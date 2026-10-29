import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { LearningItem, PackRecord, Resource, ReviewLogEntry, StoredItem } from '../types.js'
import { isDue, isNew, newReviewState, rateReview } from '../review/scheduler.js'
import type { Grade } from '../review/scheduler.js'

interface StoreData {
  version: 2
  items: StoredItem[]
  packs: PackRecord[]
  logs: ReviewLogEntry[]
  outputs: OutputEntry[]
  preferences: StorePreferences
}

export interface OutputEntry {
  id: string
  date: string
  text: string
  prompt: string
  answer?: string
  packId?: string
  articleTitle?: string
  createdAt: string
}

export interface DailyProgress {
  date: string
  dueAtStart: number
  reviewed: number
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
}

const DAILY_REVIEW_TARGET = 10

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
      articleFinished: false,
      outputDone: false,
      completed: false,
    },
    streak: 0,
  }
}

function normalizePreferences(raw: unknown): StorePreferences {
  const value = raw && typeof raw === 'object' ? (raw as Partial<StorePreferences>) : {}
  const daily =
    value.daily && typeof value.daily === 'object'
      ? (value.daily as Partial<DailyProgress>)
      : {}
  const feedback =
    value.wordFeedback && typeof value.wordFeedback === 'object' ? value.wordFeedback : {}
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
  }
}

function emptyStore(): StoreData {
  return { version: 2, items: [], packs: [], logs: [], outputs: [], preferences: emptyPreferences() }
}

async function readResourceFiles(dir: string): Promise<Resource[]> {
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch {
    return []
  }
  const resources: Resource[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    try {
      const resource = JSON.parse(await fs.readFile(path.join(dir, name), 'utf8')) as Resource
      if (resource && typeof resource.id === 'string' && typeof resource.title === 'string') resources.push(resource)
    } catch {
      // A broken resource file should not prevent the review library from opening.
    }
  }
  return resources
}

async function writeResourceFile(dir: string, resource: Resource): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, `${resource.id}.json`), JSON.stringify(resource, null, 2), 'utf8')
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
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
    notes: [existing.notes, incoming.notes].filter(Boolean).join('\n\n') || undefined,
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
  newItems: number
  favorites: number
  reviewedToday: number
  suspended: number
  known: number
}

export class Store {
  private data: StoreData

  private constructor(
    private readonly file: string,
    private readonly resourcesDir: string,
    private resources: Resource[],
    data: StoreData,
  ) {
    this.data = data
  }

  static async open(file: string): Promise<Store> {
    await fs.mkdir(path.dirname(file), { recursive: true })
    const resourcesDir = path.join(path.dirname(file), 'resources')

    let data = emptyStore()
    let legacyResources: Resource[] = []
    let needsMigration = false
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as {
        version?: number
        resources?: Resource[]
        items?: StoredItem[]
        packs?: PackRecord[]
        logs?: ReviewLogEntry[]
        outputs?: OutputEntry[]
        preferences?: unknown
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
    } catch {
      // A missing or corrupt store starts empty; resource files still load below.
    }

    const resources = await readResourceFiles(resourcesDir)
    const known = new Set(resources.map((resource) => resource.id))
    for (const resource of legacyResources) {
      if (known.has(resource.id)) continue
      resources.push(resource)
      known.add(resource.id)
      await writeResourceFile(resourcesDir, resource)
    }

    const store = new Store(file, resourcesDir, resources, data)
    if (needsMigration) {
      await fs.copyFile(file, `${file}.v1.bak`).catch(() => {})
      await store.save()
    }
    return store
  }

  async save(): Promise<void> {
    const temp = `${this.file}.tmp`
    const payload = {
      version: 2,
      items: this.data.items,
      packs: this.data.packs,
      logs: this.data.logs,
      outputs: this.data.outputs,
      preferences: this.data.preferences,
    }
    await fs.writeFile(temp, JSON.stringify(payload, null, 2), 'utf8')
    await fs.rename(temp, this.file)
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
      .filter((item) => item.status === 'active' && isDue(item.review, now))
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
    const result = rateReview(item.review, grade, now)
    item.review = result.review
    this.data.logs.push({
      itemId,
      rating: result.log.rating,
      reviewedAt: result.log.reviewedAt,
      dueAfter: result.log.dueAfter,
    })
    if (this.data.logs.length > 20_000) this.data.logs = this.data.logs.slice(-20_000)
    this.recordDailyReview(now)
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
    return {
      ...this.data.preferences,
      wordFeedback: { ...this.data.preferences.wordFeedback },
      daily: { ...this.data.preferences.daily },
    }
  }

  todayProgress(now: Date = new Date()): DailyProgress {
    return { ...this.ensureDaily(now) }
  }

  private ensureDaily(now: Date): DailyProgress {
    const key = todayKey(now)
    if (this.data.preferences.daily.date !== key) {
      this.data.preferences.daily = {
        date: key,
        dueAtStart: Math.min(this.stats(now).due, DAILY_REVIEW_TARGET),
        reviewed: 0,
        articleFinished: false,
        outputDone: false,
        completed: false,
      }
    } else if (this.data.preferences.daily.dueAtStart > DAILY_REVIEW_TARGET) {
      // 阅读优先后复习目标变小；当天已开始的旧目标也向新目标收敛
      this.data.preferences.daily.dueAtStart = DAILY_REVIEW_TARGET
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

  private recordDailyReview(now: Date): void {
    const daily = this.ensureDaily(now)
    daily.reviewed += 1
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
      .map((entry) => ({ ...entry, date: entry.date || todayKey(now) }))
  }

  outputForDate(date: string): OutputEntry | undefined {
    return [...this.data.outputs]
      .filter((entry) => entry.date === date)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
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

  async recordWordFeedback(lemma: string, delta: number): Promise<void> {
    const key = lemma.toLowerCase().trim()
    if (!key) return
    this.data.preferences.wordFeedback[key] = Math.max(
      -3,
      Math.min(3, (this.data.preferences.wordFeedback[key] ?? 0) + delta),
    )
    await this.save()
  }

  stats(now: Date = new Date()): StoreStats {
    const today = todayKey(now)
    return {
      total: this.data.items.length,
      due: this.dueItems(now, Number.MAX_SAFE_INTEGER).length,
      newItems: this.data.items.filter((item) => item.status === 'active' && isNew(item.review)).length,
      favorites: this.data.items.filter((item) => item.favorite).length,
      reviewedToday: this.data.logs.filter((log) => todayKey(new Date(log.reviewedAt)) === today).length,
      suspended: this.data.items.filter((item) => item.status === 'suspended').length,
      known: this.data.items.filter((item) => item.status === 'known').length,
    }
  }
}
