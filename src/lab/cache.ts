import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { config } from '../config.js'

function cacheFile(key: string): string {
  const hash = createHash('sha1').update(key).digest('hex')
  return path.join(config.dataDir, 'cache', 'lab', `${hash}.json`)
}

export async function cached<T>(key: string, produce: () => Promise<T>, ttlMs = 30 * 24 * 60 * 60 * 1000): Promise<T> {
  const file = cacheFile(key)
  try {
    const stat = await fs.stat(file)
    if (Date.now() - stat.mtimeMs <= ttlMs) {
      return JSON.parse(await fs.readFile(file, 'utf8')) as T
    }
  } catch {
    // Generate below.
  }
  const value = await produce()
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.tmp`
  await fs.writeFile(temp, JSON.stringify(value), 'utf8')
  await fs.rename(temp, file)
  return value
}

export function labCacheKey(feature: string, parts: unknown[]): string {
  return `${feature}:${JSON.stringify(parts)}`
}
