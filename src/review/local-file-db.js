/**
 * The browser's durable copy of a CloseRead workspace.
 *
 * The server keeps a scratch directory only while a session is active; this
 * module is where the real copy lives. It stores the same files the server
 * would write (store.json, packs/<id>/pack.json, reading progress, notes), so a
 * workspace can be hydrated back after a restart or moved to another device.
 */

import { strFromU8, strToU8, unzipSync, zipSync } from './vendor/fflate.js'

const DB_NAME = 'closeread'
const DB_VERSION = 1
const STORE = 'files'
export const SNAPSHOT_KIND = 'closeread-workspace'
export const SNAPSHOT_VERSION = 1
export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024 * 1024

let dbPromise

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'path' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB unavailable'))
  })
  return dbPromise
}

/** Ask the browser not to evict this origin under storage pressure. */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist()
  } catch {
    // Persistence is a hint; ignore failures.
  }
  return false
}

export async function storageInfo() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate()
      return { usage: estimate.usage || 0, quota: estimate.quota || 0 }
    }
  } catch {
    // Fall through to zeros.
  }
  return { usage: 0, quota: 0 }
}

export async function loadAll() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly')
    const request = transaction.objectStore(STORE).openCursor()
    const files = {}
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve(files)
        return
      }
      files[cursor.value.path] = cursor.value.content
      cursor.continue()
    }
    request.onerror = () => reject(request.error || new Error('IndexedDB read failed'))
  })
}

export async function saveFiles(entries) {
  const list = Array.isArray(entries) ? entries : []
  if (list.length === 0) return 0
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    let written = 0
    for (const entry of list) {
      if (!entry || typeof entry.path !== 'string') continue
      store.put({ path: entry.path, content: String(entry.content ?? '') })
      written += 1
    }
    transaction.oncomplete = () => resolve(written)
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB write failed'))
  })
}

export async function clearAll() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).clear()
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB clear failed'))
  })
}

export async function summary() {
  const files = await loadAll()
  const paths = Object.keys(files)
  let packs = 0
  for (const file of paths) if (/(^|\/)packs\/[^/]+\/pack\.json$/.test(file)) packs += 1
  const bytes = paths.reduce((total, file) => total + (files[file] || '').length, 0)
  return { files: paths.length, packs, bytes }
}

/** A zip with `manifest.json` plus every workspace file under `files/`. */
export async function exportZip() {
  const files = await loadAll()
  const entries = {}
  for (const [name, content] of Object.entries(files)) entries[`files/${name}`] = strToU8(content)
  entries['manifest.json'] = strToU8(
    JSON.stringify({
      kind: SNAPSHOT_KIND,
      version: SNAPSHOT_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'closeread',
      files: Object.keys(files).length,
    }),
  )
  return zipSync(entries, { level: 6 })
}

/** Accept both the zip format and the older single JSON file. */
export async function importAny(input) {
  if (input instanceof Uint8Array) {
    const unzipped = unzipSync(input)
    const manifestRaw = unzipped['manifest.json']
    if (!manifestRaw) throw new Error('压缩包里缺少 manifest.json。')
    const manifest = JSON.parse(strFromU8(manifestRaw))
    if (manifest.kind !== SNAPSHOT_KIND) throw new Error('这不是 CloseRead 的迁移包。')
    const files = {}
    for (const [name, data] of Object.entries(unzipped)) {
      if (!name.startsWith('files/')) continue
      const relative = name.slice('files/'.length)
      if (!isSafePath(relative)) continue
      files[relative] = strFromU8(data)
    }
    const count = Object.keys(files).length
    if (count === 0) throw new Error('压缩包里没有可用的内容。')
    await clearAll()
    await saveFiles(Object.entries(files).map(([path, content]) => ({ path, content })))
    return { files: count }
  }
  return importText(String(input))
}

export async function exportText() {
  const files = await loadAll()
  return JSON.stringify(
    {
      kind: SNAPSHOT_KIND,
      version: SNAPSHOT_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'closeread',
      files,
    },
    null,
    0,
  )
}

export function validate(text) {
  if (typeof text !== 'string' || text.length === 0) return { ok: false, error: '文件是空的。' }
  if (text.length > MAX_SNAPSHOT_BYTES) return { ok: false, error: '文件太大。' }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: '不是有效的 JSON 文件。' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: '文件结构不正确。' }
  }
  if (parsed.kind !== SNAPSHOT_KIND) return { ok: false, error: '这不是 CloseRead 的迁移文件。' }
  if (!Number.isInteger(parsed.version) || parsed.version < 1) {
    return { ok: false, error: '文件版本无法识别。' }
  }
  if (parsed.version > SNAPSHOT_VERSION) {
    return { ok: false, error: '文件来自更新的版本，请先刷新页面。' }
  }
  const files = parsed.files
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    return { ok: false, error: '文件缺少内容。' }
  }
  const cleaned = {}
  for (const [file, content] of Object.entries(files)) {
    if (typeof file !== 'string' || typeof content !== 'string') continue
    if (!isSafePath(file)) continue
    cleaned[file] = content
  }
  if (Object.keys(cleaned).length === 0) return { ok: false, error: '文件里没有可用的内容。' }
  return { ok: true, snapshot: { ...parsed, files: cleaned } }
}

function isSafePath(value) {
  if (!value || value.length > 400) return false
  if (value.startsWith('/') || value.includes('\\')) return false
  if (value.split('/').some((part) => part === '..' || part === '')) return false
  return /^[A-Za-z0-9._\-/]+$/.test(value)
}

export async function describe(text) {
  const result = validate(text)
  if (!result.ok) return result
  const files = result.snapshot.files
  const paths = Object.keys(files)
  let packs = 0
  for (const file of paths) if (/(^|\/)packs\/[^/]+\/pack\.json$/.test(file)) packs += 1
  return {
    ok: true,
    exportedAt: result.snapshot.exportedAt || '',
    packs,
    files: paths.length,
    bytes: paths.reduce((total, file) => total + files[file].length, 0),
  }
}

/** Replace the local copy with an imported workspace. */
export async function importText(text) {
  const result = validate(text)
  if (!result.ok) throw new Error(result.error)
  await clearAll()
  const entries = Object.entries(result.snapshot.files).map(([path, content]) => ({ path, content }))
  await saveFiles(entries)
  return { files: entries.length }
}
