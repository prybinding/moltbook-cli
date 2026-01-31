#!/usr/bin/env node

import { Command } from "commander";
import { apiGet } from "./api.js";
import { loadApiKey } from "./auth.js";
import { printJson } from "./format.js";

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
  .option("--pretty", "pretty-print JSON", false);

program
  .command("auth")
  .description("Auth helpers")
  .command("status")
  .description("Check your auth + claim status")
  .action(async () => {
    const opts = program.opts<{ pretty: boolean }>();
    const apiKey = loadApiKey();
    const data = await apiGet<GenericResponse>("/agents/status", { apiKey });
    printJson(data, opts.pretty);
  });

const posts = program.command("posts").description("Browse posts");

for (const sort of ["hot", "new", "top"] as const) {
  posts
    .command(sort)
    .description(`List ${sort} posts`)
    .option("--limit <n>", "number of posts", "10")
    .action(async (cmdOpts: { limit: string }) => {
      const opts = program.opts<{ pretty: boolean }>();
      const apiKey = loadApiKey();
      const limit = clampInt(cmdOpts.limit, 1, 50);
      const data = await apiGet<PostsResponse>(`/posts?sort=${sort}&limit=${limit}`, { apiKey });
      printJson(data, opts.pretty);
    });
}

posts
  .command("get")
  .description("Get a post by id")
  .argument("<postId>")
  .action(async (postId: string) => {
    const opts = program.opts<{ pretty: boolean }>();
    const apiKey = loadApiKey();
    const data = await apiGet<GenericResponse>(`/posts/${encodeURIComponent(postId)}`, { apiKey });
    printJson(data, opts.pretty);
  });

program
  .command("comments")
  .description("Get comments for a post")
  .argument("<postId>")
  .option("--sort <top|new|controversial>", "sort order", "top")
  .option("--limit <n>", "max comments (client-side slice)", "20")
  .action(async (postId: string, cmdOpts: { sort: string; limit: string }) => {
    const opts = program.opts<{ pretty: boolean }>();
    const apiKey = loadApiKey();
    const sort = String(cmdOpts.sort || "top");
    const limit = clampInt(cmdOpts.limit, 1, 200);
    const data = await apiGet<GenericResponse>(
      `/posts/${encodeURIComponent(postId)}/comments?sort=${encodeURIComponent(sort)}`,
      { apiKey }
    );

    // Best-effort slice when response shape is {comments:[...]}
    const anyData = data as any;
    if (anyData && Array.isArray(anyData.comments)) {
      anyData.comments = anyData.comments.slice(0, limit);
    }

    printJson(data, opts.pretty);
  });

program
  .command("search")
  .description("Semantic search")
  .argument("<query>")
  .option("--type <all|posts|comments>", "search type", "all")
  .option("--limit <n>", "max results", "10")
  .action(async (query: string, cmdOpts: { type: string; limit: string }) => {
    const opts = program.opts<{ pretty: boolean }>();
    const apiKey = loadApiKey();
    const type = String(cmdOpts.type || "all");
    const limit = clampInt(cmdOpts.limit, 1, 50);

    const q = encodeURIComponent(query);
    const data = await apiGet<GenericResponse>(`/search?q=${q}&type=${encodeURIComponent(type)}&limit=${limit}`,
      { apiKey }
    );
    printJson(data, opts.pretty);
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
