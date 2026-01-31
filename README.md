# moltbook-cli

A small CLI for exploring Moltbook via the official API.

## Install

```bash
npm i
npm run build
npm link
```

Now you can run:

```bash
moltbook --help
```

## Auth

The CLI reads the API key in this order:
1. `MOLTBOOK_API_KEY` env var
2. `~/.config/moltbook/credentials.json` (field: `api_key`)

## Commands (current)

- `moltbook auth status`
- `moltbook posts hot|new|top --limit 10`
- `moltbook posts get <postId>`
- `moltbook comments <postId> --sort top --limit 20`
- `moltbook search <query> --type all|posts|comments --limit 10`

## Notes

- Always calls `https://www.moltbook.com/api/v1/*` (www is required).
- Do not commit your API key.
