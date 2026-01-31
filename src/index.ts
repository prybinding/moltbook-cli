#!/usr/bin/env node

import { Command } from "commander";
import { apiGet } from "./api.js";
import { loadApiKey } from "./auth.js";
import { fmtDate, fmtNum, mdEscape, printJson, printMarkdown, truncate } from "./format.js";

type PostsResponse = {
  success: boolean;
  posts: unknown[];
  count: number;
  has_more?: boolean;
  next_offset?: number;
};

type GenericResponse = Record<string, unknown>;

const program = new Command();
program
  .name("moltbook")
  .description("Explore Moltbook via https://www.moltbook.com/api/v1")
  .option("--json", "output raw JSON", false)
  .option("--pretty", "pretty-print JSON (only with --json)", false);

program
  .command("auth")
  .description("Auth helpers")
  .command("status")
  .description("Check your auth + claim status")
  .action(async () => {
    const opts = program.opts<{ json: boolean; pretty: boolean }>();
    const apiKey = loadApiKey();
    const data = await apiGet<any>("/agents/status", { apiKey });

    if (opts.json) {
      printJson(data, opts.pretty);
      return;
    }

    const lines: string[] = [];
    lines.push(`# Moltbook auth status`);
    lines.push("");
    lines.push(`- status: **${mdEscape(String(data?.status ?? "unknown"))}**`);
    if (data?.agent?.name) lines.push(`- agent: **${mdEscape(String(data.agent.name))}**`);
    if (data?.message) lines.push(`- message: ${mdEscape(String(data.message))}`);
    if (data?.claim_url) lines.push(`- claim_url: ${String(data.claim_url)}`);
    if (data?.hint) lines.push(`- hint: ${mdEscape(String(data.hint))}`);
    printMarkdown(lines);
  });

const posts = program.command("posts").description("Browse posts");

for (const sort of ["hot", "new", "top"] as const) {
  posts
    .command(sort)
    .description(`List ${sort} posts`)
    .option("--limit <n>", "number of posts", "10")
    .action(async (cmdOpts: { limit: string }) => {
      const opts = program.opts<{ json: boolean; pretty: boolean }>();
      const apiKey = loadApiKey();
      const limit = clampInt(cmdOpts.limit, 1, 50);
      const data = await apiGet<PostsResponse>(`/posts?sort=${sort}&limit=${limit}`, { apiKey });

      if (opts.json) {
        printJson(data, opts.pretty);
        return;
      }

      const lines: string[] = [];
      lines.push(`# Moltbook posts (${sort})`);
      lines.push("");
      lines.push(`Count: **${fmtNum(data.count)}**`);
      lines.push("");
      lines.push(`| # | title | id | score | comments | submolt | created_at |`);
      lines.push(`|---:|---|---|---:|---:|---|---|`);

      const posts = Array.isArray((data as any).posts) ? ((data as any).posts as any[]) : [];
      posts.forEach((p, i) => {
        const title = mdEscape(truncate(String(p?.title ?? ""), 80)) || "-";
        const id = mdEscape(String(p?.id ?? "-"));
        const score = fmtNum((p?.upvotes ?? 0) - (p?.downvotes ?? 0));
        const comments = fmtNum(p?.comment_count ?? 0);
        const submolt = mdEscape(String(p?.submolt?.name ?? "-"));
        const created = mdEscape(fmtDate(p?.created_at));
        lines.push(`| ${i + 1} | ${title} | ${id} | ${score} | ${comments} | ${submolt} | ${created} |`);
      });

      printMarkdown(lines);
    });
}

posts
  .command("get")
  .description("Get a post by id")
  .argument("<postId>")
  .action(async (postId: string) => {
    const opts = program.opts<{ json: boolean; pretty: boolean }>();
    const apiKey = loadApiKey();
    const data = await apiGet<any>(`/posts/${encodeURIComponent(postId)}`, { apiKey });

    if (opts.json) {
      printJson(data, opts.pretty);
      return;
    }

    const post = (data?.post ?? data) as any;
    const lines: string[] = [];
    lines.push(`# ${mdEscape(String(post?.title ?? "(no title)"))}`);
    lines.push("");
    lines.push(`- id: \`${mdEscape(String(post?.id ?? postId))}\``);
    if (post?.submolt?.name) lines.push(`- submolt: **${mdEscape(String(post.submolt.name))}**`);
    const score = (post?.upvotes ?? 0) - (post?.downvotes ?? 0);
    lines.push(`- score: **${fmtNum(score)}** (▲${fmtNum(post?.upvotes ?? 0)} / ▼${fmtNum(post?.downvotes ?? 0)})`);
    if (post?.comment_count != null) lines.push(`- comments: **${fmtNum(post.comment_count)}**`);
    if (post?.created_at) lines.push(`- created_at: ${mdEscape(fmtDate(post.created_at))}`);
    if (post?.url) lines.push(`- url: ${String(post.url)}`);
    lines.push("");

    const content = post?.content;
    if (content) {
      lines.push("## Content");
      lines.push("");
      lines.push(String(content));
    }

    printMarkdown(lines);
  });

program
  .command("comments")
  .description("Get comments for a post")
  .argument("<postId>")
  .option("--sort <top|new|controversial>", "sort order", "top")
  .option("--limit <n>", "max comments (client-side slice)", "20")
  .action(async (postId: string, cmdOpts: { sort: string; limit: string }) => {
    const opts = program.opts<{ json: boolean; pretty: boolean }>();
    const apiKey = loadApiKey();
    const sort = String(cmdOpts.sort || "top");
    const limit = clampInt(cmdOpts.limit, 1, 200);
    const data = await apiGet<any>(
      `/posts/${encodeURIComponent(postId)}/comments?sort=${encodeURIComponent(sort)}`,
      { apiKey }
    );

    // Best-effort slice when response shape is {comments:[...]}
    const anyData = data as any;
    const comments = Array.isArray(anyData?.comments) ? (anyData.comments as any[]).slice(0, limit) : [];

    if (opts.json) {
      if (anyData && Array.isArray(anyData.comments)) anyData.comments = comments;
      printJson(data, opts.pretty);
      return;
    }

    const lines: string[] = [];
    lines.push(`# Moltbook comments`);
    lines.push("");
    lines.push(`- postId: \`${mdEscape(postId)}\``);
    lines.push(`- sort: **${mdEscape(sort)}**`);
    lines.push(`- showing: **${fmtNum(comments.length)}**`);
    lines.push("");

    comments.forEach((c, i) => {
      const author = c?.author?.name ? ` (@${c.author.name})` : "";
      const score = (c?.upvotes ?? 0) - (c?.downvotes ?? 0);
      lines.push(`## ${i + 1}${mdEscape(author)}`);
      lines.push("");
      lines.push(`- id: \`${mdEscape(String(c?.id ?? "-"))}\``);
      lines.push(`- score: **${fmtNum(score)}**`);
      if (c?.created_at) lines.push(`- created_at: ${mdEscape(fmtDate(c.created_at))}`);
      lines.push("");
      if (c?.content) lines.push(String(c.content));
      lines.push("");
    });

    printMarkdown(lines);
  });

program
  .command("search")
  .description("Semantic search")
  .argument("<query>")
  .option("--type <all|posts|comments>", "search type", "all")
  .option("--limit <n>", "max results", "10")
  .action(async (query: string, cmdOpts: { type: string; limit: string }) => {
    const opts = program.opts<{ json: boolean; pretty: boolean }>();
    const apiKey = loadApiKey();
    const type = String(cmdOpts.type || "all");
    const limit = clampInt(cmdOpts.limit, 1, 50);

    const q = encodeURIComponent(query);
    const data = await apiGet<any>(
      `/search?q=${q}&type=${encodeURIComponent(type)}&limit=${limit}`,
      { apiKey }
    );

    if (opts.json) {
      printJson(data, opts.pretty);
      return;
    }

    const lines: string[] = [];
    lines.push(`# Moltbook search`);
    lines.push("");
    lines.push(`- query: **${mdEscape(query)}**`);
    lines.push(`- type: **${mdEscape(type)}**`);
    lines.push(`- count: **${fmtNum(data?.count ?? (Array.isArray(data?.results) ? data.results.length : 0))}**`);
    lines.push("");

    const results = Array.isArray(data?.results) ? (data.results as any[]).slice(0, limit) : [];
    if (results.length) {
      lines.push(`| # | type | title/content | similarity | post_id |`);
      lines.push(`|---:|---|---|---:|---|`);
      results.forEach((r, i) => {
        const rType = mdEscape(String(r?.type ?? "-"));
        const text = mdEscape(truncate(String(r?.title ?? r?.content ?? ""), 80)) || "-";
        const sim = typeof r?.similarity === "number" ? r.similarity.toFixed(2) : "-";
        const postId = mdEscape(String(r?.post_id ?? r?.id ?? "-"));
        lines.push(`| ${i + 1} | ${rType} | ${text} | ${sim} | ${postId} |`);
      });
    }

    printMarkdown(lines);
  });

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(String(err?.message || err) + "\n");
  process.exit(1);
});

function clampInt(value: string, min: number, max: number) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
