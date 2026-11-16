import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { analyzeResource, suggestSelection } from '../analyze/index.js'
import { chatJson } from '../analyze/chat.js'
import { usageSummary } from '../analyze/usage.js'
import { z } from 'zod'
import { generateReadingAudio, generateSentenceAudio, getTtsVoice, isSayAvailable, listSystemVoices, readingText, speechFingerprint } from '../audio/tts.js'
import { seedCardCache } from '../analyze/card-cache.js'
import { knownRatioInText } from '../analyze/known.js'
import { generateDerivationGraph } from '../analyze/derivation.js'
import { enrichReadingNotes } from '../analyze/reading-notes.js'
import { detectBodyLead, generateFrontMatter } from '../analyze/reading-frontmatter.js'
import { generateReadingGuide } from '../analyze/reading-guide.js'
import { editFrontMatterText, editParagraphText } from '../analyze/reading-edit.js'
import { answerReadingQuestion } from '../analyze/note-answer.js'
import { filterPackForExport, selectExportWords } from '../analyze/export-words.js'
import { translateExercise } from '../analyze/exercise-translation.js'
import type { ExerciseKind } from '../analyze/exercise-translation.js'
import { generateSentenceCard, sentenceIdentity } from '../analyze/sentence-card.js'
import { generateSentenceRewrites } from '../analyze/sentence-rewrites.js'
import { generatePracticeFeedback } from '../analyze/sentence-practice.js'
import { sentences } from '../analyze/tokenize.js'
import { sentenceLookupKey, translateSentence } from '../analyze/sentence-translation.js'
import { generateWordCard, enrichWordRelations } from '../analyze/word-card.js'
import { generateWordStory } from '../analyze/word-story.js'
import { generateOutputFeedback } from '../analyze/output-feedback.js'
import { generateNuanceQuiz } from '../analyze/nuance.js'
import { addQuote, deleteQuote, listQuotes, setQuoteCommentary } from '../lab/quotes.js'
import { labPacks, loadLabPack } from '../lab/context.js'
import { labSpeech } from '../lab/audio.js'
import { petState } from '../lab/pet.js'
import { enrollWordbook, getWordbook, listWordbooks, wordbookView } from '../wordbooks/index.js'
import { generateAdventureFeedback, generateArgumentMap, generateDictationHint, generateDubbing, generateDungeonFlavor, generateLifeExamples, generateNewsShort, generatePetLine, generatePodcast, generateQuoteInsight, generateRegisterRemix, generateSubtitleHunter } from '../lab/generators.js'
import { renderLabApp } from './lab.js'
import { config, createWorkspace, currentWorkspace, ensureDirs, hasLlm, rootPacksDir, llmProviderOptions, llmStatus, projectRoot, publicModeEnabled, rootWorkspaceRef, runInWorkspace, saveLlmSettings, saveTtsSettings, storePath, ttsProviderOptions, ttsStatus } from '../config.js'
import { listProviderModels } from '../llm/models.js'
import { normalizeLlmProvider, providerPreset } from '../llm/providers.js'
import { buildWordGraph } from '../graph/build.js'
import {
  articleSections,
  getResourceArticles,
  isStudyArticle,
  resourceArticleCount,
  scopedResourceForArticle,
} from '../ingest/articles.js'
import { readEpub } from '../ingest/epub.js'
import { contentHash, ingestDocxBuffer, ingestEpubBuffer, ingestMobiBuffer, ingestPdfBuffer, ingestSource, ingestText } from '../ingest/index.js'
import { segmentsFromText } from '../ingest/segment.js'
import { countWords } from '../ingest/summary.js'
import { intensiveReadingMinutes } from '../pack/reading-time.js'
import { extractArticle } from '../ingest/web.js'
import { readMobi } from '../ingest/mobi.js'
import { readPdf } from '../ingest/pdf.js'
import { previewText, resourceWarnings } from '../ingest/summary.js'
import { writePack } from '../pack/build.js'
import { prefetchPack } from '../pack/prefetch.js'
import { renderHtml } from '../pack/html.js'
import { selectRemovableItems } from '../pack/rebuild.js'
import { addItemToPack, addSentenceToPack, generatePackItem, loadPack, removeItemFromPack, savePackFiles } from '../pack/mutate.js'
import {
  normalizeSentenceBoundaries,
  resyncReadingContexts,
  syncAfterParagraphDelete,
  syncAfterParagraphEdit,
  syncAfterTitleEdit,
} from '../pack/sync.js'
import {
  exportFileName,
  preparePackForExport,
  renderPackEpub,
  renderPackExportHtml,
  renderPackMobi,
  renderPackPdf,
  renderPackPng,
} from '../pack/export.js'
import { shouldMergeFragment } from '../pack/paragraph-merge.js'
import { renderPackPngPages } from '../pack/png-pages.js'
import { analyzeSelection } from '../pack/selection.js'
import { loadReadingProgress, readingPercent, readingSummary, resetReadingProgress, saveReadingProgress } from '../reading/progress.js'
import { Store } from '../store/store.js'
import type { DailyProgress } from '../store/store.js'
import { restoreLibraryBackup, writeLibraryBackup } from '../store/backup.js'
import { listTrash, purgeTrash, restoreTrash, trashPack, trashResource } from '../store/trash.js'
import { listStyleProfiles, loadStyleProfile, resolveDefaultStyle } from '../style/profile.js'
import type { LearningPack, PackRecord, Resource, ResourceArticle, StoredItem } from '../types.js'
import { accessCookie, accessTokenMatches, isLocalHostName, isLoopbackAddress, issueAccessToken, phoneUrls, requestAccessToken, withoutAccessToken } from './lan.js'
import { selectDailyWords } from './daily-words.js'
import { reviewHistory } from './history.js'
import { parseKnownWords } from './known-import.js'
import { appIconPng, pwaManifest } from './pwa.js'
import { qrSvg } from './qr.js'
import { recommendNext } from './recommend.js'
import { isDue, isLeech, isNew, stateLabel } from './scheduler.js'
import { weeklyMarkdown } from './weekly-report.js'
import type { Grade } from './scheduler.js'
import { achievementPayload } from './achievements.js'
import { DIAGNOSIS_WORDS, computeDiagnosisLevel, sampleDiagnosisWords } from './diagnosis.js'
import { weeklyPayload } from './weekly.js'
import { renderReviewApp } from './web.js'
import { VisitorRegistry, assertWorkspaceCapacity, isOwnerVisitor } from './visitors.js'
import { FeedbackBoard } from '../community/feedback.js'
import type { FeedbackStatus } from '../community/feedback.js'
import { rootDataDir } from '../config.js'

function dueLabel(item: StoredItem, now: Date = new Date()): string {
  if (item.status === 'known') return '已掌握'
  if (item.status === 'suspended') return '已暂停'
  const due = new Date(item.review.due)
  const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000)
  if (days <= 0) return '今天到期'
  if (days === 1) return '明天'
  return `${days} 天后`
}

function hasRealExample(item: StoredItem): boolean {
  return item.contexts.some((context) => context.sentence.trim().length >= 8) ||
    item.examples.some((example) => example.text.trim().length >= 8)
}

/** Wordbook examples are stored as "English — 中文"; split them for review. */
function splitExample(text: string): { sentence: string; translation: string } {
  const value = text.trim()
  const match = /^(.*?)\s+[—-]\s+(.+)$/s.exec(value)
  if (!match) return { sentence: value, translation: '' }
  return { sentence: match[1]!.trim(), translation: match[2]!.trim() }
}

function viewModel(item: StoredItem, store: Store, now: Date = new Date()) {
  const contextRecord = item.contexts[0]
  const example = item.contexts.length === 0
    ? item.examples.find((entry) => entry.text.trim().length >= 8)
    : undefined
  const exampleContext = example ? splitExample(example.text) : undefined
  const context = contextRecord?.sentence ?? exampleContext?.sentence ?? ''
  const translation = contextRecord?.translation ?? exampleContext?.translation ?? ''
  const contextKind: 'article' | 'example' | 'none' = contextRecord
    ? 'article'
    : exampleContext
      ? 'example'
      : 'none'
  const sourcePackRecord = contextRecord
    ? store.packs().find(
        (pack) => pack.resourceId === contextRecord.resourceId || pack.parentResourceId === contextRecord.resourceId,
      )
    : undefined
  const sourcePack = sourcePackRecord
    ? {
        id: sourcePackRecord.id,
        title:
          sourcePackRecord.title ??
          store.getResource(sourcePackRecord.resourceId)?.title ??
          sourcePackRecord.resourceId,
        url: packUrl(sourcePackRecord.id),
      }
    : null
  return {
    id: item.id,
    type: item.type,
    lemma: item.lemma,
    ipa: item.ipa,
    pos: item.pos,
    cefr: item.cefr,
    sense: item.sense,
    definition: item.definition,
    definitionZh: item.definitionZh,
    sentence: item.sentence ?? null,
    context,
    translation,
    contextKind,
    collocations: item.collocations,
    examples: item.examples.filter((example) => example.origin !== 'source').map((example) => example.text),
    relations: item.relations,
    wordFormation: item.wordFormation,
    memoryHook: item.memoryHook,
    notes: item.notes,
    sourceRef: item.sourceRef,
    sourcePack,
    due: item.review.due,
    dueLabel: dueLabel(item, now),
    state: stateLabel(item.review),
    contexts: item.contexts.length,
    favorite: item.favorite,
    status: item.status,
    staged: item.staged === true,
    introducedAt: item.introducedAt,
    hasExample: hasRealExample(item),
    isNew: isNew(item.review),
    leech: isLeech(item.review),
    lapses: item.review.lapses,
  }
}

function sendJson(response: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(body)
}

/** Return a consistent Chinese message instead of leaking a low-level error. */
function requireLlm(response: http.ServerResponse): boolean {
  if (hasLlm()) return false
  sendJson(response, 400, { error: '这个功能需要配置模型 API Key。请在导入页的“模型设置”里填写。' })
  return true
}

async function readBody(request: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) {
      throw new Error(`Request body is too large (limit ${Math.round(maxBytes / 1024 / 1024)} MB).`)
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

async function readJson(request: http.IncomingMessage, maxBytes = 5_000_000): Promise<Record<string, unknown>> {
  const body = await readBody(request, maxBytes)
  if (body.length === 0) return {}
  try {
    return JSON.parse(body.toString('utf8')) as Record<string, unknown>
  } catch {
    throw new Error('Request body is not valid JSON.')
  }
}


function readingNotesMarkdown(contents: LearningPack, progress: ReturnType<typeof readingSummary>): string {
  const title = contents.frontMatter?.title ?? contents.title
  const lines: string[] = []
  lines.push(`# ${title}`)
  if (contents.frontMatter?.titleZh) lines.push('', contents.frontMatter.titleZh)
  lines.push(
    '',
    `- 难度：${contents.difficulty.cefr}`,
    `- 词数：${contents.stats.wordCount}`,
    `- 进度：${progress.read} / ${progress.total} 段${progress.finishedAt ? '（已完成）' : ''}`,
    '',
  )
  const annotations = progress.annotations ?? []
  lines.push('## 我的批注', '')
  if (!annotations.length) {
    lines.push('_还没有批注。_', '')
  } else {
    for (const entry of annotations) {
      lines.push(`### 第 ${entry.paragraph + 1} 段`, '', `> ${entry.quote.replace(/\n+/g, ' ')}`, '')
      if (entry.note) lines.push(entry.note, '')
    }
  }
  const sentenceItems = contents.items.filter((item) => item.type === 'sentence' && item.sentence)
  lines.push('## 句子卡', '')
  if (!sentenceItems.length) {
    lines.push('_还没有句子卡。_', '')
  } else {
    for (const item of sentenceItems) {
      const sentence = item.sentence!
      lines.push(`- ${sentence.original}`)
      if (sentence.translation) lines.push(`  - ${sentence.translation}`)
      if (sentence.pattern) lines.push(`  - 句型：${sentence.pattern}`)
    }
    lines.push('')
  }
  const words = contents.items.filter((item) => item.type !== 'sentence')
  lines.push('## 本篇词汇', '')
  if (!words.length) {
    lines.push('_还没有词汇卡。_', '')
  } else {
    for (const item of words) {
      const meaning = item.definitionZh || item.definition || item.sense
      lines.push(`- **${item.lemma}**${item.ipa ? ` /${item.ipa}/` : ''} — ${meaning}`)
    }
    lines.push('')
  }
  lines.push('---', `由 CloseRead 导出于 ${new Date().toISOString().slice(0, 10)}`, '')
  return lines.join('\n')
}

function packUrl(packId: string): string {
  return `/read/${encodeURIComponent(packId)}`
}

function isVisibleArticle(resource: Resource, article: ResourceArticle): boolean {
  const override = resource.articleOverrides?.[String(article.index)]
  return override === undefined ? isStudyArticle(article) : override
}

async function saveUpload(buffer: Buffer, filename: string): Promise<string> {
  const dir = path.join(config.dataDir, 'uploads')
  await fs.mkdir(dir, { recursive: true })
  const safe = path.basename(filename).replace(/[^\w.\-]+/g, '_') || 'upload'
  const target = path.join(dir, `${randomUUID()}-${safe}`)
  await fs.writeFile(target, buffer)
  return target
}

function duplicateOf(store: Store, resource: Resource): Resource | undefined {
  const hash = String(resource.metadata.hash ?? contentHash(resource.text))
  return store
    .listResources()
    .find(
      (existing) =>
        existing.id !== resource.id &&
        String(existing.metadata.hash ?? contentHash(existing.text)) === hash,
    )
}

async function discardNewResource(resource: Resource): Promise<void> {
  await fs.rm(path.join(config.dataDir, 'resources', `${resource.id}.json`), { force: true }).catch(() => {})
  if (typeof resource.metadata.uploadPath === 'string') {
    await fs.rm(resource.metadata.uploadPath, { force: true }).catch(() => {})
  }
}

function packView(store: Store, pack: PackRecord) {
  const items = store.listItems().filter((item) =>
    item.contexts.some((context) => context.resourceId === pack.resourceId),
  )
  const now = new Date()
  return {
    id: pack.id,
    title: pack.title ?? store.getResource(pack.resourceId)?.title ?? pack.resourceId,
    itemCount: pack.itemCount,
    url: packUrl(pack.id),
    articleIndex: pack.articleIndex ?? null,
    due: items.filter((item) => item.status === 'active' && !isNew(item.review) && isDue(item.review, now)).length,
    mastered: items.filter((item) => item.status === 'known').length,
    learning: items.filter((item) => item.status === 'active').length,
  }
}

export interface ChapterNav {
  index: number | null
  total: number
  resourceTitle: string
  previous: { id: string; title: string; url: string; index: number } | null
  next: { id: string; title: string; url: string; index: number } | null
}

function chapterNav(store: Store, pack: PackRecord): ChapterNav | null {
  if (typeof pack.articleIndex !== 'number') return null
  const parent = pack.parentResourceId ?? pack.resourceId
  const siblings = store
    .packs()
    .filter(
      (entry) =>
        (entry.parentResourceId ?? entry.resourceId) === parent &&
        typeof entry.articleIndex === 'number',
    )
    .sort((a, b) => (a.articleIndex ?? 0) - (b.articleIndex ?? 0))
  if (siblings.length < 2) return null
  const position = siblings.findIndex((entry) => entry.id === pack.id)
  if (position < 0) return null
  const item = (entry: PackRecord) => ({
    id: entry.id,
    title: entry.title ?? store.getResource(entry.resourceId)?.title ?? entry.id,
    url: packUrl(entry.id),
    index: (entry.articleIndex ?? 0) + 1,
  })
  return {
    index: position + 1,
    total: siblings.length,
    resourceTitle: store.getResource(parent)?.title ?? parent,
    previous: position > 0 ? item(siblings[position - 1]!) : null,
    next: position < siblings.length - 1 ? item(siblings[position + 1]!) : null,
  }
}

function resourceView(resource: Resource, store: Store) {
  const packs = store
    .packs()
    .filter((pack) => pack.resourceId === resource.id || pack.parentResourceId === resource.id)
    .map((pack) => packView(store, pack))
  const articleCount = resourceArticleCount(resource)

  return {
    id: resource.id,
    title: resource.title,
    kind: resource.kind,
    wordCount: resource.wordCount,
    segmentCount: resource.segments.length,
    articleCount,
    createdAt: resource.createdAt,
    preview: previewText(resource.text, 240),
    warnings: resourceWarnings(resource).filter(
      (warning) => articleCount <= 1 || !warning.includes('整本材料'),
    ),
    canResplit: typeof resource.metadata.uploadPath === 'string',
    aiClean: resource.metadata.aiClean === 1,
    aiRemoved: Number(resource.metadata.aiRemoved ?? 0),
    aiCleanSkipped: resource.metadata.aiCleanSkipped === 1,
    aiCleanError: resource.metadata.aiCleanError === 1,
    document: {
      pages: Number(resource.metadata.pages ?? 0),
      extractablePages: Number(resource.metadata.extractablePages ?? 0),
      twoColumnPages: Number(resource.metadata.twoColumnPages ?? 0),
      removedLines: Number(resource.metadata.removedLines ?? 0),
      skippedPages: Number(resource.metadata.skippedPages ?? 0),
    },
    packs,
    pack: packs[0] ?? null,
  }
}

interface BuildJob {
  id: string
  resourceId: string
  articleIndex?: number
  status: 'running' | 'done' | 'error' | 'cancelled'
  message: string
  startedAt: string
  pack?: { id: string; title: string; itemCount: number; url: string; articleIndex?: number }
  removedItems?: number
  prefetched?: number
  error?: string
}

interface BuildRequestOptions {
  limit: number | 'auto'
  useLlm: boolean
  translate: boolean
  audio?: boolean
  onlyNew?: boolean
  styleName?: string
  articleIndex?: number
  /** Pre-generate answers/derivations/translations after the pack is built. */
  prefetch?: { answers?: boolean; expand?: boolean; sentences?: boolean }
}

const buildJobs = new Map<string, BuildJob>()
const jobControllers = new Map<string, AbortController>()
const activeBuilds = new Map<string, string>()
let cardsSeeded = false

function pruneJobs(): void {
  const cutoff = Date.now() - 30 * 60_000
  for (const [id, job] of buildJobs) {
    if (Date.parse(job.startedAt) < cutoff) buildJobs.delete(id)
  }
}

const sharedMetaCache = new Map<string, { cefr: string; title: string }>()
/** Fills in level and title for records written before those were stored. */
async function sharedMeta(pack: PackRecord): Promise<{ cefr: string; title: string }> {
  const cached = sharedMetaCache.get(pack.id)
  if (cached) return cached
  const contents = await loadPack(pack.dir).catch(() => undefined)
  const meta = {
    cefr: pack.cefr ?? contents?.difficulty?.cefr ?? '',
    title: pack.title ?? contents?.title ?? pack.id,
  }
  sharedMetaCache.set(pack.id, meta)
  return meta
}

const feedbackBoard = new FeedbackBoard(path.join(rootDataDir, 'community', 'feedback.json'))

const COMPILE_WINDOW_MS = 60_000
const COMPILE_PER_WINDOW = 6
const COMPILE_MAX_ACTIVE = 3
const compileWindows = new Map<string, { count: number; resetAt: number }>()
let compileActive = 0

/** Public compile is CPU work for strangers; keep it bounded. */
function compileAllowed(ip: string): { ok: boolean; error?: string } {
  if (!publicModeEnabled()) return { ok: true }
  if (compileActive >= COMPILE_MAX_ACTIVE) {
    return { ok: false, error: '正在处理的任务太多了，请稍等几秒再试。' }
  }
  const now = Date.now()
  const window = compileWindows.get(ip)
  if (!window || now > window.resetAt) {
    compileWindows.set(ip, { count: 1, resetAt: now + COMPILE_WINDOW_MS })
    return { ok: true }
  }
  if (window.count >= COMPILE_PER_WINDOW) {
    return { ok: false, error: '导入太频繁了，请一分钟后再试。' }
  }
  window.count += 1
  return { ok: true }
}

export interface CompileInput {
  kind: 'text' | 'url'
  text?: string
  url?: string
  title?: string
  level?: string
  limit?: number | 'auto'
  useLlm?: boolean
  translate?: boolean
  knownLemmas?: string[]
  llm?: { provider?: string; apiKey?: string; baseUrl?: string; model?: string }
}

export interface CompileResult {
  resource: Resource
  record: PackRecord
  pack: LearningPack
  html: string
  anki: string
  markdown: string
  mode: 'heuristic' | 'llm'
  warnings: string[]
}

/**
 * Stateless compile: everything is built inside a throwaway workspace and the
 * caller keeps the result. Nothing about the visitor's article survives here,
 * which is what lets the server stay replaceable and maintenance-free.
 */
export async function compileToPack(input: CompileInput): Promise<CompileResult> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'closeread-compile-'))
  const workspace = createWorkspace({
    id: 'compile',
    dataDir: path.join(tempRoot, 'data'),
    packsDir: path.join(tempRoot, 'packs'),
    level: input.level,
  })
  const llmInput = input.llm ?? {}
  const provider = normalizeLlmProvider(llmInput.provider ?? '')
  if (provider) {
    const preset = providerPreset(provider)
    const apiKey = llmInput.apiKey?.trim() ?? ''
    workspace.llm = {
      provider,
      apiKey,
      baseUrl: (llmInput.baseUrl?.trim() || preset.baseUrl).replace(/\/+$/, ''),
      model: llmInput.model?.trim() || preset.model,
      keySource: apiKey ? 'stored' : 'none',
    }
  }
  const useLlm = input.useLlm !== false && workspace.llm.apiKey.trim().length > 0

  try {
    return await runInWorkspace(workspace, async () => {
      ensureDirs()
      const aiClean = useLlm
      const resource =
        input.kind === 'url'
          ? await ingestSource(String(input.url ?? ''), { title: input.title, aiClean })
          : await ingestText(String(input.text ?? ''), { title: input.title, aiClean })
      const style = await resolveDefaultStyle()
      const outcome = await analyzeResource(resource, {
        limit: input.limit,
        knownRatio: 0,
        knownLemmas: Array.isArray(input.knownLemmas) ? input.knownLemmas : [],
        existingLemmas: [],
        avoidLemmas: [],
        selectionBias: 0,
        useLlm,
        translate: input.translate !== false,
        style,
      })
      const result = await writePack(resource, outcome, { includeSource: true, audio: false })
      const html = await fs.readFile(path.join(result.dir, 'index.html'), 'utf8')
      const anki = await fs.readFile(path.join(result.dir, 'anki.csv'), 'utf8').catch(() => '')
      const markdown = await fs.readFile(path.join(result.dir, 'pack.md'), 'utf8').catch(() => '')
      return {
        resource,
        record: result.record,
        pack: result.pack,
        html,
        anki,
        markdown,
        mode: outcome.mode,
        warnings: [...(result.pack.build?.warnings ?? [])],
      }
    })
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {})
  }
}


/**
 * The shared library lives in the server's root workspace. Visitors get their
 * own copy the first time they open a shared pack, so progress, notes and
 * cards keep working without a second storage model.
 */
async function adoptSharedPack(shared: Store, store: Store, packId: string): Promise<boolean> {
  if (!packId || store.findPack(packId)) return true
  let record = shared.findPack(packId)
  if (!record) {
    // The CLI may have published after this process started.
    await shared.reload().catch(() => {})
    record = shared.findPack(packId)
  }
  if (!record) return false
  const target = path.join(config.packsDir, path.basename(record.dir))
  try {
    await fs.cp(record.dir, target, { recursive: true, errorOnExist: false, force: false })
    const contents = await loadPack(target)
    await store.addPack({ ...record, dir: target, title: record.title ?? contents.title })
    const items = (contents.items ?? []).map((item) => ({ ...item }))
    if (items.length) await store.upsertItems(items as never)
    return true
  } catch {
    return false
  }
}


/** Turn network noise into something a reader can act on. */
function friendlyImportError(message: string, url?: string): string {
  const text = message.toLowerCase()
  if (text.includes('fetch failed') || text.includes('econnrefused') || text.includes('enotfound')) {
    return `打不开${url ? ` ${url}` : '这个链接'}：服务器连不上这个网站。可能被墙、需要登录，或者站点直接拒绝了抓取。可以复制正文粘贴进来。`
  }
  if (/\b(401|403)\b/.test(message)) {
    return '这个页面拒绝抓取（需要登录或被反爬拦截）。可以复制正文粘贴进来。'
  }
  if (/\b404\b/.test(message)) {
    return '链接返回 404，页面可能已经删除了。'
  }
  if (text.includes('timed out') || text.includes('timeout')) {
    return '抓取超时了，稍后重试，或者复制正文粘贴进来。'
  }
  return message
}

function startBuild(store: Store, resource: Resource, options: Partial<BuildRequestOptions> = {}): BuildJob {
  const buildKey = `${resource.id}:${options.articleIndex ?? 'all'}`
  const activeId = activeBuilds.get(buildKey)
  if (activeId) {
    const active = buildJobs.get(activeId)
    if (active && active.status === 'running') return active
  }

  const articles = options.articleIndex !== undefined ? getResourceArticles(resource) : []
  const article = options.articleIndex !== undefined ? articles[options.articleIndex] : undefined
  const target = article ? scopedResourceForArticle(resource, article) : resource

  const job: BuildJob = {
    id: randomUUID(),
    resourceId: resource.id,
    ...(article ? { articleIndex: article.index } : {}),
    status: 'running',
    message: article ? `准备生成「${article.title}」…` : '准备生成学习包…',
    startedAt: new Date().toISOString(),
  }
  buildJobs.set(job.id, job)
  activeBuilds.set(buildKey, job.id)
  const controller = new AbortController()
  jobControllers.set(job.id, controller)

  const limit = options.limit ?? 'auto'
  const libraryItems = store.listItems()
  const existingLibraryIds = new Set(libraryItems.map((item) => item.id))
  const knownLemmas = store.knownLemmas()
  const existingLemmas = libraryItems
    .filter((item) => item.status === 'active')
    .map((item) => item.lemma)
  const preferences = store.preferences()
  const disliked = Object.entries(preferences.wordFeedback)
    .filter(([, score]) => score <= -2)
    .map(([lemma]) => lemma)
  const avoidLemmas = options.onlyNew
    ? [
        ...new Set([
          ...disliked,
          ...libraryItems.filter((item) => item.status !== 'suspended').map((item) => item.lemma),
        ]),
      ]
    : disliked
  const knownRatio = knownRatioInText(target.text, knownLemmas)

  void (async () => {
    try {
      if (!cardsSeeded) {
        await seedCardCache(store.listItems())
        cardsSeeded = true
      }
      const previous = store.packs().find((pack) => pack.id === `pack-${target.id}`)
      let previousItemIds: string[] = []
      if (previous) {
        try {
          previousItemIds = (await loadPack(previous.dir)).items.map((item) => item.id)
        } catch {
          // A missing old pack simply means there is nothing to reconcile.
        }
      }

      const style = options.styleName
        ? await loadStyleProfile(options.styleName).catch(() => resolveDefaultStyle())
        : await resolveDefaultStyle()
      const outcome = await analyzeResource(target, {
        limit,
        knownRatio,
        knownLemmas,
        existingLemmas,
        avoidLemmas,
        selectionBias: preferences.selectionBias,
        useLlm: options.useLlm !== false,
        translate: options.translate !== false,
        style,
        signal: controller.signal,
        onProgress: (message) => {
          job.message = message
        },
      })
      controller.signal.throwIfAborted()
      for (const item of outcome.analysis.items) {
        const existing = store.getItem(item.id)
        item.libraryState = existing ? (existing.status === 'known' ? 'known' : 'learning') : 'new'
        if (item.libraryState !== 'new') item.tier = 'bonus'
      }
      const coreCount = outcome.analysis.items.filter((item) => item.tier === 'core').length
      outcome.selection = {
        ...outcome.selection,
        core: coreCount,
        bonus: Math.max(0, outcome.analysis.items.length - coreCount),
        ...(outcome.analysis.items.some((item) => item.libraryState === 'learning')
          ? { reused: outcome.analysis.items.filter((item) => item.libraryState === 'learning').length }
          : {}),
      }
      job.message = '写入学习包文件…'
      const result = await writePack(target, outcome, { includeSource: true, audio: options.audio === true })
      const coreItems = outcome.analysis.items.filter(
        (item) => item.tier === 'core' && item.libraryState !== 'known',
      )
      await store.upsertItems(coreItems)
      const newCoreIds = new Set(coreItems.map((item) => item.id))
      // Rebuilding a pack must never silently delete a card that was already
      // in the learner's library. Old cards that are no longer selected stay
      // reviewable (the pack UI can still remove them explicitly).
      const removable = selectRemovableItems({
        previousItemIds,
        keepIds: newCoreIds,
        existingIds: existingLibraryIds,
        resourceId: target.id,
        contextsOf: (itemId) => store.getItem(itemId)?.contexts,
      })
      job.removedItems = await store.removeItems(removable)
      const record: PackRecord = {
        ...result.record,
        resourceId: target.id,
        title: result.pack.title,
        cefr: result.pack.difficulty.cefr,
        ...(article ? { parentResourceId: resource.id, articleIndex: article.index } : {}),
      }
      await store.addPack(record)
      await store.recordDailyArticle(record.id, record.title ?? result.pack.title)
      const prefetch = options.prefetch
      if (prefetch && (prefetch.answers || prefetch.expand || prefetch.sentences)) {
        try {
          const contents = await loadPack(result.dir)
          const extra = await prefetchPack(contents, result.dir, prefetch, (message) => {
            job.message = message
          })
          const total = extra.answers + extra.expand + extra.sentences
          job.prefetched = total
        } catch {
          // A failed prefetch must not fail the pack that was already written.
        }
      }
      job.status = 'done'
      job.message = '学习包已生成'
      job.pack = {
        id: result.pack.id,
        title: result.pack.title,
        itemCount: result.pack.items.length,
        url: packUrl(result.pack.id),
        ...(article ? { articleIndex: article.index } : {}),
      }
    } catch (error) {
      if (controller.signal.aborted) {
        job.status = 'cancelled'
        job.message = '已取消'
        job.error = undefined
      } else {
        job.status = 'error'
        job.message = '生成失败'
        job.error = error instanceof Error ? error.message : String(error)
      }
    } finally {
      activeBuilds.delete(buildKey)
      jobControllers.delete(job.id)
    }
  })()

  return job
}

function contentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.md':
      return 'text/markdown; charset=utf-8'
    case '.csv':
      return 'text/csv; charset=utf-8'
    case '.m4a':
    case '.mp4':
      return 'audio/mp4'
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    default:
      return 'application/octet-stream'
  }
}

function nextArticleSuggestion(store: Store): {
  resourceId: string
  resourceTitle: string
  articleIndex: number
  articleTitle: string
  wordCount: number
} | null {
  for (const resource of store.listResources()) {
    const articles = getResourceArticles(resource).filter((article) => isVisibleArticle(resource, article))
    if (articles.length <= 1) continue
    const built = new Set(
      store
        .packs()
        .filter((pack) => pack.parentResourceId === resource.id)
        .map((pack) => pack.articleIndex)
        .filter((index): index is number => typeof index === 'number'),
    )
    const next = articles.find((article) => !built.has(article.index))
    if (next) {
      return {
        resourceId: resource.id,
        resourceTitle: resource.title,
        articleIndex: next.index,
        articleTitle: next.title,
        wordCount: next.wordCount,
      }
    }
  }
  return null
}

interface ReadingCard {
  packId: string
  title: string
  url: string
  read: number
  total: number
  percent: number
  lastParagraph: number
  lastSentence?: number
  updatedAt: string
  started: boolean
  finished: boolean
}

function readingCard(store: Store, pack: PackRecord, progress: {
  readParagraphs: number[]
  totalParagraphs: number
  lastParagraph: number
  updatedAt: string
  startedAt?: string
  finishedAt?: string
  lastSentence?: number
}): ReadingCard {
  return {
    packId: pack.id,
    title: pack.title ?? store.getResource(pack.resourceId)?.title ?? pack.id,
    url: packUrl(pack.id),
    read: progress.readParagraphs.length,
    total: progress.totalParagraphs,
    percent: readingPercent({
      packId: pack.id,
      totalParagraphs: progress.totalParagraphs,
      readParagraphs: progress.readParagraphs,
      lastParagraph: progress.lastParagraph,
      updatedAt: progress.updatedAt,
      ...(progress.startedAt ? { startedAt: progress.startedAt } : {}),
      ...(progress.finishedAt ? { finishedAt: progress.finishedAt } : {}),
    }),
    lastParagraph: progress.lastParagraph,
    ...(typeof progress.lastSentence === 'number' ? { lastSentence: progress.lastSentence } : {}),
    updatedAt: progress.updatedAt,
    started: Boolean(progress.startedAt),
    finished: Boolean(progress.finishedAt),
  }
}

async function readingDashboard(store: Store, daily: DailyProgress) {
  let current: ReadingCard | null = null
  const recent: ReadingCard[] = []
  let finished = 0
  let inProgress = 0
  let paragraphsRead = 0
  let unread: ReadingCard | null = null
  // Newest packs first so a built-but-unread article can be recommended when
  // there is no reading in progress.
  const packs = [...store.packs()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  for (const pack of packs) {
    const progress = await loadReadingProgress(pack.dir, pack.id, 0)
    paragraphsRead += progress.readParagraphs.length
    if (!progress.startedAt && !progress.finishedAt) {
      if (!unread) {
        let total = 0
        try {
          total = (await loadPack(pack.dir)).reading?.length ?? 0
        } catch {
          // Ignore packs whose files were deleted.
        }
        if (total > 0) {
          unread = readingCard(store, pack, { ...progress, totalParagraphs: total })
        }
      }
      continue
    }
    const card = readingCard(store, pack, progress)
    recent.push(card)
    if (progress.finishedAt) {
      finished += 1
      continue
    }
    inProgress += 1
    if (!current || card.updatedAt > current.updatedAt) current = card
  }
  if (!current && unread) current = unread

  let today: ReadingCard | null = null
  if (daily.articlePackId) {
    const pack = store.findPack(daily.articlePackId)
    if (pack) {
      let total = 0
      try {
        total = (await loadPack(pack.dir)).reading?.length ?? 0
      } catch {
        // A missing pack can still show its stored reading progress.
      }
      const progress = await loadReadingProgress(pack.dir, pack.id, total)
      today = readingCard(store, pack, progress)
      if (!today.finished && !current) current = today
      if (current && current.packId === today.packId) current = today
      const recentIndex = recent.findIndex((card) => card.packId === today!.packId)
      if (recentIndex >= 0) recent[recentIndex] = today
      if (!progress.startedAt && !progress.finishedAt && today.total > 0) {
        recent.unshift(today)
      }
    }
  }

  recent.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const sentenceCards = store.listItems().filter((item) => item.type === 'sentence').length
  return {
    current,
    today,
    recent: recent.slice(0, 5),
    stats: { finished, inProgress, paragraphsRead, sentenceCards },
  }
}

interface PassportStamp {
  packId: string
  title: string
  titleZh?: string
  url: string
  finishedAt?: string
  updatedAt: string
  finished: boolean
  percent: number
  read: number
  total: number
  wordCount?: number
  cefr?: string
  minutes?: number
  itemCount?: number
  quote?: string
  quoteZh?: string
}

function firstSentence(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  const match = /^(.+?[.!?])(?:\s|$)/.exec(compact)
  return (match?.[1] ?? compact).slice(0, 220)
}

function passportQuote(pack: LearningPack): { quote?: string; quoteZh?: string } {
  const lead = pack.frontMatter?.lead?.trim()
  if (lead) {
    return {
      quote: lead.slice(0, 220),
      ...(pack.frontMatter?.leadZh?.trim() ? { quoteZh: pack.frontMatter.leadZh.trim().slice(0, 220) } : {}),
    }
  }
  const paragraph = pack.reading?.find((entry) => entry.original.trim())
  if (paragraph) {
    return { quote: firstSentence(paragraph.original) }
  }
  if (pack.summary.trim()) return { quote: firstSentence(pack.summary) }
  return {}
}

async function passportPayload(store: Store) {
  const packs = store.packs()
  const storeStats = store.stats()
  const progressEntries: Array<{
    pack: PackRecord
    contents?: LearningPack
    progress: Awaited<ReturnType<typeof loadReadingProgress>>
  }> = []
  let finished = 0
  let inProgress = 0
  let paragraphsRead = 0
  let words = 0
  let minutes = 0
  const days = new Set<string>()

  for (const pack of packs) {
    let contents: LearningPack | undefined
    let total = 0
    try {
      contents = await loadPack(pack.dir)
      total = contents.reading?.length ?? 0
    } catch {
      // A pack whose body was deleted can still contribute stored progress.
    }
    const progress = await loadReadingProgress(pack.dir, pack.id, total)
    const touched = Boolean(progress.startedAt || progress.finishedAt || progress.readParagraphs.length)
    if (!touched) continue
    progressEntries.push({ pack, contents, progress })
    paragraphsRead += progress.readParagraphs.length
    if (progress.finishedAt) {
      finished += 1
      if (contents) {
        words += contents.stats.wordCount
        minutes += contents.stats.readingMinutes
      }
    } else {
      inProgress += 1
    }
    if (progress.readParagraphs.length || progress.finishedAt) {
      for (const value of [progress.startedAt, progress.finishedAt, progress.updatedAt]) {
        if (value) days.add(value.slice(0, 10))
      }
    }
  }

  const stamps: PassportStamp[] = progressEntries
    .map(({ pack, contents, progress }) => {
      const title = contents?.frontMatter?.title ?? pack.title ?? store.getResource(pack.resourceId)?.title ?? pack.id
      const quote = contents ? passportQuote(contents) : {}
      return {
        packId: pack.id,
        title,
        ...(contents?.frontMatter?.titleZh ? { titleZh: contents.frontMatter.titleZh } : {}),
        url: packUrl(pack.id),
        ...(progress.finishedAt ? { finishedAt: progress.finishedAt } : {}),
        updatedAt: progress.updatedAt,
        finished: Boolean(progress.finishedAt),
        percent: readingPercent(progress),
        read: progress.readParagraphs.length,
        total: progress.totalParagraphs,
        ...(contents ? { wordCount: contents.stats.wordCount } : {}),
        ...(contents?.difficulty.cefr ? { cefr: contents.difficulty.cefr } : {}),
        ...(contents ? { minutes: contents.stats.readingMinutes } : {}),
        ...(contents ? { itemCount: contents.items.length } : {}),
        ...quote,
      }
    })
    .sort((a, b) => (b.finishedAt ?? b.updatedAt).localeCompare(a.finishedAt ?? a.updatedAt))

  const achievements = await achievementPayload(store)

  return {
    achievements,
    stats: {
      streak: store.preferences().streak,
      finished,
      inProgress,
      paragraphsRead,
      words,
      minutes,
      days: days.size,
      cards: storeStats.total,
      sentenceCards: store.listItems().filter((item) => item.type === 'sentence').length,
      outputs: store.listOutputs(500).length,
    },
    stamps,
  }
}

async function todayPayload(store: Store, now: Date = new Date()) {
  const stats = store.stats(now)
  const preferences = store.preferences()
  const daily = store.todayProgress(now)
  const suggestion = nextArticleSuggestion(store)
  const reading = await readingDashboard(store, daily)
  let article: {
    id: string
    title: string
    url: string
    itemCount: number
    outputPrompt: string | null
    outputAnswer: string | null
  } | null = null

  if (daily.articlePackId) {
    const pack = store.findPack(daily.articlePackId)
    if (pack) {
      let outputPrompt: string | null = null
      let outputAnswer: string | null = null
      if (daily.articleFinished) {
        try {
          const contents = await loadPack(pack.dir)
          const discussion = contents.exercises.discussion[0]
          outputPrompt = discussion?.question ?? contents.exercises.comprehension[0]?.question ?? null
          outputAnswer = discussion?.answer ?? contents.exercises.comprehension[0]?.answer ?? null
        } catch {
          // A missing pack still counts as today's reading; the prompt is optional.
        }
      }
      article = {
        id: pack.id,
        title: pack.title ?? store.getResource(pack.resourceId)?.title ?? pack.id,
        url: packUrl(pack.id),
        itemCount: pack.itemCount,
        outputPrompt,
        outputAnswer,
      }
    }
  }

  const reviewDone = daily.dueAtStart === 0 || daily.reviewed >= daily.dueAtStart
  const latestOutput = store.outputForDate(daily.date)
  const outputs = store.listOutputs(5, now)
  return {
    date: daily.date || now.toISOString().slice(0, 10),
    streak: preferences.streak,
    selectionBias: preferences.selectionBias,
    desiredRetention: preferences.desiredRetention,
    diagnosis: preferences.diagnosis ?? null,
    completed: daily.completed,
    warnings: store.warnings(),
    reading,
    outputs,
    steps: {
      review: {
        done: reviewDone,
        dueTarget: Math.min(stats.reviewDue, preferences.dailyReviewTarget),
        newTarget: Math.min(stats.newItems, preferences.dailyNewTarget),
        newReviewed: stats.newReviewedToday,
        dueAtStart: daily.dueAtStart,
        reviewed: daily.reviewed,
        remaining: Math.max(0, daily.dueAtStart - daily.reviewed),
        totalDue: stats.reviewDue,
        backlog: stats.backlog,
        newLimit: preferences.dailyNewTarget,
        newAvailable: stats.newItems,
        sentenceDue: store.dueItems(now, Number.MAX_SAFE_INTEGER).filter((item) => item.type === 'sentence' && !isNew(item.review)).length,
      },
      article: {
        done: daily.articleFinished,
        title: article?.title ?? daily.articleTitle ?? null,
        url: article?.url ?? null,
        started: Boolean(reading.today?.started),
        percent: reading.today?.percent ?? 0,
        recommendation: reading.current,
        suggestion,
      },
      output: {
        done: daily.outputDone && daily.articleFinished && Boolean(latestOutput?.text),
        prompt: article?.outputPrompt ?? latestOutput?.prompt ?? null,
        answer: latestOutput?.answer ?? (daily.outputDone ? article?.outputAnswer ?? null : null),
        text: latestOutput?.text ?? null,
        articleTitle: latestOutput?.articleTitle ?? article?.title ?? null,
      },
    },
    stats: {
      due: stats.due,
      reviewDue: stats.reviewDue,
      dueToday: stats.dueToday,
      newReviewedToday: stats.newReviewedToday,
      backlog: stats.backlog,
      reviewedToday: stats.reviewedToday,
      total: stats.total,
      firstReviewed: stats.firstReviewed,
      firstCorrect: stats.firstCorrect,
      firstAccuracy: stats.firstAccuracy,
    },
  }
}

export interface LanStatus {
  enabled: boolean
  /** True when the caller is the machine running CloseRead. */
  local: boolean
  /** True for a public deployment, where every visitor gets the full UI. */
  public: boolean
  port: number | null
  urls: string[]
  qr: Array<{ url: string; svg: string }>
}

interface LanState {
  enabled: boolean
  token: string
  port: number | null
}

interface LanController {
  state: LanState
  status: (local: boolean) => LanStatus
  enable: () => Promise<LanStatus>
  disable: () => Promise<LanStatus>
}

function sendAccessDenied(response: http.ServerResponse, api: boolean): void {
  if (api) {
    sendJson(response, 401, { error: '需要手机访问令牌。' })
    return
  }
  response.writeHead(401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  response.end(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>需要访问令牌</title>
<style>body{margin:0;background:#f6f2e8;color:#1c1a16;font:15px/1.7 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}
main{max-width:560px;margin:14vh auto;padding:0 24px}h1{font-family:Georgia,serif;font-size:30px;margin:0 0 12px}
p{color:rgba(28,26,22,.62)}</style></head><body><main>
<h1>需要访问令牌</h1>
<p>请回到电脑上的 CloseRead，在“手机”面板复制带令牌的链接，再用手机打开。</p>
<p>令牌只在本机生成；关闭手机访问后会立即失效。</p>
</main></body></html>`)
}

function sendPhoneForbidden(response: http.ServerResponse, api: boolean): void {
  if (api) {
    sendJson(response, 403, { error: '手机访问只支持阅读、复习和练习；导入、删除和设置只能在电脑上操作。' })
    return
  }
  response.writeHead(403, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  response.end(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>仅支持阅读</title>
<style>body{margin:0;background:#f6f2e8;color:#1c1a16;font:15px/1.7 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}
main{max-width:560px;margin:14vh auto;padding:0 24px}h1{font-family:Georgia,serif;font-size:30px;margin:0 0 12px}
p{color:rgba(28,26,22,.62)}</style></head><body><main>
<h1>手机端只支持阅读和复习</h1>
<p>导入、删除、生成学习包和修改模型设置请回到电脑上的 CloseRead。</p>
</main></body></html>`)
}

const PHONE_READ_EXACT = new Set([
  '/api/summary',
  '/api/styles',
  '/api/today',
  '/api/queue',
  '/api/plan',
  '/api/weekly',
  '/api/weekly/export',
  '/api/history',
  '/api/forecast',
  '/api/passport',
  '/api/packs',
  '/api/resources',
  '/api/vocab',
  '/api/items',
  '/api/wordbooks',
  '/api/graph',
  '/api/lab',
  '/api/lab/quotes',
  '/api/preferences',
  '/api/diagnosis',
  '/api/llm',
  '/api/tts',
  '/api/lan',
  '/api/outputs',
  '/api/study/queue',
])

const PHONE_WRITE_EXACT = new Set([
  '/api/review',
  '/api/review/undo',
  '/api/favorite',
  '/api/status',
  '/api/items/bulk',
  '/api/vocab/known',
  '/api/vocab/select',
  '/api/preferences',
  '/api/diagnosis',
  '/api/today/output',
  '/api/lab/tts',
  '/api/lab/generate',
  '/api/graph/adopt',
])

const PHONE_WRITE_PATTERNS = [
  /^\/api\/packs\/[^/]+\/reading(?:\/reset)?$/,
  /^\/api\/packs\/[^/]+\/annotations$/,
  /^\/api\/packs\/[^/]+\/adopt$/,
  /^\/api\/pack\/[^/]+\/add$/,
  /^\/api\/pack\/[^/]+\/remove$/,
  /^\/api\/pack\/[^/]+\/sentence$/,
  /^\/api\/pack\/[^/]+\/analyze-selection$/,
  /^\/api\/pack\/[^/]+\/audio$/,
  /^\/api\/pack\/[^/]+\/sentence-audio$/,
  /^\/api\/pack\/[^/]+\/translate-sentence$/,
  /^\/api\/pack\/[^/]+\/reading\/answer$/,
  /^\/api\/pack\/[^/]+\/items\/[^/]+\/(?:derivation|story|rewrites|practice|expand)$/,
  /^\/api\/items\/[^/]+\/(?:nuance|enrich|examples|update)$/,
  /^\/api\/outputs\/[^/]+\/feedback$/,
  /^\/api\/outputs\/[^/]+\/revision$/,
  /^\/api\/outputs\/[^/]+\/revisions\/[^/]+\/feedback$/,
]

function isPhoneAllowed(method: string, pathname: string): boolean {
  if (method === 'GET' || method === 'HEAD') {
    if (
      pathname === '/' ||
      pathname === '/lab' ||
      pathname === '/lab/' ||
      pathname === '/bookmarklet' ||
      pathname === '/reader.js' ||
      pathname === '/reader.css' ||
      pathname === '/lab.js' ||
      pathname === '/lab.css' ||
      pathname === '/manifest.webmanifest' ||
      pathname === '/sw.js' ||
      pathname === '/icon-192.png' ||
      pathname === '/icon-512.png' ||
      pathname === '/apple-touch-icon.png' ||
      pathname.startsWith('/read/') ||
      pathname.startsWith('/pack/') ||
      pathname.startsWith('/lab/audio/')
    ) {
      return true
    }
    if (!pathname.startsWith('/api/')) return false
    if (PHONE_READ_EXACT.has(pathname)) return true
    return (
      /^\/api\/items\/[^/]+$/.test(pathname) ||
      /^\/api\/wordbooks\/[^/]+$/.test(pathname) ||
      /^\/api\/packs\/[^/]+\/reading$/.test(pathname) ||
      /^\/api\/packs\/[^/]+\/neighbors$/.test(pathname) ||
      /^\/api\/packs\/[^/]+\/recommend$/.test(pathname) ||
      /^\/api\/resources\/[^/]+\/articles$/.test(pathname) ||
      /^\/api\/jobs\/[^/]+$/.test(pathname)
    )
  }
  if (method !== 'POST') {
    if (method === 'DELETE') return /^\/api\/packs\/[^/]+\/annotations\/[^/]+$/.test(pathname)
    return false
  }
  if (PHONE_WRITE_EXACT.has(pathname)) return true
  return PHONE_WRITE_PATTERNS.some((pattern) => pattern.test(pathname))
}

async function handle(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  store: Store,
  lan: LanController,
  requireToken: boolean,
  visitors: VisitorRegistry,
  shared: Store,
  visitorId: string,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const method = request.method ?? 'GET'
  const remoteLoopback = isLoopbackAddress(request.socket.remoteAddress)

  // The local server must not become reachable through DNS rebinding.
  const host = (request.headers.host ?? '').toLowerCase()
  const trustedHost = config.publicHosts.some(
    (entry) => host === entry || host === `${entry}:443`,
  )
  if (!requireToken && !isLocalHostName(host) && !trustedHost) {
    sendJson(response, 403, { error: 'Unexpected Host header.' })
    return
  }

  // The owner link carries a secret; drop it from the address bar after the
  // cookie has been issued.
  const ownerKey = process.env.LEARN_OWNER_KEY?.trim() ?? ''
  if (method === 'GET' && ownerKey.length >= 16 && url.searchParams.get('owner') === ownerKey) {
    const next = new URL(url)
    next.searchParams.delete('owner')
    response.writeHead(302, {
      location: `${next.pathname}${next.search}`,
      'cache-control': 'no-store',
    })
    response.end()
    return
  }

  if (requireToken) {
    const token = requestAccessToken(request, url)
    if (!accessTokenMatches(token, lan.state.token)) {
      sendAccessDenied(response, url.pathname.startsWith('/api/'))
      return
    }
    if (!isPhoneAllowed(method, url.pathname)) {
      sendPhoneForbidden(response, url.pathname.startsWith('/api/'))
      return
    }
    if (
      url.searchParams.has('token') &&
      (method === 'GET' || method === 'HEAD') &&
      !url.pathname.startsWith('/api/')
    ) {
      response.writeHead(302, {
        location: withoutAccessToken(url),
        'set-cookie': accessCookie(lan.state.token),
        'cache-control': 'no-store',
      })
      response.end()
      return
    }
  }

  if (method !== 'GET' && method !== 'HEAD') {
    const origin = request.headers.origin
    const scheme = request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
    if (origin && origin !== `${scheme}://${request.headers.host ?? ''}`) {
      sendJson(response, 403, { error: 'Cross-origin request rejected.' })
      return
    }
  }


  // The read-only demo (used by bots and by visitors who have not written yet)
  // must never accept writes: a script could otherwise pollute the shared library.
  const statelessWrite =
    url.pathname === '/api/preview' ||
    url.pathname === '/api/feedback' ||
    url.pathname.startsWith('/api/feedback/')
  if (currentWorkspace().readOnly && method !== 'GET' && method !== 'HEAD' && !statelessWrite) {
    sendJson(response, 403, { error: '演示空间是只读的，请先创建自己的空间。' })
    return
  }

  // Opening a shared pack copies it into this visitor's workspace first.
  const packIdInPath =
    /^\/api\/pack\/([^/]+)/.exec(url.pathname)?.[1] ??
    /^\/api\/packs\/([^/]+)/.exec(url.pathname)?.[1] ??
    /^\/read\/([^/]+)/.exec(url.pathname)?.[1]
  if (packIdInPath && shared !== store) {
    await adoptSharedPack(shared, store, decodeURIComponent(packIdInPath))
  }

  if (method === 'GET' && (url.pathname === '/lab' || url.pathname === '/lab/')) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(renderLabApp())
    return
  }

  if (method === 'GET' && url.pathname === '/manifest.webmanifest') {
    response.writeHead(200, {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    })
    response.end(JSON.stringify(pwaManifest()))
    return
  }

  const iconMatch = /^\/(icon-192\.png|icon-512\.png|apple-touch-icon\.png)$/.exec(url.pathname)
  if (method === 'GET' && iconMatch) {
    const size = iconMatch[1] === 'icon-192.png' ? 192 : iconMatch[1] === 'icon-512.png' ? 512 : 180
    const icon = appIconPng(size)
    response.writeHead(200, {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=3600',
      'content-length': icon.length,
    })
    response.end(icon)
    return
  }

  if (method === 'GET' && url.pathname === '/sw.js') {
    try {
      const content = await fs.readFile(path.join(projectRoot, 'src', 'review', 'sw.js'), 'utf8')
      response.writeHead(200, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-cache',
      })
      response.end(content)
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Service worker not found')
    }
    return
  }


  const notesMatch = /^\/read\/([^/]+)\/notes\.md$/.exec(url.pathname)
  if (method === 'GET' && notesMatch) {
    const packId = decodeURIComponent(notesMatch[1] ?? '')
    const pack = store.findPack(packId)
    if (!pack) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Pack not found')
      return
    }
    try {
      const contents = await loadPack(pack.dir)
      const progress = await loadReadingProgress(pack.dir, pack.id, contents.reading?.length ?? 0)
      const markdown = readingNotesMarkdown(contents, readingSummary(progress))
      response.writeHead(200, {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="reading-notes.md"; filename*=UTF-8''${encodeURIComponent(`${contents.title}-精读笔记.md`)}`,
        'cache-control': 'no-store',
      })
      response.end(markdown)
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(error instanceof Error ? error.message : String(error))
    }
    return
  }

  if (method === 'GET' && url.pathname.startsWith('/read/')) {
    const packId = decodeURIComponent(url.pathname.slice('/read/'.length).split('/')[0] ?? '')
    const pack = store.findPack(packId)
    if (!pack) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Pack not found')
      return
    }
    try {
      const contents = await loadPack(pack.dir)
      const html = renderHtml(contents, contents.audio ?? { items: {} }, { inApp: true })
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      response.end(html)
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(error instanceof Error ? error.message : String(error))
    }
    return
  }

  if (method === 'GET' && url.pathname === '/app.js') {
    const version = url.searchParams.get('v') ?? ''
    let script = appScriptCache.get(version)
    if (!script) {
      externalizeAppScript(renderReviewApp())
      script = appScriptCache.get(version) ?? [...appScriptCache.values()].at(-1)
    }
    if (!script) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Script not found')
      return
    }
    response.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
    })
    response.end(script)
    return
  }

  if (method === 'GET' && url.pathname === '/vendor/fflate.js') {
    try {
      const content = await fs.readFile(path.join(projectRoot, 'src', 'review', 'vendor', 'fflate.js'), 'utf8')
      response.writeHead(200, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'public, max-age=86400',
      })
      response.end(content)
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Vendor asset not found')
    }
    return
  }

  if (method === 'GET' && (url.pathname === '/reader.js' || url.pathname === '/reader.css' || url.pathname === '/local-file-db.js')) {
    const name = url.pathname.slice(1)
    try {
      const content = await fs.readFile(path.join(projectRoot, 'src', 'review', name), 'utf8')
      response.writeHead(200, {
        'content-type': name.endsWith('.css')
          ? 'text/css; charset=utf-8'
          : 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
      })
      response.end(content)
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Reader asset not found')
    }
    return
  }

  if (method === 'GET' && (url.pathname === '/lab.js' || url.pathname === '/lab.css')) {
    const name = url.pathname.slice(1)
    try {
      const content = await fs.readFile(path.join(projectRoot, 'src', 'review', name), 'utf8')
      response.writeHead(200, {
        'content-type': name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
      })
      response.end(content)
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Lab asset not found')
    }
    return
  }

  if (method === 'GET' && url.pathname.startsWith('/lab/audio/')) {
    const root = path.join(config.dataDir, 'lab', 'audio')
    const relative = decodeURIComponent(url.pathname.slice('/lab/audio/'.length))
    const filePath = path.resolve(root, relative)
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Forbidden')
      return
    }
    try {
      const stat = await fs.stat(filePath)
      response.writeHead(200, {
        'content-type': contentType(filePath),
        'content-length': String(stat.size),
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
      })
      response.end(await fs.readFile(filePath))
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Audio not found')
    }
    return
  }

  if (method === 'GET' && url.pathname === '/api/lab') {
    const requested = url.searchParams.get('scope') ?? url.searchParams.get('packId') ?? 'all'
    const scopes = labPacks(store)
    let source = null
    try {
      source = loadLabPack(store, requested)
    } catch {
      // An empty library is a valid first-run state.
    }
    const quotes = await listQuotes()
    const ttsAvailable = ttsStatus().configured || (await isSayAvailable())
    sendJson(response, 200, {
      scopes: scopes.map((entry) => ({
        id: entry.id,
        title: entry.title,
        cefr: entry.cefr,
        wordCount: entry.wordCount,
        itemCount: entry.itemCount,
        summary: entry.summary,
        newCount: entry.newCount,
        dueCount: entry.dueCount,
        leechCount: entry.leechCount,
      })),
      packs: scopes.map((entry) => ({
        id: entry.id,
        title: entry.title,
        cefr: entry.cefr,
        wordCount: entry.wordCount,
        itemCount: entry.itemCount,
        summary: entry.summary,
      })),
      pack: source?.info ?? null,
      source: source?.info ?? null,
      words: source?.words.map((item) => viewModel(item, store)) ?? [],
      quotes,
      pet: petState(store),
      status: { llm: hasLlm(), tts: ttsAvailable },
    })
    return
  }

  if (method === 'POST' && url.pathname === '/api/lab/tts') {
    try {
      const body = await readJson(request)
      const text = String(body.text ?? '').trim()
      if (!text) {
        sendJson(response, 400, { error: '没有可朗读的文本。' })
        return
      }
      if (text.length > 12_000) {
        sendJson(response, 400, { error: '这段文本太长，建议分成小段。' })
        return
      }
      const speech = await labSpeech(text)
      sendJson(response, 200, speech)
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'GET' && url.pathname === '/api/lab/quotes') {
    sendJson(response, 200, { quotes: await listQuotes() })
    return
  }

  if (method === 'POST' && url.pathname === '/api/lab/quotes') {
    try {
      const body = await readJson(request)
      const quote = await addQuote({
        text: String(body.text ?? ''),
        translation: typeof body.translation === 'string' ? body.translation : undefined,
        packId: typeof body.packId === 'string' ? body.packId : undefined,
        sourceTitle: typeof body.sourceTitle === 'string' ? body.sourceTitle : undefined,
        commentary: typeof body.commentary === 'string' ? body.commentary : undefined,
      })
      sendJson(response, 200, { quote })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const quoteCommentaryMatch = /^\/api\/lab\/quotes\/([^/]+)\/commentary$/.exec(url.pathname)
  if (method === 'POST' && quoteCommentaryMatch) {
    const id = decodeURIComponent(quoteCommentaryMatch[1]!)
    const quotes = await listQuotes()
    const quote = quotes.find((entry) => entry.id === id)
    if (!quote) {
      sendJson(response, 404, { error: 'Quote not found' })
      return
    }
    if (!hasLlm()) {
      sendJson(response, 400, { error: 'AI 点评需要配置模型 API Key。' })
      return
    }
    try {
      const insight = await generateQuoteInsight(quote.text, quote.sourceTitle ?? '金句墙')
      const updated = await setQuoteCommentary(id, insight.commentary, insight.translation)
      sendJson(response, 200, { quote: updated, insight })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const quoteMatch = /^\/api\/lab\/quotes\/([^/]+)$/.exec(url.pathname)
  if (method === 'DELETE' && quoteMatch) {
    const removed = await deleteQuote(decodeURIComponent(quoteMatch[1]!))
    sendJson(response, removed ? 200 : 404, removed ? { ok: true } : { error: 'Quote not found' })
    return
  }

  if (method === 'POST' && url.pathname === '/api/lab/generate') {
    try {
      if (!hasLlm()) {
        sendJson(response, 400, { error: '这个功能需要配置模型 API Key。' })
        return
      }
      const body = await readJson(request)
      const feature = String(body.feature ?? '')
      const requested = typeof body.scope === 'string' ? body.scope : typeof body.packId === 'string' ? body.packId : 'all'
      const loadPackForLab = async () => loadLabPack(store, requested).pack

      if (feature === 'register') {
        const target = String(body.target ?? 'tweet')
        if (target !== 'tweet' && target !== 'email' && target !== 'headline' && target !== 'poem') {
          sendJson(response, 400, { error: '不支持的文体。' })
          return
        }
        const pack = await loadPackForLab()
        const paragraphIndex = Number(body.paragraphIndex ?? 0)
        const text = typeof body.text === 'string' ? body.text.slice(0, 5000) : ''
        const result = await generateRegisterRemix(pack, paragraphIndex, target, text)
        sendJson(response, 200, { result })
        return
      }

      if (feature === 'podcast') {
        const mode = body.mode === 'duo' ? 'duo' : 'solo'
        const podcast = await generatePodcast(await loadPackForLab(), mode)
        sendJson(response, 200, { podcast })
        return
      }

      if (feature === 'life-examples') {
        const itemId = String(body.itemId ?? '')
        const item = store.getItem(itemId)
        if (!item) {
          sendJson(response, 404, { error: 'Word not found' })
          return
        }
        const context = String(body.context ?? '').slice(0, 80)
        const result = await generateLifeExamples(item, context)
        sendJson(response, 200, result)
        return
      }

      if (feature === 'pet') {
        const pet = petState(store)
        const line = await generatePetLine(pet)
        sendJson(response, 200, { line })
        return
      }

      if (feature === 'argument-map') {
        const argument = await generateArgumentMap(await loadPackForLab())
        sendJson(response, 200, { argument })
        return
      }

      if (feature === 'news-short') {
        const news = await generateNewsShort(await loadPackForLab())
        sendJson(response, 200, { news })
        return
      }

      if (feature === 'subtitle-hunter') {
        const subtitle = await generateSubtitleHunter(await loadPackForLab())
        sendJson(response, 200, { subtitle })
        return
      }

      if (feature === 'dubbing') {
        const dubbing = await generateDubbing(await loadPackForLab())
        sendJson(response, 200, { dubbing })
        return
      }

      if (feature === 'dungeon') {
        const words = Array.isArray(body.words)
          ? body.words.map((word) => String(word)).filter(Boolean).slice(0, 8)
          : []
        const dungeon = await generateDungeonFlavor(words)
        sendJson(response, 200, { dungeon })
        return
      }

      if (feature === 'word-adventure') {
        const words = Array.isArray(body.words)
          ? body.words.map((word) => String(word)).filter(Boolean).slice(0, 8)
          : []
        const text = String(body.text ?? '').trim()
        if (words.length < 3 || text.length < 10) {
          sendJson(response, 400, { error: '至少 3 个目标词和一小段故事。' })
          return
        }
        const result = await generateAdventureFeedback(words, text.slice(0, 3000))
        sendJson(response, 200, { result })
        return
      }

      if (feature === 'dictation-hint') {
        const sentence = String(body.sentence ?? '').slice(0, 500)
        const typed = String(body.typed ?? '').slice(0, 1000)
        const hint = await generateDictationHint(sentence, typed)
        sendJson(response, 200, hint)
        return
      }

      sendJson(response, 400, { error: 'Unknown lab feature' })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (url.pathname === '/api/lan') {
    if (method === 'GET') {
      sendJson(response, 200, lan.status(!requireToken && remoteLoopback))
      return
    }
    if (method === 'POST') {
      if (requireToken || !remoteLoopback) {
        sendJson(response, 403, { error: '只有电脑上的 CloseRead 可以开关手机访问。' })
        return
      }
      try {
        const body = await readJson(request)
        const status = body.enabled === true ? await lan.enable() : await lan.disable()
        sendJson(response, 200, { ...status, local: true })
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
      }
      return
    }
  }

  if (method === 'GET' && url.pathname === '/') {
    const { html } = externalizeAppScript(renderReviewApp())
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(html)
    return
  }

  if (method === 'GET' && url.pathname === '/bookmarklet') {
    const scheme = request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
    const origin = `${scheme}://${request.headers.host ?? '127.0.0.1:4317'}`
    const bookmarklet =
      `javascript:(()=>{const u='${origin}/?import='+encodeURIComponent(location.href);window.open(u,'_blank','noopener')})()`
    const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CloseRead 书签导入</title>
<style>
body{margin:0;background:#f6f2e8;color:#1c1a16;font:15px/1.7 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}
main{max-width:680px;margin:12vh auto;padding:0 24px}
h1{font-family:Georgia,serif;font-size:32px;margin:0 0 10px}
p{color:rgba(28,26,22,.62)}
.bookmark{display:inline-block;margin:18px 0;padding:12px 18px;border:1px solid #1c1a16;border-radius:999px;color:#1c1a16;text-decoration:none;font-weight:600;cursor:grab}
code{display:block;margin-top:18px;padding:12px;border:1px solid rgba(28,26,22,.15);background:rgba(255,253,248,.7);font:11px/1.5 ui-monospace,Menlo,monospace;word-break:break-all;color:rgba(28,26,22,.7)}
</style></head><body><main>
<h1>把当前网页交给 CloseRead</h1>
<p>把下面的按钮拖到浏览器书签栏。以后在任意文章页点一下，就会打开本地 CloseRead，并自动填入当前链接。</p>
<a class="bookmark" href="${bookmarklet}">导入当前网页</a>
<p>书签只把当前页面的链接交给 CloseRead，不会上传页面内容。文章由 CloseRead 按链接重新抓取。</p>
<code>${bookmarklet.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>
</main></body></html>`
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(html)
    return
  }

  if (method === 'GET' && url.pathname === '/api/feedback') {
    const sort = url.searchParams.get('sort') === 'new' ? 'new' : 'votes'
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const list = await feedbackBoard.list(visitorId, {
      sort,
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0,
    })
    sendJson(response, 200, { ...list, owner: isOwnerVisitor(visitorId) })
    return
  }

  if (method === 'POST' && url.pathname === '/api/feedback/image') {
    try {
      const body = await readBody(request, 3 * 1024 * 1024)
      if (body.length === 0) {
        sendJson(response, 400, { error: '图片是空的。' })
        return
      }
      const type = String(request.headers['content-type'] || '')
      const ext = type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : '.jpg'
      if (!/^image\/(png|jpe?g|webp)/i.test(type)) {
        sendJson(response, 400, { error: '只支持 PNG / JPG / WebP 图片。' })
        return
      }
      const dir = path.join(rootDataDir, 'community', 'feedback-images')
      await fs.mkdir(dir, { recursive: true })
      const name = `${randomUUID().slice(0, 12)}${ext}`
      await fs.writeFile(path.join(dir, name), body)
      sendJson(response, 200, { ok: true, image: name })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const feedbackImageMatch = /^\/api\/feedback\/image\/([A-Za-z0-9._-]+)$/.exec(url.pathname)
  if (method === 'GET' && feedbackImageMatch) {
    const name = feedbackImageMatch[1]!
    try {
      const file = path.join(rootDataDir, 'community', 'feedback-images', name)
      const data = await fs.readFile(file)
      const ext = path.extname(name).toLowerCase()
      const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
      response.writeHead(200, {
        'content-type': type,
        'cache-control': 'public, max-age=31536000, immutable',
      })
      response.end(data)
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Image not found')
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/feedback') {
    try {
      const body = await readJson(request, 20_000)
      const imageName = typeof body.image === 'string' ? body.image : ''
      const safeImage = /^[A-Za-z0-9._-]{6,40}$/.test(imageName) ? imageName : ''
      const result = await feedbackBoard.add(visitorId, {
        kind: body.kind === 'bug' ? 'bug' : 'idea',
        body: typeof body.body === 'string' ? body.body : '',
        ...(safeImage ? { image: safeImage } : {}),
      })
      if (!result.ok) {
        sendJson(response, 400, { error: result.error })
        return
      }
      sendJson(response, 200, { ok: true, item: result.item })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const voteMatch = /^\/api\/feedback\/([^/]+)\/vote$/.exec(url.pathname)
  if (method === 'POST' && voteMatch) {
    const result = await feedbackBoard.vote(decodeURIComponent(voteMatch[1]!), visitorId)
    sendJson(response, result.ok ? 200 : 400, result.ok ? result : { error: result.error })
    return
  }

  const deleteMatch = /^\/api\/feedback\/([^/]+)$/.exec(url.pathname)
  if (method === 'DELETE' && deleteMatch) {
    if (!isOwnerVisitor(visitorId)) {
      sendJson(response, 403, { error: '只有站点作者能删除意见。' })
      return
    }
    const target = await feedbackBoard.find(decodeURIComponent(deleteMatch[1]!))
    const removed = await feedbackBoard.remove(decodeURIComponent(deleteMatch[1]!))
    if (removed && target?.image) {
      await fs.rm(path.join(rootDataDir, 'community', 'feedback-images', target.image), { force: true }).catch(() => {})
    }
    sendJson(response, removed ? 200 : 404, removed ? { ok: true } : { error: '这条意见不在了。' })
    return
  }

  const statusMatch = /^\/api\/feedback\/([^/]+)\/status$/.exec(url.pathname)
  if (method === 'POST' && statusMatch) {
    if (!isOwnerVisitor(visitorId)) {
      sendJson(response, 403, { error: '只有站点作者能改状态。' })
      return
    }
    const body = await readJson(request, 5_000).catch(() => ({} as Record<string, unknown>))
    const status = String(body.status ?? '') as FeedbackStatus
    if (!['open', 'planned', 'fixed', 'declined'].includes(status)) {
      sendJson(response, 400, { error: '未知状态。' })
      return
    }
    const ok = await feedbackBoard.setStatus(
      decodeURIComponent(statusMatch[1]!),
      status,
      typeof body.reply === 'string' ? body.reply : undefined,
    )
    sendJson(response, ok ? 200 : 404, ok ? { ok: true } : { error: '这条意见不在了。' })
    return
  }

  if (method === 'GET' && url.pathname === '/api/public/ping') {
    visitors.heartbeat(visitorId)
    sendJson(response, 200, { ok: true })
    return
  }

  if (method === 'GET' && url.pathname === '/api/public/stats') {
    sendJson(response, 200, { ...visitors.stats(), mode: publicModeEnabled() ? 'public' : 'local' })
    return
  }

  if (method === 'GET' && url.pathname === '/api/shared') {
    // Packs published by the CLI land on disk; pick them up without a restart.
    await shared.reload().catch(() => {})
    const mine = new Set(store.packs().map((pack) => pack.id))
    const packs = await Promise.all(
      shared.packs().map(async (pack) => {
        const meta = await sharedMeta(pack)
        return {
          id: pack.id,
          title: meta.title,
          itemCount: pack.itemCount,
          createdAt: pack.createdAt,
          issueId: pack.parentResourceId ?? pack.resourceId,
          shared: true,
          owned: mine.has(pack.id),
          cefr: meta.cefr,
          url: `/read/${encodeURIComponent(pack.id)}`,
        }
      }),
    )
    sendJson(response, 200, { packs, total: packs.length })
    return
  }

  if (method === 'GET' && url.pathname === '/api/session') {
    const workspace = currentWorkspace()
    sendJson(response, 200, {
      id: workspace.readOnly ? '' : workspace.id,
      personal: !workspace.readOnly,
      public: publicModeEnabled(),
    })
    return
  }

  if (method === 'POST' && url.pathname === '/api/hydrate') {
    const workspace = currentWorkspace()
    if (workspace.readOnly) {
      sendJson(response, 409, { error: '演示空间不需要回灌。' })
      return
    }
    try {
      const body = await readJson(request, 80_000_000)
      const files = body.files
      if (!files || typeof files !== 'object' || Array.isArray(files)) {
        sendJson(response, 400, { error: '缺少 files。' })
        return
      }
      const written = await visitors.hydrate(workspace.id, files as Record<string, string>)
      sendJson(response, 200, { ok: true, files: written })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'GET' && url.pathname === '/api/checkpoint') {
    const workspace = currentWorkspace()
    if (workspace.readOnly) {
      sendJson(response, 200, { files: [] })
      return
    }
    // Always rescan: background build jobs finish after their request returned.
    await visitors.capture(workspace.id)
    sendJson(response, 200, { files: visitors.takeChanges(workspace.id) })
    return
  }

  if (method === 'GET' && url.pathname === '/api/summary') {
    sendJson(response, 200, { summary: store.stats(), packs: store.packs(), warnings: store.warnings() })
    return
  }

  if (method === 'GET' && url.pathname === '/api/styles') {
    sendJson(response, 200, {
      styles: (await listStyleProfiles()).map((style) => ({
        name: style.name,
        title: style.title,
        source: style.source ?? null,
        model: style.model ?? null,
        samples: style.samples ?? null,
      })),
    })
    return
  }

  if (url.pathname === '/api/preferences') {
    if (method === 'GET') {
      const preferences = store.preferences()
      sendJson(response, 200, {
        preferences: {
          desiredRetention: preferences.desiredRetention,
          dailyNewTarget: preferences.dailyNewTarget,
          dailyReviewTarget: preferences.dailyReviewTarget,
          weeklyArticleGoal: preferences.weeklyArticleGoal,
          weeklyStudyDaysGoal: preferences.weeklyStudyDaysGoal,
        },
      })
      return
    }
    if (method === 'POST') {
      try {
        const body = await readJson(request)
        const wantsTargets = body.dailyNewTarget !== undefined || body.dailyReviewTarget !== undefined
        const wantsWeekly =
          body.weeklyArticleGoal !== undefined || body.weeklyStudyDaysGoal !== undefined
        let preferences = store.preferences()
        let changed = false
        if (wantsWeekly) {
          const articles =
            body.weeklyArticleGoal === undefined
              ? preferences.weeklyArticleGoal
              : Number(body.weeklyArticleGoal)
          const studyDays =
            body.weeklyStudyDaysGoal === undefined
              ? preferences.weeklyStudyDaysGoal
              : Number(body.weeklyStudyDaysGoal)
          if (
            !Number.isFinite(articles) ||
            !Number.isFinite(studyDays) ||
            articles < 0 ||
            articles > 100 ||
            studyDays < 0 ||
            studyDays > 7
          ) {
            sendJson(response, 400, { error: '每周文章目标需在 0–100，学习天数需在 0–7 之间。' })
            return
          }
          preferences = await store.setWeeklyGoals(articles, studyDays)
          changed = true
        }
        if (wantsTargets) {
          const newTarget = body.dailyNewTarget === undefined ? preferences.dailyNewTarget : Number(body.dailyNewTarget)
          const reviewTarget =
            body.dailyReviewTarget === undefined ? preferences.dailyReviewTarget : Number(body.dailyReviewTarget)
          if (
            !Number.isFinite(newTarget) ||
            !Number.isFinite(reviewTarget) ||
            newTarget < 0 ||
            newTarget > 100 ||
            reviewTarget < 0 ||
            reviewTarget > 100
          ) {
            sendJson(response, 400, { error: '每日目标需要在 0 到 100 之间。' })
            return
          }
          preferences = await store.setDailyTargets(newTarget, reviewTarget)
          changed = true
        }
        if (body.desiredRetention !== undefined) {
          const value = Number(body.desiredRetention)
          if (!Number.isFinite(value) || value < 0.8 || value > 0.97) {
            sendJson(response, 400, { error: '目标记忆率需要在 0.80 到 0.97 之间。' })
            return
          }
          preferences = await store.setDesiredRetention(value)
          changed = true
        }
        if (!changed) {
          sendJson(response, 400, { error: '没有可更新的设置。' })
          return
        }
        sendJson(response, 200, {
          ok: true,
          preferences: {
            desiredRetention: preferences.desiredRetention,
            dailyNewTarget: preferences.dailyNewTarget,
            dailyReviewTarget: preferences.dailyReviewTarget,
            weeklyArticleGoal: preferences.weeklyArticleGoal,
            weeklyStudyDaysGoal: preferences.weeklyStudyDaysGoal,
          },
        })
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
      }
      return
    }
  }

  if (url.pathname === '/api/diagnosis') {
    if (method === 'GET') {
      sendJson(response, 200, {
        words: sampleDiagnosisWords(),
        diagnosis: store.preferences().diagnosis ?? null,
      })
      return
    }
    if (method === 'POST') {
      try {
        const body = await readJson(request)
        const bank = new Map(DIAGNOSIS_WORDS.map((word) => [word.lemma, word]))
        const submitted = Array.isArray(body.words)
          ? [
              ...new Set(
                body.words
                  .map((lemma) => String(lemma).toLowerCase().trim())
                  .filter((lemma) => bank.has(lemma)),
              ),
            ]
          : []
        const words = submitted.length > 0
          ? submitted.map((lemma) => bank.get(lemma)!)
          : DIAGNOSIS_WORDS
        const valid = new Set(words.map((word) => word.lemma))
        const known = Array.isArray(body.known)
          ? [
              ...new Set(
                body.known
                  .map((lemma) => String(lemma).toLowerCase().trim())
                  .filter((lemma) => valid.has(lemma)),
              ),
            ]
          : []
        const level = computeDiagnosisLevel(known, words)
        const diagnosis = await store.saveDiagnosis(level, known, words.length)
        config.level = diagnosis.level
        sendJson(response, 200, { diagnosis })
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
      }
      return
    }
  }

  if (method === 'GET' && url.pathname === '/api/llm') {
    sendJson(response, 200, {
      status: llmStatus(),
      providers: llmProviderOptions.map((provider) => ({
        id: provider.id,
        label: provider.label,
        api: provider.api,
        baseUrl: provider.baseUrl,
        model: provider.model,
        models: provider.models,
      })),
    })
    return
  }

  if ((method === 'GET' || method === 'POST') && url.pathname === '/api/llm/models') {
    const body = method === 'POST' ? await readJson(request).catch(() => ({} as Record<string, unknown>)) : {}
    const requestedProvider = typeof body.provider === 'string' ? normalizeLlmProvider(body.provider) : undefined
    try {
      const models = await listProviderModels({
        ...(requestedProvider ? { provider: requestedProvider } : {}),
        ...(typeof body.apiKey === 'string' && body.apiKey.trim() ? { apiKey: body.apiKey.trim() } : {}),
        ...(typeof body.baseUrl === 'string' && body.baseUrl.trim() ? { baseUrl: body.baseUrl.trim() } : {}),
      })
      sendJson(response, 200, {
        models,
        provider: providerPreset(requestedProvider ?? config.llm.provider).label,
      })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/llm') {
    try {
      const body = await readJson(request)
      const status = saveLlmSettings({
        provider: String(body.provider ?? ''),
        ...(typeof body.apiKey === 'string' ? { apiKey: body.apiKey } : {}),
        ...(typeof body.baseUrl === 'string' ? { baseUrl: body.baseUrl } : {}),
        ...(typeof body.model === 'string' ? { model: body.model } : {}),
      })
      sendJson(response, 200, { ok: true, status })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'GET' && url.pathname === '/api/graph') {
    const threshold = Math.max(0, Math.min(10, Number(url.searchParams.get('threshold') ?? 1.5) || 1.5))
    const includeNegative = url.searchParams.get('negative') !== '0'
    const includeGhosts = url.searchParams.get('ghosts') !== '0'
    const includeContext = url.searchParams.get('context') === '1'
    const graphItems = store.listItems().filter((item) => item.type !== 'sentence')
    const graph = buildWordGraph(graphItems, {
      threshold,
      includeNegative,
      includeGhosts,
      includeContext,
      maxGhosts: 40,
    })
    const itemById = new Map(graphItems.map((item) => [item.id, item]))
    const packs = store.packs()
    const nodes = graph.nodes.map((node) => {
      const item = itemById.get(node.id)
      const context = item?.contexts[0]
      const pack = context
        ? packs.find(
            (entry) => entry.resourceId === context.resourceId || entry.parentResourceId === context.resourceId,
          )
        : undefined
      return {
        ...node,
        dueLabel: item ? dueLabel(item) : '',
        sourcePack: pack
          ? {
              id: pack.id,
              title: pack.title ?? store.getResource(pack.resourceId)?.title ?? pack.id,
              url: packUrl(pack.id),
            }
          : null,
      }
    })
    sendJson(response, 200, {
      nodes,
      edges: graph.edges,
      families: graph.families,
      stats: {
        items: graph.nodes.filter((node) => !node.ghost).length,
        ghosts: graph.nodes.filter((node) => node.ghost).length,
        isolated: graph.isolated,
        edges: graph.edges.length,
        threshold,
      },
    })
    return
  }

  const derivationMatch = /^\/api\/pack\/([^/]+)\/items\/([^/]+)\/derivation$/.exec(url.pathname)
  if (method === 'POST' && derivationMatch) {
    try {
      const pack = store.findPack(decodeURIComponent(derivationMatch[1]!))
      if (!pack) {
        sendJson(response, 404, { error: 'Pack not found' })
        return
      }
      const contents = await loadPack(pack.dir)
      const item = contents.items.find((entry) => entry.id === decodeURIComponent(derivationMatch[2]!))
      if (!item) {
        sendJson(response, 404, { error: 'Item not found in pack' })
        return
      }
      if (item.derivation) {
        sendJson(response, 200, { ok: true, derivation: item.derivation, cached: true })
        return
      }
      const derivation = await generateDerivationGraph(item)
      item.derivation = derivation
      await savePackFiles(contents, pack.dir)
      await store.upsertItems([item])
      sendJson(response, 200, { ok: true, derivation })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const sentenceAudioMatch = /^\/api\/pack\/([^/]+)\/sentence-audio$/.exec(url.pathname)
  if (method === 'POST' && sentenceAudioMatch) {
    try {
      const body = await readJson(request)
      const paragraphIndex = Number(body.paragraph)
      const sentenceIndex = Number(body.sentence)
      if (!Number.isInteger(paragraphIndex) || !Number.isInteger(sentenceIndex)) {
        sendJson(response, 400, { error: '句子位置不正确。', fallback: 'browser' })
        return
      }
      const pack = store.findPack(decodeURIComponent(sentenceAudioMatch[1]!))
      if (!pack) {
        sendJson(response, 404, { error: 'Pack not found' })
        return
      }
      const contents = await loadPack(pack.dir)
      const paragraph = (contents.reading ?? []).find((entry) => entry.index === paragraphIndex)
      if (!paragraph) {
        sendJson(response, 400, { error: '找不到这个段落。', fallback: 'browser' })
        return
      }
      const parts = paragraph.customSentences?.length ? paragraph.customSentences : sentences(paragraph.original)
      const text = parts[sentenceIndex]?.trim()
      if (!text) {
        sendJson(response, 400, { error: '找不到这句话。', fallback: 'browser' })
        return
      }
      const result = await generateSentenceAudio(text, pack.dir)
      if (!result) {
        sendJson(response, 400, {
          error: '当前系统没有可用的离线语音（macOS say）。',
          fallback: 'browser',
        })
        return
      }
      sendJson(response, 200, { ok: true, audio: result.path, cached: result.cached, text })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error), fallback: 'browser' })
    }
    return
  }

  const audioMatch = /^\/api\/pack\/([^/]+)\/audio$/.exec(url.pathname)
  if (method === 'POST' && audioMatch) {
    try {
      const body = (await readJson(request).catch(() => ({}))) as Record<string, unknown>
      const pack = store.findPack(decodeURIComponent(audioMatch[1]!))
      if (!pack) {
        sendJson(response, 404, { error: 'Pack not found' })
        return
      }
      const contents = await loadPack(pack.dir)
      const fingerprint = await speechFingerprint(readingText(contents))
      const cached = contents.audio?.reading
      if (!body.regenerate && cached && (!contents.audio?.voice || contents.audio.voice === fingerprint)) {
        try {
          await fs.access(path.join(pack.dir, cached))
          sendJson(response, 200, { ok: true, audio: contents.audio, cached: true })
          return
        } catch {
          // Regenerate when the cached file was deleted.
        }
      }
      const reading = await generateReadingAudio(contents, pack.dir)
      if (!reading) {
        sendJson(response, 400, { error: '这篇文章还没有可朗读的正文。', fallback: 'browser' })
        return
      }
      const audio = { ...(contents.audio ?? { items: {} }), reading: reading.path, voice: reading.fingerprint }
      contents.audio = audio
      await savePackFiles(contents, pack.dir)
      sendJson(response, 200, { ok: true, audio })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const wordStoryMatch = /^\/api\/pack\/([^/]+)\/items\/([^/]+)\/story$/.exec(url.pathname)
  if (method === 'POST' && wordStoryMatch) {
    try {
      const pack = store.findPack(decodeURIComponent(wordStoryMatch[1]!))
      if (!pack) {
        sendJson(response, 404, { error: 'Pack not found' })
        return
      }
      const contents = await loadPack(pack.dir)
      const item = contents.items.find((entry) => entry.id === decodeURIComponent(wordStoryMatch[2]!))
      if (!item) {
        sendJson(response, 404, { error: 'Item not found in pack' })
        return
      }
      if (item.type === 'sentence') {
        sendJson(response, 400, { error: '句子卡没有词源。' })
        return
      }
      if (item.wordStory) {
        sendJson(response, 200, { ok: true, item, story: item.wordStory, cached: true })
        return
      }
      if (requireLlm(response)) return
      const story = await generateWordStory(item)
      item.wordStory = story
      await savePackFiles(contents, pack.dir)
      await store.upsertItems([item])
      sendJson(response, 200, { ok: true, item, story })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const sentenceRewritesMatch = /^\/api\/pack\/([^/]+)\/items\/([^/]+)\/rewrites$/.exec(url.pathname)
  if (method === 'POST' && sentenceRewritesMatch) {
    try {
      const body = (await readJson(request).catch(() => ({}))) as Record<string, unknown>
      const pack = store.findPack(decodeURIComponent(sentenceRewritesMatch[1]!))
      if (!pack) {
        sendJson(response, 404, { error: 'Pack not found' })
        return
      }
      const contents = await loadPack(pack.dir)
      const item = contents.items.find((entry) => entry.id === decodeURIComponent(sentenceRewritesMatch[2]!))
      if (!item) {
        sendJson(response, 404, { error: 'Item not found in pack' })
        return
      }
      if (item.type !== 'sentence' || !item.sentence) {
        sendJson(response, 400, { error: '这不是句子卡。' })
        return
      }
      if (!body.regenerate && item.sentence.rewrites?.length) {
        sendJson(response, 200, { ok: true, item, rewrites: item.sentence.rewrites, cached: true })
        return
      }
      if (requireLlm(response)) return
      const rewrites = await generateSentenceRewrites(item)
      item.sentence.rewrites = rewrites
      await savePackFiles(contents, pack.dir)
      await store.upsertItems([item])
      sendJson(response, 200, { ok: true, item, rewrites })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const practiceMatch = /^\/api\/pack\/([^/]+)\/items\/([^/]+)\/practice$/.exec(url.pathname)
  if (method === 'POST' && practiceMatch) {
    if (requireLlm(response)) return
    try {
      const pack = store.findPack(decodeURIComponent(practiceMatch[1]!))
      if (!pack) {
        sendJson(response, 404, { error: 'Pack not found' })
        return
      }
      const contents = await loadPack(pack.dir)
      const item = contents.items.find((entry) => entry.id === decodeURIComponent(practiceMatch[2]!))
      if (!item) {
        sendJson(response, 404, { error: 'Item not found in pack' })
        return
      }
      if (item.type === 'sentence') {
        sendJson(response, 400, { error: '句子卡不需要造句练习。' })
        return
      }
      const body = await readJson(request)
      const sentence = typeof body.sentence === 'string' ? body.sentence.trim() : ''
      if (sentence.length < 3) {
        sendJson(response, 400, { error: '先写一句英文。' })
        return
      }
      if (sentence.length > 500) {
        sendJson(response, 400, { error: '句子太长了，控制在 500 字符以内。' })
        return
      }
      const scene = typeof body.scene === 'string' ? body.scene : 'daily'
      const feedback = await generatePracticeFeedback(item, sentence, scene)
      sendJson(response, 200, { ok: true, feedback })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const nuanceMatch = /^\/api\/items\/([^/]+)\/nuance$/.exec(url.pathname)
  if (method === 'POST' && nuanceMatch) {
    const item = store.getItem(decodeURIComponent(nuanceMatch[1]!))
    if (!item) {
      sendJson(response, 404, { error: 'Item not found' })
      return
    }
    if (!hasLlm()) {
      sendJson(response, 400, { error: '语境侦探需要配置模型。配置 API Key 后即可生成三句用法辨析。' })
      return
    }
    try {
      const quiz = await generateNuanceQuiz(item)
      sendJson(response, 200, { quiz })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const expandPackItemMatch = /^\/api\/pack\/([^/]+)\/items\/([^/]+)\/expand$/.exec(url.pathname)
  if (method === 'POST' && expandPackItemMatch) {
    try {
      const pack = store.findPack(decodeURIComponent(expandPackItemMatch[1]!))
      if (!pack) {
        sendJson(response, 404, { error: 'Pack not found' })
        return
      }
      const contents = await loadPack(pack.dir)
      const itemIdToExpand = decodeURIComponent(expandPackItemMatch[2]!)
      const item = contents.items.find((entry) => entry.id === itemIdToExpand)
      if (!item) {
        sendJson(response, 404, { error: 'Item not found in pack' })
        return
      }
      if (item.type === 'sentence') {
        sendJson(response, 400, { error: '句子卡请使用回译复习。' })
        return
      }
      const relationCount =
        item.relations.synonyms.length +
        item.relations.antonyms.length +
        item.relations.confusables.length +
        item.relations.wordFamily.length
      const needsEnrich = !item.wordFormation || relationCount === 0
      const enriched = needsEnrich ? await enrichWordRelations(item) : item
      if (needsEnrich) {
        await savePackFiles(contents, pack.dir)
        await store.upsertItems([enriched])
      }
      sendJson(response, 200, { ok: true, item: enriched, enriched: needsEnrich })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const enrichItemMatch = /^\/api\/items\/([^/]+)\/enrich$/.exec(url.pathname)
  if (method === 'POST' && enrichItemMatch) {
    try {
      const item = store.getItem(decodeURIComponent(enrichItemMatch[1]!))
      if (!item) {
        sendJson(response, 404, { error: 'Item not found' })
        return
      }
      const enriched = await enrichWordRelations(item)
      await store.upsertItems([enriched])
      sendJson(response, 200, { ok: true, item: viewModel(enriched, store) })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/graph/adopt') {
    try {
      const body = await readJson(request)
      const lemma = typeof body.lemma === 'string' ? body.lemma.trim() : ''
      if (!lemma) {
        sendJson(response, 400, { error: 'lemma is required' })
        return
      }
      const item = await generateWordCard(lemma)
      await store.upsertItems([item])
      sendJson(response, 200, { ok: true, item })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'GET' && url.pathname === '/api/weekly') {
    sendJson(response, 200, await weeklyPayload(store))
    return
  }

  if (method === 'GET' && url.pathname === '/api/weekly/export') {
    const payload = await weeklyPayload(store)
    response.writeHead(200, {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="closeread-weekly-${payload.range.end}.md"`,
      'cache-control': 'no-store',
    })
    response.end(weeklyMarkdown(payload))
    return
  }

  if (method === 'GET' && url.pathname === '/api/history') {
    const days = Math.max(1, Math.min(60, Number(url.searchParams.get('days') ?? 14)))
    sendJson(response, 200, { history: reviewHistory(store, days) })
    return
  }

  if (method === 'GET' && url.pathname === '/api/forecast') {
    sendJson(response, 200, store.dueForecast(new Date()))
    return
  }

  if (method === 'GET' && url.pathname === '/api/today') {
    sendJson(response, 200, await todayPayload(store))
    return
  }

  const annotationsMatch = /^\/api\/packs\/([^/]+)\/annotations$/.exec(url.pathname)
  if (method === 'POST' && annotationsMatch) {
    const pack = store.findPack(decodeURIComponent(annotationsMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      const body = await readJson(request)
      const quote = typeof body.quote === 'string' ? body.quote.replace(/\s+/g, ' ').trim() : ''
      const note = typeof body.note === 'string' ? body.note.trim() : ''
      const paragraph = Number(body.paragraph)
      if (!quote) {
        sendJson(response, 400, { error: '批注内容不能为空。' })
        return
      }
      let total = 0
      try {
        total = (await loadPack(pack.dir)).reading?.length ?? 0
      } catch {
        // Progress can still be loaded from the stored file.
      }
      const progress = await loadReadingProgress(pack.dir, pack.id, total)
      if (!Number.isInteger(paragraph) || paragraph < 0 || (total > 0 && paragraph >= total)) {
        sendJson(response, 400, { error: '段落位置不正确。' })
        return
      }
      const annotation = {
        id: randomUUID(),
        paragraph,
        quote: quote.slice(0, 500),
        ...(note ? { note } : {}),
        createdAt: new Date().toISOString(),
      }
      progress.annotations = [...(progress.annotations ?? []), annotation]
      await saveReadingProgress(pack.dir, progress)
      sendJson(response, 200, { ok: true, annotation, progress: readingSummary(progress) })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const annotationDeleteMatch = /^\/api\/packs\/([^/]+)\/annotations\/([^/]+)$/.exec(url.pathname)
  if (method === 'DELETE' && annotationDeleteMatch) {
    const pack = store.findPack(decodeURIComponent(annotationDeleteMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      let total = 0
      try {
        total = (await loadPack(pack.dir)).reading?.length ?? 0
      } catch {
        // Keep the stored count when the pack is unavailable.
      }
      const progress = await loadReadingProgress(pack.dir, pack.id, total)
      const id = decodeURIComponent(annotationDeleteMatch[2]!)
      const before = (progress.annotations ?? []).length
      progress.annotations = (progress.annotations ?? []).filter((entry) => entry.id !== id)
      if ((progress.annotations ?? []).length === before) {
        sendJson(response, 404, { error: '批注不存在。' })
        return
      }
      await saveReadingProgress(pack.dir, progress)
      sendJson(response, 200, { ok: true, progress: readingSummary(progress) })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const readResetMatch = /^\/api\/packs\/([^/]+)\/reading\/reset$/.exec(url.pathname)
  if (method === 'POST' && readResetMatch) {
    const pack = store.findPack(decodeURIComponent(readResetMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      let total = 0
      try {
        total = (await loadPack(pack.dir)).reading?.length ?? 0
      } catch {
        // Reset with the stored progress shape if the pack body is unavailable.
      }
      const progress = await resetReadingProgress(pack.dir, pack.id, total)
      await store.resetDailyArticle()
      sendJson(response, 200, { ok: true, progress: readingSummary(progress), daily: store.todayProgress() })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const readingMatch = /^\/api\/packs\/([^/]+)\/reading$/.exec(url.pathname)
  if (readingMatch) {
    const pack = store.findPack(decodeURIComponent(readingMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    if (method === 'GET') {
      let total = 0
      try {
        total = (await loadPack(pack.dir)).reading?.length ?? 0
      } catch {
        // Reading progress can still be returned for a pack whose body is missing.
      }
      const progress = await loadReadingProgress(pack.dir, pack.id, total)
      sendJson(response, 200, {
        progress: readingSummary(progress),
        pack: {
          id: pack.id,
          title: pack.title ?? store.getResource(pack.resourceId)?.title ?? pack.id,
          url: packUrl(pack.id),
          totalParagraphs: progress.totalParagraphs,
        },
      })
      return
    }
    if (method === 'POST') {
      try {
        const body = await readJson(request)
        let total = 0
        try {
          total = (await loadPack(pack.dir)).reading?.length ?? 0
        } catch {
          // Fall back to the supplied count when the pack file is unavailable.
        }
        if (typeof body.totalParagraphs === 'number' && Number.isFinite(body.totalParagraphs)) {
          total = Math.max(total, Math.floor(body.totalParagraphs))
        }
        const progress = await loadReadingProgress(pack.dir, pack.id, total)
        const now = new Date().toISOString()
        if (!progress.startedAt) progress.startedAt = now
        if (Array.isArray(body.readParagraphs)) {
          progress.readParagraphs = body.readParagraphs.map((value) => Number(value))
        }
        if (typeof body.lastParagraph === 'number' && Number.isFinite(body.lastParagraph)) {
          progress.lastParagraph = Math.floor(body.lastParagraph)
        }
        if (typeof body.lastSentence === 'number' && Number.isFinite(body.lastSentence)) {
          progress.lastSentence = Math.max(0, Math.floor(body.lastSentence))
        }
        if (body.finished === true && !progress.finishedAt) progress.finishedAt = now
        if (total > 0 && progress.totalParagraphs <= 0) progress.totalParagraphs = total
        await saveReadingProgress(pack.dir, progress)
        if (progress.finishedAt) {
          await store.markArticleRead(
            pack.id,
            pack.title ?? store.getResource(pack.resourceId)?.title ?? pack.id,
          )
        }
        sendJson(response, 200, {
          ok: true,
          progress: readingSummary(progress),
          daily: store.todayProgress(),
        })
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
      }
      return
    }
  }

  if (method === 'POST' && url.pathname === '/api/today/output') {
    try {
      const body = await readJson(request)
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (!text) {
        sendJson(response, 400, { error: '请先写下三句英文输出。' })
        return
      }
      const daily = store.todayProgress()
      const requestedPack = typeof body.packId === 'string' ? store.findPack(body.packId) : undefined
      const pack = requestedPack ?? (daily.articlePackId ? store.findPack(daily.articlePackId) : undefined)
      let prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
      let answer = typeof body.answer === 'string' ? body.answer.trim() : ''
      let articleTitle = daily.articleTitle
      if (pack) {
        try {
          const contents = await loadPack(pack.dir)
          const discussion = contents.exercises.discussion[0]
          prompt = prompt || discussion?.question || contents.exercises.comprehension[0]?.question || ''
          answer = answer || discussion?.answer || contents.exercises.comprehension[0]?.answer || ''
          articleTitle = contents.title
        } catch {
          // The saved output is still useful without the pack's reference answer.
        }
      }
      const entry = await store.saveOutput({
        text,
        prompt,
        ...(answer ? { answer } : {}),
        ...(pack ? { packId: pack.id } : {}),
        ...(articleTitle ? { articleTitle } : {}),
      })
      sendJson(response, 200, { ok: true, output: entry, today: await todayPayload(store) })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'GET' && url.pathname === '/api/outputs') {
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? 20)))
    sendJson(response, 200, { outputs: store.listOutputs(limit) })
    return
  }

  const outputRevisionMatch = /^\/api\/outputs\/([^/]+)\/revision$/.exec(url.pathname)
  if (method === 'POST' && outputRevisionMatch) {
    try {
      const body = await readJson(request)
      const text = typeof body.text === 'string' ? body.text : ''
      const output = await store.addOutputRevision(decodeURIComponent(outputRevisionMatch[1]!), text)
      sendJson(response, 200, { ok: true, output })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const outputRevisionFeedbackMatch =
    /^\/api\/outputs\/([^/]+)\/revisions\/([^/]+)\/feedback$/.exec(url.pathname)
  if (method === 'POST' && outputRevisionFeedbackMatch) {
    try {
      const output = store.getOutput(decodeURIComponent(outputRevisionFeedbackMatch[1]!))
      if (!output) {
        sendJson(response, 404, { error: 'Output not found' })
        return
      }
      const revision = output.revisions?.find(
        (entry) => entry.id === decodeURIComponent(outputRevisionFeedbackMatch[2]!),
      )
      if (!revision) {
        sendJson(response, 404, { error: 'Revision not found' })
        return
      }
      if (revision.feedback) {
        sendJson(response, 200, { ok: true, output, feedback: revision.feedback, cached: true })
        return
      }
      if (requireLlm(response)) return
      const feedback = await generateOutputFeedback(
        revision.text,
        output.prompt,
        output.answer,
        output.articleTitle,
      )
      const saved = await store.saveOutputRevisionFeedback(output.id, revision.id, feedback)
      sendJson(response, 200, { ok: true, output: saved, feedback })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const outputFeedbackMatch = /^\/api\/outputs\/([^/]+)\/feedback$/.exec(url.pathname)
  if (method === 'POST' && outputFeedbackMatch) {
    try {
      const output = store.getOutput(decodeURIComponent(outputFeedbackMatch[1]!))
      if (!output) {
        sendJson(response, 404, { error: 'Output not found' })
        return
      }
      if (output.feedback) {
        sendJson(response, 200, { ok: true, output, feedback: output.feedback, cached: true })
        return
      }
      if (requireLlm(response)) return
      const feedback = await generateOutputFeedback(
        output.text,
        output.prompt,
        output.answer,
        output.articleTitle,
      )
      const saved = await store.saveOutputFeedback(output.id, feedback)
      sendJson(response, 200, { ok: true, output: saved, feedback })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/feedback/selection') {
    const body = await readJson(request)
    const delta = Number(body.delta)
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1) {
      sendJson(response, 400, { error: 'delta must be 1 or -1' })
      return
    }
    const preferences = await store.adjustSelectionBias(delta)
    sendJson(response, 200, { ok: true, selectionBias: preferences.selectionBias })
    return
  }

  const packFeedbackMatch = /^\/api\/pack\/([^/]+)\/feedback$/.exec(url.pathname)
  if (method === 'POST' && packFeedbackMatch) {
    const pack = store.findPack(decodeURIComponent(packFeedbackMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    const body = await readJson(request)
    const delta = body.direction === 'more' ? 1 : body.direction === 'less' ? -1 : 0
    if (delta === 0) {
      sendJson(response, 400, { error: 'direction must be more or less' })
      return
    }
    const preferences = await store.adjustSelectionBias(delta)
    sendJson(response, 200, { ok: true, selectionBias: preferences.selectionBias })
    return
  }

  if (method === 'GET' && url.pathname === '/api/plan') {
    const now = new Date()
    const stats = store.stats(now)
    sendJson(response, 200, {
      due: stats.reviewDue,
      reviewedToday: stats.reviewedToday,
      suggestion: nextArticleSuggestion(store),
    })
    return
  }

  if (method === 'GET' && url.pathname === '/api/queue') {
    const queuePrefs = store.preferences()
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 30)))
    const newLimit = Math.max(0, Math.min(100, Number(url.searchParams.get('newLimit') ?? queuePrefs.dailyNewTarget)))
    const reviewLimit = Math.max(0, Math.min(100, Number(url.searchParams.get('reviewLimit') ?? queuePrefs.dailyReviewTarget)))
    const scope = url.searchParams.get('scope') ?? 'all'
    const book = url.searchParams.get('book') ?? ''
    const packId = url.searchParams.get('pack')
    const pack = packId ? store.findPack(packId) : undefined
    if (packId && !pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    const words = (url.searchParams.get('words') ?? '')
      .split(',')
      .map((word) => word.trim())
      .filter(Boolean)
    const wordsLabel = url.searchParams.get('label') ?? '自定义词组'
    const now = new Date()
    const before = store.stats(now)
    // Only the normal daily queue releases staged wordbook words. A direct
    // word-card link or a custom pack/word filter should not consume the budget.
    if (!words.length && !pack && (scope === 'all' || scope === 'new')) {
      const releaseBudget = Math.max(0, newLimit - before.newReviewedToday)
      if (releaseBudget > 0) await store.releaseStaged(releaseBudget, now, book ? `wordbook:${book}` : undefined)
    }

    let items = store.listItems().filter((item) => item.status === 'active' && (words.length > 0 || item.staged !== true))
    if (pack) {
      items = items.filter((item) => item.contexts.some((context) => context.resourceId === pack.resourceId))
    }
    if (book) items = items.filter((item) => item.tags.includes(`wordbook:${book}`))
    if (words.length > 0) {
      const selected = new Set(words)
      items = items.filter((item) => selected.has(item.id))
    }
    const typeFilter = url.searchParams.get('type')
    if (typeFilter === 'sentence') items = items.filter((item) => item.type === 'sentence')
    else if (typeFilter === 'word') items = items.filter((item) => item.type !== 'sentence')

    const dueAll = items.filter((item) => !isNew(item.review) && isDue(item.review, now))
    const freshAll = items.filter((item) => isNew(item.review))
    const leechAll = items.filter((item) => isLeech(item.review))
    dueAll.sort((a, b) => a.review.due.localeCompare(b.review.due))
    freshAll.sort((a, b) => (b.introducedAt ?? '').localeCompare(a.introducedAt ?? '') || a.createdAt.localeCompare(b.createdAt))

    const stats = store.stats(now)
    const freshBudget = Math.max(0, newLimit - stats.newReviewedToday)
    let selected: typeof items
    if (words.length > 0) selected = items.slice(0, limit)
    else if (scope === 'new') selected = freshAll.slice(0, freshBudget)
    else if (scope === 'due') selected = dueAll.slice(0, reviewLimit)
    else if (scope === 'leech') selected = leechAll.slice(0, reviewLimit)
    else selected = [...dueAll.slice(0, reviewLimit), ...freshAll.slice(0, freshBudget)]
    selected = selected.slice(0, limit)

    sendJson(response, 200, {
      items: selected.map((item) => viewModel(item, store, now)),
      summary: stats,
      budget: {
        dueLimit: reviewLimit,
        newLimit,
        dueTotal: dueAll.length,
        newTotal: freshAll.length,
        dueShown: Math.min(dueAll.length, reviewLimit),
        newShown: Math.min(freshAll.length, freshBudget),
        backlog: stats.backlog,
        reviewedToday: stats.reviewedToday,
      },
      pack: pack
        ? {
            id: pack.id,
            title: pack.title ?? store.getResource(pack.resourceId)?.title ?? pack.id,
            itemCount: pack.itemCount,
            due: items.length,
          }
        : null,
      words:
        words.length > 0
          ? {
              label: wordsLabel,
              due: items.length,
            }
          : null,
      filter:
        typeFilter === 'sentence' || typeFilter === 'word'
          ? {
              type: typeFilter,
              due: items.length,
            }
          : null,
    })
    return
  }

  if (method === 'GET' && url.pathname === '/api/wordbooks') {
    sendJson(response, 200, { books: listWordbooks().map((book) => wordbookView(store, book)) })
    return
  }

  const wordbookMatch = /^\/api\/wordbooks\/([^/]+)(?:\/(enroll))?$/.exec(url.pathname)
  if (wordbookMatch) {
    const book = getWordbook(decodeURIComponent(wordbookMatch[1]!))
    if (!book) {
      sendJson(response, 404, { error: 'Wordbook not found' })
      return
    }
    if (method === 'GET' && !wordbookMatch[2]) {
      sendJson(response, 200, { book: wordbookView(store, book) })
      return
    }
    if (method === 'POST' && wordbookMatch[2] === 'enroll') {
      try {
        const body = await readJson(request).catch(() => ({} as Record<string, unknown>))
        const limit = Number(body.limit)
        const result = await enrollWordbook(store, book, {
          ...(Number.isFinite(limit) && limit > 0 ? { limit: Math.min(20_000, Math.floor(limit)) } : {}),
        })
        sendJson(response, 200, { ok: true, result, book: wordbookView(store, book), summary: store.stats() })
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
      }
      return
    }
  }

  if (method === 'POST' && url.pathname === '/api/vocab/select') {
    try {
      const body = await readJson(request)
      const count = Math.max(1, Math.min(120, Number(body.count ?? 20)))
      const selection = await selectDailyWords(store, count, { force: body.force === true })
      sendJson(response, 200, {
        ...selection,
        selection: store.dailyWordSelection(),
      })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'GET' && url.pathname === '/api/vocab') {
    const q = url.searchParams.get('q')?.trim() ?? ''
    const group = url.searchParams.get('group') ?? 'all'
    const type = url.searchParams.get('type') ?? 'all'
    const source = url.searchParams.get('source') ?? ''
    const cefr = url.searchParams.get('cefr') ?? ''
    const book = url.searchParams.get('book') ?? ''
    const sort = url.searchParams.get('sort') ?? 'due'
    const now = new Date()
    const all = store.listItems(q)
    const words = all.filter((item) => item.type !== 'sentence')
    const counts = {
      all: words.length,
      new: words.filter((item) => item.status === 'active' && item.staged !== true && isNew(item.review)).length,
      due: words.filter((item) => item.status === 'active' && item.staged !== true && !isNew(item.review) && isDue(item.review, now)).length,
      leech: words.filter((item) => item.status === 'active' && item.staged !== true && isLeech(item.review)).length,
      backlog: words.filter((item) => item.status === 'active' && item.staged === true).length,
      missing: words.filter((item) => !hasRealExample(item)).length,
      known: words.filter((item) => item.status === 'known').length,
      suspended: words.filter((item) => item.status === 'suspended').length,
      sentences: all.length - words.length,
    }
    let filtered = type === 'sentence'
      ? all.filter((item) => item.type === 'sentence')
      : type === 'word'
        ? words.slice()
        : all.slice()
    if (source) filtered = filtered.filter((item) => item.contexts.some((context) => context.resourceId === source) || item.sourceRef.includes(source))
    if (cefr) filtered = filtered.filter((item) => item.cefr === cefr)
    if (book) {
      const bookLemmas = new Set((getWordbook(book)?.words ?? []).map((word) => word.w.toLowerCase()))
      if (bookLemmas.size) filtered = filtered.filter((item) => bookLemmas.has(item.lemma.toLowerCase()))
    }
    if (group !== 'all') {
      filtered = filtered.filter((item) => {
        if (item.type === 'sentence') return false
        if (group === 'new') return item.status === 'active' && item.staged !== true && isNew(item.review)
        if (group === 'due') return item.status === 'active' && item.staged !== true && !isNew(item.review) && isDue(item.review, now)
        if (group === 'leech') return item.status === 'active' && item.staged !== true && isLeech(item.review)
        if (group === 'backlog') return item.status === 'active' && item.staged === true
        if (group === 'missing') return !hasRealExample(item)
        if (group === 'known') return item.status === 'known'
        if (group === 'suspended') return item.status === 'suspended'
        return true
      })
    }
    const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    const cefrRank = (value: string | undefined): number => {
      const index = cefrOrder.indexOf((value ?? '').toUpperCase())
      return index >= 0 ? index : cefrOrder.length
    }
    filtered.sort((a, b) => {
      if (sort === 'alpha') return a.lemma.localeCompare(b.lemma)
      if (sort === 'recent') return b.createdAt.localeCompare(a.createdAt)
      if (sort === 'cefr') return cefrRank(a.cefr) - cefrRank(b.cefr) || a.lemma.localeCompare(b.lemma)
      if (sort === 'frequency') {
        return (
          (a.frequencyRank ?? Number.MAX_SAFE_INTEGER) - (b.frequencyRank ?? Number.MAX_SAFE_INTEGER) ||
          a.lemma.localeCompare(b.lemma)
        )
      }
      if (sort === 'lapses') {
        return b.review.lapses - a.review.lapses || a.lemma.localeCompare(b.lemma)
      }
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return a.review.due.localeCompare(b.review.due)
    })
    const total = filtered.length
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') ?? 200)))
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0))
    const page = filtered.slice(offset, offset + limit)
    const sourceMap = new Map<string, string>()
    for (const pack of store.packs()) {
      if (!sourceMap.has(pack.resourceId)) {
        sourceMap.set(pack.resourceId, pack.title ?? store.getResource(pack.resourceId)?.title ?? pack.resourceId)
      }
    }
    const sources = [...sourceMap.entries()].map(([id, title]) => ({ id, title }))
    const cefrs = [...new Set(words.map((item) => item.cefr).filter((value): value is string => Boolean(value)))].sort()
    sendJson(response, 200, {
      items: page.map((item) => viewModel(item, store, now)),
      counts,
      total,
      offset,
      limit,
      hasMore: offset + page.length < total,
      sources,
      cefrs,
      dailySelection: store.dailyWordSelection(now),
      summary: store.stats(now),
    })
    return
  }

  if (method === 'POST' && url.pathname === '/api/vocab/known') {
    try {
      const body = await readJson(request, 2_000_000)
      const words = parseKnownWords(typeof body.text === 'string' ? body.text : '')
      if (words.length === 0) {
        sendJson(response, 400, { error: '没有识别到单词，每行一个或用逗号分隔。' })
        return
      }
      const byLemma = new Map<string, Array<{ id: string; status: string }>>()
      for (const item of store.listItems()) {
        if (item.type === 'sentence') continue
        const key = item.lemma.toLowerCase().trim()
        const list = byLemma.get(key) ?? []
        list.push({ id: item.id, status: item.status })
        byLemma.set(key, list)
      }
      const unknown: string[] = []
      const ids: string[] = []
      let matchedWords = 0
      let alreadyKnown = 0
      for (const word of words) {
        const matches = byLemma.get(word)
        if (!matches?.length) {
          unknown.push(word)
          continue
        }
        matchedWords += 1
        for (const match of matches) {
          ids.push(match.id)
          if (match.status === 'known') alreadyKnown += 1
        }
      }
      const itemsUpdated = await store.setStatusMany([...new Set(ids)], 'known')
      sendJson(response, 200, {
        ok: true,
        words: words.length,
        matchedWords,
        itemsUpdated,
        alreadyKnown,
        unknown: unknown.slice(0, 20),
        unknownCount: unknown.length,
        summary: store.stats(),
      })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const itemDetailMatch = /^\/api\/items\/([^/]+)$/.exec(url.pathname)
  if (method === 'GET' && itemDetailMatch) {
    const item = store.getItem(decodeURIComponent(itemDetailMatch[1]!))
    if (!item) {
      sendJson(response, 404, { error: 'Item not found' })
      return
    }
    sendJson(response, 200, {
      item: {
        ...viewModel(item, store),
        contexts: item.contexts,
        examples: item.examples,
        relations: item.relations,
        tags: item.tags,
        notes: item.notes,
        wordFormation: item.wordFormation,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        review: item.review,
      },
    })
    return
  }

  const itemUpdateMatch = /^\/api\/items\/([^/]+)\/update$/.exec(url.pathname)
  if (method === 'POST' && itemUpdateMatch) {
    try {
      const itemId = decodeURIComponent(itemUpdateMatch[1]!)
      const body = await readJson(request)
      const collocations = Array.isArray(body.collocations)
        ? body.collocations.map((value) => String(value)).slice(0, 30)
        : undefined
      const patch = {
        ...(typeof body.sense === 'string' ? { sense: body.sense } : {}),
        ...(typeof body.definition === 'string' ? { definition: body.definition } : {}),
        ...(typeof body.definitionZh === 'string' ? { definitionZh: body.definitionZh } : {}),
        ...(typeof body.notes === 'string' ? { notes: body.notes } : {}),
        ...(typeof body.memoryHook === 'string' ? { memoryHook: body.memoryHook } : {}),
        ...(collocations ? { collocations } : {}),
      }
      if (Object.keys(patch).length === 0) {
        sendJson(response, 400, { error: '没有可更新的字段。' })
        return
      }
      const item = await store.updateItem(itemId, patch)
      if (!item) {
        sendJson(response, 404, { error: 'Item not found' })
        return
      }
      const resourceIds = new Set(item.contexts.map((context) => context.resourceId))
      for (const record of store.packs()) {
        if (!resourceIds.has(record.resourceId) && !resourceIds.has(record.parentResourceId ?? '')) continue
        try {
          const contents = await loadPack(record.dir)
          const target = contents.items.find((entry) => entry.id === itemId)
          if (!target) continue
          Object.assign(target, patch)
          await savePackFiles(contents, record.dir)
        } catch {
          // A missing pack must not block editing the library card.
        }
      }
      sendJson(response, 200, {
        ok: true,
        item: {
          ...viewModel(item, store),
          contexts: item.contexts,
          examples: item.examples,
          relations: item.relations,
          tags: item.tags,
          notes: item.notes,
          wordFormation: item.wordFormation,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          review: item.review,
        },
      })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'GET' && url.pathname === '/api/study/queue') {
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') ?? 20)))
    const newLimit = Math.max(0, Math.min(30, Number(url.searchParams.get('newLimit') ?? 10)))
    const group = url.searchParams.get('group') ?? 'all'
    const source = url.searchParams.get('source') ?? ''
    const cefr = url.searchParams.get('cefr') ?? ''
    const book = url.searchParams.get('book') ?? ''
    const now = new Date()
    const words = store.listItems().filter((item) => item.type !== 'sentence' && item.status === 'active')
    const bookLemmas = book
      ? new Set((getWordbook(book)?.words ?? []).map((word) => word.w.toLowerCase()))
      : undefined
    const scoped = words.filter((item) =>
      (!source || item.contexts.some((context) => context.resourceId === source)) &&
      (!cefr || item.cefr === cefr) &&
      (!bookLemmas || bookLemmas.has(item.lemma.toLowerCase())),
    )
    const fresh = scoped.filter((item) => isNew(item.review)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const due = scoped.filter((item) => !isNew(item.review) && isDue(item.review, now))
    const leech = scoped.filter((item) => isLeech(item.review))
    let selected: typeof words
    if (group === 'new') selected = fresh
    else if (group === 'due') selected = due
    else if (group === 'leech') selected = leech
    else selected = [...fresh.slice(0, newLimit), ...due]
    selected = selected.slice(0, limit)
    sendJson(response, 200, {
      items: selected.map((item) => viewModel(item, store, now)),
      counts: {
        new: fresh.length,
        due: due.length,
        leech: leech.length,
        total: selected.length,
      },
    })
    return
  }

  if (method === 'GET' && url.pathname === '/api/items') {
    const query = url.searchParams.get('q') ?? undefined
    const now = new Date()
    sendJson(response, 200, {
      items: store.listItems(query).map((item) => viewModel(item, store, now)),
      summary: store.stats(now),
    })
    return
  }

  if (url.pathname === '/api/tts') {
    if (method === 'GET') {
      const status = ttsStatus()
      const systemVoice = await getTtsVoice(true)
      sendJson(response, 200, {
        tts: status,
        providers: ttsProviderOptions,
        voice: status.configured ? status.voice : systemVoice,
        default: !status.configured,
        say: await isSayAvailable(),
        systemVoice: systemVoice ?? null,
        systemVoices: await listSystemVoices(true),
      })
      return
    }
    if (method === 'POST') {
      try {
        const body = await readJson(request)
        const tts = saveTtsSettings({
          provider: typeof body.provider === 'string' ? body.provider : undefined,
          apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
          baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
          model: typeof body.model === 'string' ? body.model : undefined,
          voice: typeof body.voice === 'string' ? body.voice : undefined,
          instructions: typeof body.instructions === 'string' ? body.instructions : undefined,
          clear: body.clear === true,
        })
        sendJson(response, 200, { ok: true, tts })
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
      }
      return
    }
  }

  if (method === 'GET' && url.pathname === '/api/passport') {
    sendJson(response, 200, await passportPayload(store))
    return
  }

  if (method === 'GET' && url.pathname === '/api/backup') {
    try {
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
      const file = path.join(config.dataDir, 'backups', `library-${stamp}.json`)
      const result = await writeLibraryBackup(store, file)
      const body = await fs.readFile(result.file)
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': String(body.length),
        'cache-control': 'no-store',
        'content-disposition': `attachment; filename="closeread-backup-${stamp}.json"`,
      })
      response.end(body)
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'GET' && url.pathname === '/api/settings') {
    const preferences = store.preferences()
    const workspace = currentWorkspace()
    const stats = visitors.stats()
    sendJson(response, 200, {
      dataDir: config.dataDir,
      packsDir: config.packsDir,
      workspace: { id: workspace.id, readOnly: workspace.readOnly, mode: publicModeEnabled() ? 'public' : 'local' },
      community: stats,
      counts: { ...store.stats(), packs: store.packs().length },
      preferences: {
        desiredRetention: preferences.desiredRetention,
        dailyNewTarget: preferences.dailyNewTarget,
        dailyReviewTarget: preferences.dailyReviewTarget,
        weeklyArticleGoal: preferences.weeklyArticleGoal,
        weeklyStudyDaysGoal: preferences.weeklyStudyDaysGoal,
      },
      llm: llmStatus(),
      tts: ttsStatus(),
      usage: usageSummary(),
      trash: await listTrash(),
      warnings: store.warnings(),
    })
    return
  }

  if (method === 'GET' && url.pathname === '/api/trash') {
    sendJson(response, 200, { entries: await listTrash() })
    return
  }

  const trashRestoreMatch = /^\/api\/trash\/([^/]+)\/restore$/.exec(url.pathname)
  if (method === 'POST' && trashRestoreMatch) {
    try {
      const result = await restoreTrash(store, decodeURIComponent(trashRestoreMatch[1]!))
      sendJson(response, 200, { ok: true, result, summary: store.stats() })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const trashMatch = /^\/api\/trash\/([^/]+)$/.exec(url.pathname)
  if (method === 'DELETE' && trashMatch) {
    const removed = await purgeTrash(decodeURIComponent(trashMatch[1]!))
    sendJson(response, removed ? 200 : 404, removed ? { ok: true } : { error: '回收站条目不存在。' })
    return
  }

  if (method === 'POST' && url.pathname === '/api/restore') {
    const temp = path.join(config.dataDir, 'backups', `restore-${randomUUID()}.json`)
    try {
      const body = await readBody(request, 250 * 1024 * 1024)
      if (body.length === 0) throw new Error('备份文件为空。')
      await fs.mkdir(path.dirname(temp), { recursive: true })
      await fs.writeFile(temp, body)
      const result = await restoreLibraryBackup(
        temp,
        storePath(),
        path.join(config.dataDir, 'resources'),
        config.packsDir,
      )
      await store.reload()
      sendJson(response, 200, { ok: true, result, summary: store.stats() })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    } finally {
      await fs.rm(temp, { force: true }).catch(() => {})
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/llm/test') {
    if (requireLlm(response)) return
    try {
      const testSchema = z.object({ ok: z.boolean() })
      const result = await chatJson(
        testSchema,
        'You are a connection test. Return exactly one JSON object.',
        'Return {"ok":true}.',
        { maxTokens: 20, temperature: 0 },
      )
      sendJson(response, 200, { ok: result.ok === true, model: config.llm.model, usage: usageSummary() })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const publishMatch = /^\/api\/packs\/([^/]+)\/publish$/.exec(url.pathname)
  if (method === 'POST' && publishMatch) {
    const pack = store.findPack(decodeURIComponent(publishMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: '找不到这个学习包。' })
      return
    }
    try {
      await shared.reload().catch(() => {})
      if (shared.findPack(pack.id)) {
        sendJson(response, 409, { error: '这个学习包已经在公共库里了。' })
        return
      }
      if (shared.packs().length >= 500) {
        sendJson(response, 429, { error: '公共库已满（500 个），暂时不能再公开新的学习包。' })
        return
      }
      const name = `${path.basename(pack.dir)}`
      const target = path.join(rootPacksDir, name)
      await fs.cp(pack.dir, target, { recursive: true, errorOnExist: false, force: false })
      await shared.addPack({
        ...pack,
        dir: target,
        publishedBy: currentWorkspace().id,
        publishedAt: new Date().toISOString(),
      })
      sendJson(response, 200, { ok: true, pack: { id: pack.id, title: pack.title ?? pack.id } })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const unpublishMatch = /^\/api\/packs\/([^/]+)\/unpublish$/.exec(url.pathname)
  if (method === 'POST' && unpublishMatch) {
    const id = decodeURIComponent(unpublishMatch[1]!)
    try {
      await shared.reload().catch(() => {})
      const record = shared.findPack(id)
      if (!record) {
        sendJson(response, 404, { error: '公共库里没有这个学习包。' })
        return
      }
      const me = currentWorkspace().id
      if (record.publishedBy !== me && !isOwnerVisitor(me)) {
        sendJson(response, 403, {
          error: record.publishedBy
            ? '这个学习包是别人公开的，只有作者本人能取消。'
            : '只有站点作者能移除内置的示例内容。',
        })
        return
      }
      // Unpublishing used to delete the folder outright. For the built-in sample
      // that is the only copy, so send it to the trash and keep it restorable.
      await trashPack(shared, record).catch(() => {})
      await shared.removePack(id)
      if (record.dir.startsWith(rootPacksDir)) {
        await fs.rm(record.dir, { recursive: true, force: true }).catch(() => {})
      }
      sendJson(response, 200, { ok: true })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'GET' && url.pathname === '/api/packs') {
    await shared.reload().catch(() => {})
    const sharedById = new Map(shared.packs().map((pack) => [pack.id, pack]))
    const me = currentWorkspace().id
    const owner = isOwnerVisitor(me)
    sendJson(response, 200, {
      packs: store.packs().map((pack) => {
        const issueId = pack.parentResourceId ?? pack.resourceId
        const issue = store.getResource(issueId)
        return {
          ...pack,
          ...packView(store, pack),
          shared: sharedById.has(pack.id),
          publishedByMe: sharedById.get(pack.id)?.publishedBy === me,
          builtIn: Boolean(sharedById.get(pack.id)) && !sharedById.get(pack.id)?.publishedBy,
          canUnpublish:
            Boolean(sharedById.get(pack.id)) &&
            (sharedById.get(pack.id)?.publishedBy === me || owner),
          issueId,
          issueTitle: issue?.title ?? issueId,
          chapter: chapterNav(store, pack),
        }
      }),
    })
    return
  }

  const neighborsMatch = /^\/api\/packs\/([^/]+)\/neighbors$/.exec(url.pathname)
  if (method === 'GET' && neighborsMatch) {
    const pack = store.findPack(decodeURIComponent(neighborsMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    sendJson(response, 200, { chapter: chapterNav(store, pack) })
    return
  }

  const recommendMatch = /^\/api\/packs\/([^/]+)\/recommend$/.exec(url.pathname)
  if (method === 'GET' && recommendMatch) {
    const pack = store.findPack(decodeURIComponent(recommendMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      const limit = Math.max(1, Math.min(6, Number(url.searchParams.get('limit') ?? 3)))
      sendJson(response, 200, { recommendations: await recommendNext(store, pack.id, limit) })
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'GET' && url.pathname === '/api/resources') {
    pruneJobs()
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') ?? 12)))
    sendJson(response, 200, {
      resources: store.listResources().slice(0, limit).map((resource) => resourceView(resource, store)),
      llm: hasLlm(),
      model: config.llm.model,
      provider: llmStatus().label,
    })
    return
  }

  if (
    method === 'POST' &&
    publicModeEnabled() &&
    (url.pathname.startsWith('/api/import/') ||
      url.pathname === '/api/build' ||
      /^\/api\/resources\/[^/]+\/build$/.test(url.pathname))
  ) {
    try {
      await assertWorkspaceCapacity(currentWorkspace())
    } catch (error) {
      sendJson(response, 413, { error: error instanceof Error ? error.message : String(error) })
      return
    }
  }

  if (method === 'POST' && url.pathname === '/api/compile') {
    const ip = request.socket.remoteAddress ?? 'unknown'
    const allowed = compileAllowed(ip)
    if (!allowed.ok) {
      sendJson(response, 429, { error: allowed.error })
      return
    }
    try {
      const body = await readJson(request, 20_000_000)
      const kind = body.kind === 'url' ? 'url' : 'text'
      const text = typeof body.text === 'string' ? body.text : ''
      const rawUrl = typeof body.url === 'string' ? body.url.trim() : ''
      if (kind === 'url' ? !rawUrl : !text.trim()) {
        sendJson(response, 400, { error: kind === 'url' ? '请填写网页链接。' : '请粘贴要导入的文本。' })
        return
      }
      const llmInput =
        typeof body.llm === 'object' && body.llm !== null ? (body.llm as Record<string, unknown>) : {}
      const requestedLimit = body.limit === undefined || body.limit === 'auto' ? 'auto' : Number(body.limit)
      compileActive += 1
      try {
        const result = await compileToPack({
          kind,
          text,
          url: rawUrl,
          ...(typeof body.title === 'string' && body.title.trim() ? { title: body.title.trim() } : {}),
          ...(typeof body.level === 'string' && body.level.trim() ? { level: body.level.trim() } : {}),
          limit: requestedLimit === 'auto' || !Number.isFinite(requestedLimit) ? 'auto' : requestedLimit,
          useLlm: body.useLlm !== false,
          translate: body.translate !== false,
          knownLemmas: Array.isArray(body.knownLemmas)
            ? body.knownLemmas.filter((value): value is string => typeof value === 'string')
            : [],
          llm: {
            ...(typeof llmInput.provider === 'string' ? { provider: llmInput.provider } : {}),
            ...(typeof llmInput.apiKey === 'string' ? { apiKey: llmInput.apiKey } : {}),
            ...(typeof llmInput.baseUrl === 'string' ? { baseUrl: llmInput.baseUrl } : {}),
            ...(typeof llmInput.model === 'string' ? { model: llmInput.model } : {}),
          },
        })
        sendJson(response, 200, { ok: true, ...result })
      } finally {
        compileActive -= 1
      }
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/preview') {
    try {
      const body = await readJson(request, 2_000_000)
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (text.length < 40) {
        sendJson(response, 400, { error: '内容太短，先粘贴一篇完整的文章。' })
        return
      }
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      const resource = {
        id: 'preview',
        title: title || '预览',
        kind: 'text' as const,
        source: 'preview',
        text,
        segments: segmentsFromText(text),
        wordCount: countWords(text),
        createdAt: new Date().toISOString(),
        metadata: { format: 'preview' },
      } as unknown as Resource
      const selection = suggestSelection(resource, { limit: 'auto' })
      const articles = getResourceArticles(resource)
      sendJson(response, 200, {
        ok: true,
        words: resource.wordCount,
        segments: resource.segments.length,
        articles: articles.length,
        items: selection.recommended,
        cefr: selection.cefr,
        minutes: intensiveReadingMinutes({
          wordCount: resource.wordCount,
          paragraphs: resource.segments.length,
          items: selection.recommended,
        }),
        note: selection.reason,
      })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/import/text') {
    try {
      const body = await readJson(request)
      const text = typeof body.text === 'string' ? body.text : ''
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!text.trim()) {
        sendJson(response, 400, { error: '请粘贴要导入的文本。' })
        return
      }
      const aiClean = body.aiClean !== false && hasLlm()
      const resource = await ingestText(text, { title: title || undefined, aiClean })
      const duplicate = duplicateOf(store, resource)
      if (duplicate) {
        await discardNewResource(resource)
        sendJson(response, 409, {
          error: `这份材料已经导入过：${duplicate.title}`,
          existing: { id: duplicate.id, title: duplicate.title },
        })
        return
      }
      await store.addResource(resource)
      sendJson(response, 200, { ok: true, resource: resourceView(resource, store) })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/import/url') {
    try {
      const body = await readJson(request)
      const raw = typeof body.url === 'string' ? body.url.trim() : ''
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!raw) {
        sendJson(response, 400, { error: '请填写网页链接。' })
        return
      }
      const aiClean = body.aiClean !== false && hasLlm()
      const resource = await ingestSource(raw, { title: title || undefined, aiClean }).catch((error) => {
        throw new Error(friendlyImportError(error instanceof Error ? error.message : String(error), raw))
      })
      const duplicate = duplicateOf(store, resource)
      if (duplicate) {
        await discardNewResource(resource)
        sendJson(response, 409, {
          error: `这份材料已经导入过：${duplicate.title}`,
          existing: { id: duplicate.id, title: duplicate.title },
        })
        return
      }
      await store.addResource(resource)
      sendJson(response, 200, { ok: true, resource: resourceView(resource, store) })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/import/pdf') {
    try {
      const filename = url.searchParams.get('name')?.trim() || 'uploaded.pdf'
      const title = url.searchParams.get('title')?.trim() || undefined
      const buffer = await readBody(request, 50 * 1024 * 1024)
      const resource = await ingestPdfBuffer(buffer, { filename, title })
      try {
        resource.metadata.uploadPath = await saveUpload(buffer, filename)
      } catch {
        // Keeping the original file is a convenience, not a requirement.
      }
      const duplicate = duplicateOf(store, resource)
      if (duplicate) {
        await discardNewResource(resource)
        sendJson(response, 409, {
          error: `这份材料已经导入过：${duplicate.title}`,
          existing: { id: duplicate.id, title: duplicate.title },
        })
        return
      }
      await store.addResource(resource)
      sendJson(response, 200, { ok: true, resource: resourceView(resource, store) })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/import/ebook') {
    try {
      const filename = url.searchParams.get('name')?.trim() || 'uploaded.epub'
      const title = url.searchParams.get('title')?.trim() || undefined
      const extension = path.extname(filename).toLowerCase()
      const buffer = await readBody(request, 100 * 1024 * 1024)
      let resource: Resource
      if (extension === '.epub') {
        resource = await ingestEpubBuffer(buffer, { filename, title })
      } else if (extension === '.mobi' || extension === '.azw' || extension === '.azw3') {
        resource = await ingestMobiBuffer(buffer, { filename, title })
      } else if (extension === '.docx') {
        resource = await ingestDocxBuffer(buffer, { filename, title })
      } else if (['.txt', '.md', '.markdown', '.text'].includes(extension)) {
        resource = await ingestText(buffer.toString('utf8'), {
          ...(title ? { title } : {}),
          source: filename,
        })
      } else if (extension === '.html' || extension === '.htm') {
        const extracted = extractArticle(buffer.toString('utf8'), filename)
        if (extracted.chars < 200) throw new Error('这个 HTML 里没提取到正文。')
        resource = await ingestText(extracted.text, {
          title: title || extracted.title,
          source: filename,
        })
      } else {
        throw new Error('只支持 EPUB、MOBI、AZW、AZW3、DOCX、HTML、TXT、Markdown 文件。')
      }
      try {
        resource.metadata.uploadPath = await saveUpload(buffer, filename)
      } catch {
        // Keeping the original file is a convenience, not a requirement.
      }
      const duplicate = duplicateOf(store, resource)
      if (duplicate) {
        await discardNewResource(resource)
        sendJson(response, 409, {
          error: `这份材料已经导入过：${duplicate.title}`,
          existing: { id: duplicate.id, title: duplicate.title },
        })
        return
      }
      await store.addResource(resource)
      sendJson(response, 200, { ok: true, resource: resourceView(resource, store) })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const articlesMatch = /^\/api\/resources\/([^/]+)\/articles$/.exec(url.pathname)
  if (method === 'GET' && articlesMatch) {
    const resource = store.getResource(decodeURIComponent(articlesMatch[1]!))
    if (!resource) {
      sendJson(response, 404, { error: 'Resource not found' })
      return
    }
    const allArticles = getResourceArticles(resource)
    const sections = articleSections(allArticles)
    const visibleArticles = allArticles.filter((article) => isVisibleArticle(resource, article))
    const hiddenArticles = allArticles.filter((article) => !isVisibleArticle(resource, article))
    const packs = store
      .packs()
      .filter((pack) => pack.resourceId === resource.id || pack.parentResourceId === resource.id)
      .map((pack) => packView(store, pack))
    const summary = (article: (typeof allArticles)[number]) => ({
      index: article.index,
      title: article.title,
      wordCount: article.wordCount,
      preview: previewText(article.text, 160),
      section: sections.get(article.index) ?? null,
    })
    sendJson(response, 200, {
      resource: resourceView(resource, store),
      articles: visibleArticles.map(summary),
      hiddenArticles: hiddenArticles.map((article) => ({ ...summary(article), hidden: true })),
      totalArticles: allArticles.length,
      hiddenCount: hiddenArticles.length,
      packs: packs.filter((pack) => pack.articleIndex !== null),
    })
    return
  }

  const overrideArticleMatch = /^\/api\/resources\/([^/]+)\/articles\/(\d+)\/override$/.exec(url.pathname)
  if (method === 'POST' && overrideArticleMatch) {
    try {
      const resource = store.getResource(decodeURIComponent(overrideArticleMatch[1]!))
      const index = Number(overrideArticleMatch[2])
      if (!resource) {
        sendJson(response, 404, { error: 'Resource not found' })
        return
      }
      const article = getResourceArticles(resource).find((entry) => entry.index === index)
      if (!article) {
        sendJson(response, 404, { error: 'Article not found' })
        return
      }
      const body = await readJson(request)
      if (typeof body.isArticle !== 'boolean') {
        sendJson(response, 400, { error: 'isArticle must be true or false' })
        return
      }
      resource.articleOverrides = { ...(resource.articleOverrides ?? {}), [String(index)]: body.isArticle }
      await store.addResource(resource)
      sendJson(response, 200, { ok: true, resource: resourceView(resource, store) })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const resplitMatch = /^\/api\/resources\/([^/]+)\/resplit$/.exec(url.pathname)
  if (method === 'POST' && resplitMatch) {
    try {
      const resource = store.getResource(decodeURIComponent(resplitMatch[1]!))
      if (!resource) {
        sendJson(response, 404, { error: 'Resource not found' })
        return
      }
      const uploadPath = typeof resource.metadata.uploadPath === 'string' ? resource.metadata.uploadPath : ''
      if (!uploadPath) {
        sendJson(response, 400, { error: '原始上传文件未保存，请重新导入这份材料。' })
        return
      }
      const extension = path.extname(uploadPath).toLowerCase()
      let articles
      if (extension === '.epub') articles = (await readEpub(uploadPath)).articles
      else if (extension === '.mobi' || extension === '.azw' || extension === '.azw3') {
        articles = (await readMobi(uploadPath)).articles
      } else if (extension === '.pdf') articles = (await readPdf(uploadPath)).articles
      else throw new Error('This upload cannot be split into articles.')
      if (articles.length === 0) throw new Error('No article boundaries were found.')
      resource.articles = articles
      resource.articleOverrides = {}
      resource.metadata = { ...resource.metadata, articles: articles.length }
      await store.addResource(resource)
      sendJson(response, 200, {
        ok: true,
        articleCount: articles.length,
        resource: resourceView(resource, store),
      })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const deleteResourceMatch = /^\/api\/resources\/([^/]+)\/delete$/.exec(url.pathname)
  if (method === 'POST' && deleteResourceMatch) {
    try {
      const resource = store.getResource(decodeURIComponent(deleteResourceMatch[1]!))
      if (!resource) {
        sendJson(response, 404, { error: 'Resource not found' })
        return
      }
      if ([...activeBuilds.keys()].some((key) => key.startsWith(`${resource.id}:`))) {
        sendJson(response, 409, { error: '这份材料正在生成学习包，请先取消当前构建。' })
        return
      }

      const relatedPacks = store
        .packs()
        .filter(
          (pack) =>
            pack.resourceId === resource.id ||
            pack.parentResourceId === resource.id ||
            pack.resourceId.startsWith(`${resource.id}--a`),
        )
      const scopedIds = new Set([resource.id, ...relatedPacks.map((pack) => pack.resourceId)])
      const packItemIds: string[] = []
      for (const pack of relatedPacks) {
        try {
          packItemIds.push(...(await loadPack(pack.dir)).items.map((item) => item.id))
        } catch {
          // A missing pack file should not block resource deletion.
        }
      }
      const trashEntry = await trashResource(store, resource)
      for (const pack of relatedPacks) {
        await store.removePack(pack.id)
      }

      const candidateIds = new Set([
        ...packItemIds,
        ...store
          .listItems()
          .filter((item) => item.contexts.some((context) => scopedIds.has(context.resourceId)))
          .map((item) => item.id),
      ])
      const removable = [...candidateIds].filter((itemId) => {
        const item = store.getItem(itemId)
        return item ? item.contexts.every((context) => scopedIds.has(context.resourceId)) : false
      })
      const removedItems = await store.removeItems(removable)
      await store.removeResource(resource.id)
      sendJson(response, 200, {
        ok: true,
        removedPacks: relatedPacks.length,
        removedItems,
        trashId: trashEntry.id,
        summary: store.stats(),
      })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const buildMatch = /^\/api\/resources\/([^/]+)\/build$/.exec(url.pathname)
  if (method === 'POST' && buildMatch) {
    const resource = store.getResource(decodeURIComponent(buildMatch[1]!))
    if (!resource) {
      sendJson(response, 404, { error: 'Resource not found' })
      return
    }
    let body: Record<string, unknown> = {}
    try {
      body = await readJson(request)
    } catch {
      // An empty or malformed body just means default build options.
    }
    const requestedLimit =
      body.limit === undefined || body.limit === 'auto' ? 'auto' : Number(body.limit)
    const requestedArticle =
      body.article === undefined || body.article === null ? undefined : Number(body.article)
    if (requestedArticle !== undefined) {
      const articles = getResourceArticles(resource)
      if (!Number.isInteger(requestedArticle) || requestedArticle < 0 || requestedArticle >= articles.length) {
        sendJson(response, 400, { error: 'Article not found' })
        return
      }
    }
    const job = startBuild(store, resource, {
      limit: requestedLimit === 'auto' || !Number.isFinite(requestedLimit) ? 'auto' : requestedLimit,
      useLlm: body.useLlm !== false,
      translate: body.translate !== false,
      audio: body.audio === true,
      onlyNew: body.onlyNew === true,
      ...(body.prefetch && typeof body.prefetch === 'object'
        ? {
            prefetch: {
              answers: (body.prefetch as Record<string, unknown>).answers === true,
              expand: (body.prefetch as Record<string, unknown>).expand === true,
              sentences: (body.prefetch as Record<string, unknown>).sentences === true,
            },
          }
        : {}),
      ...(typeof body.style === 'string' && body.style.trim() ? { styleName: body.style.trim() } : {}),
      ...(requestedArticle !== undefined ? { articleIndex: requestedArticle } : {}),
    })
    sendJson(response, 202, { jobId: job.id, job })
    return
  }

  const cancelJobMatch = /^\/api\/jobs\/([^/]+)\/cancel$/.exec(url.pathname)
  if (method === 'POST' && cancelJobMatch) {
    const job = buildJobs.get(decodeURIComponent(cancelJobMatch[1]!))
    if (!job) {
      sendJson(response, 404, { error: 'Job not found' })
      return
    }
    jobControllers.get(job.id)?.abort()
    if (job.status === 'running') {
      job.status = 'cancelled'
      job.message = '已取消'
      job.error = undefined
    }
    sendJson(response, 200, { job })
    return
  }

  const jobMatch = /^\/api\/jobs\/([^/]+)$/.exec(url.pathname)
  if (method === 'GET' && jobMatch) {
    pruneJobs()
    const job = buildJobs.get(decodeURIComponent(jobMatch[1]!))
    if (!job) {
      sendJson(response, 404, { error: 'Job not found' })
      return
    }
    sendJson(response, 200, { job })
    return
  }

  if (method === 'POST' && url.pathname === '/api/review') {
    const body = await readJson(request)
    const itemId = typeof body.itemId === 'string' ? body.itemId : ''
    const rating = Number(body.rating)
    if (!itemId || ![1, 2, 3, 4].includes(rating)) {
      sendJson(response, 400, { error: 'itemId and rating (1-4) are required' })
      return
    }
    const item = await store.applyReview(itemId, rating as Grade)
    if (!item) {
      sendJson(response, 404, { error: 'Item not found' })
      return
    }
    sendJson(response, 200, { ok: true, item: viewModel(item, store), summary: store.stats() })
    return
  }

  if (method === 'POST' && url.pathname === '/api/review/undo') {
    try {
      const result = await store.undoLastReview()
      if (!result) {
        sendJson(response, 409, { error: '没有可撤销的复习记录。' })
        return
      }
      sendJson(response, 200, {
        ok: true,
        item: viewModel(result.item, store),
        summary: store.stats(),
        undone: { reviewedAt: result.log.reviewedAt },
      })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/words/examples') {
    try {
      if (!hasLlm()) {
        sendJson(response, 400, { error: '批量补例句需要配置模型 API Key。' })
        return
      }
      const body = await readJson(request)
      const limit = Math.max(1, Math.min(10, Number(body.limit ?? 5)))
      const book = typeof body.book === 'string' ? body.book : ''
      const candidates = store.listItems()
        .filter((item) => item.type !== 'sentence' && !hasRealExample(item) && (!book || item.tags.includes(`wordbook:${book}`)))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit)
      const updated: typeof candidates = []
      const failures: Array<{ lemma: string; error: string }> = []
      for (const item of candidates) {
        try {
          const result = await generateLifeExamples(item, '日常')
          const examples = result.examples.map((example) => ({ text: example.en, origin: 'generated' as const }))
          updated.push({
            ...item,
            examples: [...item.examples, ...examples.filter((example) => !item.examples.some((existing) => existing.text === example.text))],
            ...(item.notes ? {} : result.note ? { notes: result.note } : {}),
            updatedAt: new Date().toISOString(),
          })
        } catch (error) {
          failures.push({ lemma: item.lemma, error: error instanceof Error ? error.message : String(error) })
        }
      }
      if (updated.length) await store.upsertItems(updated)
      const remaining = store.listItems().filter((item) => item.type !== 'sentence' && !hasRealExample(item) && (!book || item.tags.includes(`wordbook:${book}`))).length
      sendJson(response, 200, { ok: true, attempted: candidates.length, updated: updated.length, failures, remaining })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const exampleItemMatch = /^\/api\/items\/([^/]+)\/examples$/.exec(url.pathname)
  if (method === 'POST' && exampleItemMatch) {
    if (requireLlm(response)) return
    try {
      const item = store.getItem(decodeURIComponent(exampleItemMatch[1]!))
      if (!item) {
        sendJson(response, 404, { error: 'Item not found' })
        return
      }
      const result = await generateLifeExamples(item, '日常')
      const examples = result.examples.map((example) => ({ text: example.en, origin: 'generated' as const }))
      const updated = {
        ...item,
        examples: [...item.examples, ...examples.filter((example) => !item.examples.some((existing) => existing.text === example.text))],
        notes: item.notes || result.note,
        updatedAt: new Date().toISOString(),
      }
      await store.upsertItems([updated])
      sendJson(response, 200, { ok: true, item: viewModel(updated, store) })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  if (method === 'POST' && url.pathname === '/api/favorite') {
    const body = await readJson(request)
    const itemId = typeof body.itemId === 'string' ? body.itemId : ''
    const favorite = body.favorite === true
    if (!itemId) {
      sendJson(response, 400, { error: 'itemId is required' })
      return
    }
    const item = await store.setFavorite(itemId, favorite)
    if (!item) {
      sendJson(response, 404, { error: 'Item not found' })
      return
    }
    sendJson(response, 200, { ok: true, item: viewModel(item, store), summary: store.stats() })
    return
  }

  if (method === 'POST' && url.pathname === '/api/status') {
    const body = await readJson(request)
    const itemId = typeof body.itemId === 'string' ? body.itemId : ''
    const status = body.status
    if (!itemId || (status !== 'active' && status !== 'known' && status !== 'suspended')) {
      sendJson(response, 400, { error: 'itemId and a valid status are required' })
      return
    }
    const item = await store.setStatus(itemId, status)
    if (!item) {
      sendJson(response, 404, { error: 'Item not found' })
      return
    }
    sendJson(response, 200, { ok: true, item: viewModel(item, store), summary: store.stats() })
    return
  }

  if (method === 'POST' && url.pathname === '/api/items/bulk') {
    try {
      const body = await readJson(request)
      const ids = Array.isArray(body.ids)
        ? [...new Set(body.ids.map((value) => String(value)).filter(Boolean))].slice(0, 500)
        : []
      const action = typeof body.action === 'string' ? body.action : ''
      if (ids.length === 0) {
        sendJson(response, 400, { error: '先选择要操作的词卡。' })
        return
      }
      let count = 0
      if (action === 'active' || action === 'known' || action === 'suspended') {
        count = await store.setStatusMany(ids, action)
      } else if (action === 'favorite' || action === 'unfavorite') {
        count = await store.setFavoriteMany(ids, action === 'favorite')
      } else {
        sendJson(response, 400, { error: '不支持的批量操作。' })
        return
      }
      sendJson(response, 200, { ok: true, count, summary: store.stats() })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const analyzeMatch = /^\/api\/pack\/([^/]+)\/analyze-selection$/.exec(url.pathname)
  if (method === 'POST' && analyzeMatch) {
    const packId = decodeURIComponent(analyzeMatch[1]!)
    const pack = store.findPack(packId)
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    const body = await readJson(request)
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) {
      sendJson(response, 400, { error: 'text is required' })
      return
    }
    try {
      const current = await loadPack(pack.dir)
      const context = typeof body.context === 'string' ? body.context.trim() : ''
      const analysis = await analyzeSelection(current, text, context ? { context } : {})
      sendJson(response, 200, { analysis })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const packActionMatch = /^\/api\/pack\/([^/]+)\/(add|remove)$/.exec(url.pathname)
  if (method === 'POST' && packActionMatch) {
    const packId = decodeURIComponent(packActionMatch[1]!)
    const action = packActionMatch[2]
    const pack = store.findPack(packId)
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }

    const body = await readJson(request)
    try {
      const current = await loadPack(pack.dir)

      if (action === 'remove') {
        const itemId = typeof body.itemId === 'string' ? body.itemId : ''
        if (!itemId) {
          sendJson(response, 400, { error: 'itemId is required' })
          return
        }
        if (!current.items.some((item) => item.id === itemId)) {
          sendJson(response, 404, { error: 'Item not found in pack' })
          return
        }
        const removedItem = current.items.find((item) => item.id === itemId)
        const updated = removeItemFromPack(current, itemId)
        await savePackFiles(updated, pack.dir)
        await store.setStatus(itemId, 'known')
        if (removedItem) await store.recordWordFeedback(removedItem.lemma, -1)
        const record = store.findPack(pack.id)
        if (record) await store.addPack({ ...record, itemCount: updated.items.length })
        sendJson(response, 200, { ok: true, itemId, itemCount: updated.items.length })
        return
      }

      const word = typeof body.word === 'string' ? body.word.trim() : ''
      if (!word) {
        sendJson(response, 400, { error: 'word is required' })
        return
      }
      const item = await generatePackItem(current, word)
      const target =
        body.source === 'manual'
          ? { manual: true }
          : body.source === 'front' || body.front === true
            ? { front: true }
            : typeof body.paragraphIndex === 'number' && Number.isInteger(body.paragraphIndex)
              ? { paragraphIndex: body.paragraphIndex }
              : {}
      const updated = addItemToPack(current, item, target)
      if (updated === current) {
        sendJson(response, 200, { ok: true, duplicate: true, itemId: item.id, itemCount: current.items.length })
        return
      }
      await savePackFiles(updated, pack.dir)
      await store.upsertItems([item])
      const record = store.findPack(pack.id)
      if (record) await store.addPack({ ...record, itemCount: updated.items.length })
      sendJson(response, 200, { ok: true, itemId: item.id, itemCount: updated.items.length })
      return
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
      return
    }
  }

  const exportMatch = /^\/api\/pack\/([^/]+)\/export\/(html|epub|pdf|mobi|png|png-pages)$/.exec(url.pathname)
  if (method === 'GET' && exportMatch) {
    const pack = store.findPack(decodeURIComponent(exportMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    const format = exportMatch[2] as 'html' | 'epub' | 'pdf' | 'mobi' | 'png' | 'png-pages'
    const density = url.searchParams.get('density') === 'compact' ? 'compact' : 'comfortable'
    const rawWords = Number(url.searchParams.get('words'))
    const requestedWords =
      Number.isInteger(rawWords) && rawWords >= 5 ? Math.min(100, Math.round(rawWords / 5) * 5) : undefined
    try {
      const contents = await loadPack(pack.dir)
      const prepared = await preparePackForExport(contents)
      if (prepared.changed > 0) await savePackFiles(contents, pack.dir)
      let exportPack = contents
      let selectedCount: number | undefined
      if (requestedWords) {
        const selected = await selectExportWords(contents, requestedWords)
        exportPack = filterPackForExport(contents, selected)
        selectedCount = selected.filter((item) => item.type !== 'sentence').length
      }
      let body: Uint8Array
      let contentType: string
      if (format === 'html') {
        body = Buffer.from(renderPackExportHtml(exportPack), 'utf8')
        contentType = 'text/html; charset=utf-8'
      } else if (format === 'epub') {
        body = renderPackEpub(exportPack)
        contentType = 'application/epub+zip'
      } else if (format === 'pdf') {
        body = await renderPackPdf(exportPack, { density, wordLayout: 'catalog' })
        contentType = 'application/pdf'
      } else if (format === 'png') {
        const width = Math.max(640, Math.min(2400, Number(url.searchParams.get('width')) || 1200))
        const scale = Math.max(1, Math.min(3, Number(url.searchParams.get('scale')) || 1))
        body = await renderPackPng(exportPack, { width, scale })
        contentType = 'image/png'
      } else if (format === 'png-pages') {
        const width = Math.max(640, Math.min(1600, Number(url.searchParams.get('width')) || 900))
        const maxHeight = Math.max(2400, Math.min(12000, Number(url.searchParams.get('maxHeight')) || 5000))
        body = await renderPackPngPages(exportPack, { width, maxHeight })
        contentType = 'application/zip'
      } else {
        body = await renderPackMobi(exportPack)
        contentType = 'application/octet-stream'
      }
      const extension = format === 'png-pages' ? 'zip' : format
      let name = exportFileName(exportPack, extension)
      if (format === 'png') {
        const width = Math.max(640, Math.min(2400, Number(url.searchParams.get('width')) || 1200))
        const scale = Math.max(1, Math.min(3, Number(url.searchParams.get('scale')) || 1))
        if (width !== 1200 || scale > 1) {
          name = name.replace(/\.png$/i, '') + `-${width}w${scale > 1 ? `-${scale}x` : ''}.png`
        }
      }
      const countSuffix = selectedCount ? `-${selectedCount}w` : ''
      const densitySuffix = format === 'pdf' && density === 'compact' ? '-compact' : ''
      if (countSuffix) name = name.replace(/(\.[^.]+)$/, `${countSuffix}$1`)
      if (densitySuffix) name = name.replace(/(\.[^.]+)$/, `${densitySuffix}$1`)
      response.writeHead(200, {
        'content-type': contentType,
        'content-length': String(body.length),
        'cache-control': 'no-store',
        ...(selectedCount ? { 'x-export-words': String(selectedCount) } : {}),
        'content-disposition': `attachment; filename="${pack.id}${countSuffix}${densitySuffix}.${extension}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      })
      response.end(body)
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const editReadingMatch = /^\/api\/pack\/([^/]+)\/reading\/edit$/.exec(url.pathname)
  if (method === 'POST' && editReadingMatch) {
    const pack = store.findPack(decodeURIComponent(editReadingMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      const body = await readJson(request)
      const kind = body.kind === 'title' || body.kind === 'lead' ? body.kind : 'paragraph'
      const contents = await loadPack(pack.dir)
      if (kind === 'paragraph') {
        const index = Number(body.index)
        const paragraph = (contents.reading ?? []).find((entry) => entry.index === index)
        if (!paragraph) {
          sendJson(response, 404, { error: 'Paragraph not found' })
          return
        }
        if (body.delete === true) {
          const oldOriginal = paragraph.original
          contents.reading = (contents.reading ?? [])
            .filter((entry) => entry.index !== index)
            .map((entry, newIndex) => ({ ...entry, index: newIndex }))
          const changedItems = syncAfterParagraphDelete(contents, index, oldOriginal)
          await savePackFiles(contents, pack.dir)
          await store.replaceLearningItems(changedItems)
          sendJson(response, 200, { ok: true, deleted: true, total: contents.reading.length })
          return
        }
        const text = typeof body.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : ''
        if (!text) {
          sendJson(response, 400, { error: '段落内容不能为空。' })
          return
        }
        const surrounding = (contents.reading ?? [])
          .filter((entry) => Math.abs(entry.index - index) <= 1)
          .map((entry) => entry.original)
          .join('\n\n')
        const edited = await editParagraphText(text, surrounding, contents.title)
        const oldOriginal = paragraph.original
        paragraph.original = text
        paragraph.translation = edited.translation
        paragraph.note = edited.note
        // Manual boundaries describe the old text; let the new paragraph re-split automatically.
        delete paragraph.customSentences
        const changedItems = syncAfterParagraphEdit(contents, index, oldOriginal)
        await savePackFiles(contents, pack.dir)
        await store.replaceLearningItems(changedItems)
        sendJson(response, 200, { ok: true, paragraph })
        return
      }

      const text = typeof body.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : ''
      if (kind === 'title' && !text) {
        sendJson(response, 400, { error: '标题不能为空。' })
        return
      }
      if (kind === 'lead' && !text) {
        const frontMatter = { ...(contents.frontMatter ?? { title: contents.title, itemIds: [] }) }
        delete frontMatter.lead
        delete frontMatter.leadZh
        delete frontMatter.leadNote
        contents.frontMatter = frontMatter
        await savePackFiles(contents, pack.dir)
        sendJson(response, 200, { ok: true, frontMatter })
        return
      }
      const edited = await editFrontMatterText(kind, text, contents.summary)
      const frontMatter = {
        title: contents.title,
        itemIds: [],
        ...contents.frontMatter,
      }
      const oldTitle = contents.title
      if (kind === 'title') {
        contents.title = text
        frontMatter.title = text
        frontMatter.titleZh = edited.translation
        if (edited.note) frontMatter.titleNote = edited.note
      } else {
        frontMatter.lead = text
        frontMatter.leadZh = edited.translation
        if (edited.note) frontMatter.leadNote = edited.note
      }
      contents.frontMatter = frontMatter
      const changedItems = kind === 'title' ? syncAfterTitleEdit(contents, oldTitle) : []
      await savePackFiles(contents, pack.dir)
      if (changedItems.length > 0) await store.replaceLearningItems(changedItems)
      if (kind === 'title') {
        const record = store.findPack(pack.id)
        if (record) await store.addPack({ ...record, title: contents.title })
      }
      sendJson(response, 200, { ok: true, frontMatter })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const sentenceBoundsMatch = /^\/api\/pack\/([^/]+)\/reading\/sentences$/.exec(url.pathname)
  if (method === 'POST' && sentenceBoundsMatch) {
    const pack = store.findPack(decodeURIComponent(sentenceBoundsMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      const body = await readJson(request)
      const index = Number(body.index)
      const contents = await loadPack(pack.dir)
      const paragraph = (contents.reading ?? []).find((entry) => entry.index === index)
      if (!paragraph) {
        sendJson(response, 404, { error: 'Paragraph not found' })
        return
      }
      const custom = normalizeSentenceBoundaries(paragraph.original, body.sentences)
      if (custom) paragraph.customSentences = custom
      else delete paragraph.customSentences
      const applied = custom ?? sentences(paragraph.original)
      await savePackFiles(contents, pack.dir)
      sendJson(response, 200, { ok: true, sentences: applied, default: !custom })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const noteEditMatch = /^\/api\/pack\/([^/]+)\/reading\/note$/.exec(url.pathname)
  if (method === 'POST' && noteEditMatch) {
    const pack = store.findPack(decodeURIComponent(noteEditMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      const body = await readJson(request)
      const index = Number(body.index)
      const contents = await loadPack(pack.dir)
      const paragraph = (contents.reading ?? []).find((entry) => entry.index === index)
      if (!paragraph) {
        sendJson(response, 404, { error: 'Paragraph not found' })
        return
      }
      if (body.regenerate === true) {
        const surrounding = (contents.reading ?? [])
          .filter((entry) => Math.abs(entry.index - index) <= 1)
          .map((entry) => entry.original)
          .join('\n\n')
        const edited = await editParagraphText(paragraph.original, surrounding, contents.title)
        paragraph.translation = edited.translation
        paragraph.note = edited.note
        await savePackFiles(contents, pack.dir)
        sendJson(response, 200, { ok: true, note: paragraph.note, paragraph })
        return
      }
      const raw = body.note && typeof body.note === 'object' ? (body.note as Record<string, unknown>) : {}
      const text = (key: string, fallback = ''): string =>
        typeof raw[key] === 'string' ? String(raw[key]).trim() : fallback
      const existing = paragraph.note
      const connectors = Array.isArray(raw.connectors)
        ? (raw.connectors as Array<Record<string, unknown>>)
            .map((connector) => ({
              text: typeof connector.text === 'string' ? connector.text.trim() : '',
              usage: typeof connector.usage === 'string' ? connector.usage.trim() : '',
            }))
            .filter((connector) => connector.text)
        : existing?.connectors ?? []
      paragraph.note = {
        summary: text('summary', existing?.summary ?? '') || '本段笔记已手动调整。',
        ...(text('role', existing?.role ?? '') ? { role: text('role', existing?.role ?? '') } : {}),
        ...(text('keySentence', existing?.keySentence ?? '')
          ? { keySentence: text('keySentence', existing?.keySentence ?? '') }
          : {}),
        ...(text('keySentenceNote', existing?.keySentenceNote ?? '')
          ? { keySentenceNote: text('keySentenceNote', existing?.keySentenceNote ?? '') }
          : {}),
        ...(text('grammar', existing?.grammar ?? '') ? { grammar: text('grammar', existing?.grammar ?? '') } : {}),
        connectors,
        ...(text('background', existing?.background ?? '')
          ? { background: text('background', existing?.background ?? '') }
          : {}),
        ...(text('question', existing?.question ?? '')
          ? { question: text('question', existing?.question ?? '') }
          : {}),
        ...(typeof raw.answer === 'string'
          ? raw.answer.trim()
            ? { answer: raw.answer.trim() }
            : {}
          : existing?.answer
            ? { answer: existing.answer }
            : {}),
      }
      await savePackFiles(contents, pack.dir)
      sendJson(response, 200, { ok: true, note: paragraph.note, paragraph })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const guideRegenerateMatch = /^\/api\/pack\/([^/]+)\/reading-guide\/regenerate$/.exec(url.pathname)
  if (method === 'POST' && guideRegenerateMatch) {
    const pack = store.findPack(decodeURIComponent(guideRegenerateMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      const contents = await loadPack(pack.dir)
      const guide = await generateReadingGuide(contents)
      contents.readingGuide = guide
      await savePackFiles(contents, pack.dir)
      sendJson(response, 200, { ok: true, guide })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const exerciseTranslationMatch = /^\/api\/pack\/([^/]+)\/exercises\/translate$/.exec(url.pathname)
  if (method === 'POST' && exerciseTranslationMatch) {
    const pack = store.findPack(decodeURIComponent(exerciseTranslationMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      const body = await readJson(request)
      const kind: ExerciseKind =
        body.kind === 'comprehension' || body.kind === 'discussion' ? body.kind : 'cloze'
      const index = Number(body.index)
      const contents = await loadPack(pack.dir)
      if (kind === 'cloze') {
        const exercise = contents.exercises.cloze[index]
        if (!exercise) {
          sendJson(response, 404, { error: 'Exercise not found' })
          return
        }
        if (!exercise.sentenceZh) {
          const translated = await translateExercise(
            'cloze',
            exercise.sentence,
            exercise.answer,
            contents.summary,
          )
          exercise.sentenceZh = translated.questionZh
          if (translated.answerZh) exercise.answerZh = translated.answerZh
          await savePackFiles(contents, pack.dir)
        }
        sendJson(response, 200, {
          ok: true,
          kind,
          index,
          questionZh: exercise.sentenceZh,
          answerZh: exercise.answerZh ?? null,
        })
        return
      }
      const exercises =
        kind === 'comprehension' ? contents.exercises.comprehension : contents.exercises.discussion
      const exercise = exercises[index]
      if (!exercise) {
        sendJson(response, 404, { error: 'Exercise not found' })
        return
      }
      if (!exercise.questionZh) {
        const translated = await translateExercise(
          kind,
          exercise.question,
          exercise.answer,
          contents.summary,
        )
        exercise.questionZh = translated.questionZh
        if (translated.answerZh) exercise.answerZh = translated.answerZh
        await savePackFiles(contents, pack.dir)
      }
      sendJson(response, 200, {
        ok: true,
        kind,
        index,
        questionZh: exercise.questionZh,
        answerZh: exercise.answerZh ?? null,
      })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const repairHeadMatch = /^\/api\/pack\/([^/]+)\/repair-head$/.exec(url.pathname)
  if (method === 'POST' && repairHeadMatch) {
    const pack = store.findPack(decodeURIComponent(repairHeadMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      const contents = await loadPack(pack.dir)
      const bodyLead = detectBodyLead(contents)
      let moved = 0
      if (bodyLead && contents.reading?.length) {
        const first = contents.reading[0]!
        const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim()
        if (!normalizeText(first.original).toLowerCase().includes(normalizeText(bodyLead).toLowerCase())) {
          const oldOriginal = first.original
          first.original = `${bodyLead} ${first.original}`.trim()
          const surrounding = contents.reading
            .slice(1, 2)
            .map((paragraph) => paragraph.original)
            .join('\n\n')
          const edited = await editParagraphText(first.original, surrounding, contents.title)
          first.translation = edited.translation
          first.note = edited.note
          delete first.customSentences
          const changedItems = syncAfterParagraphEdit(contents, first.index, oldOriginal)
          await store.replaceLearningItems(changedItems)
          moved = 1
        }
      }
      const frontMatter = await generateFrontMatter(contents)
      if (frontMatter) {
        const merged = {
          ...(contents.frontMatter ?? {}),
          ...frontMatter,
          itemIds: contents.frontMatter?.itemIds ?? [],
        }
        if (!frontMatter.lead) {
          delete merged.lead
          delete merged.leadZh
          delete merged.leadNote
        }
        contents.frontMatter = merged
      }
      await savePackFiles(contents, pack.dir)
      sendJson(response, 200, {
        ok: true,
        moved,
        lead: contents.frontMatter?.lead ?? null,
        leadZh: contents.frontMatter?.leadZh ?? null,
      })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const repairReadingMatch = /^\/api\/pack\/([^/]+)\/repair-reading$/.exec(url.pathname)
  if (method === 'POST' && repairReadingMatch) {
    const pack = store.findPack(decodeURIComponent(repairReadingMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      const contents = await loadPack(pack.dir)
      const source = contents.reading ?? []
      const continuation =
        /(?:^|\s)(?:the|a|an|and|or|but|of|to|in|on|at|for|with|from|by|as|that|which|who|whose|where|when|if|because|although|while|than)\s*$/i
      const repaired: typeof source = []
      const indexMap: number[] = []
      let merged = 0
      for (let i = 0; i < source.length; i++) {
        const startIndex = i
        const current = { ...source[i]!, itemIds: [...(source[i]!.itemIds ?? [])] }
        let groupMerged = false
        while (i < source.length - 1) {
          const next = source[i + 1]!
          const text = current.original.trim()
          const complete = /[.!?]["'”’)\]]*$/.test(text) && !continuation.test(text)
          if (complete && !shouldMergeFragment(current.original, next.original)) break
          current.original = `${current.original.trim()} ${next.original.trim()}`
          current.itemIds = [...new Set([...current.itemIds, ...(next.itemIds ?? [])])]
          current.translation = [current.translation, next.translation].filter(Boolean).join(' ')
          i += 1
          groupMerged = true
          merged += 1
        }
        if (groupMerged) {
          const surrounding = repaired
            .slice(-1)
            .concat(source[i + 1] ? [source[i + 1]!] : [])
            .map((paragraph) => paragraph.original)
            .join('\n\n')
          const edited = await editParagraphText(current.original, surrounding, contents.title)
          current.translation = edited.translation
          current.note = edited.note
        }
        for (let oldIndex = startIndex; oldIndex <= i; oldIndex++) indexMap[oldIndex] = repaired.length
        repaired.push({ ...current, index: repaired.length })
      }
      if (merged > 0) {
        contents.reading = repaired
        const changedItems = resyncReadingContexts(contents)
        await savePackFiles(contents, pack.dir)
        if (changedItems.length > 0) await store.replaceLearningItems(changedItems)
        const progress = await loadReadingProgress(pack.dir, pack.id, repaired.length)
        const readParagraphs = [
          ...new Set(
            progress.readParagraphs
              .map((index) => indexMap[index])
              .filter((index): index is number => typeof index === 'number' && index < repaired.length),
          ),
        ].sort((a, b) => a - b)
        const lastParagraph = indexMap[progress.lastParagraph] ?? Math.max(0, repaired.length - 1)
        await saveReadingProgress(pack.dir, {
          ...progress,
          totalParagraphs: repaired.length,
          readParagraphs,
          lastParagraph,
          lastSentence: 0,
        })
      }
      sendJson(response, 200, { ok: true, merged, total: repaired.length })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const answerReadingMatch = /^\/api\/pack\/([^/]+)\/reading\/answer$/.exec(url.pathname)
  if (method === 'POST' && answerReadingMatch) {
    const pack = store.findPack(decodeURIComponent(answerReadingMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      const body = await readJson(request)
      const index = Number(body.index)
      const contents = await loadPack(pack.dir)
      const paragraph = (contents.reading ?? []).find((entry) => entry.index === index)
      if (!paragraph?.note?.question) {
        sendJson(response, 404, { error: '这一段还没有想一想问题。' })
        return
      }
      if (paragraph.note.answer && body.regenerate !== true) {
        sendJson(response, 200, { ok: true, answer: paragraph.note.answer, cached: true })
        return
      }
      const answer = await answerReadingQuestion(paragraph.original, paragraph.note.question, contents.title)
      paragraph.note.answer = answer
      await savePackFiles(contents, pack.dir)
      sendJson(response, 200, { ok: true, answer })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const enrichReadingMatch = /^\/api\/pack\/([^/]+)\/enrich-reading$/.exec(url.pathname)
  if (method === 'POST' && enrichReadingMatch) {
    const pack = store.findPack(decodeURIComponent(enrichReadingMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      const contents = await loadPack(pack.dir)
      const updated = await enrichReadingNotes(contents)
      let frontMatterUpdated = false
      if (contents.frontMatter?.lead) {
        const lead = contents.frontMatter.lead.replace(/\s+/g, ' ').toLowerCase()
        if (
          (contents.reading ?? []).some((paragraph) =>
            paragraph.original.replace(/\s+/g, ' ').toLowerCase().includes(lead),
          )
        ) {
          const frontMatter = { ...contents.frontMatter }
          delete frontMatter.lead
          delete frontMatter.leadZh
          delete frontMatter.leadNote
          contents.frontMatter = frontMatter
          frontMatterUpdated = true
        }
      }
      if (!contents.frontMatter?.titleZh || !contents.frontMatter?.summaryZh) {
        const frontMatter = await generateFrontMatter(contents)
        if (frontMatter) {
          contents.frontMatter = frontMatter
          frontMatterUpdated = true
        }
      }
      let guideUpdated = false
      if (!contents.readingGuide) {
        try {
          const guide = await generateReadingGuide(contents)
          if (guide) {
            contents.readingGuide = guide
            guideUpdated = true
          }
        } catch (error) {
          // The page has a deterministic fallback guide; a failed compression should not block notes.
        }
      }
      if (updated > 0 || frontMatterUpdated || guideUpdated) await savePackFiles(contents, pack.dir)
      sendJson(response, 200, {
        ok: true,
        updated,
        frontMatterUpdated,
        guideUpdated,
        total: contents.reading?.length ?? 0,
      })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const translateSentenceMatch = /^\/api\/pack\/([^/]+)\/translate-sentence$/.exec(url.pathname)
  if (method === 'POST' && translateSentenceMatch) {
    const pack = store.findPack(decodeURIComponent(translateSentenceMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      const body = await readJson(request)
      const sentence = typeof body.sentence === 'string' ? body.sentence.trim() : ''
      if (!sentence) {
        sendJson(response, 400, { error: 'sentence is required' })
        return
      }
      let context = typeof body.context === 'string' ? body.context : ''
      if (!context) {
        try {
          const contents = await loadPack(pack.dir)
          const normalized = sentence.replace(/\s+/g, ' ').toLowerCase()
          context =
            (contents.reading ?? []).find((paragraph) =>
              paragraph.original.replace(/\s+/g, ' ').toLowerCase().includes(normalized),
            )?.original ?? ''
        } catch {
          // Translation can proceed from the sentence alone.
        }
      }
      const contents = await loadPack(pack.dir).catch(() => undefined)
      const stored = contents?.sentenceTranslations?.[sentenceLookupKey(sentence)]
      if (stored) {
        sendJson(response, 200, { ok: true, translation: stored, cached: true })
        return
      }
      const translation = await translateSentence(sentence, context)
      if (contents) {
        contents.sentenceTranslations = {
          ...(contents.sentenceTranslations ?? {}),
          [sentenceLookupKey(sentence)]: translation,
        }
        await savePackFiles(contents, pack.dir).catch(() => {})
      }
      sendJson(response, 200, { ok: true, translation })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const sentenceMatch = /^\/api\/pack\/([^/]+)\/sentence$/.exec(url.pathname)
  if (method === 'POST' && sentenceMatch) {
    const pack = store.findPack(decodeURIComponent(sentenceMatch[1]!))
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    try {
      const body = await readJson(request)
      const sentence = typeof body.sentence === 'string' ? body.sentence.trim() : ''
      if (!sentence) {
        sendJson(response, 400, { error: 'sentence is required' })
        return
      }
      const current = await loadPack(pack.dir)
      const normalized = sentence.replace(/\s+/g, ' ').trim().toLowerCase()
      const identity = sentenceIdentity(sentence)
      const existingSentence = current.items.find(
        (item) =>
          item.type === 'sentence' &&
          item.sentence &&
          sentenceIdentity(item.sentence.original) === identity,
      )
      if (existingSentence) {
        sendJson(response, 200, {
          ok: true,
          duplicate: true,
          itemId: existingSentence.id,
          itemCount: current.items.length,
        })
        return
      }
      if (requireLlm(response)) return
      const paragraphIndex = (current.reading ?? []).findIndex((paragraph) =>
        paragraph.original.replace(/\s+/g, ' ').toLowerCase().includes(normalized),
      )
      const surrounding =
        paragraphIndex >= 0 ? (current.reading ?? [])[paragraphIndex]?.original : undefined
      const style = await resolveDefaultStyle()
      const item = await generateSentenceCard(sentence, {
        resourceId: current.resourceId,
        resourceTitle: current.title,
        ...(paragraphIndex >= 0 ? { paragraphIndex } : {}),
        ...(surrounding ? { surrounding } : {}),
        ...(current.styleName || style?.name ? { styleName: current.styleName ?? style?.name } : {}),
      })
      const updated = addSentenceToPack(current, item)
      if (updated === current) {
        sendJson(response, 200, { ok: true, duplicate: true, itemId: item.id, itemCount: current.items.length })
        return
      }
      await savePackFiles(updated, pack.dir)
      await store.upsertItems([item])
      const record = store.findPack(pack.id)
      if (record) await store.addPack({ ...record, itemCount: updated.items.length })
      sendJson(response, 200, { ok: true, itemId: item.id, itemCount: updated.items.length, item })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const adoptMatch = /^\/api\/packs\/([^/]+)\/adopt$/.exec(url.pathname)
  if (method === 'POST' && adoptMatch) {
    try {
      const packRecord = store.packs().find((item) => item.id === decodeURIComponent(adoptMatch[1]!))
      if (!packRecord) {
        sendJson(response, 404, { error: 'Pack not found' })
        return
      }
      const body = await readJson(request)
      const itemId = typeof body.itemId === 'string' ? body.itemId : ''
      const pack = await loadPack(packRecord.dir)
      const item = pack.items.find((entry) => entry.id === itemId)
      if (!item) {
        sendJson(response, 404, { error: 'Item not found' })
        return
      }
      if (item.tier !== 'core') {
        item.tier = 'core'
        if (pack.selection) {
          pack.selection = {
            ...pack.selection,
            core: pack.selection.core + 1,
            bonus: Math.max(0, pack.selection.bonus - 1),
          }
        }
        await savePackFiles(pack, packRecord.dir)
        await store.upsertItems([item])
      }
      sendJson(response, 200, { ok: true, itemId })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  const deletePackMatch = /^\/api\/packs\/([^/]+)\/delete$/.exec(url.pathname)
  if (method === 'POST' && deletePackMatch) {
    const packId = decodeURIComponent(deletePackMatch[1]!)
    const pack = store.packs().find((item) => item.id === packId)
    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found' })
      return
    }
    let itemIds: string[] = []
    try {
      const loaded = await loadPack(pack.dir)
      itemIds = loaded.items.map((item) => item.id)
    } catch {
      // The pack may already be missing; the record can still be removed.
    }
    const trashEntry = await trashPack(store, pack)
    const removable = itemIds.filter((itemId) => {
      const item = store.getItem(itemId)
      return item ? item.contexts.every((context) => context.resourceId === pack.resourceId) : false
    })
    const removedItems = await store.removeItems(removable)
    await store.removePack(pack.id)
    sendJson(response, 200, {
      ok: true,
      removedItems,
      trashId: trashEntry.id,
      packs: store.packs().length,
      summary: store.stats(),
    })
    return
  }

  if ((method === 'GET' || method === 'HEAD') && url.pathname.startsWith('/pack/')) {
    const parts = url.pathname.split('/').filter(Boolean)
    const packId = decodeURIComponent(parts[1] ?? '')
    const relative = parts.slice(2).join('/') || 'index.html'
    const pack = store.findPack(packId)
    if (!pack) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Pack not found')
      return
    }
    const root = path.resolve(pack.dir)
    const filePath = path.resolve(root, relative)
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Forbidden')
      return
    }
    if (method === 'GET' && relative === 'index.html') {
      // 用当前模板重新渲染，旧学习包也能获得新的阅读进度和导航
      try {
        const contents = await loadPack(pack.dir)
        const html = renderHtml(contents, contents.audio ?? { items: {} })
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        response.end(html)
        return
      } catch {
        // Fall back to the stored static file below.
      }
    }
    try {
      const stat = await fs.stat(filePath)
      const type = contentType(filePath)
      const range = request.headers.range
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range)
        if (!match) {
          response.writeHead(416, { 'content-range': `bytes */${stat.size}` })
          response.end()
          return
        }
        const rawStart = match[1] ?? ''
        const rawEnd = match[2] ?? ''
        let start = rawStart ? Number(rawStart) : Math.max(0, stat.size - Number(rawEnd))
        let end = rawEnd && rawStart ? Number(rawEnd) : stat.size - 1
        if (!rawStart && !rawEnd) {
          response.writeHead(416, { 'content-range': `bytes */${stat.size}` })
          response.end()
          return
        }
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= stat.size) {
          response.writeHead(416, { 'content-range': `bytes */${stat.size}` })
          response.end()
          return
        }
        end = Math.min(end, stat.size - 1)
        const content = await fs.readFile(filePath)
        const chunk = content.subarray(start, end + 1)
        response.writeHead(206, {
          'content-type': type,
          'content-length': String(chunk.length),
          'content-range': `bytes ${start}-${end}/${stat.size}`,
          'accept-ranges': 'bytes',
          'cache-control': 'no-store',
        })
        response.end(method === 'HEAD' ? undefined : chunk)
        return
      }
      response.writeHead(200, {
        'content-type': type,
        'content-length': String(stat.size),
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
      })
      response.end(method === 'HEAD' ? undefined : await fs.readFile(filePath))
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('File not found')
    }
    return
  }

  sendJson(response, 404, { error: 'Not found' })
}

export interface ReviewServer {
  server: http.Server
  store: Store
  port: number
  url: string
  enableLan: () => Promise<LanStatus>
  disableLan: () => Promise<LanStatus>
  lanStatus: () => LanStatus
  close: () => Promise<void>
}

function closeHttpServer(instance: http.Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    instance.close((error) => (error ? reject(error) : resolve()))
    instance.closeAllConnections?.()
  })
}


/**
 * The shell is one big inline script. Serving it as a separate, immutable file
 * lets the browser cache it, so a repeat visit only refetches the HTML.
 */
const appScriptCache = new Map<string, string>()

function externalizeAppScript(html: string): { html: string; version: string } {
  let best: { start: number; end: number; body: string } | undefined
  const pattern = /<script>([\s\S]*?)<\/script>/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html)) !== null) {
    const body = match[1] ?? ''
    if (!best || body.length > best.body.length) {
      best = { start: match.index, end: match.index + match[0].length, body }
    }
  }
  if (!best || best.body.length < 20_000) return { html, version: '' }
  const version = createHash('sha1').update(best.body).digest('hex').slice(0, 12)
  if (appScriptCache.size > 4) appScriptCache.clear()
  appScriptCache.set(version, best.body)
  return {
    html: html.slice(0, best.start) + `<script src="/app.js?v=${version}"></script>` + html.slice(best.end),
    version,
  }
}

export async function startReviewServer(options: { port?: number } = {}): Promise<ReviewServer> {
  ensureDirs()
  const store = await Store.open(storePath())
  const diagnosis = store.preferences().diagnosis
  if (diagnosis?.level) config.level = diagnosis.level
  const port = options.port ?? 4317
  const visitors = new VisitorRegistry(store)
  const accessFile = path.join(path.dirname(storePath()), 'access.json')
  const lanState: LanState = { enabled: false, token: '', port: null }
  let lanServer: http.Server | undefined

  function status(local: boolean): LanStatus {
    const urls =
      lanState.enabled && lanState.port !== null && local ? phoneUrls(lanState.port, lanState.token) : []
    return {
      enabled: lanState.enabled,
      local,
      public: publicModeEnabled(),
      port: lanState.port,
      urls,
      qr: urls.map((url) => ({ url, svg: qrSvg(url) })),
    }
  }

  const lan: LanController = {
    state: lanState,
    status,
    enable: () => enableLan(),
    disable: () => disableLan(),
  }

  function createHandler(requireToken: boolean) {
    return (request: http.IncomingMessage, response: http.ServerResponse): void => {
      const run = async (): Promise<void> => {
        // Container health checks must not mint a visitor identity each run.
        if (request.method === 'GET' && (request.url ?? '').startsWith('/api/health')) {
          response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          response.end('{"ok":true}')
          return
        }
        // Compiling is stateless: the caller keeps the result, so no workspace
        // (and no cookie) should be created for it.
        if ((request.url ?? '').startsWith('/api/compile')) {
          await runInWorkspace(rootWorkspaceRef(), () =>
            handle(request, response, store, lan, requireToken, visitors, store, ''),
          )
          return
        }
        // The LAN listener stays single-user; the public listener resolves a
        // visitor and switches the active workspace for the whole request chain.
        const context = requireToken
          ? { workspace: rootWorkspaceRef(), store, visitorId: 'local', personal: false }
          : await visitors.resolve(request, response)
        if (context.claimError) {
          sendJson(response, 429, { error: context.claimError })
          return
        }
        await runInWorkspace(context.workspace, () =>
          handle(request, response, context.store, lan, requireToken, visitors, store, context.visitorId),
        )
        // Any write inside the scratch workspace is captured here so the
        // browser can pull it even when the reader page made the change.
        const method = request.method ?? 'GET'
        const pathname = (request.url ?? '').split('?')[0] ?? ''
        if (
          publicModeEnabled() &&
          !context.workspace.readOnly &&
          context.workspace.id !== 'local' &&
          method !== 'GET' &&
          method !== 'HEAD' &&
          pathname !== '/api/hydrate' &&
          pathname !== '/api/checkpoint'
        ) {
          await visitors.capture(context.workspace.id).catch(() => {})
        }
      }
      run().catch((error: unknown) => {
        if (!response.headersSent) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
        } else {
          response.end()
        }
      })
    }
  }

  async function enableLan(): Promise<LanStatus> {
    if (lanState.enabled && lanServer) return status(true)
    const token = await issueAccessToken(accessFile)
    const lanHttp = http.createServer(createHandler(true))
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => {
          lanHttp.off('listening', onListening)
          reject(error)
        }
        const onListening = (): void => {
          lanHttp.off('error', onError)
          resolve()
        }
        lanHttp.once('error', onError)
        lanHttp.once('listening', onListening)
        lanHttp.listen(0, '0.0.0.0')
      })
    } catch (error) {
      await fs.rm(accessFile, { force: true }).catch(() => {})
      throw error
    }
    const address = lanHttp.address()
    const lanPort = typeof address === 'object' && address ? address.port : 0
    lanServer = lanHttp
    lanState.enabled = true
    lanState.token = token
    lanState.port = lanPort
    return status(true)
  }

  async function disableLan(): Promise<LanStatus> {
    const running = lanServer
    lanServer = undefined
    lanState.enabled = false
    lanState.token = ''
    lanState.port = null
    if (running) await closeHttpServer(running).catch(() => {})
    await fs.rm(accessFile, { force: true }).catch(() => {})
    return status(true)
  }

  const server = http.createServer(createHandler(false))
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, config.host, () => resolve())
  })
  const address = server.address()
  const actualPort = typeof address === 'object' && address ? address.port : port

  // The analysis pipeline pays a one-time initialisation cost (~10s in the
  // container). Pay it during startup instead of making the first visitor wait.
  if (process.env.NODE_ENV === 'production' && process.env.LEARN_NO_WARMUP !== '1') {
    const warmupText = [
      'Attention has quietly become the scarcest resource of the modern economy. It cannot be stored, borrowed, or bought in bulk, and every platform that captures it is really selling access to the people behind it.',
      'The cost shows up in small places: a notification interrupts a sentence, a tab stays open for a week, and the work that needed an hour of silence never quite happens.',
      'Deliberate friction helps. Closing the laptop, writing the first sentence by hand, or leaving the phone in another room turns an impulse into a decision.',
    ].join('\n\n')
    void compileToPack({ kind: 'text', text: warmupText, title: 'Warm up' })
      .then((result) => console.log(`Compiler warm-up ready (${result.pack.items.length} items).`))
      .catch((error: unknown) => {
        console.warn(`Compiler warm-up skipped: ${error instanceof Error ? error.message : String(error)}`)
      })
  }

  return {
    server,
    store,
    port: actualPort,
    url: `http://127.0.0.1:${actualPort}`,
    enableLan,
    disableLan,
    lanStatus: () => status(true),
    close: async () => {
      await disableLan().catch(() => {})
      await visitors.flush().catch(() => {})
      await closeHttpServer(server)
    },
  }
}
