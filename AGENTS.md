# Working with CloseRead

CloseRead is a local-first English intensive-reading tool. The CLI is the stable entry point; the local web UI is a renderer over the same pack data.

## Commands

```bash
pnpm dev add ./article.pdf --build --open
pnpm dev build latest
pnpm dev review
pnpm dev review --lan   # phone access on the LAN, token required
pnpm dev export latest
pnpm dev doctor
pnpm dev backup
pnpm dev restore <file> --force
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
```

Run commands from the repository root. The app writes user data under `data/` and packs under `packs/`; both are gitignored. The `/lab` UI lives in `src/review/lab.js` and `src/review/lab.css`; keep it in sync with the lab API. Do not edit a user's existing pack unless the task explicitly asks for it. Phone access binds a second LAN listener on a random port and requires a token; the token is learning-scoped (read, review, collect, output, lab), while import/delete/build/settings remain local. Never expose it on an untrusted network. The store is written atomically and keeps `store.json.bak` plus daily snapshots under `data/backups/`; a corrupt store is moved aside and surfaced as a warning instead of being overwritten. `pnpm dev backup` now includes pack folders, reading progress and quotes; deleted packs/resources go to `data/trash/` and can be restored from Settings.

## Stable outputs

A pack directory contains:

- `pack.json` — the complete structured pack, including optional `build` metadata and paragraph `page` values
- `meta.json` — the reproducible build fingerprint
- `pack.md` — Markdown for Obsidian/print
- `anki.csv` — Anki import
- `index.html` — the interactive reader
- `reading.json` — reading progress

The structural contract is in `src/pack/schema.ts`. When changing pack fields, update the schema, fixtures/tests, and both READMEs.

## Models and data

- The app works without an LLM key in heuristic mode.
- Keys come from environment variables or the local settings files (`data/llm.json`, `data/tts.json`, mode `0600`). Never commit keys or print them.
- Tests must not depend on a real model key. Use fixtures or local fake HTTP servers.
- Do not claim an npm package, installer, release, or online demo exists unless the corresponding artifact is actually published.

## Style

- ESM, Node 22+, TypeScript, no semicolons, single quotes, trailing commas.
- Comments explain constraints, not the next line.
- Keep the reading-first loop intact: import → understand → collect → review. Do not turn the project into a chat tutor or a generic agent workspace.
