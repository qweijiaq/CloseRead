<p align="center">
  <img src="assets/banner.svg" alt="CloseRead — paragraph-level intensive reading of any text" width="100%">
</p>

<h1 align="center">CloseRead</h1>

<p align="center">
  <a href="https://github.com/qweijiaq/CloseRead/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/qweijiaq/CloseRead/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-2ea44f"></a>
</p>

<p align="center">
  <strong>English</strong> · <a href="README.zh-CN.md">简体中文</a> · <a href="https://qweijiaq.github.io/CloseRead/">Live demo</a>
</p>

**CloseRead turns a PDF, EPUB, MOBI, DOCX, article URL, text file or talk transcript into a paragraph-by-paragraph intensive reading pack: translation, notes, word cards, sentence cards and a local review library.**

It is not a chat tutor, and it is not a flashcard app that happens to contain articles. The loop is **read → understand → collect → briefly review**. The interface can switch between Chinese and an English beta; generated study notes remain Chinese.

![CloseRead intensive reading workspace](assets/reader.png)

*Actual UI: article head, paragraph translation, intensive-reading notes and collapsed word cards.*

## Why not ChatGPT / a vocabulary app?

| | ChatGPT | Vocabulary app | CloseRead |
| --- | --- | --- | --- |
| Real article | Can read it, but you re-prompt every time | Usually no real article | PDF / EPUB / MOBI / DOCX / URL / text / transcript |
| Structured output | You have to organise it yourself | Word list only | Paragraph translations, notes, grammar, word cards, sentence cards |
| Keep the context | Stays in the chat | Cards lose the article | Cards stay attached to their paragraph |
| Review | No built-in queue | Yes | FSRS queue for words and sentences, plus Anki CSV |
| Where it lives | Cloud account | Usually cloud | Sources, packs, progress and library stay on disk |

## Quick start

Requires **Node.js 22+** and **pnpm 10+** (the repo pins pnpm 11.9 via `packageManager`).

```bash
pnpm install
pnpm dev demo          # build the sample article into a pack
pnpm dev review        # open the local reading UI at http://127.0.0.1:4317
```

`demo` runs the full pipeline on `samples/sample-article.md`: it builds a pack under `packs/`, adds the items to the review library, and generates audio with macOS `say` when available. `review` opens the **Today** reading dashboard; **Review** is a separate flashcard tab.

Add your own material:

```bash
pnpm dev add ./article.pdf
pnpm dev add ./book.epub
pnpm dev add https://example.com/article --build --open
pnpm dev add --clipboard --build
```

From any article page, you can install the local bookmarklet at `/bookmarklet`; it opens the import form with the current URL filled in.

CloseRead is currently **source-only**: there is no npm package or signed installer release yet. A thin Electron shell is included for a local desktop app:

```bash
pnpm desktop        # run the desktop shell from source
pnpm desktop:pack   # build an unpacked app in desktop-dist/
pnpm desktop:build:mac  # unsigned macOS dmg
pnpm desktop:build:win  # Windows NSIS; run on Windows
```

See [desktop/README.md](desktop/README.md) for packaging notes. A read-only static demo lives in [`demo/index.html`](demo/index.html); the included Pages workflow can publish it. The reading dashboard and pack header also have an `EN` toggle for the English UI beta.

## Where your data lives

`pnpm dev` keeps the library in `data/` and packs in `packs/` under the repository. The desktop app uses the OS app-data directory instead: `~/Library/Application Support/closeread/` on macOS, `%APPDATA%\closeread` on Windows, and `~/.config/closeread` on Linux. Set `LEARN_DATA_DIR` and `LEARN_PACKS_DIR` to point both at the same folder; the desktop app honors them when launched from a shell (for example `LEARN_DATA_DIR=... pnpm desktop`).

The library is a single `store.json` plus one JSON file per imported resource. CloseRead writes it atomically and keeps:

- `store.json.bak` — the last good version;
- `data/backups/store-YYYY-MM-DD.json` — one snapshot per day, seven kept;
- `store.json.corrupt-<timestamp>` — an unreadable file is moved aside and shown as a banner instead of being overwritten.

To restore, stop the server and copy the chosen snapshot over `store.json`. The automatic daily snapshots cover the library store only. The portable `pnpm dev backup` archive includes the store, imported resources, pack folders (including `reading.json` and cached audio) and the local quote wall when present; the `data/lab/audio/` cache is not included because it can be regenerated.

For a portable copy of the library, use:

```bash
pnpm dev backup                  # writes data/backups/library-<timestamp>.json
pnpm dev restore <file> --force  # stop the server first
```

Manual restores keep a `store.json.pre-restore-<timestamp>` copy and only overwrite the records included in the backup. Pack directories are remapped under the current `LEARN_PACKS_DIR`. The **成长** page also has **下载完整备份**, which writes the same archive through the local server.

Deleting a pack or a resource moves it to `data/trash/` first; open **设置 → 回收站** to restore it or delete it permanently. Trash entries keep pack records, item review state and uploaded files.

## Phone access

The main server binds to `127.0.0.1`. To read or review on a phone or tablet on the same Wi-Fi:

- Open the **手机** panel in the app and choose **开启手机访问**, or run `pnpm dev review --lan`.
- Scan the QR code in the panel with the phone camera to open the token link. The QR is generated locally and never sent to a third-party service.
- Use “Add to Home Screen” on the phone or install CloseRead from the desktop browser to open it as a standalone app; data and tokens stay local.
- Open the token link once on the phone. The token is stored in an HttpOnly cookie, stripped from the address bar, and used for the app's relative links and API calls.
- The phone token is a learning token: it can read, review, collect words/sentences, write outputs and use the practice lab. Importing, deleting data, rebuilding packs and changing model/TTS settings stay on the computer.
- Phone access uses a separate random LAN port and requires the token for every request. Closing it stops that listener; a new token is issued on the next enable unless `LEARN_ACCESS_TOKEN` pins one.
- Use a trusted network only: the LAN connection is HTTP, not HTTPS. Do not enable it on public Wi-Fi. If the phone cannot connect, check the OS firewall and the router's AP isolation.
- `LEARN_ACCESS_TOKEN` can pin a token for automation; otherwise a new token is generated each time phone access is enabled.

## A calmer workspace

The app now has two primary modes: **Reading** and **Vocabulary**. The desktop sidebar and mobile bottom bar expose only those two actions; practice, progress, weekly review and writing output move behind **More**, and the word web has been removed from the interface. The reading home only continues reading, imports material and lists articles; the vocabulary home leads with today's review. The default reading view is `/read/:id`: select a word or sentence to add it directly; the older `/pack/:id` remains as **tool mode** inside “more reading tools”.

![CloseRead dashboard](docs/review/ui-home.png)

![Integrated reader](docs/review/ui-reader.png)


### AI cleanup on import

Pasted text and web articles can be cleaned before they enter the library. When a model key is configured, the import form's **AI 清理正文** option is on by default. The model receives numbered blocks and may only **drop boilerplate blocks** (navigation, cookie notices, newsletter/subscribe prompts, related links, ads, footers); it never rewrites the article. If the model fails or tries to remove too much, the original text is kept and the resource shows a warning.

Use `pnpm dev add --no-ai-clean` to keep raw extracted text. PDF/EPUB imports intentionally skip this pass for now so page references and book structure are not destroyed.

![AI cleanup on import](docs/review/import-ai-clean.png)


### Vocabulary that you can actually study

The library is now a study surface, not a list. Group words by **new / due / leech / known**, filter by source, wordbook or CEFR, and sort by due date, recency, alphabet, CEFR, frequency or lapse count. Open a full word card (contexts, collocations, examples, relations, etymology, notes), and start a daily session with **10 new words + due reviews** by default. The review queue is the single study surface; it shares the same FSRS scheduler as the rest of the app.

Built-in wordbooks can be added from **词书库**: CET-4 (4,544), CET-6 (3,991), TOEFL (10,367) and a full IELTS dataset (7,298). They are seeded into the same FSRS library and can be filtered/studied like your own words. Sources and licenses are documented in [src/wordbooks/ATTRIBUTION.md](src/wordbooks/ATTRIBUTION.md): CET/TOEFL data is BSD-3-Clause from KyleBing/english-vocabulary; IELTS comes from CC BY 4.0 Word Atlas; phonetics come from MIT-licensed ECDICT. The bundled IELTS list is a 7,298-entry dataset, not an official list.

The library now has a **daily budget**: due reviews and new words default to 10 each, adjustable in Settings, while wordbook imports sit in a **backlog** until a day's budget releases them. The review page and both "背词" buttons share one queue; adding 10,000 TOEFL words no longer makes the due badge 10,000.

Words without a real example are marked **无例句** and are skipped by 练习. Open the quality strip in 词库 to generate examples in batches of 5 or 10; each word makes one model call, so the batch is explicit rather than a hidden 10,000-word job.

![Vocabulary library](docs/review/vocab-library.png)

### More: practice

Open `/lab` (or **练习** in the sidebar). Three word-based missions draw from your **learned vocabulary**, not from a selected article. Pick a scope (all / new / due / leech / favorites); the tasks use target words with real example sentences.

- **听写诊所**: listen to a vocabulary example, type it, compare word by word.
- **影子跟读**: listen, shadow, record and play back locally; audio never leaves the browser.
- **生活例句**: put one target word into work, travel, hobby or daily life with AI.

Only 生活例句 needs a model key; dictation and shadowing work without one. Generated examples are cached under `data/cache/lab/`; audio is cached under `data/lab/audio/`.

![Learning Lab](docs/review/lab.png)


1. **Import** a real source. A bookmarked PDF or an EPUB is split into articles; directory pages, ads, cartoons and digest pages can be filtered out.
2. **Generate** one article. You get a bilingual reading page, paragraph translations, a structure map and intensive-reading notes.
3. **Read** paragraph by paragraph. Select a word or a whole sentence to see its context and add a card without leaving the text.
4. **Go deeper** with etymology, word-family expansion, sentence focus, AI theater, micro-stories and a 60-second warm-up.
5. **Review** only what you chose to keep. Core cards enter FSRS; bonus cards stay in the pack. Export to Anki or Markdown when you want.

## Pack output

Each pack is a folder you can keep, inspect or move:

`pack.json` · `meta.json` · `pack.md` · `anki.csv` · `index.html` · `reading.json`

`meta.json` records the input hash, mode, provider/model, prompt version, timestamp and build warnings. It contains no API keys, so a later build can be compared or reproduced.

## Main features

### Read

- PDF (text layer), EPUB, MOBI/AZW/AZW3, DOCX, article URLs, RSS/Atom feeds, pasted text/Markdown and timestamped transcripts.
- English title, Chinese title, standfirst/deck and paragraph-by-paragraph translation.
- A structure map, per-paragraph notes (role, key sentence, grammar, background, reflection question) and a reading progress bar; the default reader can expand each paragraph's notes without switching to tool mode.
- Chapter navigation for books split into articles, plus select-to-analyse and local annotations from the default reader.
- Sentence-by-sentence listening from the default reader: click any sentence or “逐句听”, and the current sentence is highlighted and scrolled into view.
- A “接下来读” strip at the end of each article recommends neighbouring packs by CEFR, length, same book and reading state.
- Edit or delete a paragraph; edits re-translate the paragraph and re-sync word and sentence cards.
- Light / dark / follow-system themes and reader typography: four font sizes, three line heights and three column widths, remembered on this device.

### Understand

- Sentence focus mode with large text, optional translation, pronunciation, previous/next navigation, merge/split sentence boundaries and “mark this paragraph read”.
- Sentence cards with chunks, pattern, grammar and substitutions for back-translation.
- AI theater: a bounded three-turn interview with the author or a rebuttal challenge, with a recap of expressions used and missed.
- Micro-stories and 60-second sentence/word puzzles built from the cards already in the pack.

### Collect

- Select 1–8 words or a complete sentence; the card stays attached to the paragraph it came from.
- Contextual translation and a short annotation appear before you add anything.
- Word cards include etymology, roots and affixes, a derivation tree, word family, synonyms, antonyms, confusables, collocations and examples.
- Edit a card's sense, definitions, mnemonic, collocations and notes from the vocabulary detail drawer; the change follows the card into its pack.
- Sentence cards keep the full source sentence, translation, chunks and pattern.

### Review

- FSRS scheduling for word and sentence cards, with an adjustable target retention (85–95%).
- Vocabulary review uses a flashcard: the front shows the word, pronunciation and source sentence; tap the card or press Space to flip. The back shows meanings, collocations, examples and the source, followed by Again / Hard / Good / Easy (keys 1–4).
- Choose 5/10/15/20/30/50 new words per day; enable “AI 选相关词” when starting a session to pick a thematically related set from due/new words and cache it for the day, with a source/context fallback when no model key is configured.
- First-attempt accuracy is shown separately so repeated reviews do not inflate it.
- A 7-day due forecast sits above the queue; the last rating can be undone with the button or `U` / `Cmd/Ctrl+Z`; cards with 4+ lapses are flagged as leeches with a pause/rewrite hint.
- Core/bonus split: core cards enter the queue; bonus cards stay in the pack.
- Select any word or sentence cards in the library to start a custom review round, or bulk suspend, mark known, restore and favourite them.
- Paste or upload a CSV/TXT list of words you already know; matching cards are marked known, and no new cards are created.
- Anki CSV, Markdown for Obsidian, and HTML/EPUB/PDF/PNG export. MOBI export needs Calibre.

### More: writing

- Write three English sentences after reading; drafts are kept in the local output history.
- Ask the editor for feedback, then revise and save another version. Each revision is stored separately and can get its own editor reply, so you can see what changed.

### More: stats and experiments

- A 24-word vocabulary check seeds your level and known words, so the first build is not a cold start.
- Achievements and a 12-week reading calendar (streaks, reviews, outputs, night-owl/early-bird) derived from existing records; no extra data is stored.
- AI usage detective: from a review card, generate a short scene and three sentences where only one uses the target word naturally; get a Chinese explanation and a combo streak. Requires an LLM key.
- **成长** includes the reading passport and a weekly review (last 7 days: articles finished, review accuracy, missed words and next-week focus), with a Markdown report export; the insights page also shows a 14-day review curve, retention by source/CEFR, and weekly article/study-day goal progress.
- Reading passport with a 3:4 share card.
- Full-article audio and sentence-by-sentence shadowing with local recording.
- Audio can use macOS `say`, browser speech, or a configured neural TTS provider (Edge online, GLM-TTS, Gemini TTS, MiniMax, ElevenLabs or an OpenAI-compatible endpoint).

## Inputs and outputs

`PDF` `EPUB` `MOBI` `AZW/AZW3` `DOCX` `URL` `RSS/Atom` `Text` `SRT/VTT` · `HTML reader` `Markdown` `Anki CSV` `EPUB` `PDF` `PNG` `MOBI`

| | |
| --- | --- |
| **Input** | Text-layer PDFs, EPUB/MOBI/AZW/AZW3, DOCX, article URLs, RSS/Atom feeds, pasted text/Markdown, talk transcripts. Feeds import their latest article. Audio/video needs a sibling transcript. |
| **Output** | Interactive HTML reader, Markdown for Obsidian/print, Anki CSV; the UI can also export EPUB, PDF, PNG and (with Calibre) MOBI. |
| **Platform** | Node 22+ on macOS, Linux or Windows. PDF/PNG export uses local Chrome; MOBI export uses Calibre when installed. |
| **Models** | No LLM key needed for heuristic mode; add a DeepSeek/OpenAI/GLM-compatible key for AI notes, translations, word expansion and selection. |
| **Audio** | Optional. macOS `say` works offline; other systems can use browser speech or configure a neural TTS endpoint. |

## Is this for you?

CloseRead is for people who want to read real English articles slowly and keep the useful parts: exam preparation, foreign-magazine reading and long-term vocabulary building. It is less useful if you want a one-click summary, do not want to configure a model key, or need scanned PDF OCR today.

## Limitations

- No OCR for scanned PDFs.
- DRM-protected EPUB, MOBI and AZW files cannot be decrypted; use a DRM-free copy.
- Paywalls, login walls and bot checks are not bypassed.
- Video/audio transcription is not built in; bring a transcript.
- Heuristic Chinese definitions are dictionary/translation glosses, not context-aware paraphrase. LLM mode gives better sense-level Chinese.
- The review server binds to `127.0.0.1` and has no authentication. Do not expose it.
- Copyright: use this for personal study. Do not redistribute packs that contain full source text.

## Development

```bash
pnpm typecheck
pnpm lint            # tsc with noUnusedLocals / noUnusedParameters
pnpm format:check    # whitespace, newline and tab check
pnpm test
pnpm test:e2e        # Chrome-driven browser flow (uses CHROME_PATH if needed)
```

Tests use Node's built-in test runner via `tsx`. `pnpm test` runs the unit/integration suite plus small Chrome smoke tests; `pnpm test:e2e` runs the seeded browser flow (import → read → settings → review/undo → diagnosis → export). Both use the installed Chrome or `CHROME_PATH`. The CLI runs from source with `tsx`; there is no separate build step. Agent/CLI integration notes live in [AGENTS.md](AGENTS.md).

## License

MIT
