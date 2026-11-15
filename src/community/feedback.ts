import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export type FeedbackKind = 'idea' | 'bug'
export type FeedbackStatus = 'open' | 'planned' | 'fixed' | 'declined'

export interface FeedbackItem {
  id: string
  kind: FeedbackKind
  body: string
  createdAt: string
  status: FeedbackStatus
  votes: number
  /** Who voted, so a second click removes the vote. Never sent to clients. */
  voters: Record<string, true>
  /** Public author label, e.g. 匿名访客 #a3f. */
  author: string
  /** Stored file name of an attached screenshot. */
  image?: string
  reply?: string
}

export interface PublicFeedback {
  id: string
  kind: FeedbackKind
  body: string
  createdAt: string
  status: FeedbackStatus
  votes: number
  author: string
  image?: string
  reply?: string
  voted: boolean
}

const MAX_ITEMS = 300
const MAX_BODY = 1000
const MIN_BODY = 4
const MAX_VOTES_PER_VISITOR = 30
const SUBMIT_WINDOW_MS = 60 * 60 * 1000
const SUBMIT_PER_WINDOW = 5

interface FeedbackFile {
  version: 1
  items: FeedbackItem[]
}

/**
 * A small file-backed board. Writes are serialized and atomic; the volume here
 * is tiny, so no database is worth it.
 */
export class FeedbackBoard {
  private items: FeedbackItem[] = []
  /** mtime+size of the file we last read or wrote; detects outside edits. */
  private stamp = ''
  private chain: Promise<void> = Promise.resolve()
  private submissions = new Map<string, { count: number; resetAt: number }>()

  constructor(private readonly file: string) {}

  private async load(): Promise<void> {
    await this.ensureFresh()
  }

  /** Re-read when the file changed underneath us (e.g. the CLI edited it). */
  private async ensureFresh(): Promise<void> {
    let stamp = ''
    try {
      const stat = await fs.stat(this.file)
      stamp = `${stat.mtimeMs}:${stat.size}`
    } catch {
      // No file yet: keep whatever we have in memory.
      this.stamp = ''
      return
    }
    if (stamp === this.stamp) return
    try {
      const raw = await fs.readFile(this.file, 'utf8')
      const parsed = JSON.parse(raw) as FeedbackFile
      if (Array.isArray(parsed?.items)) {
        this.items = parsed.items.filter(
          (item) => item && typeof item.id === 'string' && typeof item.body === 'string',
        )
      }
      this.stamp = stamp
    } catch {
      // An unreadable file leaves the previous contents untouched.
    }
  }

  private write(): Promise<void> {
    const payload: FeedbackFile = { version: 1, items: this.items }
    const text = JSON.stringify(payload, null, 1)
    this.chain = this.chain.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true })
      const temp = `${this.file}.${process.pid}.tmp`
      await fs.writeFile(temp, text)
      await fs.rename(temp, this.file)
      const stat = await fs.stat(this.file)
      this.stamp = `${stat.mtimeMs}:${stat.size}`
    }).catch(() => {})
    return this.chain
  }

  /** Rate limit submissions per visitor so one person cannot flood the board. */
  private maySubmit(visitorId: string): boolean {
    const now = Date.now()
    const window = this.submissions.get(visitorId)
    if (!window || now > window.resetAt) {
      this.submissions.set(visitorId, { count: 1, resetAt: now + SUBMIT_WINDOW_MS })
      return true
    }
    if (window.count >= SUBMIT_PER_WINDOW) return false
    window.count += 1
    return true
  }

  async list(
    visitorId: string,
    options: { sort?: 'new' | 'votes'; limit?: number; offset?: number } = {},
  ): Promise<{ items: PublicFeedback[]; total: number; counts: Record<FeedbackStatus, number> }> {
    await this.load()
    const counts: Record<FeedbackStatus, number> = { open: 0, planned: 0, fixed: 0, declined: 0 }
    for (const item of this.items) counts[item.status] += 1
    const order: Record<FeedbackStatus, number> = { planned: 0, open: 1, fixed: 2, declined: 3 }
    const sorted = [...this.items].sort((a, b) => {
      if (options.sort === 'new') return b.createdAt.localeCompare(a.createdAt)
      return order[a.status] - order[b.status] || b.votes - a.votes || b.createdAt.localeCompare(a.createdAt)
    })
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50)
    const offset = Math.max(options.offset ?? 0, 0)
    const items = sorted.slice(offset, offset + limit)
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        body: item.body,
        createdAt: item.createdAt,
        status: item.status,
        votes: item.votes,
        author: item.author,
        ...(item.image ? { image: item.image } : {}),
        ...(item.reply ? { reply: item.reply } : {}),
        voted: Boolean(item.voters[visitorId]),
      }))
    return { items, total: sorted.length, counts }
  }

  async add(
    visitorId: string,
    input: { kind: FeedbackKind; body: string; image?: string },
  ): Promise<{ ok: true; item: PublicFeedback } | { ok: false; error: string }> {
    await this.load()
    const body = input.body.trim()
    if (body.length < MIN_BODY) return { ok: false, error: '写长一点点吧，至少 4 个字。' }
    if (body.length > MAX_BODY) return { ok: false, error: `最多 ${MAX_BODY} 个字。` }
    if (this.items.length >= MAX_ITEMS) return { ok: false, error: '意见墙满了，暂时不能再提新的。' }
    if (!this.maySubmit(visitorId)) return { ok: false, error: '提得有点频繁，休息一下再来。' }

    const item: FeedbackItem = {
      id: randomUUID().slice(0, 8),
      kind: input.kind === 'bug' ? 'bug' : 'idea',
      body,
      createdAt: new Date().toISOString(),
      status: 'open',
      votes: 1,
      voters: { [visitorId]: true },
      author: `访客 ${visitorId.slice(0, 4)}`,
      ...(input.image ? { image: input.image } : {}),
    }
    this.items.unshift(item)
    await this.write()
    return {
      ok: true,
      item: { ...item, voted: true, voters: undefined } as unknown as PublicFeedback,
    }
  }

  async vote(id: string, visitorId: string): Promise<{ ok: boolean; votes?: number; voted?: boolean; error?: string }> {
    await this.load()
    const item = this.items.find((entry) => entry.id === id)
    if (!item) return { ok: false, error: '这条意见不在了。' }
    const votedItems = this.items.filter((entry) => entry.voters[visitorId]).length
    if (!item.voters[visitorId] && votedItems >= MAX_VOTES_PER_VISITOR) {
      return { ok: false, error: '点太多了，先专注读文章吧。' }
    }
    if (item.voters[visitorId]) {
      delete item.voters[visitorId]
      item.votes = Math.max(0, item.votes - 1)
    } else {
      item.voters[visitorId] = true
      item.votes += 1
    }
    await this.write()
    return { ok: true, votes: item.votes, voted: Boolean(item.voters[visitorId]) }
  }

  async setStatus(id: string, status: FeedbackStatus, reply?: string): Promise<boolean> {
    await this.load()
    const item = this.items.find((entry) => entry.id === id)
    if (!item) return false
    item.status = status
    if (reply !== undefined) item.reply = reply.trim() || undefined
    await this.write()
    return true
  }

  async remove(id: string): Promise<boolean> {
    await this.load()
    const index = this.items.findIndex((entry) => entry.id === id)
    if (index < 0) return false
    this.items.splice(index, 1)
    await this.write()
    return true
  }

  /** Used by the CLI: resolve a short id prefix. */
  async find(idOrPrefix: string): Promise<FeedbackItem | undefined> {
    await this.load()
    return (
      this.items.find((item) => item.id === idOrPrefix) ??
      this.items.find((item) => item.id.startsWith(idOrPrefix))
    )
  }
}
