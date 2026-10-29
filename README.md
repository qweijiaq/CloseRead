# 细读 · CloseRead

[![CI](https://github.com/qweijiaq/CloseRead/actions/workflows/ci.yml/badge.svg)](https://github.com/qweijiaq/CloseRead/actions/workflows/ci.yml)

细读（CloseRead）是一个本地优先的英语精读工具。它把一篇英文文章拆成自然段，生成逐段译文、精读笔记、重点词卡和句子卡，并把值得复习的内容留进词库。它不是聊天外教，也不是背单词 App，只关心一件事：把一篇好文章真正读透。

Read authentic English deeply, and keep what you learn with a small spaced-repetition library.

Feed it a PDF, EPUB, MOBI, an article URL, a text file, or a transcript from a talk. It extracts the vocabulary, collocations and contexts that are actually worth learning, builds a paragraph-by-paragraph reading workspace, and turns the words you meet into review cards for later.

This is not a chat tutor, and it is not a flashcard app that happens to contain articles. The main loop is **read → understand → collect → briefly review**; review is the closing step, not the reason to open the app.

## Quick start

```bash
pnpm install
pnpm dev demo
pnpm dev review
```

`demo` runs the whole pipeline on `samples/sample-article.md`, produces a pack under `packs/`, generates audio with macOS `say` when available, and adds the items to the review library. `review` starts a local UI at `http://127.0.0.1:4317`; the **今日** tab is a reading dashboard, while **复习** is a separate tab for the flashcard queue.

To add your own material:

```bash
pnpm dev add ./article.pdf                 # PDF with a text layer
pnpm dev add ./book.epub                   # EPUB
pnpm dev add ./book.mobi                   # MOBI, AZW or AZW3 (including KF8)
pnpm dev add https://example.com/article   # article URL (bare domains work too)
pnpm dev add                               # paste text, then press Ctrl-D
pbpaste | pnpm dev add -                   # read pasted text from stdin
pnpm dev add --clipboard                   # read the macOS clipboard
pnpm dev add --text "short passage"        # inline text
```

`add` prints a preview of the extracted text, the word and paragraph counts, and warnings when extraction looks thin or when a PDF has pages without text. Add `--build` to ingest and build the pack in one step:

```bash
pnpm dev add https://example.com/article --build --open
```

## Commands

```bash
pnpm dev add ./article.pdf          # ingest a PDF, EPUB, MOBI, URL, text, or transcript
pnpm dev add --clipboard --build    # ingest from the clipboard and build immediately
pnpm dev build latest               # analyse and build a learning pack
pnpm dev resplit <id> <file>        # re-parse an existing issue into its articles
pnpm dev build <resource-id> --limit 25 --audio
pnpm dev list                       # list ingested resources
pnpm dev items --due                # list due review items
pnpm dev review --open              # start the review UI and open it
pnpm dev export latest --out out.csv
pnpm dev audio latest               # add TTS audio to an existing pack
pnpm dev style list                 # list writing-style profiles
pnpm dev style add <name> <source>  # distill a style card from an EPUB/PDF/text
pnpm dev style merge [names...]     # synthesize styles/unified.md (default)
pnpm dev doctor                     # environment and library check
```

Add options:

| Option | Meaning |
| --- | --- |
| `--text "<text>"` | Ingest inline text instead of a file or URL |
| `--clipboard` | Read the macOS clipboard; a lone URL is fetched, otherwise the text is ingested |
| `--title <name>` | Override the title derived from the source |
| `--build` | Build the pack immediately after ingesting |
| `--open` | Open the pack when used with `--build` |

Build options:

| Option | Meaning |
| --- | --- |
| `--limit <n\|auto>` | Item count. `auto` (default) uses article length, CEFR, your known-word ratio and pack feedback to suggest 4–20 items; an explicit number forces that count |
| `--no-llm` | Force heuristic mode even when an API key exists |
| `--no-zh` | Skip the free Chinese definitions |
| `--zh-context` | Also translate context sentences (uses more translation quota) |
| `--style <name>` | Follow a style guide from `styles/<name>.md` (or an explicit path) |
| `--no-source` | Leave the full source text out of the pack |
| `--audio` | Generate TTS audio with macOS `say` |
| `--out <dir>` | Custom pack output directory |
| `--open` | Open the generated HTML |

## What a pack contains

```text
packs/<resource-id>/
  index.html      paragraph-by-paragraph reader, inline vocabulary cards, exercises with answers, audio
  pack.md         Markdown version for Obsidian/print
  pack.json       structured data used by every renderer
  reading.json    per-paragraph reading progress and completion state
  anki.csv        import into Anki
  audio/          summary, word list and per-item pronunciation (optional)
  notes.md        extraction notes and fallbacks
```

The reader puts each source paragraph next to its Chinese translation. Vocabulary cards for a paragraph are collapsed under **本段重点词 N 个**, so the first pass stays focused on the text; the vocabulary table links back to the paragraph, and discussion questions include reference answers. Each paragraph has a numbered marker for **已读**, and the hero has a reading progress bar and **精读完成** button. Progress is stored in `reading.json` next to the pack and is rendered by the server with the current template, so older packs pick up new reading controls without a rebuild. The layout is responsive: two columns on desktop, stacked on mobile. The home dashboard shows cumulative reading stats (articles finished, paragraphs read, sentence cards, due count) and recommends an in-progress article first, then a built-but-unread pack, before suggesting an unbuilt article from the current resource.

**逐段精读笔记** add a paragraph-level annotation card: the paragraph's role (背景 / 论点 / 例证 / 转折 / 结论), a Chinese summary, one key sentence with a structural note, a grammar point, discourse connectors, optional background, and a reflection question. New packs generate these notes during the reading pass; existing packs get a **补齐导读与笔记** button that fills missing notes, title/summary translations and the compressed reading guide. The reading section also has an **INTENSIVE READING** overview (paragraphs, sentences, long sentences, key words), a clickable **文章结构地图**, and a **隐藏笔记 / 显示笔记** toggle that persists locally. If a styled editorial exists, **精读导读** is a compact LLM-compressed version: it keeps the hook, groups key expressions by their job in the argument, and ends with a reading strategy, without repeating full word-card definitions or paragraph notes. Until that guide is generated, a deterministic fallback keeps the hook and builds a compact expression thread from the cards. The complete editorial remains in the Markdown export.

Every **想一想** question has a **看参考答案** button. The answer is generated from the paragraph and article, written in Chinese as a 2–4 sentence reference, and cached in the pack so it opens instantly next time.

The article head is the first thing on the page: the hero shows the English title, its Chinese translation and a short note on the title's wording, plus the publication's real standfirst/deck and its Chinese translation and annotation when the source has one. It does not invent a summary from the body: when the source has no deck, the head stops after the title. Title and standfirst text are selectable like body text, so words can be added from them into a front-matter word list; both have an **编辑** action in the hero. If an older pack promoted the first body sentence to the lead, a **修复文章头** action moves it back into the opening paragraph, re-translates that paragraph, and re-extracts the real deck. Selecting any word, phrase or sentence in the reading text shows its contextual **译文** and a short **注释** immediately in the popover, alongside the add actions; a paragraph-aware add keeps the new word card inside the paragraph it came from, while manual additions stay in **补充词汇**. The reading-time pill uses an intensive-reading estimate (re-reading, notes, sentence analysis and word cards), not a 200-words-per-minute skimming estimate.

Every paragraph and the article title/lead have an **编辑** action. Saving an edited paragraph re-translates it and regenerates that paragraph's note; a paragraph can also be deleted when the source has redundant content. Edits are propagated to the library: word-card contexts are re-pointed at the new sentence (or removed when their paragraph is deleted, with later paragraph indexes shifted), and sentence cards whose source text no longer exists are marked **待复核** instead of silently keeping stale text. Every paragraph's note can be edited field by field, regenerated with AI, and its reflection answer regenerated independently; the reading guide has its own **重写导读** action. The reading header has **修复分段** for source paragraphs that were cut mid-sentence or split by layout artifacts (a standalone quote/attribution, a quote after a colon, or a lower-case continuation); it merges those blocks, re-translates the merged paragraph and re-syncs word contexts. New builds apply the same layout-fragment normalization before the reading pass, so PDF line breaks and short transition lines do not create fake paragraphs. A short one-sentence transition (`Lacklustre content is not the only reason...`) joins the paragraph that follows it; headings, dated title blocks and footer/caption lines are protected. Sentence splitting protects titles, initials, acronyms and decimals, so the sentence-focus view does not cut inside `Mr.`, `U.S.` or `3.5`.

Each word card has a **发散** action. It opens an AI expansion dialog with word family/derivatives, synonyms, antonyms, confusables, collocations, roots/affixes, examples and a memory hook; results are saved back into the pack and library so they are available next time. The dialog also renders an AI **派生图** (for example `flame → inflame → inflammation / inflammatory`) as an indented mind-map tree with branch labels and Chinese glosses, which is easier to scan and prints well.

**单句精读** opens a focused overlay that walks the article one sentence at a time: large original sentence, optional paragraph translation, on-demand LLM **翻译本句** (cached by sentence + paragraph context under `data/cache/sentences/`), browser TTS pronunciation, key-word chips, previous/next navigation, keyboard arrows, and **加入句子卡 / 本段已读** actions. Selections inside the focused sentence still open the add-word/add-sentence popover. The overlay also has **合并下一句** and **拆分本句** for fixing a bad sentence boundary; the split dialog uses an inline `|` marker (no native prompt), and the server only accepts boundaries whose joined text still equals the paragraph, so this can reposition cuts but never rewrite the source. Custom boundaries persist in the pack and reset to automatic segmentation when they match it. The last sentence is saved in `reading.json`, so opening the pack with `?focus=1` resumes where you stopped.

### Adaptive selection

By default a pack suggests its own size. A 1,000-word article gets roughly 10–12 items; a short piece gets fewer; a C1/C2 text or a library with many known words nudges the count up. The split is about 70% **core** and 30% **bonus**:

- core items enter the spaced-repetition queue
- bonus items are shown in the pack with a **Bonus** badge but are not queued
- the pack page displays the word count, CEFR and the exact recommendation reason
- `--limit 12` (or the UI build request) overrides the automatic count

The LLM extraction asks for a `valueScore` on each candidate and keeps the highest-scoring ones; heuristic mode uses its frequency/part-of-speech ranking instead. Words marked **known** in the library are passed to the selector as an exclusion list, filtered again after extraction, and shown in the pack as “已掌握” rather than being queued again. Words already in the library but still being learned are passed as a “prefer new items” hint; if one is selected it is shown with **已在词库** and kept as Bonus, so it never re-enters review as a fresh card. The automatic count uses the article's own known-word ratio, not just the global library ratio.

A pack's **词太多 / 词太少** buttons adjust a persisted selection bias (-5 to +5), which changes the automatic count for later builds; the 选词说明 line reports the adjustment. The import/build panel also has an explicit **选词量** selector: automatic, about 6 items for stronger readers, about 10 as standard, about 16, or about 22 for readers who want more. Removing a word twice from a pack marks it known and records negative word feedback; a word removed repeatedly is added to the selector's exclusion list. The build UI also has a **只选生词** checkbox that excludes every word already in the library for that pack.

### Sentence cards

Intensive reading is not only about words. Select a complete sentence in the original text and the pack popover offers **加入句子卡**; the LLM generates a sentence card with the original, a natural Chinese translation, phrase-by-phrase chunks (role and meaning), the reusable pattern, a concise grammar note, 2–3 substitutions, and why the sentence is worth learning. Sentence cards live in their own **句子卡** section, stay out of the vocabulary table and the word graph, and enter the review queue as a separate item type.

In review, a sentence card shows only the Chinese translation plus the pattern hint and asks for a **back-translation**. The check compares content-word overlap with the original, not exact wording; after reveal the original, chunks, grammar, substitutions and source are shown. Ratings use the same FSRS schedule as word cards. Selecting a phrase or clause expands it to the complete source sentence before the card is generated, and terminal punctuation is restored; adding the same sentence again (with or without the final period) is recognized as a duplicate. The review tab has a **只复习句子卡** shortcut (also offered on the home review card) that filters the due queue to sentence cards and can switch back to all due items. In the library, a sentence card shows the full English sentence and Chinese translation, with an expandable **详情** panel for chunks, pattern, grammar and substitutions.

### Exporting the reading page

The pack's **导出** menu offers:

- **网页 HTML**: a dedicated static reading document, not a screenshot of the interactive page. All notes, word cards (including their AI derivation trees and relation/formation details), sentence cards, vocabulary and exercise answers are expanded; scripts, buttons, collapsed `<details>` and editing controls are absent.
- **EPUB**: a valid EPUB 3 archive containing the title/lead translations, paragraph translations and notes, sentence cards, vocabulary and exercises, including available exercise translations.
- **PDF**: generated with local headless Chrome; if Chrome is missing, the UI falls back to the browser's print dialog so the page can still be saved as PDF
- **PNG 长图**: one long PNG of the entire static document, with 900px (phone), 1200px (standard) and 1800px (2× high-resolution) options, useful for notes or sharing
- **PNG 分图**: AI groups the export into several page images at logical block boundaries (cover, guide, paragraphs, sentence cards, word cards, exercises), then downloads them as a ZIP with a `pages.txt` manifest. Blocks are never cut in the middle; pages taller than the target are split only between modules, and a deterministic height-based plan is used when the AI plan is unavailable or invalid.
- **MOBI**: generated through Calibre's `ebook-convert` when Calibre is installed; otherwise the UI explains that EPUB can be downloaded and converted locally

Before any export, the backend fills missing word derivations, reflection-question answers and exercise translations so the exported document is complete. Cached results make later exports fast. During a long export an inline progress panel shows the chosen format and elapsed seconds until the download starts.

Exercises cache their Chinese prompt and answer translations when opened: cloze prompts show the translated blank sentence, comprehension/discussion questions show the translated question, and sentence answers show their translation.

`pack.md` remains the Markdown export for Obsidian/print.

### Word-card cache

LLM builds use two stages: a compact **selection** call (lemma, sense, context and value score), then card generation for only the selected candidates. Generated cards are cached under `data/cache/cards/` by lemma and sense; when a later article selects the same word, its card is reused and only the new context is attached. Existing review-library cards are seeded into the cache on the first build of a session, so a new article can reuse cards you already own. The build progress and the pack's 选词说明 report cache hits. Cards can also be reused when the sense wording changes slightly (lexical overlap), while genuinely different senses get separate cache entries.

### Word network

The **词网** tab builds a graph from the review library. Learned words are filled nodes; words mentioned in their synonym/antonym/word-family/confusable lists but not yet learned appear as dashed **ghost nodes**, so the graph also shows the learning frontier. Synonym and word-family links are positive, antonym and confusable links are negative, and words sharing a root, prefix or suffix are connected as morphology edges. Ghost nodes can be promoted with **加入学习包**; isolated learned words have an **AI 补全关系** action that asks the LLM for missing relations and updates the graph.

Controls include a threshold slider, negative/root/ghost/context toggles, hide-known/isolated filters, zoom and background pan, and a label mode (auto/all/off). Ghosts are off by default to keep the first view clean; enabling them shows a capped frontier of up to 40 unlearned words. Auto labels only mark high-degree words, while hover, search hits and selected nodes always reveal their label. There are three views:

- **网络**: force layout with edge tooltips, node due rings, click-to-focus, 1/2-hop neighbors, and a two-click path mode showing how two words are connected
- **词族树**: root/prefix/suffix hubs with their member words and a **复习这组** link
- **聚类**: connected components as cluster cards with due counts, member chips and a **复习这组** link

The review queue accepts a word-group filter (`?tab=review&words=...`), so a family or cluster can be studied as one session. Graph settings persist across reloads; the graph is built from your library, so it grows as you learn rather than showing a static dictionary map.

Each learning item is **sense-level**, not word-level:

- the exact sense used in the source
- the context sentence plus translation
- IPA, part of speech, CEFR estimate
- collocations and chunks
- synonyms, antonyms, confusables, word family
- roots/prefixes/suffixes with related words and a short memory hook
- dictionary and generated examples, clearly labelled
- a source reference (page or timestamp)

The local library deduplicates items by lemma + sense. If the same word appears in another source, the new context is merged into the existing card instead of creating a duplicate.

## Modes

### Heuristic mode (no API key)

- candidate selection from frequency, part of speech and word length
- definitions, IPA, synonyms and examples from the free Dictionary API
- Chinese definitions from Youdao's bilingual dictionary, with MyMemory as a fallback
- collocations extracted from the source text
- automatic cloze exercises

This mode is free and works offline after the dictionary and translation caches are warm. It is intentionally conservative: sense disambiguation is still weaker than LLM mode, and dictionary/translation glosses can be broad. Use `--no-zh` to skip Chinese and `--zh-context` to also translate the context sentences.

### LLM mode

Set an OpenAI-compatible endpoint in `.env`:

```bash
LEARN_API_KEY=sk-...
LEARN_BASE_URL=https://api.openai.com/v1
LEARN_MODEL=gpt-4o-mini
LEARN_LEVEL=B2
```

The LLM gets the source in chunks and returns structured JSON: sense, CEFR, definitions, Chinese translations, collocations, examples, confusables, notes and exercises. Every item is validated with zod; a failed chunk falls back per chunk, and a total failure falls back to heuristic mode.

Any OpenAI-compatible provider works (DeepSeek, Moonshot, Qwen, a local gateway). If only `DEEPSEEK_API_KEY` is present, the compiler uses `https://api.deepseek.com/v1` and `deepseek-chat` automatically. `LEARN_ENV_FILE` can point at another local `.env` file so keys do not need to be copied into this repo. Use `--no-llm` to compare output.

## Style references and a unified house style

Each teacher gets one card under `styles/`. Cards can be generated from a reference EPUB/PDF/text with an LLM, or written by hand.

```bash
pnpm dev style add teacher-a ./references/teacher-a.epub
pnpm dev style add teacher-b ./references/teacher-b.epub
pnpm dev style list
pnpm dev style show teacher-a
pnpm dev style merge teacher-a teacher-b --out unified --focus light-longterm
```

`style merge` synthesizes one house style with an explicit “扬长避短” pass: it keeps each teacher's strengths (hooks, close reading, examples, grammar clarity, exam focus) and drops quirks, clickbait, self-promotion, over-correction, signature catchphrases and copied passages. `--focus light-longterm` weights the merge toward easy entry and sustainable daily habits; `--focus balanced` keeps exam and long-term strengths closer to even. Once `styles/unified.md` exists, `build` and `demo` use it by default; override with `--style teacher-a`, or set `LEARN_STYLE=none` to disable.

The public repository does not ship any style cards. Create your own under `styles/`; that directory and `docs/` are local-only and gitignored. If `styles/unified.md` exists, `build` and `demo` use it by default; otherwise the built-in template is used.

Without an LLM key, `style add` writes a structural skeleton you can edit by hand; `style merge` requires an LLM. In heuristic mode, style only shapes the template article structure. With an LLM, it writes the full “精读笔记” and tunes the Chinese notes.

Reference books and generated style cards stay local; both `references/` and `styles/` are gitignored.

## Review

The review UI is deliberately small and no longer the landing page:

- **今日** is reading-first: a hero for **继续精读 / 开始精读**, a three-step day (read → write 3 sentences → optional 5-minute review), and a **最近精读** list. The day completes when you finish an article and write the output; review does not block it.
- **输出**: after the article is finished, the output step shows the discussion question in a textarea. The pack page also has a **读完写三句** section after the exercises. Saving stores the written text and the reference answer in `data/store.json`; the home page shows the latest five outputs under **最近输出**, expandable to full text. A day only completes when a written output actually exists.
- **复习** is a separate tab with the due queue.
- due queue with Again / Hard / Good / Easy (FSRS)
- context cloze: the target word is hidden in the card and its context sentence, so recall starts from meaning and context rather than recognition
- a typing box checks the spelling (common inflections are accepted) before the answer is revealed; **发音** uses the browser's speech synthesis
- after reveal, the answer shows the full word, IPA, Chinese definition, memory hook, collocations, examples, roots/affixes and synonym/antonym/confusable/word-family relations
- star favorites, mark known, suspend
- library search, with a link from each item back to its source pack
- pack-scoped review: **复习这篇** on a pack filters the queue to that pack's items, with a clear-filter link
- pack library grouped by issue, with review/open/rebuild/delete actions and due/mastered counts
- keyboard shortcuts: `Space` reveal, `1–4` rate, `S` star, `K` known

Review state and the pack index live in `data/store.json`; full resource text and article splits live in `data/resources/<id>.json`. The store is version 2: opening an older store migrates automatically, backs up the old file as `store.json.v1.bak`, moves legacy resource bodies out of `store.json`, and rewrites the file without them. This keeps the frequently written review store small (the three test issues shrank it from about 6 MB to about 220 KB); SQLite is still the longer-term upgrade. Pack files are written via temp-file + rename so a crash cannot leave a half-written pack.json before the other files.

### Importing from the UI

Start `pnpm dev review` and click **+ 导入材料** in the header (or the **导入** tab). Three inputs are available:

- **粘贴文本**: paste an article or Markdown, optionally give it a title.
- **网页链接**: a normal article URL, a bare domain, or a direct PDF link. Paywalls and login walls are reported, not bypassed.
- **PDF 文件**: upload a text-layer PDF (up to 50 MB). Scanned PDFs are reported as unsupported.
- **EPUB / MOBI**: upload an EPUB, MOBI, AZW, or AZW3 file (up to 100 MB), including KF8. DRM-protected files are reported instead of producing a broken pack.

After importing, the card shows the title, word/paragraph counts, a text preview and any extraction warnings. EPUB, MOBI and bookmarked PDF issues are split into their articles: click **查看 N 篇文章**, pick one, and generate a pack for that article only. Non-article entries — short section pages, cartoons, the table of contents, ads, data pages and “The world this week” news digests — are hidden by default; the list shows how many were filtered, can be searched, filtered by section or generated state, sorted by length, and can reveal the filtered items. Each row also has a small **非文章 / 设为文章** override, persisted with the resource. The **最近导入** list keeps the last few resources so you can build one later. Without an LLM key the page says so and uses heuristic mode; with a key it uses the configured model and style.

Article generation supports a client-side build queue: tick several articles, click **生成选中**, and the UI builds them one after another. More than two articles require a second click with a time estimate, and a batch is capped at 10; the queue persists across reloads and can be resumed or cleared. A running build can be cancelled, and a **停止队列** button stops the remaining batch without cancelling the current article. The optional **生成音频** checkbox uses macOS `say`; **只选生词** keeps words already in the library out of the new pack. Build results report how many old items a rebuild removed.

Resource management: duplicate imports are rejected by content hash, uploaded PDF/EPUB/MOBI originals are kept under `data/uploads/` so **重新解析文章** can re-split them, and a two-click **删除材料** removes the resource plus its packs and orphaned items. A completed article pack links back to its issue's article list and to a review queue filtered to that pack; its page can hide translations, switch to a larger font, show only core words, promote an individual Bonus word with **加入复习**, or send **词太多 / 词太少** feedback that tunes later selection.

For an issue imported before article splitting existed, `pnpm dev resplit <resource-id> <path-to-file>` adds the article boundaries in place without creating a duplicate resource.

### Editing a pack

Open the pack through the review server rather than `file://`; start it with an LLM key so the 添加 action can generate new items:

```bash
LEARN_ENV_FILE=/path/to/another/.env pnpm dev review
```

Pack pages open in the same tab and keep a sticky **← 复习** link in the top bar; the brand also returns to the review home, the footer has **返回复习首页** and **回到顶部**, and `file://` pages fall back to `http://127.0.0.1:4317/`.
- **移除**: click the × on an item twice — the first click turns it into 确认, the second removes it from the pack and marks it known in the library, so it leaves the review queue. There is no native dialog.
- **添加单词 / 句子卡**: select 1–8 words in an original paragraph; a small 添加 button appears next to the selection. For multi-word selections the AI checks whether the whole selection is a meaningful word, collocation, idiom or phrase; the popover offers **整体添加** and **分别添加** (the meaningful content words), with the recommended option first. Selecting a complete sentence (or a longer span) adds a **加入句子卡** option, which generates a sentence-level card for back-translation rather than a vocabulary card. The 添加单词 button in the top bar jumps to the reader and shows the hint; manual input stays available under 手动输入.
- Progress and errors are shown inline and in a toast; there are no native dialogs.
- If the new word does not appear in the source, it is shown in a 补充词汇 section instead of under a paragraph.
- Edits rewrite `pack.json`, `pack.md`, `index.html` and `anki.csv` immediately and reload the page. The 风格化导读 is kept as generated.

Without an LLM key, 移除 still works; 添加 returns a clear error.

## Supported input

| Input | Notes |
| --- | --- |
| Pasted text | `pnpm dev add` then Ctrl-D, or `--text`, `-`, `--clipboard`. A `--title` keeps the title readable |
| PDF | text-layer PDFs; top-level bookmarks become article boundaries; repeated running headers/footers are removed; scanned pages need OCR and are not handled yet |
| EPUB | spine order, headings and chapter text; nav/NCX titles are used for articles without their own headings; each spine item becomes an article |
| MOBI / AZW / AZW3 | both MOBI (PalmDOC) and KF8 containers; spine chapters and the TOC become articles; DRM-protected files are not supported |
| URL | main-article extraction with cheerio + turndown; bare domains and direct PDF links work |
| `.txt` / `.md` | plain text and Markdown |
| `.srt` / `.vtt` | timestamped transcripts |
| audio / video | requires a sibling `.srt`, `.vtt`, `.txt` or `.md` transcript |

DRM-protected EPUB/MOBI files are not supported. A password-protected PDF, a scanned PDF, or a page behind a login/paywall produces a specific error instead of a pack. For a blocked article, save the page as HTML or paste its text.

After ingesting, `add` prints a short preview and warns when fewer than 300 words were extracted, when some PDF pages had no text, or when a web page fell back to extracting the whole body. Check that preview before spending LLM tokens on a build.

Video and audio are not transcribed by this project yet. For a TED talk or podcast, put the official transcript next to the media file (or transcribe it separately) and ingest the transcript. Whisper integration is on the roadmap.

## Design notes

- **Curation over coverage.** A 1,000-word article should produce roughly 15–25 items, not a glossary. The cap is enforced by `--limit` and the extraction prompt.
- **Sense-level cards.** `run a business`, `run late` and `run out of` are different items.
- **Source grounding.** The LLM's context sentence is checked against the source; if it is not verbatim, the nearest real sentence is used instead.
- **Stable IDs.** Items are keyed by `lemma + sense`, so re-building a pack merges rather than duplicates.
- **Offline-first.** Sources, packs and the library stay on disk. Only the LLM call and the optional dictionary/translation APIs leave the machine.

## Limitations

- No OCR for scanned PDFs yet.
- DRM-protected EPUB, MOBI and AZW files cannot be decrypted; use a DRM-free copy.
- The word network's learned nodes come only from the library; ghost nodes depend on relation data in existing cards. A fresh library can still have isolated words until more cards accumulate.
- Whole-issue builds are intentionally discouraged. EPUB/MOBI chapters and PDF bookmarks are exposed as articles; a file without chapter boundaries can still be built as one long document, but its reading section may be truncated.
- Paywalls, login walls and bot checks are not bypassed. When extraction fails, `add` says so and suggests saving the page as HTML or pasting the text.
- Web extraction is heuristic: if no article container is found, the whole page is used and `add` warns about possible navigation/footer text.
- No built-in video/audio transcription yet (bring a transcript).
- Heuristic Chinese definitions prefer Youdao and fall back to MyMemory; they are dictionary/translation glosses, not context-aware paraphrase. LLM mode gives better sense-level Chinese.
- Style matching is only fully realized in LLM mode; heuristic mode produces a structural template.
- JSON storage is fine for a personal library; SQLite/FSRS metadata is next.
- TTS uses macOS `say`; other platforms skip audio for now.
- The review server binds to `127.0.0.1` and has no authentication. Do not expose it.
- Copyright: use this for personal study. Do not redistribute packs that contain full source text.

## Roadmap

Adaptive item selection (`--limit auto`, core/bonus split, selection rationale) is implemented, along with persistent word-card caching and the word network. Remaining work:

1. SQLite store + proper review log
2. OCR pipeline for scanned PDFs
3. Whisper/ffmpeg adapter for local audio/video transcription
4. LLM provider abstraction with per-stage model selection
5. Better collocation and sense disambiguation
6. Anki APKG export with audio
7. Cross-source context aggregation and "today's story" generation from due items
