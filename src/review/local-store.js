/**
 * Browser-local workspace storage.
 *
 * The public deployment keeps no user content on the server, so every article,
 * learning item, reading position, note and output lives here, inside the
 * visitor's own browser. This module is plain ESM with no DOM assumptions so
 * the same code runs in the page and under `node --test`.
 *
 * The shape of a record is deliberately opaque: the store is a keyed document
 * store, and only the snapshot envelope is a contract. That keeps storage from
 * drifting out of sync with the pack schema.
 */

export const SNAPSHOT_KIND = 'closeread-workspace'
export const SNAPSHOT_VERSION = 1

/** Object stores. `meta` holds one row per setting; the rest are keyed records. */
export const STORES = [
  'meta',
  'packs',
  'resources',
  'items',
  'progress',
  'notes',
  'outputs',
  'quotes',
  'keys',
]

/** Refuse absurd imports before they are written to the browser. */
export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024 * 1024

export const DEFAULT_PREFERENCES = {
  desiredRetention: 0.9,
  dailyNewTarget: 10,
  dailyReviewTarget: 10,
  weeklyArticleGoal: 3,
  weeklyStudyDaysGoal: 5,
}

export function isStoreName(name) {
  return STORES.includes(name)
}

/** Deep-ish copy for plain JSON data, used so callers cannot mutate stored rows. */
function clone(value) {
  if (value === null || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value))
}

function recordKey(store, value) {
  if (!isStoreName(store)) throw new Error(`Unknown store: ${store}`)
  if (store === 'meta') {
    if (typeof value !== 'object' || value === null) throw new Error('meta value must be an object')
    return 'settings'
  }
  const key = value && typeof value === 'object' ? value.id ?? value.key : undefined
  if (typeof key !== 'string' || !key) {
    throw new Error(`${store} records need a string id`)
  }
  return key
}

/** In-memory driver: keeps the store logic testable without a browser. */
export class MemoryDriver {
  constructor() {
    this.data = new Map(STORES.map((name) => [name, new Map()]))
  }

  async open() {}

  async get(store, key) {
    const map = this.data.get(store)
    if (!map || !map.has(key)) return undefined
    return clone(map.get(key))
  }

  async put(store, key, value) {
    const map = this.data.get(store)
    if (!map) throw new Error(`Unknown store: ${store}`)
    map.set(key, clone(value))
  }

  async delete(store, key) {
    this.data.get(store)?.delete(key)
  }

  async entries(store) {
    const map = this.data.get(store)
    if (!map) return []
    return [...map.entries()].map(([key, value]) => [key, clone(value)])
  }

  async clear(store) {
    this.data.get(store)?.clear()
  }
}

/** IndexedDB driver used by the page. One object store per entity type. */
export class IndexedDbDriver {
  constructor(databaseName = 'closeread') {
    this.databaseName = databaseName
    this.db = null
    this.opening = null
  }

  async open() {
    if (this.db) return this.db
    if (this.opening) return this.opening
    this.opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, SNAPSHOT_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
        }
      }
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    })
    return this.opening
  }

  async transaction(store, mode, run) {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode)
      let result
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
      const request = run(tx.objectStore(store))
      request.onsuccess = () => {
        result = request.result
      }
    })
  }

  async get(store, key) {
    return this.transaction(store, 'readonly', (objectStore) => objectStore.get(key))
  }

  async put(store, key, value) {
    await this.transaction(store, 'readwrite', (objectStore) =>
      objectStore.put(clone(value), key),
    )
  }

  async delete(store, key) {
    await this.transaction(store, 'readwrite', (objectStore) => objectStore.delete(key))
  }

  async entries(store) {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly')
      const request = tx.objectStore(store).openCursor()
      const rows = []
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) {
          resolve(rows)
          return
        }
        rows.push([String(cursor.key), cursor.value])
        cursor.continue()
      }
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
    })
  }

  async clear(store) {
    await this.transaction(store, 'readwrite', (objectStore) => objectStore.clear())
  }
}

export class LocalStore {
  constructor(driver = new MemoryDriver()) {
    this.driver = driver
  }

  async open() {
    await this.driver.open()
    return this
  }

  async getSettings() {
    const stored = await this.driver.get('meta', 'settings')
    if (!stored || typeof stored !== 'object') {
      return { preferences: { ...DEFAULT_PREFERENCES } }
    }
    return {
      ...stored,
      preferences: { ...DEFAULT_PREFERENCES, ...(stored.preferences ?? {}) },
    }
  }

  async saveSettings(patch) {
    const current = await this.getSettings()
    const next = { ...current, ...patch }
    next.preferences = { ...current.preferences, ...(patch?.preferences ?? {}) }
    await this.driver.put('meta', 'settings', next)
    return next
  }

  async put(store, value) {
    const key = recordKey(store, value)
    await this.driver.put(store, key, value)
    return key
  }

  async putMany(store, values) {
    for (const value of values) await this.put(store, value)
    return values.length
  }

  async get(store, key) {
    return this.driver.get(store, key)
  }

  async delete(store, key) {
    await this.driver.delete(store, key)
  }

  async list(store) {
    const rows = await this.driver.entries(store)
    return rows.map(([, value]) => value)
  }

  async count(store) {
    return (await this.driver.entries(store)).length
  }

  async clearAll() {
    for (const store of STORES) await this.driver.clear(store)
  }

  /** Everything that belongs to the visitor, in one transferable object. */
  async exportSnapshot(options = {}) {
    const stores = {}
    for (const name of STORES) {
      if (name === 'keys' && options.includeKeys !== true) continue
      stores[name] = Object.fromEntries(await this.driver.entries(name))
    }
    return {
      kind: SNAPSHOT_KIND,
      version: SNAPSHOT_VERSION,
      exportedAt: new Date().toISOString(),
      app: options.app ?? 'closeread',
      stores,
    }
  }

  async serialize(options = {}) {
    return JSON.stringify(await this.exportSnapshot(options))
  }

  async importSnapshot(snapshot, options = {}) {
    const checked = validateSnapshot(snapshot)
    if (!checked.ok) throw new Error(checked.error)
    const mode = options.mode === 'replace' ? 'replace' : 'merge'
    if (mode === 'replace') await this.clearAll()
    const summary = { added: 0, replaced: 0, packs: 0, items: 0 }
    for (const [name, records] of Object.entries(checked.snapshot.stores)) {
      const existing = await this.driver.entries(name)
      const known = new Set(existing.map(([key]) => key))
      for (const [key, value] of Object.entries(records)) {
        await this.driver.put(name, key, value)
        if (known.has(key)) summary.replaced += 1
        else summary.added += 1
        if (name === 'packs') summary.packs += 1
        if (name === 'items') summary.items += 1
      }
    }
    return summary
  }
}

/**
 * Check an imported file before touching storage. A wrong file must not be able
 * to wipe a workspace, so the structure is verified field by field.
 */
export function validateSnapshot(raw) {
  let snapshot = raw
  if (typeof raw === 'string') {
    if (raw.length > MAX_SNAPSHOT_BYTES) return { ok: false, error: '文件太大。' }
    try {
      snapshot = JSON.parse(raw)
    } catch {
      return { ok: false, error: '不是有效的 JSON 文件。' }
    }
  }
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { ok: false, error: '文件结构不正确。' }
  }
  if (snapshot.kind !== SNAPSHOT_KIND) {
    return { ok: false, error: '这不是 CloseRead 的迁移文件。' }
  }
  if (!Number.isInteger(snapshot.version) || snapshot.version < 1) {
    return { ok: false, error: '文件版本无法识别。' }
  }
  if (snapshot.version > SNAPSHOT_VERSION) {
    return { ok: false, error: '文件来自更新的版本，请先刷新页面。' }
  }
  if (!snapshot.stores || typeof snapshot.stores !== 'object' || Array.isArray(snapshot.stores)) {
    return { ok: false, error: '文件缺少内容区。' }
  }
  const stores = {}
  for (const [name, records] of Object.entries(snapshot.stores)) {
    if (!isStoreName(name)) return { ok: false, error: `未知的数据分区：${name}` }
    if (!records || typeof records !== 'object' || Array.isArray(records)) {
      return { ok: false, error: `数据分区 ${name} 结构不正确。` }
    }
    stores[name] = records
  }
  return { ok: true, snapshot: { ...snapshot, stores } }
}

/** Counts shown in the import dialog so nobody overwrites data blindly. */
export function describeSnapshot(snapshot) {
  const stores = snapshot?.stores ?? {}
  const count = (name) => Object.keys(stores[name] ?? {}).length
  return {
    exportedAt: typeof snapshot?.exportedAt === 'string' ? snapshot.exportedAt : '',
    packs: count('packs'),
    resources: count('resources'),
    items: count('items'),
    notes: count('notes'),
    hasKeys: count('keys') > 0,
  }
}
