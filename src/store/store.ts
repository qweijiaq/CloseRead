import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { LearningItem, PackRecord, Resource, ReviewLogEntry, StoredItem } from '../types.js'
import { isDue, isNew, newReviewState, rateReview } from '../review/scheduler.js'
import type { Grade } from '../review/scheduler.js'

export interface StoreData {
  version: 2
  items: StoredItem[]
  packs: PackRecord[]
  logs: ReviewLogEntry[]
  outputs: OutputEntry[]
  preferences: StorePreferences
}

export interface StoreWarning {
  code: 'corrupt-store' | 'corrupt-resource' | 'backup-failed'
  message: string
  path?: string
}

export interface StoreDiagnosis {
  level: 'B1' | 'B2' | 'C1' | 'C2'
  knownLemmas: string[]
  knownCount: number
  total: number
  completedAt: string
}

const DIAGNOSIS_LEVELS = new Set(['B1', 'B2', 'C1', 'C2'])

function normalizeDiagnosis(raw: unknown): StoreDiagnosis | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<StoreDiagnosis>
  const level = typeof value.level === 'string' ? value.level.toUpperCase() : ''
  if (!DIAGNOSIS_LEVELS.has(level)) return undefined
  const knownLemmas = Array.isArray(value.knownLemmas)
    ? [...new Set(value.knownLemmas.map((lemma) => String(lemma).toLowerCase().trim()).filter(Boolean))]
    : []
  return {
    level: level as StoreDiagnosis['level'],
    knownLemmas,
    knownCount: knownLemmas.length,
    total: Math.max(knownLemmas.length, Number.isFinite(value.total) ? Number(value.total) : knownLemmas.length),
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : new Date().toISOString(),
  }
}

function fileStamp(now: Date = new Date()): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

export interface EditorFeedback {
  praise: string
  upgrade: string
  revision: string
  question?: string
}

export interface OutputRevision {
  id: string
  text: string
  /** Cached AI editor reply for this revision. */
  feedback?: EditorFeedback
  createdAt: string
}

export interface OutputEntry {
  id: string
  date: string
  text: string
  prompt: string
  answer?: string
  packId?: string
  articleTitle?: string
  /** Cached AI editor reply; generated only when the learner asks. */
  feedback?: EditorFeedback
  /** Rewrites after the first draft, each with its own optional editor reply. */
  revisions?: OutputRevision[]
  createdAt: string
}

export interface DailyProgress {
  date: string
  dueAtStart: number
  reviewed: number
  /** Unique item ids reviewed today. Used so repeating one card cannot finish the day. */
  reviewedItems: string[]
  articlePackId?: string
  articleTitle?: string
  articleFinished: boolean
  outputDone: boolean
  completed: boolean
}

export interface StorePreferences {
  selectionBias: number
  wordFeedback: Record<string, number>
  daily: DailyProgress
  streak: number
  lastCompletedDate?: string
  /** Desired FSRS retention, between 0.8 and 0.97. */
  desiredRetention: number
  /** How many new cards the daily plan releases. */
  dailyNewTarget: number
  /** How many due cards the daily plan aims to cover. */
  dailyReviewTarget: number
  /** Weekly article goal shown in the weekly review. */
  weeklyArticleGoal: number
  /** Weekly study-day goal shown in the weekly review. */
  weeklyStudyDaysGoal: number
  /** Self-reported vocabulary diagnosis; also drives the prompt level. */
  diagnosis?: StoreDiagnosis
}

export const DAILY_REVIEW_TARGET = 10
export const DAILY_NEW_TARGET = 10

function todayKey(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function emptyPreferences(): StorePreferences {
  return {
    selectionBias: 0,
    wordFeedback: {},
    daily: {
      date: '',
      dueAtStart: 0,
      reviewed: 0,
      reviewedItems: [],
      articleFinished: false,
      outputDone: false,
      completed: false,
    },
    streak: 0,
    desiredRetention: 0.9,
    dailyNewTarget: DAILY_NEW_TARGET,
    dailyReviewTarget: DAILY_REVIEW_TARGET,
    weeklyArticleGoal: 3,
    weeklyStudyDaysGoal: 5,
  }
}

function normalizeTarget(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizePreferences(raw: unknown): StorePreferences {
  const value = raw && typeof raw === 'object' ? (raw as Partial<StorePreferences>) : {}
  const daily =
    value.daily && typeof value.daily === 'object'
      ? (value.daily as Partial<DailyProgress>)
      : {}
  const feedback =
    value.wordFeedback && typeof value.wordFeedback === 'object' ? value.wordFeedback : {}
  const diagnosis = normalizeDiagnosis(value.diagnosis)
  return {
    selectionBias:
      typeof value.selectionBias === 'number' && Number.isFinite(value.selectionBias)
        ? Math.max(-5, Math.min(5, value.selectionBias))
        : 0,
    wordFeedback: Object.fromEntries(
      Object.entries(feedback).filter(([, score]) => typeof score === 'number'),
    ) as Record<string, number>,
    daily: {
      date: typeof daily.date === 'string' ? daily.date : '',
      dueAtStart: typeof daily.dueAtStart === 'number' ? daily.dueAtStart : 0,
      reviewed: typeof daily.reviewed === 'number' ? daily.reviewed : 0,
      reviewedItems: Array.isArray(daily.reviewedItems)
        ? [...new Set(daily.reviewedItems.filter((value): value is string => typeof value === 'string'))]
        : [],
      ...(typeof daily.articlePackId === 'string' ? { articlePackId: daily.articlePackId } : {}),
      ...(typeof daily.articleTitle === 'string' ? { articleTitle: daily.articleTitle } : {}),
      articleFinished: daily.articleFinished === true,
      outputDone: daily.outputDone === true,
      completed: daily.completed === true,
    },
    streak: typeof value.streak === 'number' && Number.isFinite(value.streak) ? value.streak : 0,
    ...(typeof value.lastCompletedDate === 'string'
      ? { lastCompletedDate: value.lastCompletedDate }
      : {}),
    desiredRetention:
      typeof value.desiredRetention === 'number' && Number.isFinite(value.desiredRetention)
        ? Math.max(0.8, Math.min(0.97, value.desiredRetention))
        : 0.9,
    dailyNewTarget: normalizeTarget(value.dailyNewTarget, DAILY_NEW_TARGET),
    dailyReviewTarget: normalizeTarget(value.dailyReviewTarget, DAILY_REVIEW_TARGET),
    weeklyArticleGoal: normalizeTarget(value.weeklyArticleGoal, 3),
    weeklyStudyDaysGoal: Math.min(7, normalizeTarget(value.weeklyStudyDaysGoal, 5)),
    ...(diagnosis ? { diagnosis } : {}),
  }
}

function emptyStore(): StoreData {
  return { version: 2, items: [], packs: [], logs: [], outputs: [], preferences: emptyPreferences() }
}

async function readResourceFiles(dir: string, warnings: StoreWarning[] = []): Promise<Resource[]> {
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch {
    return []
  }
  const resources: Resource[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const file = path.join(dir, name)
    try {
      const resource = JSON.parse(await fs.readFile(file, 'utf8')) as Resource
      if (resource && typeof resource.id === 'string' && typeof resource.title === 'string') {
        resources.push(resource)
      } else {
        warnings.push({
          code: 'corrupt-resource',
          message: `导入材料文件格式不正确，已跳过：${name}`,
          path: file,
        })
      }
    } catch {
      warnings.push({
        code: 'corrupt-resource',
        message: `导入材料文件无法解析，已跳过：${name}`,
        path: file,
      })
    }
  }
  return resources
}

async function writeResourceFile(dir: string, resource: Resource): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
  const target = path.join(dir, `${resource.id}.json`)
  const temp = `${target}.${process.pid}.${randomUUID()}.tmp`
  await fs.writeFile(temp, JSON.stringify(resource, null, 2), 'utf8')
  await fs.rename(temp, target)
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function mergeNotes(existing: string | undefined, incoming: string | undefined): string | undefined {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const note of [existing, incoming]) {
    for (const paragraph of (note ?? '').split(/\n{2,}/)) {
      const value = paragraph.trim()
      if (!value || seen.has(value)) continue
      seen.add(value)
      parts.push(value)
    }
  }
  return parts.length ? parts.join('\n\n') : undefined
}

function isFallbackMeaning(value: string): boolean {
  return value.startsWith('the meaning of')
}

function mergeItem(existing: StoredItem, incoming: LearningItem): StoredItem {
  const contexts = [...existing.contexts]
  for (const context of incoming.contexts) {
    if (!contexts.some((item) => item.resourceId === context.resourceId && item.sentence === context.sentence)) {
      contexts.push(context)
    }
  }

  const examples = [...existing.examples]
  for (const example of incoming.examples) {
    if (!examples.some((item) => item.text === example.text)) examples.push(example)
  }

  return {
    ...existing,
    ...incoming,
    id: existing.id,
    contexts,
    examples,
    collocations: unique([...existing.collocations, ...incoming.collocations]),
    tags: unique([...existing.tags, ...incoming.tags]),
    staged: existing.staged === false ? false : existing.staged === true ? true : incoming.staged,
    introducedAt: existing.introducedAt ?? incoming.introducedAt,
    relations: {
      synonyms: unique([...existing.relations.synonyms, ...incoming.relations.synonyms]),
      antonyms: unique([...existing.relations.antonyms, ...incoming.relations.antonyms]),
      confusables: unique([...existing.relations.confusables, ...incoming.relations.confusables]),
      wordFamily: unique([...existing.relations.wordFamily, ...incoming.relations.wordFamily]),
    },
    definition: isFallbackMeaning(incoming.definition) ? existing.definition : incoming.definition,
    sense: isFallbackMeaning(incoming.sense) ? existing.sense : incoming.sense,
    definitionZh: incoming.definitionZh || existing.definitionZh,
    ipa: existing.ipa || incoming.ipa,
    notes: mergeNotes(existing.notes, incoming.notes),
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    review: existing.review,
    favorite: existing.favorite,
    status: existing.status,
  }
}

export interface StoreStats {
  total: number
  due: number
  reviewDue: number
  dueToday: number
  newReviewedToday: number
  newItems: number
  backlog: number
  favorites: number
  reviewedToday: number
  suspended: number
  known: number
  firstReviewed: number
  firstCorrect: number
  firstAccuracy: number
}

export class Store {
  private data: StoreData
  private warningList: StoreWarning[]
  private saveChain: Promise<void> = Promise.resolve()
  private readonly backupDir: string

  private constructor(
    private readonly file: string,
    private readonly resourcesDir: string,
    private resources: Resource[],
    data: StoreData,
    warnings: StoreWarning[] = [],
  ) {
    this.data = data
    this.warningList = warnings
    this.backupDir = path.join(path.dirname(file), 'backups')
  }

  static async open(file: string): Promise<Store> {
    await fs.mkdir(path.dirname(file), { recursive: true })
    const resourcesDir = path.join(path.dirname(file), 'resources')
    const warnings: StoreWarning[] = []

    let data = emptyStore()
    let legacyResources: Resource[] = []
    let needsMigration = false
    try {
      const raw = await fs.readFile(file, 'utf8')
      if (raw.trim()) {
        const parsed = JSON.parse(raw) as {
          version?: number
          resources?: Resource[]
          items?: StoredItem[]
          packs?: PackRecord[]
          logs?: ReviewLogEntry[]
          outputs?: OutputEntry[]
          preferences?: unknown
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('store.json does not contain a store object')
        }
        const looksLikeStore =
          parsed.version === 1 ||
          parsed.version === 2 ||
          Array.isArray(parsed.items) ||
          Array.isArray(parsed.resources)
        if (!looksLikeStore || (parsed.version !== undefined && parsed.version !== 1 && parsed.version !== 2)) {
          throw new Error(`store.json has an unsupported shape or version (${String(parsed.version)})`)
        }
        for (const key of ['items', 'packs', 'logs', 'outputs'] as const) {
          if (parsed[key] !== undefined && !Array.isArray(parsed[key])) {
            throw new Error(`store.json field ${key} is not an array`)
          }
        }
        if (
          parsed.preferences !== undefined &&
          (typeof parsed.preferences !== 'object' || parsed.preferences === null || Array.isArray(parsed.preferences))
        ) {
          throw new Error('store.json preferences are not an object')
        }
        needsMigration = parsed.version === 1
        data = {
          version: 2,
          items: Array.isArray(parsed.items) ? parsed.items : [],
          packs: Array.isArray(parsed.packs) ? parsed.packs : [],
          logs: Array.isArray(parsed.logs) ? parsed.logs : [],
          outputs: Array.isArray(parsed.outputs) ? parsed.outputs : [],
          preferences: normalizePreferences(parsed.preferences),
        }
        if (Array.isArray(parsed.resources)) legacyResources = parsed.resources
      }
    } catch (error) {
      const missing = error instanceof Error && (error as { code?: string }).code === 'ENOENT'
      if (missing) {
        // A previous start may have quarantined a corrupt store; keep warning about it.
        const dir = path.dirname(file)
        const prefix = `${path.basename(file)}.corrupt-`
        const names = await fs.readdir(dir).catch(() => [] as string[])
        const previous = names.filter((name) => name.startsWith(prefix)).sort().at(-1)
        if (previous) {
          warnings.push({
            code: 'corrupt-store',
            message:
              '检测到之前隔离的词库文件，当前从空词库启动。可以从该文件或 data/backups 的每日快照恢复。',
            path: path.join(dir, previous),
          })
        }
      } else {
        const corrupt = `${file}.corrupt-${fileStamp()}-${randomUUID().slice(0, 8)}`
        let quarantined = false
        try {
          await fs.rename(file, corrupt)
          quarantined = true
        } catch {
          try {
            await fs.copyFile(file, corrupt)
            await fs.rm(file, { force: true })
            quarantined = true
          } catch {
            // Refuse to start rather than overwrite a file we could not preserve.
          }
        }
        if (!quarantined) {
          throw new Error(
            `The learning library could not be read or moved aside: ${file}. ` +
              'Back it up and repair the file before starting CloseRead.',
          )
        }
        warnings.push({
          code: 'corrupt-store',
          message:
            '词库文件无法解析，已把损坏文件移到隔离位置，并从空词库启动。' +
            '可以从隔离文件或 data/backups 的每日快照恢复。',
          path: corrupt,
        })
      }
    }

    const resources = await readResourceFiles(resourcesDir, warnings)
    const known = new Set(resources.map((resource) => resource.id))
    for (const resource of legacyResources) {
      if (known.has(resource.id)) continue
      resources.push(resource)
      known.add(resource.id)
      await writeResourceFile(resourcesDir, resource)
    }

    const store = new Store(file, resourcesDir, resources, data, warnings)
    const staged = store.stageWordbookBacklog()
    if (needsMigration || staged) {
      await fs.copyFile(file, `${file}.v1.bak`).catch(() => {})
      await store.save()
    }
    return store
  }

  /** Warnings raised while opening or persisting the library, for the UI and doctor. */
  warnings(): StoreWarning[] {
    return this.warningList.map((warning) => ({ ...warning }))
  }

  snapshot(): StoreData {
    return structuredClone(this.data)
  }

  /** Add snapshots exactly as they were, including review/favorite/status. */
  async restoreItems(items: StoredItem[]): Promise<number> {
    let restored = 0
    for (const item of items) {
      if (this.getItem(item.id)) continue
      this.data.items.push(structuredClone(item))
      restored += 1
    }
    if (restored) await this.save()
    return restored
  }

  /** Reload the store from disk after a full-library restore. */
  async reload(): Promise<void> {
    const fresh = await Store.open(this.file)
    this.data = fresh.data
    this.resources = fresh.resources
    this.warningList = fresh.warningList
    this.saveChain = Promise.resolve()
  }

  async saveDiagnosis(
    level: string,
    knownLemmas: string[],
    total: number,
  ): Promise<StoreDiagnosis> {
    const normalizedLevel = level.trim().toUpperCase()
    const known = [...new Set(knownLemmas.map((lemma) => lemma.toLowerCase().trim()).filter(Boolean))]
    const diagnosis: StoreDiagnosis = {
      level: DIAGNOSIS_LEVELS.has(normalizedLevel) ? (normalizedLevel as StoreDiagnosis['level']) : 'B2',
      knownLemmas: known,
      knownCount: known.length,
      total: Math.max(known.length, Math.floor(total)),
      completedAt: new Date().toISOString(),
    }
    this.data.preferences.diagnosis = diagnosis
    await this.save()
    return { ...diagnosis, knownLemmas: [...known] }
  }

  /** Library-known words plus the words marked as known in the diagnosis. */
  knownLemmas(): string[] {
    const fromItems = this.data.items
      .filter((item) => item.status === 'known')
      .map((item) => item.lemma)
    const fromDiagnosis = this.data.preferences.diagnosis?.knownLemmas ?? []
    return [...new Set([...fromItems, ...fromDiagnosis].map((lemma) => lemma.toLowerCase().trim()).filter(Boolean))]
  }

  logsSince(since: string): ReviewLogEntry[] {
    return this.data.logs.filter((log) => log.reviewedAt >= since).map((log) => ({ ...log }))
  }

  /** Undo the most recent rating when it carries a pre-review snapshot. */
  async undoLastReview(now: Date = new Date()): Promise<{ item: StoredItem; log: ReviewLogEntry } | undefined> {
    const log = this.data.logs[this.data.logs.length - 1]
    if (!log || !log.before) return undefined
    const item = this.getItem(log.itemId)
    if (!item) return undefined

    item.review = { ...log.before }
    this.data.logs.pop()
    const daily = this.ensureDaily(now)
    if (daily.date === todayKey(new Date(log.reviewedAt))) {
      const stillReviewedToday = this.data.logs.some(
        (entry) =>
          entry.itemId === log.itemId &&
          todayKey(new Date(entry.reviewedAt)) === daily.date,
      )
      daily.reviewedItems = (daily.reviewedItems ?? []).filter(
        (itemId) => itemId !== log.itemId || stillReviewedToday,
      )
      daily.reviewed = Math.max(0, daily.reviewed - 1)
    }
    await this.save()
    return { item, log }
  }

  /** Due counts for today and the next days; overdue cards are folded into today. */
  dueForecast(now: Date = new Date(), days = 7): {
    days: Array<{ date: string; due: number }>
    overdue: number
    total: number
  } {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const buckets = Array.from({ length: Math.max(1, days) }, (_, index) => {
      const date = new Date(start)
      date.setDate(date.getDate() + index)
      return { date: todayKey(date), due: 0 }
    })
    let overdue = 0
    for (const item of this.data.items) {
      if (item.status !== 'active' || item.staged === true || isNew(item.review)) continue
      const due = new Date(item.review.due)
      if (Number.isNaN(due.getTime())) continue
      const day = new Date(due)
      day.setHours(0, 0, 0, 0)
      const diff = Math.round((day.getTime() - start.getTime()) / 86_400_000)
      if (diff < 0) {
        overdue += 1
        buckets[0]!.due += 1
      } else if (diff < buckets.length) {
        buckets[diff]!.due += 1
      }
    }
    return {
      days: buckets,
      overdue,
      total: buckets.reduce((sum, bucket) => sum + bucket.due, 0),
    }
  }

  get backupFile(): string {
    return `${this.file}.bak`
  }

  get backupDirectory(): string {
    return this.backupDir
  }

  get dataDirectory(): string {
    return path.dirname(this.file)
  }

  async snapshots(): Promise<string[]> {
    try {
      return (await fs.readdir(this.backupDir))
        .filter((name) => /^store-\d{4}-\d{2}-\d{2}\.json$/.test(name))
        .sort()
    } catch {
      return []
    }
  }

  async save(): Promise<void> {
    const next = this.saveChain.then(() => this.writeStore())
    this.saveChain = next.catch(() => undefined)
    return next
  }

  private async writeStore(): Promise<void> {
    const payload = {
      version: 2,
      items: this.data.items,
      packs: this.data.packs,
      logs: this.data.logs,
      outputs: this.data.outputs,
      preferences: this.data.preferences,
    }
    await fs.mkdir(path.dirname(this.file), { recursive: true })
    await this.backupBeforeWrite()

    const temp = `${this.file}.${process.pid}.${randomUUID()}.tmp`
    try {
      const handle = await fs.open(temp, 'w')
      try {
        await handle.writeFile(JSON.stringify(payload, null, 2), 'utf8')
        await handle.sync()
      } finally {
        await handle.close()
      }
      await fs.rename(temp, this.file)
    } catch (error) {
      await fs.rm(temp, { force: true }).catch(() => {})
      throw error
    }
  }

  private async backupBeforeWrite(): Promise<void> {
    try {
      const stat = await fs.stat(this.file).catch(() => undefined)
      if (!stat || stat.size === 0) return

      await this.copyBackup(this.file, `${this.file}.bak`)

      const daily = path.join(this.backupDir, `store-${todayKey()}.json`)
      if (!(await fileExists(daily))) {
        await fs.mkdir(this.backupDir, { recursive: true })
        await this.copyBackup(this.file, daily)
        await this.pruneBackups()
      }
      this.warningList = this.warningList.filter((warning) => warning.code !== 'backup-failed')
    } catch (error) {
      this.addWarning({
        code: 'backup-failed',
        message: `自动备份失败：${error instanceof Error ? error.message : String(error)}`,
        path: this.backupDir,
      })
    }
  }

  private async copyBackup(source: string, target: string): Promise<void> {
    const temp = `${target}.${randomUUID()}.tmp`
    await fs.copyFile(source, temp)
    try {
      await fs.rename(temp, target)
    } catch {
      await fs.copyFile(temp, target)
      await fs.rm(temp, { force: true })
    }
  }

  private async pruneBackups(): Promise<void> {
    const files = (await fs.readdir(this.backupDir))
      .filter((name) => /^store-\d{4}-\d{2}-\d{2}\.json$/.test(name))
      .sort()
    for (const name of files.slice(0, Math.max(0, files.length - 7))) {
      await fs.rm(path.join(this.backupDir, name), { force: true })
    }
  }

  private addWarning(warning: StoreWarning): void {
    if (this.warningList.some((existing) => existing.code === warning.code && existing.path === warning.path)) {
      return
    }
    this.warningList.push(warning)
  }

  async addResource(resource: Resource): Promise<void> {
    const index = this.resources.findIndex((item) => item.id === resource.id)
    if (index >= 0) this.resources[index] = resource
    else this.resources.push(resource)
    await writeResourceFile(this.resourcesDir, resource)
  }

  async removeResource(id: string): Promise<boolean> {
    const index = this.resources.findIndex((item) => item.id === id)
    if (index < 0) return false
    this.resources.splice(index, 1)
    await fs.rm(path.join(this.resourcesDir, `${id}.json`), { force: true })
    return true
  }

  listResources(): Resource[] {
    return [...this.resources].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  getResource(id: string): Resource | undefined {
    return this.resources.find((item) => item.id === id)
  }

  latestResource(): Resource | undefined {
    return this.listResources()[0]
  }

  resolveResource(idOrLatest: string): Resource | undefined {
    return idOrLatest === 'latest' ? this.latestResource() : this.getResource(idOrLatest)
  }

  listItems(query?: string): StoredItem[] {
    const needle = query?.trim().toLowerCase()
    const items = [...this.data.items]
    if (!needle) return items.sort((a, b) => a.lemma.localeCompare(b.lemma))
    return items
      .filter((item) => {
        const haystack = [
          item.lemma,
          item.sense,
          item.definition,
          item.definitionZh ?? '',
          ...item.contexts.map((context) => context.sentence),
          ...item.tags,
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(needle)
      })
      .sort((a, b) => a.lemma.localeCompare(b.lemma))
  }

  getItem(id: string): StoredItem | undefined {
    return this.data.items.find((item) => item.id === id)
  }

  dueItems(now: Date = new Date(), limit = 100): StoredItem[] {
    return this.data.items
      .filter((item) => item.status === 'active' && item.staged !== true && isDue(item.review, now))
      .sort((a, b) => a.review.due.localeCompare(b.review.due))
      .slice(0, limit)
  }

  async upsertItems(items: LearningItem[]): Promise<{ added: number; updated: number }> {
    let added = 0
    let updated = 0
    const now = new Date().toISOString()
    for (const item of items) {
      const index = this.data.items.findIndex((existing) => existing.id === item.id)
      if (index >= 0) {
        this.data.items[index] = mergeItem(this.data.items[index]!, item)
        updated++
        continue
      }
      this.data.items.push({
        ...item,
        createdAt: item.createdAt || now,
        updatedAt: now,
        review: newReviewState(),
        favorite: false,
        status: 'active',
        ...(item.staged === true ? { staged: true } : {}),
        ...(item.introducedAt ? { introducedAt: item.introducedAt } : {}),
      })
      added++
    }
    await this.save()
    return { added, updated }
  }

  /** Replace pack-owned fields without merging stale contexts from the old item. */
  async replaceLearningItems(items: LearningItem[]): Promise<void> {
    if (items.length === 0) return
    const now = new Date().toISOString()
    for (const item of items) {
      const index = this.data.items.findIndex((existing) => existing.id === item.id)
      if (index >= 0) {
        const existing = this.data.items[index]!
        this.data.items[index] = {
          ...item,
          createdAt: existing.createdAt,
          updatedAt: now,
          review: existing.review,
          favorite: existing.favorite,
          status: existing.status,
        }
      } else {
        this.data.items.push({
          ...item,
          createdAt: item.createdAt || now,
          updatedAt: now,
          review: newReviewState(),
          favorite: false,
          status: 'active',
        })
      }
    }
    await this.save()
  }

  async applyReview(itemId: string, grade: Grade, now: Date = new Date()): Promise<StoredItem | undefined> {
    const item = this.getItem(itemId)
    if (!item) return undefined
    this.ensureDaily(now)
    const before = { ...item.review }
    const result = rateReview(item.review, grade, now, this.data.preferences.desiredRetention)
    item.review = result.review
    this.data.logs.push({
      itemId,
      rating: result.log.rating,
      reviewedAt: result.log.reviewedAt,
      dueAfter: result.log.dueAfter,
      before,
    })
    if (this.data.logs.length > 20_000) this.data.logs = this.data.logs.slice(-20_000)
    this.recordDailyReview(now, item.id)
    await this.save()
    return item
  }

  /** Replace editable learner-facing fields without touching review state. */
  async updateItem(
    itemId: string,
    patch: {
      sense?: string
      definition?: string
      definitionZh?: string
      notes?: string
      memoryHook?: string
      collocations?: string[]
    },
  ): Promise<StoredItem | undefined> {
    const item = this.getItem(itemId)
    if (!item) return undefined
    if (typeof patch.sense === 'string' && patch.sense.trim()) item.sense = patch.sense.trim()
    if (typeof patch.definition === 'string' && patch.definition.trim()) item.definition = patch.definition.trim()
    if (typeof patch.definitionZh === 'string') item.definitionZh = patch.definitionZh.trim() || undefined
    if (typeof patch.notes === 'string') item.notes = patch.notes.trim() || undefined
    if (typeof patch.memoryHook === 'string') item.memoryHook = patch.memoryHook.trim() || undefined
    if (Array.isArray(patch.collocations)) {
      item.collocations = [...new Set(patch.collocations.map((value) => String(value).trim()).filter(Boolean))]
    }
    item.updatedAt = new Date().toISOString()
    await this.save()
    return item
  }

  async setFavorite(itemId: string, favorite: boolean): Promise<StoredItem | undefined> {
    const item = this.getItem(itemId)
    if (!item) return undefined
    item.favorite = favorite
    await this.save()
    return item
  }

  async setStatus(itemId: string, status: StoredItem['status']): Promise<StoredItem | undefined> {
    const item = this.getItem(itemId)
    if (!item) return undefined
    item.status = status
    await this.save()
    return item
  }

  async setStatusMany(
    itemIds: string[],
    status: StoredItem['status'],
    now: Date = new Date(),
  ): Promise<number> {
    const wanted = new Set(itemIds)
    if (wanted.size === 0) return 0
    let changed = 0
    for (const item of this.data.items) {
      if (!wanted.has(item.id) || item.status === status) continue
      item.status = status
      item.updatedAt = now.toISOString()
      changed += 1
    }
    if (changed > 0) await this.save()
    return changed
  }

  async setFavoriteMany(itemIds: string[], favorite: boolean): Promise<number> {
    const wanted = new Set(itemIds)
    if (wanted.size === 0) return 0
    let changed = 0
    for (const item of this.data.items) {
      if (!wanted.has(item.id) || item.favorite === favorite) continue
      item.favorite = favorite
      changed += 1
    }
    if (changed > 0) await this.save()
    return changed
  }

  async addPack(pack: PackRecord): Promise<void> {
    const index = this.data.packs.findIndex((item) => item.id === pack.id)
    if (index >= 0) this.data.packs[index] = pack
    else this.data.packs.push(pack)
    await this.save()
  }

  async removePack(packId: string): Promise<PackRecord | undefined> {
    const index = this.data.packs.findIndex((item) => item.id === packId)
    if (index < 0) return undefined
    const [pack] = this.data.packs.splice(index, 1)
    await this.save()
    return pack
  }

  async removeItems(itemIds: string[]): Promise<number> {
    if (itemIds.length === 0) return 0
    const ids = new Set(itemIds)
    const before = this.data.items.length
    this.data.items = this.data.items.filter((item) => !ids.has(item.id))
    this.data.logs = this.data.logs.filter((log) => !ids.has(log.itemId))
    const removed = before - this.data.items.length
    if (removed > 0) await this.save()
    return removed
  }

  findPack(idOrResourceId: string): PackRecord | undefined {
    return this.data.packs.find((pack) => pack.id === idOrResourceId || pack.resourceId === idOrResourceId)
  }

  packs(): PackRecord[] {
    return [...this.data.packs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  preferences(): StorePreferences {
    const diagnosis = this.data.preferences.diagnosis
    return {
      ...this.data.preferences,
      wordFeedback: { ...this.data.preferences.wordFeedback },
      daily: { ...this.data.preferences.daily },
      ...(diagnosis
        ? { diagnosis: { ...diagnosis, knownLemmas: [...diagnosis.knownLemmas] } }
        : {}),
    }
  }

  todayProgress(now: Date = new Date()): DailyProgress {
    return { ...this.ensureDaily(now) }
  }

  private ensureDaily(now: Date): DailyProgress {
    const key = todayKey(now)
    const target = () => {
      const stats = this.stats(now)
      return (
        Math.min(stats.reviewDue, this.data.preferences.dailyReviewTarget) +
        Math.min(stats.newItems, this.data.preferences.dailyNewTarget)
      )
    }
    if (this.data.preferences.daily.date !== key) {
      this.data.preferences.daily = {
        date: key,
        dueAtStart: target(),
        reviewed: 0,
        reviewedItems: [],
        articleFinished: false,
        outputDone: false,
        completed: false,
      }
    } else if (
      this.data.preferences.daily.dueAtStart === 0 &&
      this.data.preferences.daily.reviewed === 0 &&
      (this.data.preferences.daily.reviewedItems?.length ?? 0) === 0
    ) {
      // If the day opens empty, allow the target to settle once the first
      // material arrives. Otherwise the goal is fixed for the day.
      this.data.preferences.daily.dueAtStart = target()
    }
    return this.data.preferences.daily
  }

  private completeDailyIfReady(now: Date): void {
    const daily = this.data.preferences.daily
    if (daily.completed) return
    // 复习是读后收尾，不阻塞“今天读完一篇并写出三句话”的完成判定
    const hasWrittenOutput = this.data.outputs.some((entry) => entry.date === todayKey(now))
    if (!daily.articleFinished || !daily.outputDone || !hasWrittenOutput) return
    daily.completed = true
    const today = todayKey(now)
    if (this.data.preferences.lastCompletedDate === today) return
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    this.data.preferences.streak =
      this.data.preferences.lastCompletedDate === todayKey(yesterday)
        ? this.data.preferences.streak + 1
        : 1
    this.data.preferences.lastCompletedDate = today
  }

  private recordDailyReview(now: Date, itemId?: string): void {
    const daily = this.ensureDaily(now)
    if (!Array.isArray(daily.reviewedItems)) daily.reviewedItems = []
    if (itemId && !daily.reviewedItems.includes(itemId)) {
      daily.reviewedItems.push(itemId)
    }
    daily.reviewed = Math.max(daily.reviewed, daily.reviewedItems.length)
    this.completeDailyIfReady(now)
  }

  async recordDailyArticle(packId: string, title: string, now: Date = new Date()): Promise<void> {
    const daily = this.ensureDaily(now)
    // 今天已经精读完一篇时，不再把“今日文章”换成刚生成的另一篇
    if (daily.articleFinished) return
    daily.articlePackId = packId
    daily.articleTitle = title
    daily.articleFinished = false
    await this.save()
  }

  async markArticleRead(
    packId: string,
    title: string,
    now: Date = new Date(),
  ): Promise<DailyProgress> {
    const daily = this.ensureDaily(now)
    if (!daily.articleFinished) {
      daily.articlePackId = packId
      daily.articleTitle = title
    }
    daily.articleFinished = true
    this.completeDailyIfReady(now)
    await this.save()
    return { ...daily }
  }

  async markOutputDone(now: Date = new Date()): Promise<void> {
    const daily = this.ensureDaily(now)
    daily.outputDone = true
    this.completeDailyIfReady(now)
    await this.save()
  }

  async resetDailyArticle(now: Date = new Date()): Promise<DailyProgress> {
    const daily = this.ensureDaily(now)
    daily.articleFinished = false
    daily.completed = false
    await this.save()
    return { ...daily }
  }

  listOutputs(limit = 20, now: Date = new Date()): OutputEntry[] {
    return [...this.data.outputs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(0, limit))
      .map((entry) => ({
        ...entry,
        date: entry.date || todayKey(now),
        ...(entry.revisions ? { revisions: entry.revisions.map((revision) => ({ ...revision })) } : {}),
      }))
  }

  outputForDate(date: string): OutputEntry | undefined {
    const entry = [...this.data.outputs]
      .filter((item) => item.date === date)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    return entry
      ? {
          ...entry,
          ...(entry.revisions ? { revisions: entry.revisions.map((revision) => ({ ...revision })) } : {}),
        }
      : undefined
  }

  getOutput(id: string): OutputEntry | undefined {
    const entry = this.data.outputs.find((output) => output.id === id)
    return entry
      ? {
          ...entry,
          ...(entry.revisions ? { revisions: entry.revisions.map((revision) => ({ ...revision })) } : {}),
        }
      : undefined
  }

  async saveOutputFeedback(id: string, feedback: EditorFeedback): Promise<OutputEntry> {
    const entry = this.data.outputs.find((output) => output.id === id)
    if (!entry) throw new Error('Output not found.')
    entry.feedback = feedback
    await this.save()
    return {
      ...entry,
      ...(entry.revisions ? { revisions: entry.revisions.map((revision) => ({ ...revision })) } : {}),
    }
  }

  async addOutputRevision(id: string, text: string, now: Date = new Date()): Promise<OutputEntry> {
    const entry = this.data.outputs.find((output) => output.id === id)
    if (!entry) throw new Error('Output not found.')
    const trimmed = text.replace(/\r\n?/g, '\n').trim()
    if (!trimmed) throw new Error('这一版还是空的。')
    const latest = entry.revisions?.[entry.revisions.length - 1]?.text ?? entry.text
    if (trimmed === latest.trim()) throw new Error('这一版和上一版相同，先改几句再保存。')
    entry.revisions = [
      ...(entry.revisions ?? []),
      { id: randomUUID(), text: trimmed, createdAt: now.toISOString() },
    ]
    await this.save()
    return {
      ...entry,
      revisions: entry.revisions.map((revision) => ({ ...revision })),
    }
  }

  async saveOutputRevisionFeedback(
    outputId: string,
    revisionId: string,
    feedback: EditorFeedback,
  ): Promise<OutputEntry> {
    const entry = this.data.outputs.find((output) => output.id === outputId)
    if (!entry) throw new Error('Output not found.')
    const revision = entry.revisions?.find((item) => item.id === revisionId)
    if (!revision) throw new Error('Revision not found.')
    revision.feedback = feedback
    await this.save()
    return {
      ...entry,
      revisions: entry.revisions!.map((item) => ({ ...item })),
    }
  }

  async saveOutput(
    input: {
      text: string
      prompt: string
      answer?: string
      packId?: string
      articleTitle?: string
    },
    now: Date = new Date(),
  ): Promise<OutputEntry> {
    const text = input.text.trim()
    if (!text) throw new Error('Output text is empty.')
    const entry: OutputEntry = {
      id: randomUUID(),
      date: todayKey(now),
      text,
      prompt: input.prompt.trim(),
      ...(input.answer?.trim() ? { answer: input.answer.trim() } : {}),
      ...(input.packId ? { packId: input.packId } : {}),
      ...(input.articleTitle ? { articleTitle: input.articleTitle } : {}),
      createdAt: now.toISOString(),
    }
    this.data.outputs.push(entry)
    if (this.data.outputs.length > 500) this.data.outputs = this.data.outputs.slice(-500)
    const daily = this.ensureDaily(now)
    daily.outputDone = true
    this.completeDailyIfReady(now)
    await this.save()
    return entry
  }

  async adjustSelectionBias(delta: number): Promise<StorePreferences> {
    this.data.preferences.selectionBias = Math.max(
      -5,
      Math.min(5, this.data.preferences.selectionBias + delta),
    )
    await this.save()
    return this.preferences()
  }

  async setDesiredRetention(value: number): Promise<StorePreferences> {
    this.data.preferences.desiredRetention = Math.max(0.8, Math.min(0.97, value))
    await this.save()
    return this.preferences()
  }

  async setDailyTargets(newTarget: number, reviewTarget: number): Promise<StorePreferences> {
    this.data.preferences.dailyNewTarget = normalizeTarget(newTarget, this.data.preferences.dailyNewTarget)
    this.data.preferences.dailyReviewTarget = normalizeTarget(
      reviewTarget,
      this.data.preferences.dailyReviewTarget,
    )
    await this.save()
    return this.preferences()
  }

  async setWeeklyGoals(articles: number, studyDays: number): Promise<StorePreferences> {
    this.data.preferences.weeklyArticleGoal = normalizeTarget(
      articles,
      this.data.preferences.weeklyArticleGoal,
    )
    this.data.preferences.weeklyStudyDaysGoal = Math.min(
      7,
      normalizeTarget(studyDays, this.data.preferences.weeklyStudyDaysGoal),
    )
    await this.save()
    return this.preferences()
  }

  async recordWordFeedback(lemma: string, delta: number): Promise<void> {
    const key = lemma.toLowerCase().trim()
    if (!key) return
    this.data.preferences.wordFeedback[key] = Math.max(
      -3,
      Math.min(3, (this.data.preferences.wordFeedback[key] ?? 0) + delta),
    )
    await this.save()
  }

  /** Existing wordbook imports become a backlog instead of flooding the due queue. */
  private stageWordbookBacklog(): boolean {
    let changed = false
    for (const item of this.data.items) {
      if (item.staged === undefined && item.status === 'active' && item.review.reps === 0 && item.tags.some((tag) => tag.startsWith('wordbook:'))) {
        item.staged = true
        changed = true
      }
    }
    return changed
  }

  /** Release up to the remaining daily new-word budget from the staged backlog. */
  async releaseStaged(limit: number, now: Date = new Date(), tag?: string): Promise<number> {
    if (limit <= 0) return 0
    const today = todayKey(now)
    const introducedToday = this.data.items.filter(
      (item) => item.introducedAt && todayKey(new Date(item.introducedAt)) === today,
    ).length
    const remaining = Math.max(0, limit - introducedToday)
    if (remaining === 0) return 0
    const candidates = this.data.items
      .filter((item) => item.status === 'active' && item.staged === true && item.review.reps === 0 && (!tag || item.tags.includes(tag)))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.lemma.localeCompare(b.lemma))
      .slice(0, remaining)
    if (candidates.length === 0) return 0
    const stamp = now.toISOString()
    for (const item of candidates) {
      item.staged = false
      item.introducedAt = stamp
      item.updatedAt = stamp
      item.review.due = stamp
    }
    await this.save()
    return candidates.length
  }

  stats(now: Date = new Date()): StoreStats {
    const today = todayKey(now)
    const firstByItem = new Map<string, { rating: number; reviewedAt: string }>()
    for (const log of this.data.logs) {
      if (!firstByItem.has(log.itemId)) firstByItem.set(log.itemId, { rating: log.rating, reviewedAt: log.reviewedAt })
    }
    const firstReviewed = firstByItem.size
    const firstCorrect = [...firstByItem.values()].filter((entry) => entry.rating >= 3).length
    const newReviewedToday = [...firstByItem.values()].filter((entry) => todayKey(new Date(entry.reviewedAt)) === today).length
    const active = this.data.items.filter((item) => item.status === 'active')
    const due = this.dueItems(now, Number.MAX_SAFE_INTEGER).length
    const reviewDue = active.filter((item) => item.staged !== true && !isNew(item.review) && isDue(item.review, now)).length
    return {
      total: this.data.items.length,
      due,
      reviewDue,
      dueToday: Math.min(reviewDue, this.data.preferences.dailyReviewTarget),
      newReviewedToday,
      newItems: active.filter((item) => item.staged !== true && isNew(item.review)).length,
      backlog: active.filter((item) => item.staged === true).length,
      favorites: this.data.items.filter((item) => item.favorite).length,
      reviewedToday: new Set(
        this.data.logs
          .filter((log) => todayKey(new Date(log.reviewedAt)) === today)
          .map((log) => log.itemId),
      ).size,
      suspended: this.data.items.filter((item) => item.status === 'suspended').length,
      known: this.data.items.filter((item) => item.status === 'known').length,
      firstReviewed,
      firstCorrect,
      firstAccuracy: firstReviewed ? firstCorrect / firstReviewed : 0,
    }
  }
}
