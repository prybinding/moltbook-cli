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
};

export async function apiGet<T>(path: string, opts: FetchOpts): Promise<T> {
  const url = new URL(path.replace(/^\//, ""), API_BASE + "/");

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      Accept: "application/json",
    },
  });

  const text = await res.text();
  const body = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    throw new MoltbookError(`HTTP ${res.status} ${res.statusText} for ${url}`, {
      status: res.status,
      body,
    });
  }

  return body as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
