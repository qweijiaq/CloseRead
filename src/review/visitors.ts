import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHmac, randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { createWorkspace, publicModeEnabled, rootDataDir, rootPacksDir, rootWorkspaceRef } from '../config.js'
import type { Workspace } from '../config.js'
import { Store } from '../store/store.js'
import type { PackRecord } from '../types.js'

const VISITOR_COOKIE = 'cr_visitor'

/**
 * The owner is whoever holds the owner cookie. It is derived from
 * LEARN_OWNER_KEY so the value cannot be guessed or forged without the secret;
 * a fixed string like "owner-main" would let anyone edit devtools and become
 * the author.
 */
export function ownerVisitorId(): string {
  const key = process.env.LEARN_OWNER_KEY?.trim() ?? ''
  if (key.length < 16) return ''
  return `owner-${createHmac('sha256', key).update('closeread-owner').digest('base64url').slice(0, 22)}`
}

export function isOwnerVisitor(id: string): boolean {
  const owner = ownerVisitorId()
  return Boolean(owner) && id === owner
}
const ONLINE_WINDOW_MS = 3 * 60 * 1000
const FLUSH_INTERVAL_MS = 15 * 1000
const COOKIE_MAX_AGE = 2 * 365 * 24 * 60 * 60

/** New identities per IP per window; keeps cookie-less clients from growing the log. */
const NEW_ID_LIMIT = 5
const NEW_ID_WINDOW_MS = 60 * 60 * 1000
const CLAIMS_PER_IP_PER_DAY = 5
const MAX_VISITORS = 5000
const MAX_WORKSPACES = 500
const MAX_OPEN_STORES = 40
const STORE_IDLE_MS = 10 * 60 * 1000

interface VisitRecord {
  first: number
  last: number
  /** Last time an open, visible page said hello. Drives "online". */
  active?: number
  claimed?: boolean
}

interface VisitFile {
  version: 1
  visitors: Record<string, VisitRecord>
}

export interface PublicStats {
  totalUsers: number
  online: number
}

export interface ClaimResult {
  ok: boolean
  error?: string
}

function readCookie(request: IncomingMessage, name: string): string | undefined {
  const header = request.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    if (part.slice(0, index).trim() !== name) continue
    return decodeURIComponent(part.slice(index + 1).trim())
  }
  return undefined
}

function visitorCookie(value: string, secure: boolean): string {
  const attrs = [
    `${VISITOR_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE}`,
  ]
  if (secure) attrs.push('Secure')
  return attrs.join('; ')
}

function isWriteMethod(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
}

function newVisitorId(): string {
  return randomBytes(9).toString('base64url')
}

function isSafeVisitorId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,32}$/.test(value)
}

function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

/** Bots and bare scripts would otherwise inflate "how many people used this". */
const BOT_AGENT = /bot|crawler|spider|curl|wget|python-requests|headless|monitor|uptime|scanner|scan\//i

function looksLikeBot(request: IncomingMessage): boolean {
  const agent = String(request.headers['user-agent'] ?? '')
  if (!agent.trim()) return true
  return BOT_AGENT.test(agent)
}

/**
 * Public multi-visitor mode.
 *
 * Every browser gets an anonymous cookie. Reads before the first write come
 * from the shared read-only demo; the first write silently creates a private
 * workspace so nobody ever sees a login form, and no two visitors share a store.
 */
export class VisitorRegistry {
  private visits = new Map<string, VisitRecord>()
  private loaded = false
  private dirty = false
  private lastFlush = 0
  private flushChain: Promise<void> = Promise.resolve()
  private newIdWindows = new Map<string, { count: number; resetAt: number }>()
  private claimWindows = new Map<string, { count: number; day: string }>()
  private workspaces = new Map<string, Workspace>()
  private stores = new Map<string, Promise<Store>>()
  private storeUsage = new Map<string, number>()
  private syncState = new Map<string, Map<string, string>>()
  private pendingChanges = new Map<string, Map<string, string>>()
  private demoWorkspace: Workspace | undefined

  constructor(
    private readonly demoStore: Store,
    private readonly demoIntervalMs = ONLINE_WINDOW_MS,
  ) {}

  private get visitsFile(): string {
    return path.join(rootDataDir, 'community', 'visits.json')
  }

  /**
   * Visitor workspaces are scratch space, not storage: they live in the OS temp
   * directory and are wiped on every start. The browser holds the durable copy
   * and hydrates it back, which keeps the server free of anything to maintain.
   */
  private get usersRoot(): string {
    return path.join(this.runRoot, 'users')
  }

  /** Scratch root. Tests override it so parallel suites do not share one. */
  private get runRoot(): string {
    const override = process.env.LEARN_RUN_DIR?.trim()
    return override || path.join(os.tmpdir(), 'closeread-run')
  }

  private workspaceDir(id: string): string {
    return path.join(this.usersRoot, id)
  }

  /** Drop every scratch workspace left over from a previous process. */
  private async resetScratch(): Promise<void> {
    await fs.rm(this.runRoot, { recursive: true, force: true }).catch(() => {})
    await fs.mkdir(this.usersRoot, { recursive: true }).catch(() => {})
  }

  private loadPromise: Promise<void> | undefined

  /**
   * One shared load: a second request must wait for the first, not read an
   * empty map and flush it back over the real visitor log.
   */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return
    this.loadPromise ??= this.loadVisits()
    await this.loadPromise
  }

  private async readVisitFile(file: string): Promise<Map<string, VisitRecord>> {
    const found = new Map<string, VisitRecord>()
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as VisitFile
      if (!parsed || typeof parsed !== 'object' || !parsed.visitors || typeof parsed.visitors !== 'object') {
        return found
      }
      for (const [id, record] of Object.entries(parsed.visitors)) {
        if (!isSafeVisitorId(id) || !record || typeof record !== 'object') continue
        const first = Number(record.first) || Date.now()
        const last = Number(record.last) || first
        found.set(id, {
          first,
          last,
          ...(Number(record.active) ? { active: Number(record.active) } : {}),
          claimed: record.claimed === true,
        })
      }
    } catch {
      // A missing or unreadable visit log only costs statistics, not isolation.
    }
    return found
  }

  private async loadVisits(): Promise<void> {
    await this.resetScratch()
    // The live log can be shorter than its backup after a crash or a bad write;
    // take the union so a truncation never erases history.
    for (const file of [this.visitsFile, `${this.visitsFile}.bak`]) {
      const found = await this.readVisitFile(file)
      for (const [id, record] of found) {
        const existing = this.visits.get(id)
        if (!existing) {
          this.visits.set(id, record)
          continue
        }
        this.visits.set(id, {
          first: Math.min(existing.first, record.first),
          last: Math.max(existing.last, record.last),
          ...(record.active || existing.active ? { active: Math.max(record.active ?? 0, existing.active ?? 0) } : {}),
          claimed: existing.claimed === true || record.claimed === true,
        })
      }
    }
    // Persist what we just loaded: an early flush used to write an empty map.
    this.dirty = this.visits.size > 0
    this.loaded = true
  }

  private markDirty(): void {
    this.dirty = true
    if (Date.now() - this.lastFlush < FLUSH_INTERVAL_MS) return
    void this.flush()
  }

  /** Persist statistics. Bounded loss on a crash is acceptable; isolation never depends on it. */
  flush(): Promise<void> {
    if (!this.dirty) return this.flushChain
    // A flush before the log finished loading would wipe the visitor history.
    if (this.visits.size === 0) return this.flushChain
    const snapshot: VisitFile = { version: 1, visitors: {} }
    for (const [id, record] of this.visits) {
      snapshot.visitors[id] = { ...record }
    }
    this.dirty = false
    this.lastFlush = Date.now()
    const payload = JSON.stringify(snapshot)
    this.flushChain = this.flushChain
      .then(async () => {
        await fs.mkdir(path.dirname(this.visitsFile), { recursive: true })
        const temp = `${this.visitsFile}.${process.pid}.tmp`
        await fs.writeFile(temp, payload)
        await fs.copyFile(this.visitsFile, `${this.visitsFile}.bak`).catch(() => {})
        await fs.rename(temp, this.visitsFile)
      })
      .catch(() => {
        // Statistics must never break a page load.
      })
    return this.flushChain
  }

  private noteVisit(id: string, ip: string, created: boolean): void {
    const now = Date.now()
    const existing = this.visits.get(id)
    if (existing) {
      // Heartbeat at most once a minute so an idle page does not rewrite the log.
      if (now - existing.last < 60 * 1000) return
      existing.last = now
      this.markDirty()
      return
    }
    if (this.visits.size >= MAX_VISITORS) return
    // Cookie-blocked clients mint an identity per request; record at most a few
    // per IP so the counter stays meaningful without breaking their workspace.
    if (created && !this.mayCreateId(ip)) return
    this.visits.set(id, { first: now, last: now })
    this.markDirty()
  }

  /** Cookie-less clients would mint a new id per request; cap that per IP. */
  private mayCreateId(ip: string): boolean {
    const now = Date.now()
    const window = this.newIdWindows.get(ip)
    if (!window || now > window.resetAt) {
      this.newIdWindows.set(ip, { count: 1, resetAt: now + NEW_ID_WINDOW_MS })
      return true
    }
    if (window.count >= NEW_ID_LIMIT) return false
    window.count += 1
    return true
  }

  private mayClaim(ip: string): boolean {
    const now = Date.now()
    const today = dayKey(now)
    const window = this.claimWindows.get(ip)
    if (!window || window.day !== today) {
      this.claimWindows.set(ip, { count: 1, day: today })
      return true
    }
    if (window.count >= CLAIMS_PER_IP_PER_DAY) return false
    window.count += 1
    return true
  }

  private async hasWorkspace(id: string): Promise<boolean> {
    if (this.workspaces.has(id)) return true
    try {
      await fs.access(path.join(this.workspaceDir(id), 'data'))
      return true
    } catch {
      return false
    }
  }

  private demo(): Workspace {
    this.demoWorkspace ??= (() => {
      const workspace = createWorkspace({
        id: 'demo',
        dataDir: rootDataDir,
        packsDir: rootPacksDir,
        readOnly: true,
      })
      // The shared demo must never spend the owner's provider keys on anonymous
      // traffic. Visitors add their own key, which also creates their workspace.
      workspace.llm = { ...workspace.llm, apiKey: '', keySource: 'none' }
      if (workspace.tts.provider !== 'local' && workspace.tts.provider !== 'edge') {
        workspace.tts = { ...workspace.tts, apiKey: '', keySource: 'none' }
      }
      return workspace
    })()
    return this.demoWorkspace
  }

  workspaceFor(id: string): Workspace {
    const cached = this.workspaces.get(id)
    if (cached) return cached
    const base = this.workspaceDir(id)
    const workspace = createWorkspace({
      id,
      dataDir: path.join(base, 'data'),
      packsDir: path.join(base, 'packs'),
    })
    this.workspaces.set(id, workspace)
    return workspace
  }

  /** One open Store per visitor, opened lazily and reused for the process lifetime. */
  storeFor(workspace: Workspace): Promise<Store> {
    const existing = this.stores.get(workspace.id)
    if (existing) {
      this.storeUsage.set(workspace.id, Date.now())
      return existing
    }
    this.evictIdleStores()
    const opening = (async () => {
      await fs.mkdir(path.join(workspace.dataDir, 'resources'), { recursive: true })
      await fs.mkdir(workspace.packsDir, { recursive: true })
      const store = await Store.open(path.join(workspace.dataDir, 'store.json'))
      const diagnosis = store.preferences().diagnosis
      if (diagnosis?.level) workspace.level = diagnosis.level
      return store
    })()
    this.stores.set(workspace.id, opening)
    this.storeUsage.set(workspace.id, Date.now())
    opening.catch(() => this.stores.delete(workspace.id))
    return opening
  }

  /**
   * Every open store keeps its items in memory. On a small server that adds up,
   * so the coldest workspaces are dropped and reopened from disk when they
   * come back. Only untouched-for-a-while stores are eligible, so no request
   * is ever writing through an evicted instance.
   */
  private evictIdleStores(): void {
    if (this.stores.size < MAX_OPEN_STORES) return
    const now = Date.now()
    const candidates = [...this.storeUsage.entries()]
      .filter(([id]) => id !== 'demo' && now - this.storeUsage.get(id)! > STORE_IDLE_MS)
      .sort((a, b) => a[1] - b[1])
    for (const [id] of candidates.slice(0, Math.max(1, this.stores.size - MAX_OPEN_STORES + 1))) {
      this.stores.delete(id)
      this.storeUsage.delete(id)
    }
  }

  /**
   * Seed a private workspace with the demo article so the first visit after
   * "starting" is not an empty screen. Pack directories are absolute in the
   * store, so they are rewritten to the new root.
   */
  private async seed(id: string): Promise<void> {
    const target = this.workspaceDir(id)
    const dataDir = path.join(target, 'data')
    const packsDir = path.join(target, 'packs')
    await fs.mkdir(dataDir, { recursive: true })
    await fs.mkdir(packsDir, { recursive: true })

    const sourceStore = path.join(rootDataDir, 'store.json')
    const raw = await fs.readFile(sourceStore, 'utf8').catch(() => '')
    if (!raw.trim()) return
    let parsed: { packs?: PackRecord[] }
    try {
      parsed = JSON.parse(raw) as { packs?: PackRecord[] }
    } catch {
      return
    }
    const packs = Array.isArray(parsed.packs) ? parsed.packs : []
    for (const pack of packs) {
      const name = path.basename(path.resolve(pack.dir))
      const from = path.join(rootPacksDir, name)
      const to = path.join(packsDir, name)
      await fs.cp(from, to, { recursive: true, errorOnExist: false }).catch(() => {})
      pack.dir = to
    }
    await fs.cp(path.join(rootDataDir, 'resources'), path.join(dataDir, 'resources'), {
      recursive: true,
      errorOnExist: false,
    }).catch(() => {})
    await fs.writeFile(path.join(dataDir, 'store.json'), JSON.stringify(parsed, null, 2))
  }

  /** Create the private workspace. Called on the visitor's first write. */
  async claim(id: string, ip: string, returning = false): Promise<ClaimResult> {
    if (this.workspaces.size >= MAX_WORKSPACES) {
      return { ok: false, error: '公开体验名额已满，请稍后再试。' }
    }
    // Only new identities count against the IP budget. A returning visitor lost
    // its scratch workspace to a restart, and must always get it back.
    if (!returning && !this.mayClaim(ip)) {
      return { ok: false, error: '今天创建的独立空间太多了，请明天再试。' }
    }
    const target = this.workspaceDir(id)
    await fs.mkdir(target, { recursive: true })
    await this.seed(id)
    const record = this.visits.get(id)
    if (record) {
      record.claimed = true
      this.markDirty()
    }
    // Drop any stale demo view so the next request sees the private data root.
    this.workspaces.delete(id)
    return { ok: true }
  }

  /** Called when a page is open and visible; this is what "online" means. */
  heartbeat(id: string): void {
    const record = this.visits.get(id)
    if (!record) return
    const now = Date.now()
    if (record.active && now - record.active < 30 * 1000) return
    record.active = now
    record.last = now
    this.markDirty()
  }

  stats(): PublicStats {
    const now = Date.now()
    let online = 0
    for (const record of this.visits.values()) {
      if (record.active && now - record.active <= this.demoIntervalMs) online += 1
    }
    return { totalUsers: this.visits.size, online }
  }

  async resolve(request: IncomingMessage, response: ServerResponse): Promise<{
    workspace: Workspace
    store: Store
    visitorId: string
    personal: boolean
    claimError?: string
  }> {
    const method = request.method ?? 'GET'
    const ip = request.socket.remoteAddress ?? 'unknown'
    const secure = request.headers['x-forwarded-proto'] === 'https'

    // Local and LAN use are single-user; they keep the original data/ and packs/.
    if (!publicModeEnabled()) {
      return { workspace: rootWorkspaceRef(), store: this.demoStore, visitorId: 'local', personal: false }
    }

    await this.ensureLoaded()

    if (looksLikeBot(request)) {
      return { workspace: this.demo(), store: this.demoStore, visitorId: 'bot', personal: false }
    }

    let id = readCookie(request, VISITOR_COOKIE)
    let created = false
    // Optional owner link: `?owner=<LEARN_OWNER_KEY>` pins a stable workspace
    // so the site owner keeps one identity across browsers.
    const ownerKey = process.env.LEARN_OWNER_KEY?.trim()
    if (ownerKey && ownerKey.length >= 16) {
      const requested = new URL(request.url ?? '/', 'http://localhost').searchParams.get('owner')
      if (requested === ownerKey) {
        id = ownerVisitorId()
        created = true
      }
    }
    // A device must always get its own identity. Sharing one by IP would merge
    // two people's workspaces, which is far worse than an inflated counter.
    if (!id || !isSafeVisitorId(id)) {
      id = newVisitorId()
      created = true
    }
    if (isSafeVisitorId(id) === false) id = newVisitorId()

    if (readCookie(request, VISITOR_COOKIE) !== id) {
      response.setHeader('set-cookie', visitorCookie(id, secure))
    }
    this.noteVisit(id, ip, created)

    const personal = await this.hasWorkspace(id)
    if (!personal) {
      // Feedback and previews do not need a workspace: nothing is stored for
      // the visitor, so claiming one would just create an empty directory.
      const statelessWrite =
        isWriteMethod(method) &&
        ((request.url ?? '').startsWith('/api/feedback') || (request.url ?? '').startsWith('/api/preview'))
      if (!isWriteMethod(method) || statelessWrite) {
        return { workspace: this.demo(), store: this.demoStore, visitorId: id, personal: false }
      }
      const claimed = await this.claim(id, ip, created === false)
      if (!claimed.ok) {
        return {
          workspace: this.demo(),
          store: this.demoStore,
          visitorId: id,
          personal: false,
          claimError: claimed.error,
        }
      }
    }

    const workspace = this.workspaceFor(id)
    const store = await this.storeFor(workspace)
    return { workspace, store, visitorId: id, personal: true }
  }

  /**
   * The browser is the source of truth. When it reconnects after a restart (or
   * after its scratch workspace expired) it uploads everything it kept.
   */
  async hydrate(id: string, files: Record<string, string>): Promise<number> {
    const target = this.workspaceDir(id)
    await fs.rm(target, { recursive: true, force: true }).catch(() => {})
    await fs.mkdir(target, { recursive: true })
    let written = 0
    for (const [relative, content] of Object.entries(files)) {
      if (!isSafeRelativePath(relative)) continue
      if (typeof content !== 'string') continue
      const file = path.join(target, relative)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, content)
      written += 1
    }
    // Reopen from the hydrated files instead of any stale in-memory store.
    this.workspaces.delete(id)
    this.stores.delete(id)
    return written
  }

  /** Snapshot the scratch workspace and return everything that changed. */
  async capture(id: string, hint?: string): Promise<void> {
    const root = this.workspaceDir(id)
    const current = await collectWorkspaceFiles(root, hint)
    const previous = this.syncState.get(id)
    const pending = this.pendingChanges.get(id) ?? new Map<string, string>()
    for (const [relative, stamp] of current) {
      if (previous?.get(relative) === stamp) continue
      try {
        pending.set(relative, await fs.readFile(path.join(root, relative), 'utf8'))
      } catch {
        // A file that vanished between listing and reading is simply skipped.
      }
    }
    this.syncState.set(id, current)
    this.pendingChanges.set(id, pending)
  }

  takeChanges(id: string): Array<{ path: string; content: string }> {
    const pending = this.pendingChanges.get(id)
    if (!pending || pending.size === 0) return []
    this.pendingChanges.set(id, new Map())
    return [...pending.entries()].map(([file, content]) => ({ path: file, content }))
  }

  hasChanges(id: string): boolean {
    return (this.pendingChanges.get(id)?.size ?? 0) > 0
  }

  /** Number of private workspaces on disk, used by the guests CLI. */
  static async listWorkspaces(): Promise<{ id: string; size: number; packs: number }[]> {
    const root = path.join(rootDataDir, 'users')
    const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => [])
    const results: { id: string; size: number; packs: number }[] = []
    for (const entry of entries) {
      if (!entry.isDirectory() || !isSafeVisitorId(entry.name)) continue
      const dir = path.join(root, entry.name)
      results.push({ id: entry.name, size: await directorySize(dir), packs: await countPacks(dir) })
    }
    return results.sort((a, b) => b.size - a.size)
  }
}

async function directorySize(dir: string, limit = Number.POSITIVE_INFINITY): Promise<number> {
  let total = 0
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      total += await directorySize(file, limit - total)
      if (total > limit) return total
      continue
    }
    const stat = await fs.stat(file).catch(() => undefined)
    if (stat?.isFile()) total += stat.size
    if (total > limit) return total
  }
  return total
}

async function countPacks(dir: string): Promise<number> {
  const entries = await fs.readdir(path.join(dir, 'packs'), { withFileTypes: true }).catch(() => [])
  return entries.filter((entry) => entry.isDirectory()).length
}

const SKIP_DIRS = new Set(['cache', 'backups', 'trash', 'uploads', 'exports', 'lab'])
const SKIP_EXT = /\.(mp3|m4a|wav|ogg|opus|png|jpe?g|gif|webp|pdf|epub|mobi|azw3|docx)$/i
const MAX_SYNC_FILES = 3000

function isSafeRelativePath(value: string): boolean {
  if (!value || value.length > 400) return false
  if (value.startsWith('/') || value.includes('\\')) return false
  if (value.split('/').some((part) => part === '..' || part === '')) return false
  return /^[A-Za-z0-9._\-/]+$/.test(value)
}

/**
 * List the text files worth keeping in the browser. Audio and caches are
 * derived data, so they are regenerated instead of transferred.
 */
async function collectWorkspaceFiles(root: string, hint?: string): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const walk = async (dir: string, prefix: string, depth: number): Promise<void> => {
    if (depth > 3) return
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        await walk(path.join(dir, entry.name), relative, depth + 1)
        continue
      }
      if (!entry.isFile() || SKIP_EXT.test(entry.name)) continue
      const stat = await fs.stat(path.join(dir, entry.name)).catch(() => undefined)
      if (!stat) continue
      out.set(relative, `${stat.size}:${Math.round(stat.mtimeMs)}`)
    }
  }
  await walk(root, '', 0)
  if (out.size > MAX_SYNC_FILES && hint) {
    const filtered = new Map<string, string>()
    for (const [relative, stamp] of out) {
      if (relative === 'store.json' || relative.includes(hint)) filtered.set(relative, stamp)
    }
    return filtered
  }
  return out
}

export const WORKSPACE_LIMIT_BYTES = 250 * 1024 * 1024

/** Public workspaces are capped so one visitor cannot fill the server disk. */
export async function assertWorkspaceCapacity(workspace: Workspace): Promise<void> {
  const used =
    (await directorySize(workspace.dataDir, WORKSPACE_LIMIT_BYTES)) +
    (await directorySize(workspace.packsDir, WORKSPACE_LIMIT_BYTES))
  if (used >= WORKSPACE_LIMIT_BYTES) {
    throw new Error('这个空间已满（250 MB 上限），请先删除一些文章。')
  }
}

export interface PruneResult {
  id: string
  size: number
  lastSeen: number | null
  removed: boolean
}

/**
 * Delete visitor workspaces that have been idle for `days`. Deleting user data
 * is destructive, so the caller must opt in explicitly.
 */
export async function pruneWorkspaces(options: {
  days: number
  dryRun: boolean
}): Promise<PruneResult[]> {
  const root = path.join(rootDataDir, 'users')
  const cutoff = Date.now() - options.days * 24 * 60 * 60 * 1000
  let visits: Record<string, VisitRecord> = {}
  try {
    const raw = await fs.readFile(path.join(rootDataDir, 'community', 'visits.json'), 'utf8')
    const parsed = JSON.parse(raw) as VisitFile
    if (parsed?.visitors && typeof parsed.visitors === 'object') visits = parsed.visitors
  } catch {
    // Without an activity log fall back to the directory mtime.
  }

  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => [])
  const results: PruneResult[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeVisitorId(entry.name)) continue
    const dir = path.join(root, entry.name)
    const record = visits[entry.name]
    const stat = await fs.stat(dir).catch(() => undefined)
    const lastSeen = record?.last ?? stat?.mtimeMs ?? null
    if (lastSeen === null || lastSeen > cutoff) continue
    const size = await directorySize(dir)
    let removed = false
    if (!options.dryRun) {
      await fs.rm(dir, { recursive: true, force: true }).then(() => {
        removed = true
      })
      delete visits[entry.name]
    }
    results.push({ id: entry.name, size, lastSeen, removed })
  }
  if (!options.dryRun && results.length > 0) {
    const payload: VisitFile = { version: 1, visitors: visits }
    await fs.mkdir(path.join(rootDataDir, 'community'), { recursive: true })
    await fs.writeFile(path.join(rootDataDir, 'community', 'visits.json'), JSON.stringify(payload))
  }
  return results.sort((a, b) => b.size - a.size)
}

export { VISITOR_COOKIE, ONLINE_WINDOW_MS }
