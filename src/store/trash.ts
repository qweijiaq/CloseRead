import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { config } from '../config.js'
import { loadPack } from '../pack/mutate.js'
import type { PackRecord, Resource, StoredItem } from '../types.js'
import type { Store } from './store.js'

export interface TrashPack {
  record: PackRecord
  items: StoredItem[]
  dirName: string
}

export interface TrashEntry {
  id: string
  kind: 'pack' | 'resource'
  title: string
  deletedAt: string
  packs: TrashPack[]
  resource?: Resource
  uploadName?: string
}

export interface TrashView {
  id: string
  kind: 'pack' | 'resource'
  title: string
  deletedAt: string
  packCount: number
  itemCount: number
  hasResource: boolean
}

function root(): string {
  return path.join(config.dataDir, 'trash')
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
}

function safeName(value: string): string {
  return path.basename(value).replace(/[^\w.\-]+/g, '_') || 'item'
}

async function move(source: string, target: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true })
  try {
    await fs.rename(source, target)
  } catch {
    await fs.cp(source, target, { recursive: true, force: true })
    await fs.rm(source, { recursive: true, force: true })
  }
}

async function writeManifest(dir: string, entry: TrashEntry): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(entry, null, 2), 'utf8')
}

function itemsForPack(
  store: Store,
  record: PackRecord,
  contents: { items: Array<{ id: string }> } | undefined,
): StoredItem[] {
  const ids = new Set<string>([
    ...(contents?.items.map((item) => item.id) ?? []),
    ...store
      .listItems()
      .filter((item) => item.contexts.some((context) => context.resourceId === record.resourceId))
      .map((item) => item.id),
  ])
  return [...ids]
    .map((id) => store.getItem(id))
    .filter((item): item is StoredItem => Boolean(item))
}

/** Move one pack folder and its library snapshots into the local trash. */
export async function trashPack(store: Store, record: PackRecord): Promise<TrashEntry> {
  const id = `${stamp()}-${randomUUID().slice(0, 8)}`
  const dir = path.join(root(), id)
  let contents: { items: Array<{ id: string }> } | undefined
  try {
    contents = await loadPack(record.dir)
  } catch {
    // The folder may already be missing; the store record is still recoverable.
  }
  const entry: TrashEntry = {
    id,
    kind: 'pack',
    title: record.title ?? store.getResource(record.resourceId)?.title ?? record.id,
    deletedAt: new Date().toISOString(),
    packs: [
      {
        record,
        items: itemsForPack(store, record, contents),
        dirName: safeName(record.dir),
      },
    ],
  }
  if (contents) {
    await move(record.dir, path.join(dir, 'pack'))
  }
  await writeManifest(dir, entry)
  return entry
}

/** Move all pack folders, the resource file and its upload into the local trash. */
export async function trashResource(store: Store, resource: Resource): Promise<TrashEntry> {
  const id = `${stamp()}-${randomUUID().slice(0, 8)}`
  const dir = path.join(root(), id)
  const related = store.packs().filter(
    (pack) =>
      pack.resourceId === resource.id ||
      pack.parentResourceId === resource.id ||
      pack.resourceId.startsWith(`${resource.id}--a`),
  )
  const packs: TrashPack[] = []
  for (const [index, record] of related.entries()) {
    let contents: { items: Array<{ id: string }> } | undefined
    try {
      contents = await loadPack(record.dir)
    } catch {
      // Still keep the record; a missing folder should not block deletion.
    }
    packs.push({
      record,
      items: itemsForPack(store, record, contents),
      dirName: safeName(record.dir),
    })
    if (contents) {
      await move(record.dir, path.join(dir, 'packs', String(index)))
    }
  }
  const uploadPath = typeof resource.metadata.uploadPath === 'string' ? resource.metadata.uploadPath : undefined
  const entry: TrashEntry = {
    id,
    kind: 'resource',
    title: resource.title,
    deletedAt: new Date().toISOString(),
    packs,
    resource,
    ...(uploadPath ? { uploadName: safeName(uploadPath) } : {}),
  }
  if (uploadPath) {
    try {
      await move(uploadPath, path.join(dir, 'upload', path.basename(uploadPath)))
    } catch {
      // The upload may have been removed already.
    }
  }
  await writeManifest(dir, entry)
  return entry
}

async function readEntry(dir: string): Promise<TrashEntry | undefined> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8')) as TrashEntry
    if (!raw || typeof raw.id !== 'string' || (raw.kind !== 'pack' && raw.kind !== 'resource')) return undefined
    return raw
  } catch {
    return undefined
  }
}

const TRASH_MAX_AGE_DAYS = 30

async function pruneOldEntries(): Promise<void> {
  let names: string[] = []
  try {
    names = await fs.readdir(root())
  } catch {
    return
  }
  const cutoff = Date.now() - TRASH_MAX_AGE_DAYS * 86_400_000
  for (const name of names) {
    const dir = path.join(root(), name)
    const entry = await readEntry(dir)
    if (!entry) continue
    const deletedAt = Date.parse(entry.deletedAt)
    if (Number.isFinite(deletedAt) && deletedAt < cutoff) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }
}

export async function listTrash(): Promise<TrashView[]> {
  await pruneOldEntries()
  let names: string[] = []
  try {
    names = await fs.readdir(root())
  } catch {
    return []
  }
  const entries: TrashView[] = []
  for (const name of names) {
    const dir = path.join(root(), name)
    const entry = await readEntry(dir)
    if (!entry) continue
    entries.push({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      deletedAt: entry.deletedAt,
      packCount: entry.packs.length,
      itemCount: entry.packs.reduce((sum, pack) => sum + pack.items.length, 0),
      hasResource: Boolean(entry.resource),
    })
  }
  return entries.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
}

export async function restoreTrash(
  store: Store,
  id: string,
): Promise<{ kind: 'pack' | 'resource'; title: string; packs: number; items: number }> {
  const dir = path.join(root(), safeName(id))
  const entry = await readEntry(dir)
  if (!entry) throw new Error('回收站条目不存在。')
  if (entry.kind === 'pack') {
    const pack = entry.packs[0]
    if (!pack) throw new Error('回收站条目缺少学习包。')
    if (store.findPack(pack.record.id)) throw new Error('这个学习包已经存在，无法重复恢复。')
    const target = path.join(config.packsDir, pack.dirName)
    try {
      await fs.access(target)
      throw new Error(`目标目录已存在：${target}`)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('目标目录')) throw error
    }
    const source = path.join(dir, 'pack')
    try {
      await fs.access(source)
      await move(source, target)
    } catch {
      // A record-only deletion can still restore the metadata.
    }
    await store.addPack({ ...pack.record, dir: target })
    await store.restoreItems(pack.items)
    await fs.rm(dir, { recursive: true, force: true })
    return { kind: 'pack', title: entry.title, packs: 1, items: pack.items.length }
  }

  if (!entry.resource) throw new Error('回收站条目缺少导入材料。')
  if (store.getResource(entry.resource.id)) throw new Error('这份材料已经存在，无法重复恢复。')
  for (const [index, pack] of entry.packs.entries()) {
    const target = path.join(config.packsDir, pack.dirName)
    if (store.findPack(pack.record.id)) continue
    try {
      await fs.access(target)
      throw new Error(`目标目录已存在：${target}`)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('目标目录')) throw error
    }
    const source = path.join(dir, 'packs', String(index))
    try {
      await fs.access(source)
      await move(source, target)
    } catch {
      // Keep the record even if its folder was already missing.
    }
    await store.addPack({ ...pack.record, dir: target })
    await store.restoreItems(pack.items)
  }
  if (entry.uploadName) {
    const source = path.join(dir, 'upload', path.basename(entry.uploadName))
    try {
      await fs.access(source)
      const uploadTarget = path.join(config.dataDir, 'uploads', path.basename(entry.uploadName))
      await move(source, uploadTarget)
      entry.resource.metadata.uploadPath = uploadTarget
    } catch {
      // Upload restoration is best effort.
    }
  }
  await store.addResource(entry.resource)
  await fs.rm(dir, { recursive: true, force: true })
  return {
    kind: 'resource',
    title: entry.title,
    packs: entry.packs.length,
    items: entry.packs.reduce((sum, pack) => sum + pack.items.length, 0),
  }
}

export async function purgeTrash(id: string): Promise<boolean> {
  const dir = path.join(root(), safeName(id))
  try {
    await fs.access(dir)
    await fs.rm(dir, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}
