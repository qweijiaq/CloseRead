import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { parseArgs } from 'node:util'

import { analyzeResource } from './analyze/index.js'
import { seedCardCache } from './analyze/card-cache.js'
import { knownRatioInText } from './analyze/known.js'
import { generatePackAudio, isSayAvailable } from './audio/tts.js'
import { config, ensureDirs, hasLlm, hasNeuralTts, projectRoot, storePath } from './config.js'
import { readEpub } from './ingest/epub.js'
import { ingestSource, ingestText, contentHash, normalizeUrl } from './ingest/index.js'
import { readMobi } from './ingest/mobi.js'
import { readPdf } from './ingest/pdf.js'
import { previewText, resourceWarnings } from './ingest/summary.js'
import { writePack } from './pack/build.js'
import { loadPack } from './pack/mutate.js'
import { renderHtml } from './pack/html.js'
import { prefetchPack } from './pack/prefetch.js'
import { FeedbackBoard } from './community/feedback.js'
import type { FeedbackStatus } from './community/feedback.js'
import { startReviewServer } from './review/server.js'
import { VisitorRegistry, pruneWorkspaces } from './review/visitors.js'
import { restoreLibraryBackup, writeLibraryBackup } from './store/backup.js'
import { Store } from './store/store.js'
import { analyzeStyle } from './style/analyze.js'
import { mergeStyles } from './style/merge.js'
import type { StyleFocus } from './style/merge.js'
import { listStyleProfiles, loadStyleProfile, resolveDefaultStyle } from './style/profile.js'
import type { LearningPack, Resource, ResourceArticle } from './types.js'

const execFileAsync = promisify(execFile)

interface BuildCliOptions {
  limit: number | 'auto'
  useLlm: boolean
  translate: boolean
  translateContext: boolean
  styleName?: string
  includeSource: boolean
  audio: boolean
  out?: string
  open: boolean
}

interface AddCliOptions extends BuildCliOptions {
  text?: string
  title?: string
  clipboard: boolean
  build: boolean
  aiClean?: boolean
}

const HELP = `CloseRead — turn authentic English input into intensive reading packs.

Usage:
  pnpm dev add <file-or-url>          Ingest a PDF, EPUB, MOBI, article URL, text or transcript
  pnpm dev add                        Paste text, then press Ctrl-D
  pnpm dev add -                      Read pasted text from stdin (pbpaste | ...)
  pnpm dev add --clipboard            Read the macOS clipboard
  pnpm dev add --text "..."           Ingest inline text
  pnpm dev resplit <id> <file>        Re-parse an existing resource into articles
  pnpm dev build <id|latest>          Analyse a resource and build a learning pack
  pnpm dev list                       List ingested resources
  pnpm dev items [--due] [--query q]  List learning items
  pnpm dev review [--port 4317] [--lan] Start the local review UI (--lan also serves phones)
  pnpm dev export <id|latest>         Export the pack's Anki CSV
  pnpm dev audio <id|latest>          Generate audio for an existing pack (macOS say)
  pnpm dev style <list|show|add|merge> Manage writing-style profiles
  pnpm dev demo                       Run the full pipeline on the bundled sample
  pnpm dev doctor                     Check the environment and library
  pnpm dev backup [file]              Back up the library to one JSON file
  pnpm dev restore <file> --force     Restore the library from a backup
  pnpm dev guests [--days N] [--force]  List visitor workspaces; prune idle ones
  pnpm dev prefetch <id|latest> [--expand] [--sentences]
                                      Pre-generate answers the reader would ask for
  pnpm dev unpublish <id|title>       Remove a pack from the shared library
  pnpm dev feedback [status <id> <s> | delete <id>]
                                      List the feedback board, move or remove an item

Add options:
  --title <name>   Override the resource title
  --build          Build the learning pack immediately after ingesting
  --no-llm         Ingest and build without an LLM (when --build is used)
  --no-ai-clean    Keep raw extracted text instead of AI-removing boilerplate
  --open           Open the generated pack (when --build is used)

Style commands:
  pnpm dev style list
  pnpm dev style add <name> <epub|pdf|txt|url> [--samples 6] [--force]
  pnpm dev style show <name>
  pnpm dev style merge [names...] [--out unified] [--focus balanced|light-longterm] [--force]

Build options:
  --limit <n|auto> Number of items to keep; auto is the default
  --no-llm         Force heuristic mode even when an API key is configured
  --no-zh          Skip the free machine Chinese definitions
  --zh-context     Also translate context sentences (uses more quota)
  --style <name>   Follow a style guide from styles/<name>.md (or a path); defaults to unified when present
  --no-source      Do not include the full source text in the pack
  --audio          Generate TTS audio (macOS)
  --out <dir>      Custom output directory for the pack
  --open           Open the generated HTML in the browser
`

function line(label: string, value: string | number): string {
  return `  ${label.padEnd(12)} ${value}`
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`
}

function parseLimit(value: string | undefined): number | 'auto' {
  if (!value || value === 'auto') return 'auto'
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'auto'
  return Math.max(1, Math.min(100, Math.round(number)))
}

async function openPath(target: string): Promise<void> {
  if (process.platform !== 'darwin') return
  await execFileAsync('open', [target]).catch(() => {})
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

async function readClipboard(): Promise<string> {
  if (process.platform !== 'darwin') {
    throw new Error('--clipboard uses macOS pbpaste and is only available on macOS. Pipe the text instead.')
  }
  const { stdout } = await execFileAsync('pbpaste', [], { maxBuffer: 16 * 1024 * 1024 })
  return String(stdout)
}

function printIngestSummary(resource: Resource): void {
  console.log('')
  console.log(`Added: ${resource.title}`)
  console.log(line('id', resource.id))
  console.log(line('kind', resource.kind))
  console.log(line('words', resource.wordCount))
  console.log(line('segments', resource.segments.length))
  console.log('')
  console.log('Preview:')
  console.log(`  ${previewText(resource.text)}`)

  const notes = resourceWarnings(resource)
  if (notes.length > 0) {
    console.log('')
    for (const note of notes) console.log(`Note: ${note}`)
  }
}

function printResources(store: Store): void {
  const resources = store.listResources()
  if (resources.length === 0) {
    console.log('No resources yet. Run: pnpm dev add <file-or-url>')
    return
  }
  console.log('ID                                      KIND        WORDS   TITLE')
  for (const resource of resources) {
    console.log(
      `${resource.id.padEnd(38)} ${resource.kind.padEnd(11)} ${String(resource.wordCount).padEnd(7)} ${truncate(
        resource.title,
        60,
      )}`,
    )
  }
}

async function commandAdd(input: string | undefined, options: AddCliOptions): Promise<void> {
  const provided = [input ? 'input' : '', options.text !== undefined ? '--text' : '', options.clipboard ? '--clipboard' : '']
  if (provided.filter(Boolean).length > 1) {
    console.error('Use only one of a file/URL, --text, or --clipboard.')
    process.exitCode = 1
    return
  }

  let resource: Resource
  if (options.text !== undefined) {
    console.log('Ingesting pasted text …')
    resource = await ingestText(options.text, { title: options.title, aiClean: options.aiClean })
  } else if (options.clipboard) {
    console.log('Reading the clipboard …')
    const clipboard = (await readClipboard()).trim()
    if (!clipboard) throw new Error('The clipboard is empty.')
    const clipboardUrl = /\s/.test(clipboard) ? null : normalizeUrl(clipboard)
    if (clipboardUrl) {
      console.log(`Clipboard contains a URL: ${clipboardUrl}`)
      resource = await ingestSource(clipboardUrl, { title: options.title, aiClean: options.aiClean })
    } else {
      resource = await ingestText(clipboard, { title: options.title, aiClean: options.aiClean })
    }
  } else if (input && input !== '-') {
    console.log(`Ingesting ${input} …`)
    resource = await ingestSource(input, { title: options.title, aiClean: options.aiClean })
  } else {
    if (input === '-') console.log('Reading text from stdin …')
    else if (process.stdin.isTTY) console.log('Paste an article or some text, then press Ctrl-D. (You can also pass a file path or URL.)')
    const text = await readStdin()
    if (!text.trim()) {
      console.error('No text received.')
      process.exitCode = 1
      return
    }
    resource = await ingestText(text, { title: options.title, aiClean: options.aiClean })
  }

  const store = await Store.open(storePath())
  const hash = String(resource.metadata.hash ?? contentHash(resource.text))
  const existing = store
    .listResources()
    .find(
      (entry) =>
        entry.id !== resource.id &&
        String(entry.metadata.hash ?? contentHash(entry.text)) === hash,
    )
  if (existing) {
    await fs.rm(path.join(config.dataDir, 'resources', `${resource.id}.json`), { force: true })
    console.error(`Already imported: ${existing.title} (${existing.id})`)
    process.exitCode = 1
    return
  }
  await store.addResource(resource)
  printIngestSummary(resource)

  if (options.build) {
    console.log('')
    await commandBuild(resource.id, options)
    return
  }

  console.log('')
  console.log(`Next: pnpm dev build ${resource.id} --open`)
}

async function commandResplit(idOrLatest: string | undefined, file: string | undefined): Promise<void> {
  if (!idOrLatest || !file) {
    console.error('Usage: pnpm dev resplit <id|latest> <epub|mobi|azw|azw3|pdf>')
    process.exitCode = 1
    return
  }

  const store = await Store.open(storePath())
  const resource = store.resolveResource(idOrLatest)
  if (!resource) {
    console.error(`Resource not found: ${idOrLatest}`)
    process.exitCode = 1
    return
  }

  const extension = path.extname(file).toLowerCase()
  console.log(`Re-parsing ${resource.title} from ${file} …`)
  let articles: ResourceArticle[]
  if (extension === '.epub') articles = (await readEpub(file)).articles
  else if (extension === '.mobi' || extension === '.azw' || extension === '.azw3') {
    articles = (await readMobi(file)).articles
  } else if (extension === '.pdf') articles = (await readPdf(file)).articles
  else {
    console.error('Only EPUB, MOBI, AZW, AZW3 and PDF files can be split into articles.')
    process.exitCode = 1
    return
  }

  if (articles.length === 0) {
    console.error('No article boundaries were found in this file.')
    process.exitCode = 1
    return
  }

  resource.articles = articles
  resource.metadata = { ...resource.metadata, articles: articles.length }
  await store.addResource(resource)
  await fs.writeFile(
    path.join(config.dataDir, 'resources', `${resource.id}.json`),
    JSON.stringify(resource, null, 2),
    'utf8',
  )

  console.log('')
  console.log(`Articles: ${articles.length}`)
  for (const article of articles.slice(0, 20)) {
    console.log(line(`#${article.index}`, `${article.wordCount} words · ${article.title}`))
  }
  if (articles.length > 20) console.log(`  … and ${articles.length - 20} more`)
}

function applyStoredLevel(store: Store): void {
  const level = store.preferences().diagnosis?.level
  if (level) config.level = level
}

async function commandBuild(idOrLatest: string, options: BuildCliOptions): Promise<void> {
  const store = await Store.open(storePath())
  applyStoredLevel(store)
  const resource = store.resolveResource(idOrLatest)
  if (!resource) {
    console.error(`Resource not found: ${idOrLatest}`)
    printResources(store)
    process.exitCode = 1
    return
  }

  console.log(`Analyzing "${resource.title}" (${resource.wordCount} words) …`)
  console.log(hasLlm() && options.useLlm ? `Mode: LLM (${config.llm.model})` : 'Mode: heuristic (free Dictionary API)')

  const style = options.styleName ? await loadStyleProfile(options.styleName) : await resolveDefaultStyle()
  await seedCardCache(store.listItems())
  const knownLemmas = store.knownLemmas()
  const knownRatio = knownRatioInText(resource.text, knownLemmas)
  const outcome = await analyzeResource(resource, {
    limit: options.limit,
    knownRatio,
    knownLemmas,
    useLlm: options.useLlm,
    translate: options.translate,
    translateContext: options.translateContext,
    style,
    onProgress: (message) => console.log(`  · ${message}`),
  })
  for (const item of outcome.analysis.items) {
    const existing = store.getItem(item.id)
    item.libraryState = existing ? (existing.status === 'known' ? 'known' : 'learning') : 'new'
    if (item.libraryState === 'known') item.tier = 'bonus'
  }
  const coreCount = outcome.analysis.items.filter((item) => item.tier === 'core').length
  outcome.selection = {
    ...outcome.selection,
    core: coreCount,
    bonus: Math.max(0, outcome.analysis.items.length - coreCount),
  }
  console.log(options.audio ? '  · Generating audio and writing pack files…' : '  · Writing pack files…')
  const result = await writePack(resource, outcome, {
    includeSource: options.includeSource,
    audio: options.audio,
    outDir: options.out,
  })

  const coreItems = outcome.analysis.items.filter(
    (item) => item.tier === 'core' && item.libraryState !== 'known',
  )
  const { added, updated } = await store.upsertItems(coreItems)
  await store.addPack(result.record)

  console.log('')
  console.log(`Pack: ${result.pack.title}`)
  console.log(line('mode', result.pack.mode))
  console.log(line('difficulty', `${result.pack.difficulty.cefr} — ${result.pack.difficulty.reason}`))
  if (style) console.log(line('style', style.title))
  console.log(line('selection', `${outcome.selection.recommended} 项 · ${outcome.selection.core} core + ${outcome.selection.bonus} bonus`))
  console.log(line('why', truncate(outcome.selection.reason, 90)))
  console.log(line('items', result.pack.items.length))
  console.log(line('new items', added))
  console.log(line('merged', updated))
  console.log(line('dir', result.dir))
  console.log(line('html', path.join(result.dir, 'index.html')))
  console.log(line('markdown', path.join(result.dir, 'pack.md')))
  console.log(line('anki', path.join(result.dir, 'anki.csv')))
  if (outcome.notes.length) {
    console.log('')
    console.log('Notes:')
    for (const note of outcome.notes) console.log(`  - ${note}`)
  }
  console.log('')
  console.log('Next: pnpm dev review')

  if (options.open) await openPath(path.join(result.dir, 'index.html'))
}

async function commandReview(port: number, open: boolean, lan: boolean): Promise<void> {
  const server = await startReviewServer({ port })
  const store = await Store.open(storePath())
  const stats = store.stats()
  if (lan) {
    try {
      const status = await server.enableLan()
      console.log('')
      console.log('Phone access (same Wi-Fi, token required):')
      if (status.urls.length === 0) {
        console.log('  No LAN IPv4 address was detected. Check the network or use the 手机 panel in the app.')
      } else {
        for (const url of status.urls) console.log(`  ${url}`)
      }
      console.log('  The link contains an access token; do not share it publicly.')
      console.log('  Close phone access from the 手机 panel when you are done.')
    } catch (error) {
      console.error(`Could not enable phone access: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  console.log('')
  console.log(`Review UI: ${server.url}`)
  console.log(line('due', stats.due))
  console.log(line('new', stats.newItems))
  console.log(line('total', stats.total))
  console.log('')
  console.log('Press Ctrl+C to stop.')
  if (open) await openPath(server.url)

  process.on('SIGINT', () => {
    void server.close().then(() => process.exit(0))
  })
  process.on('SIGTERM', () => {
    void server.close().then(() => process.exit(0))
  })
}

async function commandItems(dueOnly: boolean, query: string | undefined): Promise<void> {
  const store = await Store.open(storePath())
  const items = dueOnly ? store.dueItems(new Date(), 500) : store.listItems(query)
  if (items.length === 0) {
    console.log(dueOnly ? 'Nothing is due.' : 'No items yet. Run: pnpm dev demo')
    return
  }
  console.log('WORD             POS         DUE                 SENSE')
  for (const item of items) {
    const due = item.status === 'active' ? new Date(item.review.due).toISOString().slice(0, 10) : item.status
    console.log(
      `${item.lemma.padEnd(16)} ${(item.pos ?? '-').padEnd(11)} ${due.padEnd(19)} ${truncate(item.sense, 70)}`,
    )
  }
}

async function commandExport(idOrLatest: string, out: string | undefined): Promise<void> {
  const store = await Store.open(storePath())
  const resource = store.resolveResource(idOrLatest)
  if (!resource) {
    console.error(`Resource not found: ${idOrLatest}`)
    process.exitCode = 1
    return
  }
  const pack = store.findPack(resource.id)
  if (!pack) {
    console.error(`No pack found for ${resource.id}. Run: pnpm dev build ${resource.id}`)
    process.exitCode = 1
    return
  }
  const source = path.join(pack.dir, 'anki.csv')
  const target = out
    ? path.resolve(out)
    : path.join(config.dataDir, 'exports', `${resource.id}-anki.csv`)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.copyFile(source, target)
  console.log(`Anki CSV → ${target}`)
}

async function commandAudio(idOrLatest: string, open: boolean): Promise<void> {
  const store = await Store.open(storePath())
  const resource = store.resolveResource(idOrLatest)
  if (!resource) {
    console.error(`Resource not found: ${idOrLatest}`)
    process.exitCode = 1
    return
  }
  const pack = store.findPack(resource.id)
  if (!pack) {
    console.error(`No pack found for ${resource.id}. Run: pnpm dev build ${resource.id}`)
    process.exitCode = 1
    return
  }
  if (!hasNeuralTts() && !(await isSayAvailable())) {
    console.log('没有可用的语音引擎：请安装 macOS 语音，或在音频设置中配置神经语音。')
    return
  }
  const packJson = JSON.parse(await fs.readFile(path.join(pack.dir, 'pack.json'), 'utf8')) as LearningPack
  console.log(`Generating audio for ${packJson.items.length} items …`)
  const audio = await generatePackAudio(packJson, pack.dir)
  packJson.audio = audio
  await fs.writeFile(path.join(pack.dir, 'pack.json'), JSON.stringify(packJson, null, 2), 'utf8')
  await fs.writeFile(path.join(pack.dir, 'index.html'), renderHtml(packJson, audio), 'utf8')
  console.log(`Audio → ${path.join(pack.dir, 'audio')}`)
  console.log(`HTML updated → ${path.join(pack.dir, 'index.html')}`)
  if (open) await openPath(path.join(pack.dir, 'index.html'))
}

async function commandDemo(open: boolean, styleName?: string): Promise<void> {
  const sample = path.join(projectRoot, 'samples', 'sample-article.md')
  try {
    await fs.access(sample)
  } catch {
    console.error(`Sample not found: ${sample}`)
    process.exitCode = 1
    return
  }

  console.log('1/4 Ingesting the bundled sample …')
  const resource = await ingestSource(sample)
  const store = await Store.open(storePath())
  applyStoredLevel(store)
  await store.addResource(resource)
  console.log(`    ${resource.title} · ${resource.wordCount} words · ${resource.segments.length} segments`)

  const style = styleName ? await loadStyleProfile(styleName) : await resolveDefaultStyle()
  console.log('2/4 Analyzing …')
  const outcome = await analyzeResource(resource, { limit: 20, useLlm: true, translate: true, style })
  console.log(`    mode: ${outcome.mode} · items: ${outcome.analysis.items.length}${style ? ` · style: ${style.title}` : ''}`)

  console.log('3/4 Building the pack and audio …')
  const result = await writePack(resource, outcome, { includeSource: true, audio: true })
  const coreItems = outcome.analysis.items.filter((item) => item.tier !== 'bonus')
  const { added, updated } = await store.upsertItems(coreItems)
  await store.addPack(result.record)
  console.log(`    pack: ${result.dir}`)
  console.log(`    items: ${added} new, ${updated} merged`)

  console.log('4/4 Done.')
  console.log('')
  console.log(`Open: ${path.join(result.dir, 'index.html')}`)
  console.log('Review: pnpm dev review')
  if (open) await openPath(path.join(result.dir, 'index.html'))
}

async function commandStyle(
  subcommand: string | undefined,
  args: string[],
  options: { samples?: string; force: boolean; out?: string; focus?: string },
): Promise<void> {
  switch (subcommand) {
    case 'list': {
      const profiles = await listStyleProfiles()
      if (profiles.length === 0) {
        console.log('No style profiles yet. Run: pnpm dev style add <name> <epub|pdf|txt>')
        return
      }
      console.log('NAME                 TITLE                                      SOURCE')
      for (const profile of profiles) {
        console.log(
          `${profile.name.padEnd(20)} ${truncate(profile.title, 42).padEnd(42)} ${truncate(
            profile.source ?? '-',
            50,
          )}`,
        )
      }
      break
    }
    case 'show': {
      const name = args[0]
      if (!name) {
        console.error('Usage: pnpm dev style show <name>')
        process.exitCode = 1
        return
      }
      const profile = await loadStyleProfile(name)
      console.log(profile.guide)
      break
    }
    case 'add': {
      const [name, source] = args
      if (!name || !source) {
        console.error('Usage: pnpm dev style add <name> <epub|pdf|txt|url> [--samples 6] [--force]')
        process.exitCode = 1
        return
      }
      const samples = Number(options.samples ?? 6)
      console.log(`Analyzing style "${name}" from ${source} …`)
      const result = await analyzeStyle(name, source, {
        samples: Number.isFinite(samples) ? samples : 6,
        force: options.force,
      })
      console.log('')
      console.log(`Style: ${result.title}`)
      console.log(line('name', name))
      console.log(line('mode', result.mode))
      if (result.model) console.log(line('model', result.model))
      console.log(line('samples', result.samples))
      console.log(line('file', result.file))
      console.log('')
      console.log(`Use it: pnpm dev build latest --style ${name}`)
      break
    }
    case 'merge': {
      const outName = options.out?.trim() || 'unified'
      if (options.focus && options.focus !== 'balanced' && options.focus !== 'light-longterm') {
        console.error('Usage: --focus must be "balanced" or "light-longterm".')
        process.exitCode = 1
        return
      }
      const focus: StyleFocus = options.focus === 'light-longterm' ? 'light-longterm' : 'balanced'
      console.log(`Merging ${args.length > 0 ? args.join(', ') : 'all style profiles'} into "${outName}" …`)
      const result = await mergeStyles({
        names: args.length > 0 ? args : undefined,
        outName,
        force: options.force,
        focus,
      })
      console.log('')
      console.log(`Unified style: ${result.title}`)
      console.log(line('focus', focus))
      console.log(line('sources', result.sources.join(', ')))
      console.log(line('file', result.file))
      console.log('')
      console.log('It is now the default style for build/demo. Override with --style <name>.')
      break
    }
    default:
      console.log('Usage: pnpm dev style <list|show|add|merge> ...')
  }
}


/**
 * Pre-generate the answers that the reader otherwise asks the model for on
 * click, so visitors without a key can still reveal them.
 */

/** Remove a pack from the shared library (works for any pack, including seeds). */

/** Inspect the feedback board, or move an item's status. */
async function commandFeedback(args: string[]): Promise<void> {
  const board = new FeedbackBoard(path.join(config.dataDir, 'community', 'feedback.json'))
  const [action, id, status] = args
  if (action === 'delete' || action === 'remove') {
    if (!id) {
      console.error('用法: pnpm dev feedback delete <id>')
      process.exitCode = 1
      return
    }
    const item = await board.find(id)
    if (!item) {
      console.error('没有找到这条意见。')
      process.exitCode = 1
      return
    }
    await board.remove(item.id)
    console.log(`已删除 ${item.id}`)
    return
  }
  if (action === 'status') {
    if (!id || !status) {
      console.error('用法: pnpm dev feedback status <id> <open|planned|fixed|declined>')
      process.exitCode = 1
      return
    }
    if (!['open', 'planned', 'fixed', 'declined'].includes(status)) {
      console.error('状态只能是 open / planned / fixed / declined')
      process.exitCode = 1
      return
    }
    const item = await board.find(id)
    if (!item) {
      console.error('没有找到这条意见。')
      process.exitCode = 1
      return
    }
    await board.setStatus(item.id, status as FeedbackStatus)
    console.log(`已更新 ${item.id} → ${status}`)
    return
  }
  const list = await board.list('')
  if (list.items.length === 0) {
    console.log('意见墙还是空的。')
    return
  }
  console.log('ID        状态      加一  内容')
  for (const item of list.items) {
    const label = { open: '待处理', planned: '已采纳', fixed: '已修复', declined: '已驳回' }[item.status]
    console.log(
      `${item.id.padEnd(9)} ${label.padEnd(6)} ${String(item.votes).padStart(3)}   ${item.body.replace(/\s+/g, ' ').slice(0, 60)}`,
    )
  }
}

async function commandUnpublish(target: string | undefined): Promise<void> {
  const store = await Store.open(storePath())
  const pack = target
    ? store.findPack(target) ?? store.packs().find((entry) => (entry.title ?? '').includes(target))
    : store.packs()[0]
  if (!pack) {
    console.error('公共库里没有这个学习包。')
    process.exitCode = 1
    return
  }
  await store.removePack(pack.id)
  await fs.rm(pack.dir, { recursive: true, force: true }).catch(() => {})
  console.log(`已从公共库移除：${pack.title ?? pack.id}`)
  console.log(`  ${pack.dir}`)
}

async function commandPrefetch(
  target: string | undefined,
  options: { expand: boolean; sentences: boolean } = { expand: false, sentences: false },
): Promise<void> {
  const store = await Store.open(storePath())
  const pack = target && target !== 'latest'
    ? store.findPack(target)
    : store.packs()[0]
  if (!pack) {
    console.error('没有找到学习包。先运行 pnpm dev add <file> --build。')
    process.exitCode = 1
    return
  }
  if (!hasLlm()) {
    console.error('预生成答案需要模型 Key（LEARN_API_KEY 或 data/llm.json）。')
    process.exitCode = 1
    return
  }
  const contents = await loadPack(pack.dir)
  const result = await prefetchPack(
    contents,
    pack.dir,
    { answers: true, expand: options.expand, sentences: options.sentences },
    (message) => console.log(`  ${message}`),
  )
  const total = result.answers + result.expand + result.sentences
  console.log(
    `完成：答案 ${result.answers} · 单词展开 ${result.expand} · 句子翻译 ${result.sentences}（共 ${total}）`,
  )
  console.log(`  ${pack.dir}`)
}

async function commandGuests(options: { days?: number; force: boolean }): Promise<void> {
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }
  function formatDate(value: number | null): string {
    if (value === null) return 'unknown'
    return new Date(value).toISOString().slice(0, 10)
  }

  if (options.days !== undefined) {
    if (!Number.isFinite(options.days) || options.days <= 0) throw new Error('--days needs a positive number.')
    const pruned = await pruneWorkspaces({ days: options.days, dryRun: !options.force })
    if (pruned.length === 0) {
      console.log(`No visitor workspace has been idle for ${options.days} days.`)
    } else {
      console.log(options.force ? 'Removed visitor workspaces:' : 'Idle visitor workspaces (dry run):')
      for (const entry of pruned) {
        console.log(line(entry.id, `${formatSize(entry.size)}  last seen ${formatDate(entry.lastSeen)}`))
      }
      if (!options.force) console.log('\nRe-run with --force to delete them.')
    }
  }

  const workspaces = await VisitorRegistry.listWorkspaces()
  if (workspaces.length === 0) {
    console.log('No visitor workspaces yet.')
    return
  }
  const total = workspaces.reduce((sum, entry) => sum + entry.size, 0)
  console.log('')
  console.log(`${workspaces.length} visitor workspaces, ${formatSize(total)} total`)
  for (const entry of workspaces.slice(0, 30)) {
    console.log(line(entry.id, `${formatSize(entry.size)}  ${entry.packs} packs`))
  }
  if (workspaces.length > 30) console.log(`  ... and ${workspaces.length - 30} more`)
}

async function commandBackup(target: string | undefined): Promise<void> {
  const store = await Store.open(storePath())
  for (const warning of store.warnings()) {
    console.warn(`Warning: ${warning.message}${warning.path ? ` (${warning.path})` : ''}`)
  }
  const file = target
    ? path.resolve(target)
    : path.join(
        config.dataDir,
        'backups',
        `library-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}.json`,
      )
  const result = await writeLibraryBackup(store, file)
  console.log(
    `Backed up ${result.items} items, ${result.packs} packs, ${result.logs} reviews, ${result.outputs} outputs and ${result.resources} resources.`,
  )
  console.log(`  ${result.file}`)
  console.log('Pack folders, reading progress and the quote wall are included when present.')
}

async function commandRestore(file: string | undefined, force: boolean): Promise<void> {
  if (!file) throw new Error('Usage: pnpm dev restore <backup.json> --force')
  if (!force) {
    console.log('Restore replaces the current library. Re-run with --force to continue.')
    return
  }
  const result = await restoreLibraryBackup(path.resolve(file), storePath(), path.join(config.dataDir, 'resources'), config.packsDir)
  console.log(`Restored ${result.items} items, ${result.packs} packs, ${result.resources} resources.`)
  if (result.packFiles) console.log(`Restored ${result.packFiles} pack files (including reading progress and audio).`)
  if (result.safetyCopy) console.log(`Previous store saved at ${result.safetyCopy}`)
  console.log('Restart the review server or desktop app to load the restored library.')
}

async function commandDoctor(): Promise<void> {
  const store = await Store.open(storePath())
  const stats = store.stats()
  const defaultStyle = await resolveDefaultStyle()
  let pdfOk = false
  try {
    await import('pdf-parse')
    pdfOk = true
  } catch {
    pdfOk = false
  }
  console.log('Environment')
  console.log(line('node', process.version))
  console.log(line('platform', `${process.platform} ${process.arch}`))
  console.log(line('data dir', config.dataDir))
  console.log(line('packs dir', config.packsDir))
  console.log(line('llm', hasLlm() ? `${config.llm.model} @ ${config.llm.baseUrl}` : 'not configured (heuristic mode)'))
  console.log(line('style', defaultStyle ? `${defaultStyle.name} — ${defaultStyle.title}` : 'none'))
  console.log(line('say', (await isSayAvailable()) ? 'available' : 'not available'))
  console.log(line('pdf-parse', pdfOk ? 'ok' : 'missing'))
  const diagnosis = store.preferences().diagnosis
  console.log(line('level', diagnosis ? `${diagnosis.level} (diagnosed)` : config.level))
  console.log(line('known words', store.knownLemmas().length))
  console.log('')
  console.log('Library')
  console.log(line('resources', store.listResources().length))
  console.log(line('items', stats.total))
  console.log(line('due', stats.due))
  console.log(line('new', stats.newItems))
  console.log(line('favorites', stats.favorites))
  const packs = store.packs()
  const invalidPacks: string[] = []
  for (const pack of packs) {
    try {
      await loadPack(pack.dir)
    } catch (error) {
      invalidPacks.push(`${pack.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  console.log(line('packs', packs.length))
  console.log(line('packs ok', packs.length - invalidPacks.length))
  const lastGood = await fs.access(store.backupFile).then(() => store.backupFile).catch(() => 'none yet')
  console.log(line('last good', lastGood))
  const snapshots = await store.snapshots()
  console.log(line('snapshots', snapshots.length ? `${snapshots.length} in ${store.backupDirectory}` : 'none yet'))
  if (invalidPacks.length > 0) {
    console.log('')
    console.log('Invalid packs')
    for (const message of invalidPacks) console.log(`  ${message}`)
  }
  const warnings = store.warnings()
  if (warnings.length > 0) {
    console.log('')
    console.log('Warnings')
    for (const warning of warnings) {
      console.log(`  ${warning.code}: ${warning.message}`)
      if (warning.path) console.log(`    ${warning.path}`)
    }
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      limit: { type: 'string' },
      'no-llm': { type: 'boolean' },
      'no-ai-clean': { type: 'boolean' },
      'no-zh': { type: 'boolean' },
      'zh-context': { type: 'boolean' },
      style: { type: 'string' },
      'no-source': { type: 'boolean' },
      samples: { type: 'string' },
      force: { type: 'boolean' },
      focus: { type: 'string' },
      audio: { type: 'boolean' },
      out: { type: 'string' },
      open: { type: 'boolean' },
      lan: { type: 'boolean' },
      port: { type: 'string' },
      query: { type: 'string' },
      days: { type: 'string' },
      expand: { type: 'boolean' },
      sentences: { type: 'boolean' },
      due: { type: 'boolean' },
      text: { type: 'string' },
      title: { type: 'string' },
      clipboard: { type: 'boolean' },
      build: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  const command = positionals[0] ?? 'help'
  ensureDirs()

  const buildOptions: BuildCliOptions = {
    limit: parseLimit(values.limit),
    useLlm: values['no-llm'] !== true,
    translate: values['no-zh'] !== true,
    translateContext: values['zh-context'] === true,
    styleName: values.style,
    includeSource: values['no-source'] !== true,
    audio: values.audio === true,
    out: values.out,
    open: values.open === true,
  }

  switch (command) {
    case 'add':
      await commandAdd(positionals[1], {
        ...buildOptions,
        text: values.text,
        title: values.title,
        clipboard: values.clipboard === true,
        build: values.build === true,
        aiClean: values['no-ai-clean'] !== true,
      })
      break
    case 'build':
      await commandBuild(positionals[1] ?? 'latest', buildOptions)
      break
    case 'resplit':
      await commandResplit(positionals[1], positionals[2])
      break
    case 'list':
      printResources(await Store.open(storePath()))
      break
    case 'items':
      await commandItems(values.due === true, values.query)
      break
    case 'review':
      await commandReview(Number(values.port ?? 4317) || 4317, values.open === true, values.lan === true)
      break
    case 'export':
      await commandExport(positionals[1] ?? 'latest', values.out)
      break
    case 'audio':
      await commandAudio(positionals[1] ?? 'latest', values.open === true)
      break
    case 'style':
      await commandStyle(positionals[1], positionals.slice(2), {
        samples: values.samples,
        force: values.force === true,
        out: values.out,
        focus: values.focus,
      })
      break
    case 'demo':
      await commandDemo(values.open === true, values.style)
      break
    case 'doctor':
      await commandDoctor()
      break
    case 'backup':
      await commandBackup(positionals[1] ?? values.out)
      break
    case 'feedback':
      await commandFeedback(positionals.slice(1))
      break
    case 'unpublish':
      await commandUnpublish(positionals[1])
      break
    case 'prefetch':
      await commandPrefetch(positionals[1] ?? 'latest', {
        expand: values.expand === true,
        sentences: values.sentences === true,
      })
      break
    case 'guests':
      await commandGuests({
        days: values.days === undefined ? undefined : Number(values.days),
        force: values.force === true,
      })
      break
    case 'restore':
      await commandRestore(positionals[1], values.force === true)
      break
    case 'help':
    default:
      console.log(HELP)
      break
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
