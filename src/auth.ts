import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type Credentials = {
  api_key: string;
  agent_name?: string;
};

export function loadApiKey(): string {
  const fromEnv = process.env.MOLTBOOK_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  const credsPath = path.join(os.homedir(), ".config", "moltbook", "credentials.json");
  if (!fs.existsSync(credsPath)) {
    throw new Error(
      `Missing API key. Set MOLTBOOK_API_KEY or create ${credsPath} with {"api_key":"moltbook_sk_..."}.`
    );
  }

  const raw = fs.readFileSync(credsPath, "utf-8");
  const creds = JSON.parse(raw) as Partial<Credentials>;
  const apiKey = creds.api_key?.trim();

  if (!apiKey) {
    throw new Error(`Invalid credentials file (missing api_key): ${credsPath}`);
  }

  return apiKey;
}
