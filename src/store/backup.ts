import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { Resource } from '../types.js'
import type { Store, StoreData } from './store.js'

interface BackupFile {
  path: string
  encoding: 'utf8' | 'base64'
  content: string
}

interface BackupPack {
  name: string
  files: BackupFile[]
}

export interface LibraryBackup {
  format: 'closeread-library'
  version: 1
  exportedAt: string
  store: StoreData
  resources: Resource[]
  /** Pack folders and reading.json. Optional for backward compatibility. */
  packs?: BackupPack[]
  /** Local quote wall, when present. */
  quotes?: unknown
}

export interface BackupResult {
  file: string
  items: number
  packs: number
  logs: number
  outputs: number
  resources: number
}

const SAFE_RESOURCE_ID = /^[A-Za-z0-9._-]+$/
const TEXT_EXTENSIONS = new Set(['.json', '.md', '.csv', '.html', '.txt', '.css', '.js', '.mjs'])
const SAFE_RELATIVE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/

function stamp(now: Date = new Date()): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
}

async function walkFiles(root: string, current = ''): Promise<string[]> {
  const dir = path.join(root, current)
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const result: string[] = []
  for (const entry of entries) {
    const relative = current ? path.join(current, entry.name) : entry.name
    if (entry.isDirectory()) {
      result.push(...(await walkFiles(root, relative)))
    } else if (entry.isFile()) {
      result.push(relative)
    }
  }
  return result
}

async function collectPacks(store: Store): Promise<BackupPack[]> {
  const packs: BackupPack[] = []
  const seen = new Set<string>()
  for (const record of store.packs()) {
    const name = path.basename(record.dir)
    if (!name || !SAFE_RESOURCE_ID.test(name) || seen.has(name)) continue
    const files: BackupFile[] = []
    for (const relative of await walkFiles(record.dir)) {
      if (!SAFE_RELATIVE.test(relative) || relative.includes('..')) continue
      try {
        const bytes = await fs.readFile(path.join(record.dir, relative))
        if (TEXT_EXTENSIONS.has(path.extname(relative).toLowerCase())) {
          files.push({ path: relative, encoding: 'utf8', content: bytes.toString('utf8') })
        } else {
          files.push({ path: relative, encoding: 'base64', content: bytes.toString('base64') })
        }
      } catch {
        // A deleted or unreadable file should not abort the whole backup.
      }
    }
    if (files.length) {
      seen.add(name)
      packs.push({ name, files })
    }
  }
  return packs
}

async function readQuotes(dataDir: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await fs.readFile(path.join(dataDir, 'quotes.json'), 'utf8')) as unknown
  } catch {
    return undefined
  }
}

async function writeAtomic(file: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${randomUUID()}.tmp`
  await fs.writeFile(temp, contents, 'utf8')
  try {
    await fs.rename(temp, file)
  } catch {
    // Windows refuses rename-over-existing; fall back to a copy.
    await fs.copyFile(temp, file)
    await fs.rm(temp, { force: true }).catch(() => {})
  }
}

function validate(value: unknown): LibraryBackup {
  if (!value || typeof value !== 'object') throw new Error('Backup is not a CloseRead library file.')
  const backup = value as Partial<LibraryBackup>
  if (backup.format !== 'closeread-library' || backup.version !== 1) {
    throw new Error('Backup format is not supported. Expected a closeread-library v1 file.')
  }
  const store = backup.store
  if (
    !store ||
    typeof store !== 'object' ||
    !Array.isArray(store.items) ||
    !Array.isArray(store.packs) ||
    !Array.isArray(store.logs) ||
    !Array.isArray(store.outputs) ||
    !store.preferences ||
    typeof store.preferences !== 'object'
  ) {
    throw new Error('Backup does not contain a valid store.')
  }
  if (!Array.isArray(backup.resources)) throw new Error('Backup does not contain a resource list.')
  for (const resource of backup.resources) {
    if (!resource || typeof resource !== 'object') throw new Error('Backup contains an invalid resource.')
    if (typeof resource.id !== 'string' || !SAFE_RESOURCE_ID.test(resource.id)) {
      throw new Error(`Backup contains an unsafe resource id: ${String(resource.id)}`)
    }
    if (typeof resource.title !== 'string') throw new Error('Backup contains a resource without a title.')
  }
  if (backup.packs !== undefined) {
    if (!Array.isArray(backup.packs)) throw new Error('Backup pack list is invalid.')
    for (const pack of backup.packs) {
      if (!pack || typeof pack.name !== 'string' || !SAFE_RESOURCE_ID.test(pack.name)) {
        throw new Error(`Backup contains an unsafe pack name: ${String(pack?.name)}`)
      }
      if (!Array.isArray(pack.files)) throw new Error(`Backup pack ${pack.name} has no file list.`)
      for (const file of pack.files) {
        if (
          !file ||
          typeof file.path !== 'string' ||
          !SAFE_RELATIVE.test(file.path) ||
          file.path.includes('..') ||
          (file.encoding !== 'utf8' && file.encoding !== 'base64') ||
          typeof file.content !== 'string'
        ) {
          throw new Error(`Backup pack ${pack.name} contains an unsafe file.`)
        }
      }
    }
  }
  return backup as LibraryBackup
}

/** Write the library (store + resources) to one portable JSON file. */
export async function writeLibraryBackup(store: Store, target: string): Promise<BackupResult> {
  const data = store.snapshot()
  const resources = store.listResources()
  const packs = await collectPacks(store)
  const quotes = await readQuotes(store.dataDirectory)
  const backup: LibraryBackup = {
    format: 'closeread-library',
    version: 1,
    exportedAt: new Date().toISOString(),
    store: data,
    resources,
    ...(packs.length ? { packs } : {}),
    ...(quotes !== undefined ? { quotes } : {}),
  }
  await writeAtomic(target, JSON.stringify(backup, null, 2))
  return {
    file: target,
    items: data.items.length,
    packs: data.packs.length,
    logs: data.logs.length,
    outputs: data.outputs.length,
    resources: resources.length,
  }
}

/** Restore a library backup over the given store, resources and pack directories. */
export async function restoreLibraryBackup(
  file: string,
  storePath: string,
  resourcesDir: string,
  packsDir?: string,
): Promise<BackupResult & { safetyCopy?: string; packFiles?: number }> {
  const backup = validate(JSON.parse(await fs.readFile(file, 'utf8')))
  const safetyCopy = `${storePath}.pre-restore-${stamp()}`
  try {
    await fs.copyFile(storePath, safetyCopy)
  } catch {
    // A fresh install has no store to preserve.
  }

  const restoredPackDirs = new Map<string, string>()
  let packFiles = 0
  if (packsDir && backup.packs) {
    for (const pack of backup.packs) {
      const targetDir = path.join(packsDir, pack.name)
      restoredPackDirs.set(pack.name, targetDir)
      for (const entry of pack.files) {
        if (!SAFE_RELATIVE.test(entry.path) || entry.path.includes('..')) continue
        const target = path.resolve(targetDir, entry.path)
        if (!target.startsWith(path.resolve(targetDir) + path.sep)) continue
        await fs.mkdir(path.dirname(target), { recursive: true })
        const temp = `${target}.${randomUUID()}.tmp`
        await fs.writeFile(
          temp,
          entry.encoding === 'base64' ? Buffer.from(entry.content, 'base64') : entry.content,
          entry.encoding === 'base64' ? undefined : 'utf8',
        )
        await fs.rename(temp, target)
        packFiles += 1
      }
    }
  }

  const data: StoreData = {
    version: 2,
    items: backup.store.items,
    packs: backup.store.packs.map((pack) => {
      const target = restoredPackDirs.get(path.basename(pack.dir))
      return target ? { ...pack, dir: target } : pack
    }),
    logs: backup.store.logs,
    outputs: backup.store.outputs,
    preferences: backup.store.preferences,
  }
  await writeAtomic(storePath, JSON.stringify(data, null, 2))

  for (const resource of backup.resources) {
    await writeAtomic(path.join(resourcesDir, `${resource.id}.json`), JSON.stringify(resource, null, 2))
  }

  if (backup.quotes !== undefined) {
    await writeAtomic(
      path.join(path.dirname(storePath), 'quotes.json'),
      JSON.stringify(backup.quotes, null, 2),
    )
  }

  return {
    file,
    items: data.items.length,
    packs: data.packs.length,
    logs: data.logs.length,
    outputs: data.outputs.length,
    resources: backup.resources.length,
    ...(packFiles ? { packFiles } : {}),
    ...(await fs.access(safetyCopy).then(() => ({ safetyCopy })).catch(() => ({}))),
  }
}
