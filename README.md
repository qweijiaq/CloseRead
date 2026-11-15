<p align="center">
  <img src="assets/banner.svg" alt="CloseRead — paragraph-level intensive reading of any text" width="100%">
</p>

<h1 align="center">CloseRead</h1>

<p align="center">
  <a href="https://github.com/qweijiaq/CloseRead/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/qweijiaq/CloseRead/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-2ea44f"></a>
  <a href="package.json"><img alt="node" src="https://img.shields.io/badge/node-22%2B-43853d"></a>
</p>

<p align="center">
  <strong>English</strong> · <a href="README.zh-CN.md">简体中文</a>
</p>

**CloseRead turns an English article, PDF, EPUB, MOBI, DOCX, URL or transcript into a paragraph-by-paragraph close-reading pack: Chinese translation, notes, word cards, sentence cards, exercises, and a local reading history.**

It is a reading workspace, not a chat tutor, and not a flashcard app with articles bolted on. The loop is **read → understand → keep**. There is no account, no cloud library and no analytics. A model key is only needed for your own imports: without one you can still read everything in the public library, where answers are pre-generated. The interface switches between Chinese and an English beta; generated study notes remain Chinese by default.

![CloseRead reading home](assets/screenshots/home.png)

*The reading home: continue the current article, see reading stats and recent packs.*

## Why another reading tool?

| | The usual problem | What CloseRead does |
| --- | --- | --- |
| Real text | Chat answers disappear into a thread; vocabulary apps rarely contain the article | One pack per article, with the full source, paragraph order and page or timestamp references |
| Context | Word cards lose the sentence they came from | Every card stays attached to its paragraph; the source sentence travels with it |
| Output | You still have to organise translations, notes and exercises yourself | Translation, structure map, paragraph notes, cards, cloze, comprehension and discussion are one page |
| Ownership | Progress and study records live in someone else's account | Sources, packs, reading progress and backups stay on your own disk or in your own browser |

## What a pack contains

### Read

- PDF with a text layer, EPUB, MOBI/AZW/AZW3, DOCX, HTML, TXT/Markdown, article URLs, RSS/Atom feeds and timestamped transcripts.
- Plain text and Markdown split on `# Heading`, `第 3 章`, `Chapter IV` and `【Section】`; reference lists, notes and indexes are dropped instead of being read as body text.
- A bilingual reading page: English title, Chinese title, standfirst and paragraph-by-paragraph translation.
- A reading guide before the text: article map, author stance, language threads and one concrete reading strategy.
- Paragraph notes: role, key sentence, grammar, connectors, background and a question that sends you back to the text.
- Sentence focus: large text, optional translation, pronunciation, previous/next navigation, merge/split sentence boundaries and "mark this paragraph read".
- Select 1–8 words or a whole sentence to look it up and add a card without leaving the text.
- Four font sizes, three line heights, three column widths, and light / dark / follow-system themes, remembered per browser.
- PDF imports use pdf.js with two-column detection, running-header removal and front-matter/index/reference skipping; bookmarks or headings can split long PDFs into chapters.

### Understand

- Word cards with context, Chinese gloss, etymology, roots and affixes, a derivation tree, word family, synonyms, antonyms, confusables, collocations and examples.
- Sentence cards with the full sentence, translation, chunks, pattern, grammar, substitutions and register rewrites for back-translation.
- Cloze, comprehension (fact, inference, main idea, word choice) and discussion prompts with reference answers.
- A 24-word vocabulary check that calibrates article difficulty and glossing; results stay in your browser.

### Keep

- Paragraph annotations, favourite cards and a "known" state that survives paragraph edits.
- Three English sentences after reading, with optional editor feedback and separately stored revisions.
- Reading progress per paragraph, a reading passport with a locally generated 3:4 share card, achievements, and a 12-week activity calendar.
- A weekly review of articles finished, words read, writing output and study days, with a Markdown report export.
- Full-article audio and sentence-by-sentence shadowing with local recording. Audio can use macOS `say`, the browser, or a configured neural TTS provider.

![Reading passport](assets/screenshots/growth.png)

*The reading passport, weekly review and achievements are derived from existing reading records.*

### Export

- Interactive HTML, EPUB, PDF (comfortable or compact) and PNG (single image or page-by-page ZIP).
- Anki CSV, standalone pack Markdown, and Markdown notes containing annotations, sentence cards and vocabulary.
- MOBI when Calibre is installed; PDF/PNG rendering uses local Chrome.
- A device-migration file with the library, imported sources, packs, reading progress, notes and settings; import it on another phone or computer.

![CloseRead reader](assets/screenshots/reader.png)

*The article, translation, paragraph note and structure map are one continuous reading surface.*

## Install from source

CloseRead is **source-only** today: there is no npm package and no signed installer. You need:

- **Node.js 22+**
- **pnpm** (the repository pins `pnpm@11.9.0` via `packageManager`)
- Runs on macOS, Linux and Windows
- Optional: Chrome for PDF/PNG export, Calibre for MOBI export, macOS `say` for offline audio

```bash
git clone https://github.com/qweijiaq/CloseRead.git
cd CloseRead
pnpm install
pnpm dev demo
pnpm dev review
```

`demo` builds the bundled sample article into a pack and writes it under `packs/`. `review` starts the local server at <http://127.0.0.1:4317>.

To import your own material, use the import panel in the app or the CLI:

```bash
pnpm dev add ./article.pdf --build --open
pnpm dev add ./book.epub --build
pnpm dev add https://example.com/article --build --open
pnpm dev add --clipboard --build
```

Pasted text and web articles can optionally run a **clean-text** pass that removes navigation, cookie notices, subscribe prompts, related links and footers. It only drops whole blocks; it never rewrites the article. Use `--no-ai-clean` to keep the raw extraction. PDF and EPUB imports skip this pass so page references and book structure stay intact.

From any article page, install the local bookmarklet at `/bookmarklet` to open the import form with the current URL filled in.

### Desktop app

A thin Electron shell is included. It is not a signed or notarised release:

```bash
pnpm desktop              # run from source
pnpm desktop:pack         # unpacked app in desktop-dist/
pnpm desktop:build:mac    # unsigned macOS dmg
pnpm desktop:build:win    # Windows NSIS; run on Windows
```

The desktop app keeps data under Electron's `userData` directory. Open **Settings → Data & packs** to see the exact paths. Packaging notes are in [desktop/README.md](desktop/README.md).

## Models and audio

A model key is needed to import your own material. Without one the heuristic pipeline only proposes candidate words: it does **not** produce Chinese paragraph translations. Reading the public library needs no key, because those packs ship with answers already generated. TTS is separate and optional.

With a key, you can use DeepSeek, OpenAI-compatible endpoints, Anthropic, Gemini, Qwen/DashScope, GLM/Zhipu, xAI, Moonshot, OpenCode Zen, OpenCode Go or OpenDesign. Configure it in the import panel's **Model settings**, or through environment variables such as `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `DASHSCOPE_API_KEY` or `GLM_API_KEY`. Keys stored in the app live in `data/llm.json`.

TTS is separate and optional. Supported providers are macOS system voices, Microsoft Edge online voices, Alibaba Cloud Bailian `qwen3-tts-flash`, GLM-TTS, Gemini TTS, MiniMax, ElevenLabs and OpenAI-compatible `/audio/speech` endpoints.

## Your data

`pnpm dev` keeps everything in two folders under the repository:

```text
data/
  store.json              library, packs, card state, outputs, preferences
  store.json.bak          last good library file
  store.json.corrupt-*    an unreadable file is moved aside, not overwritten
  backups/                daily library snapshots, 7 kept
  resources/              one JSON file per imported source
  trash/                  deleted packs and resources
  llm.json, tts.json      provider settings and API keys
  cache/                  dictionary, translation and model caches
packs/<id>/
  pack.json, meta.json, pack.md, notes.md, anki.csv, index.html
  reading.json            paragraph progress and annotations
```

Set `LEARN_DATA_DIR` and `LEARN_PACKS_DIR` to move both folders, for example when running the desktop shell from a terminal.

CloseRead writes atomically and keeps the last good library, but local mode is a single-user app. **Run one server per data directory.** Two servers writing to the same `store.json` can overwrite each other.

### Where data lives when deployed publicly

Setting `LEARN_PUBLIC_HOST` changes the storage model completely:

```text
the visitor's browser (IndexedDB)
  store.json, packs/<id>/*, reading progress, notes, settings

the server
  data/                  demo content + visit counters (a few tens of KB)
  /tmp/closeread-run/    scratch workspace, wiped on every process start
```

The server keeps no articles; after a restart nothing is left there and the browser pushes its copy back on the next visit. Use **Settings → device migration** to move a workspace to another device. See [DEPLOY.md](DEPLOY.md).

### Backup and restore

The automatic daily snapshots cover `store.json` only. For a portable copy that includes sources, packs, `reading.json`, cached audio and quotes, use **Settings → device migration** or:

```bash
pnpm dev backup                  # data/backups/library-<timestamp>.json
pnpm dev restore <file> --force  # stop the server first
```

Restore keeps a `store.json.pre-restore-<timestamp>` copy and remaps pack directories under the current `LEARN_PACKS_DIR`. Deleting a pack or source moves it to `data/trash/` first; **Settings → Trash** restores it or deletes it permanently.

## Privacy

CloseRead has no accounts, telemetry, analytics, ads or cloud sync. It makes network requests only for things you ask it to do:

- **URL/RSS import** fetches the page directly.
- **Model notes and translations** send selected article text to the provider you configure.
- **Without a model key**, word and short-text lookups use `api.dictionaryapi.dev`, `api.datamuse.com`, `dict.youdao.com` and `api.mymemory.translated.net`.
- **Cloud TTS** sends the text to the voice provider you choose; local system voices do not.
- **Phone access** serves the app over plain HTTP on your LAN, protected by a random token in an HttpOnly cookie. Use it only on a trusted network. A public deployment is opened directly on the phone; no toggle is needed.

In local mode, keys in `data/llm.json` and `data/tts.json` are stored as plain JSON with owner-only permissions where the OS supports it. In a public deployment they live only in the visitor's browser, encrypted with `LEARN_SECRET`. Backups and exported packs are unencrypted copies of your reading material.

The local server binds to `127.0.0.1` and has no login. Do not expose it directly to the public internet; a public deployment goes through the reverse proxy described in [DEPLOY.md](DEPLOY.md).

## Export at a glance

| Output | What it is for |
| --- | --- |
| HTML | Standalone reading page with the pack's styling |
| EPUB | Reflowable book for e-readers |
| PDF | Printable pack, comfortable or compact layout |
| PNG | A single long image, or one image per page in a ZIP |
| MOBI | Kindle, when Calibre is installed |
| Anki CSV | Import cards into Anki |
| Markdown | Standalone pack or reading notes for Obsidian and other editors |
| Weekly report | Markdown summary of the last seven days |
| Backup JSON | Full archive for moving or restoring the workspace |

The pack folder also keeps `pack.json`, `meta.json`, `pack.md`, `notes.md`, `anki.csv` and `index.html`, so a pack can be inspected or moved without the app. `meta.json` records the input hash, mode, provider/model, prompt version, timestamp and warnings, but no API keys.

## Phone access

The main server stays on `127.0.0.1`. To read on a phone or tablet on the same Wi-Fi:

- Open the **Phone** panel and choose **Enable phone access**, or run `pnpm dev review --lan`.
- Scan the QR code, or open the token link shown in the panel. The QR code is generated locally.
- The token is stored in an HttpOnly cookie and removed from the address bar. Phone access uses a separate random LAN port and can be closed at any time.
- Phones can read, annotate, collect words and sentences, write outputs. Importing, deleting, rebuilding packs and changing model/TTS settings stay on the computer.
- Add CloseRead to the home screen for a standalone window. The local server is HTTP, not HTTPS; check the OS firewall and router AP isolation if the phone cannot connect.
- On a public deployment just open the site on the phone; there is no toggle. The article stays in that phone's browser, so add it to the home screen to avoid the system clearing site data after long periods of disuse.

<p align="center">
  <img src="assets/screenshots/reader-dark.png" width="82%" alt="CloseRead dark reading mode">
</p>

<p align="center">
  <img src="assets/screenshots/mobile.png" width="30%" alt="CloseRead on a phone">
</p>

## Public deployment (no sign-up)

Setting `LEARN_PUBLIC_HOST` turns on public mode. There is no account system: every browser gets an anonymous cookie, reads the shared demo, and gets its own workspace on the first import or key save.

- Every visitor's articles, items, reading progress and notes live in their own browser (IndexedDB). The server keeps only an in-process scratch workspace and wipes it on every start.
- The server just serves the page, compiles what you import, and counts visitors. There is no user data to back up, prune or migrate.
- After each write the browser pulls the changed files and stores them; after a server restart it pushes them back on the next visit.
- Provider keys stay on the device and are only passed along with your own request; nothing is written to disk.
- The sidebar shows how many people have used the site and how many are online, served by `GET /api/public/stats`; bots are excluded.
- Settings → device migration exports the whole workspace to one file and imports it on another device.
- `?owner=<LEARN_OWNER_KEY>` pins your browser to a stable workspace.

See [DEPLOY.md](DEPLOY.md) for the full walkthrough.

## CLI

| Command | Purpose |
| --- | --- |
| `pnpm dev add <file-or-url>` | Import a PDF, EPUB, MOBI, DOCX, URL, text or transcript |
| `pnpm dev build <id\|latest>` | Build a pack from an imported resource |
| `pnpm dev review` | Start the local reading UI |
| `pnpm dev list` | List imported resources |
| `pnpm dev doctor` | Check the environment and data folders |
| `pnpm dev export <id\|latest>` | Export the pack's Anki CSV |
| `pnpm dev audio <id\|latest>` | Generate audio with macOS `say` |
| `pnpm dev resplit <id> <file>` | Re-parse a resource into articles |
| `pnpm dev backup` / `restore` | Create or restore a full data archive |
| `pnpm dev guests` | Inspect the process's scratch workspaces (diagnostics) |
| `pnpm dev demo` | Run the full pipeline on the bundled sample |

Run `pnpm dev --help` for build options such as `--no-llm`, `--limit`, `--style`, `--audio` and `--no-source`.

## Limitations

- No OCR for scanned PDFs.
- DRM-protected EPUB, MOBI and AZW files cannot be decrypted; use a DRM-free copy.
- Paywalls, login walls and bot checks are not bypassed.
- Video/audio transcription is not built in; bring a transcript.
- Heuristic Chinese definitions are dictionary or machine-translation glosses, not context-aware paraphrase. Model mode is better at sense-level Chinese.
- The app is optimised for one reader on one machine. There is no multi-user login, file lock or cloud sync.
- Desktop builds are unsigned, and there is no npm package or auto-updater yet.
- Copyright: use CloseRead for personal study. Do not redistribute packs that contain full source text.

## Development

```bash
pnpm typecheck
pnpm lint            # tsc with noUnusedLocals / noUnusedParameters
pnpm format:check    # whitespace, newline and tab check
pnpm test            # unit/integration suite via Node's test runner
pnpm test:e2e        # Chrome flow: import, read, settings, export
```

Tests use Node's built-in test runner through `tsx`. `pnpm test:e2e` uses installed Chrome or `CHROME_PATH`. The CLI runs from source; there is no separate build step.

Layout: `src/ingest` parses sources, `src/analyze` builds the study layer, `src/pack` renders and exports packs, `src/review` serves the local UI, and `desktop/` contains the Electron shell. Agent/CLI notes are in [AGENTS.md](AGENTS.md).

## Contributing

Issues, bug reports and pull requests are welcome at <https://github.com/qweijiaq/CloseRead>. If you find the project useful, starring the repository or sharing a pack you made is the easiest way to help.

## License

MIT
