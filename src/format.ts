export function printJson(data: unknown, pretty: boolean) {
  const text = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  process.stdout.write(text + "\n");
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}
