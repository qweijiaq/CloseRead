import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

import { analyzeResource } from '../analyze/index.js'
import { seedCardCache } from '../analyze/card-cache.js'
import { knownRatioInText } from '../analyze/known.js'
import { generateDerivationGraph } from '../analyze/derivation.js'
import { enrichReadingNotes } from '../analyze/reading-notes.js'
import { detectBodyLead, generateFrontMatter } from '../analyze/reading-frontmatter.js'
import { generateReadingGuide } from '../analyze/reading-guide.js'
import { editFrontMatterText, editParagraphText } from '../analyze/reading-edit.js'
import { answerReadingQuestion } from '../analyze/note-answer.js'
import { translateExercise } from '../analyze/exercise-translation.js'
import type { ExerciseKind } from '../analyze/exercise-translation.js'
import { generateSentenceCard, sentenceIdentity } from '../analyze/sentence-card.js'
import { sentences } from '../analyze/tokenize.js'
import { translateSentence } from '../analyze/sentence-translation.js'
import { generateWordCard, enrichWordRelations } from '../analyze/word-card.js'
import { config, ensureDirs, hasLlm, storePath } from '../config.js'
import { buildWordGraph } from '../graph/build.js'
import {
  articleSections,
  getResourceArticles,
  isStudyArticle,
  resourceArticleCount,
  scopedResourceForArticle,
} from '../ingest/articles.js'
import { readEpub } from '../ingest/epub.js'
import { contentHash, ingestEpubBuffer, ingestMobiBuffer, ingestPdfBuffer, ingestSource, ingestText } from '../ingest/index.js'
import { readMobi } from '../ingest/mobi.js'
import { readPdf } from '../ingest/pdf.js'
import { previewText, resourceWarnings } from '../ingest/summary.js'
import { writePack } from '../pack/build.js'
import { renderHtml } from '../pack/html.js'
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
import { resolveDefaultStyle } from '../style/profile.js'
import type { PackRecord, Resource, ResourceArticle, StoredItem } from '../types.js'
import { isDue, isNew, stateLabel } from './scheduler.js'
import type { Grade } from './scheduler.js'
import { renderReviewApp } from './web.js'

function dueLabel(item: StoredItem, now: Date = new Date()): string {
  if (item.status === 'known') return '已掌握'
  if (item.status === 'suspended') return '已暂停'
  const due = new Date(item.review.due)
  const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000)
  if (days <= 0) return '今天到期'
  if (days === 1) return '明天'
  return `${days} 天后`
}

function viewModel(item: StoredItem, store: Store, now: Date = new Date()) {
  const context = item.contexts[0]
  const sourcePackRecord = context
    ? store.packs().find(
        (pack) => pack.resourceId === context.resourceId || pack.parentResourceId === context.resourceId,
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
    context: context?.sentence ?? '',
    translation: context?.translation ?? '',
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
    isNew: isNew(item.review),
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

function packUrl(packId: string): string {
  return `/pack/${encodeURIComponent(packId)}/index.html`
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
    due: items.filter((item) => item.status === 'active' && isDue(item.review, now)).length,
    mastered: items.filter((item) => item.status === 'known').length,
    learning: items.filter((item) => item.status === 'active').length,
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
  error?: string
}

interface BuildRequestOptions {
  limit: number | 'auto'
  useLlm: boolean
  translate: boolean
  audio?: boolean
  onlyNew?: boolean
  articleIndex?: number
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
  const knownLemmas = libraryItems.filter((item) => item.status === 'known').map((item) => item.lemma)
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

      const style = await resolveDefaultStyle()
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
      const removable = previousItemIds.filter((itemId) => {
        if (newCoreIds.has(itemId)) return false
        const item = store.getItem(itemId)
        return Boolean(item && item.contexts.every((context) => context.resourceId === target.id))
      })
      job.removedItems = await store.removeItems(removable)
      const record: PackRecord = {
        ...result.record,
        resourceId: target.id,
        title: result.pack.title,
        ...(article ? { parentResourceId: resource.id, articleIndex: article.index } : {}),
      }
      await store.addPack(record)
      await store.recordDailyArticle(record.id, record.title ?? result.pack.title)
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
    completed: daily.completed,
    reading,
    outputs,
    steps: {
      review: {
        done: reviewDone,
        dueAtStart: daily.dueAtStart,
        reviewed: daily.reviewed,
        remaining: Math.max(0, daily.dueAtStart - daily.reviewed),
        totalDue: stats.due,
        sentenceDue: store.dueItems(now, Number.MAX_SAFE_INTEGER).filter((item) => item.type === 'sentence').length,
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
    stats: { due: stats.due, reviewedToday: stats.reviewedToday, total: stats.total },
  }
}

async function handle(request: http.IncomingMessage, response: http.ServerResponse, store: Store): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const method = request.method ?? 'GET'

  if (method === 'GET' && url.pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(renderReviewApp())
    return
  }

  if (method === 'GET' && url.pathname === '/api/summary') {
    sendJson(response, 200, { summary: store.stats(), packs: store.packs() })
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

  if (method === 'GET' && url.pathname === '/api/today') {
    sendJson(response, 200, await todayPayload(store))
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
      due: stats.due,
      reviewedToday: stats.reviewedToday,
      suggestion: nextArticleSuggestion(store),
    })
    return
  }

  if (method === 'GET' && url.pathname === '/api/queue') {
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 30)))
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
    let items = store.dueItems(now, Number.MAX_SAFE_INTEGER)
    if (pack) {
      items = items.filter((item) => item.contexts.some((context) => context.resourceId === pack.resourceId))
    }
    if (words.length > 0) {
      const selected = new Set(words)
      items = items.filter((item) => selected.has(item.id))
    }
    const typeFilter = url.searchParams.get('type')
    if (typeFilter === 'sentence') items = items.filter((item) => item.type === 'sentence')
    else if (typeFilter === 'word') items = items.filter((item) => item.type !== 'sentence')
    sendJson(response, 200, {
      items: items.slice(0, limit).map((item) => viewModel(item, store, now)),
      summary: store.stats(now),
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

  if (method === 'GET' && url.pathname === '/api/items') {
    const query = url.searchParams.get('q') ?? undefined
    const now = new Date()
    sendJson(response, 200, {
      items: store.listItems(query).map((item) => viewModel(item, store, now)),
      summary: store.stats(now),
    })
    return
  }

  if (method === 'GET' && url.pathname === '/api/packs') {
    sendJson(response, 200, {
      packs: store.packs().map((pack) => {
        const issueId = pack.parentResourceId ?? pack.resourceId
        const issue = store.getResource(issueId)
        return {
          ...pack,
          ...packView(store, pack),
          issueId,
          issueTitle: issue?.title ?? issueId,
        }
      }),
    })
    return
  }

  if (method === 'GET' && url.pathname === '/api/resources') {
    pruneJobs()
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') ?? 12)))
    sendJson(response, 200, {
      resources: store.listResources().slice(0, limit).map((resource) => resourceView(resource, store)),
      llm: hasLlm(),
      model: config.llm.model,
    })
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
      const resource = await ingestText(text, { title: title || undefined })
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
      const resource = await ingestSource(raw, { title: title || undefined })
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
      } else {
        throw new Error('只支持 EPUB、MOBI、AZW、AZW3 文件。')
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
        await store.removePack(pack.id)
        await fs.rm(pack.dir, { recursive: true, force: true }).catch(() => {})
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
      if (typeof resource.metadata.uploadPath === 'string') {
        await fs.rm(resource.metadata.uploadPath, { force: true }).catch(() => {})
      }
      sendJson(response, 200, {
        ok: true,
        removedPacks: relatedPacks.length,
        removedItems,
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
    try {
      const contents = await loadPack(pack.dir)
      const prepared = await preparePackForExport(contents)
      if (prepared.changed > 0) await savePackFiles(contents, pack.dir)
      let body: Uint8Array
      let contentType: string
      if (format === 'html') {
        body = Buffer.from(renderPackExportHtml(contents), 'utf8')
        contentType = 'text/html; charset=utf-8'
      } else if (format === 'epub') {
        body = renderPackEpub(contents)
        contentType = 'application/epub+zip'
      } else if (format === 'pdf') {
        body = await renderPackPdf(contents)
        contentType = 'application/pdf'
      } else if (format === 'png') {
        const width = Math.max(640, Math.min(2400, Number(url.searchParams.get('width')) || 1200))
        const scale = Math.max(1, Math.min(3, Number(url.searchParams.get('scale')) || 1))
        body = await renderPackPng(contents, { width, scale })
        contentType = 'image/png'
      } else if (format === 'png-pages') {
        const width = Math.max(640, Math.min(1600, Number(url.searchParams.get('width')) || 900))
        const maxHeight = Math.max(2400, Math.min(12000, Number(url.searchParams.get('maxHeight')) || 5000))
        body = await renderPackPngPages(contents, { width, maxHeight })
        contentType = 'application/zip'
      } else {
        body = await renderPackMobi(contents)
        contentType = 'application/octet-stream'
      }
      const extension = format === 'png-pages' ? 'zip' : format
      let name = exportFileName(contents, extension)
      if (format === 'png') {
        const width = Math.max(640, Math.min(2400, Number(url.searchParams.get('width')) || 1200))
        const scale = Math.max(1, Math.min(3, Number(url.searchParams.get('scale')) || 1))
        if (width !== 1200 || scale > 1) {
          name = name.replace(/\.png$/i, '') + `-${width}w${scale > 1 ? `-${scale}x` : ''}.png`
        }
      }
      response.writeHead(200, {
        'content-type': contentType,
        'content-length': String(body.length),
        'cache-control': 'no-store',
        'content-disposition': `attachment; filename="${pack.id}.${extension}"; filename*=UTF-8''${encodeURIComponent(name)}`,
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
      const translation = await translateSentence(sentence, context)
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
    const removable = itemIds.filter((itemId) => {
      const item = store.getItem(itemId)
      return item ? item.contexts.every((context) => context.resourceId === pack.resourceId) : false
    })
    const removedItems = await store.removeItems(removable)
    await store.removePack(pack.id)
    await fs.rm(pack.dir, { recursive: true, force: true }).catch(() => {})
    sendJson(response, 200, { ok: true, removedItems, packs: store.packs().length, summary: store.stats() })
    return
  }

  if (method === 'GET' && url.pathname.startsWith('/pack/')) {
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
    if (relative === 'index.html') {
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
      const content = await fs.readFile(filePath)
      response.writeHead(200, { 'content-type': contentType(filePath), 'cache-control': 'no-store' })
      response.end(content)
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
  close: () => Promise<void>
}

export async function startReviewServer(options: { port?: number; host?: string } = {}): Promise<ReviewServer> {  ensureDirs()
  const store = await Store.open(storePath)
  const port = options.port ?? 4317
  const host = options.host ?? '127.0.0.1'

  const server = http.createServer((request, response) => {
    handle(request, response, store).catch((error: unknown) => {
      if (!response.headersSent) {
        sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
      } else {
        response.end()
      }
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => resolve())
  })

  const address = server.address()
  const actualPort = typeof address === 'object' && address ? address.port : port

  return {
    server,
    store,
    port: actualPort,
    url: `http://${host}:${actualPort}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}
