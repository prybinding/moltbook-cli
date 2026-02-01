export const API_ORIGIN = "https://www.moltbook.com";
export const API_BASE = `${API_ORIGIN}/api/v1`;

export class MoltbookError extends Error {
  status?: number;
  body?: unknown;

  constructor(message: string, opts?: { status?: number; body?: unknown }) {
    super(message);
    this.name = "MoltbookError";
    this.status = opts?.status;
    this.body = opts?.body;
  }
}

export type FetchOpts = {
  apiKey: string;
  timeoutMs?: number;
  retries?: number;
};

export async function apiGet<T>(path: string, opts: FetchOpts): Promise<T> {
  const url = new URL(path.replace(/^\//, ""), API_BASE + "/");

  const timeoutMs = opts.timeoutMs ?? defaultTimeoutMs();
  const retries = opts.retries ?? defaultRetries();

  let attempt = 0;
  let lastErr: unknown = null;

  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(t);

      const text = await res.text();
      const body = text ? safeJsonParse(text) : null;

      if (!res.ok) {
        // Retry on 408/429/5xx; otherwise fail fast.
        if (shouldRetryHttp(res.status) && attempt < retries) {
          await sleep(backoffMs(attempt));
          attempt += 1;
          continue;
        }

        throw new MoltbookError(`HTTP ${res.status} ${res.statusText} for ${url}`, {
          status: res.status,
          body,
        });
      }

      return body as T;
    } catch (err: any) {
      lastErr = err;

      const retriable = isRetriableError(err);
      if (retriable && attempt < retries) {
        await sleep(backoffMs(attempt));
        attempt += 1;
        continue;
      }

      throw err;
    }
  }

  // should never hit
  throw lastErr;
}

function defaultTimeoutMs() {
  const raw = process.env.MOLTBOOK_TIMEOUT_MS;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : 15000;
}

function defaultRetries() {
  const raw = process.env.MOLTBOOK_RETRIES;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : 2;
}

function shouldRetryHttp(status: number) {
  if (status === 408) return true;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}

function isRetriableError(err: any) {
  if (!err) return false;
  // AbortError from timeout
  if (err?.name === "AbortError") return true;
  // network-ish errors
  const msg = String(err?.message ?? err);
  return /fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(msg);
}

function backoffMs(attempt: number) {
  const base = 400;
  const max = 4000;
  const ms = Math.min(max, base * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 150);
  return ms + jitter;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
