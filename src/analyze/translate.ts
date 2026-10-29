import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { config } from '../config.js'

interface MyMemoryResponse {
  responseData?: {
    translatedText?: string
    match?: number
  }
  responseStatus?: number
  quotaFinished?: boolean
}

interface YoudaoResponse {
  data?: {
    entries?: Array<{
      explain?: string
      entry?: string
    }>
  }
}

const memoryCache = new Map<string, string | null>()
const chineseCache = new Map<string, string | null>()
let lastRequestAt = 0
let quotaExhausted = false

function cacheKey(text: string): string {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 16)
}

function cacheFile(text: string): string {
  return path.join(config.dataDir, 'cache', 'translations', `${cacheKey(text)}.json`)
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function politeFetch(url: string, timeoutMs: number): Promise<Response> {
  const wait = Math.max(0, 250 - (Date.now() - lastRequestAt))
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
  return fetch(url, {
    headers: { 'user-agent': 'CloseRead/0.1' },
    signal: AbortSignal.timeout(timeoutMs),
  })
}

/**
 * Translate a short English gloss into Chinese with MyMemory's free endpoint.
 * Results are cached on disk; the anonymous quota is small, so context
 * sentences are only translated when the caller explicitly asks for them.
 */
export async function translateToChinese(text: string): Promise<string | null> {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return null
  if (quotaExhausted) return null

  const key = cacheKey(trimmed)
  if (memoryCache.has(key)) return memoryCache.get(key) ?? null

  const file = cacheFile(trimmed)
  try {
    const cached = JSON.parse(await fs.readFile(file, 'utf8')) as { translation?: string }
    if (cached.translation) {
      memoryCache.set(key, cached.translation)
      return cached.translation
    }
  } catch {
    // Not cached yet.
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const query = encodeURIComponent(trimmed.slice(0, 450))
      const response = await politeFetch(
        `https://api.mymemory.translated.net/get?q=${query}&langpair=en%7Czh-CN`,
        10_000,
      )
      if (!response.ok) {
        await sleep(500 * (attempt + 1))
        continue
      }

      const data = (await response.json()) as MyMemoryResponse
      if (data.quotaFinished) {
        quotaExhausted = true
        return null
      }

      const translated = data.responseData?.translatedText?.trim()
      if (!translated || translated.toLowerCase() === trimmed.toLowerCase()) {
        memoryCache.set(key, null)
        return null
      }

      const cleaned = translated
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')

      try {
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.writeFile(file, JSON.stringify({ source: trimmed, translation: cleaned }, null, 2), 'utf8')
      } catch {
        // A cache write failure must not fail the build.
      }
      memoryCache.set(key, cleaned)
      return cleaned
    } catch {
      if (attempt === 0) await sleep(400)
    }
  }

  return null
}

export async function translateMany(texts: string[], concurrency = 2): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const queue = [...new Set(texts.map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean))]
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      const text = queue[cursor++]!
      const translation = await translateToChinese(text)
      if (translation) result.set(text, translation)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()))
  return result
}

function chineseCacheFile(word: string): string {
  return path.join(config.dataDir, 'cache', 'chinese', `${word.toLowerCase().replace(/[^a-z0-9-]/g, '_')}.json`)
}

/** Keep the first few senses; Youdao entries for common words can be very long. */
function cleanYoudaoExplain(value: string): string {
  const cleaned = value
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const senses = cleaned
    .split('；')
    .map((sense) => sense.trim())
    .filter(Boolean)
  if (senses.length <= 3) return cleaned.slice(0, 160)
  return `${senses.slice(0, 3).join('；')}…`
}

/** Look up a concise Chinese dictionary gloss for a word or phrase. */
export async function lookupChineseWord(word: string): Promise<string | null> {
  const key = word.toLowerCase().trim()
  if (!key) return null
  if (chineseCache.has(key)) return chineseCache.get(key) ?? null

  const file = chineseCacheFile(key)
  try {
    const cached = JSON.parse(await fs.readFile(file, 'utf8')) as { explain?: string }
    if (cached.explain) {
      chineseCache.set(key, cached.explain)
      return cached.explain
    }
  } catch {
    // Not cached yet.
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await politeFetch(
        `https://dict.youdao.com/suggest?q=${encodeURIComponent(key)}&num=1&doctype=json`,
        8_000,
      )
      if (!response.ok) {
        await sleep(400 * (attempt + 1))
        continue
      }
      const data = (await response.json()) as YoudaoResponse
      const explain = data.data?.entries?.[0]?.explain?.trim()
      if (!explain) {
        chineseCache.set(key, null)
        return null
      }
      const cleaned = cleanYoudaoExplain(explain)
      try {
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.writeFile(file, JSON.stringify({ word: key, explain: cleaned }, null, 2), 'utf8')
      } catch {
        // A cache write failure must not fail the build.
      }
      chineseCache.set(key, cleaned)
      return cleaned
    } catch {
      if (attempt === 0) await sleep(350)
    }
  }

  return null
}

export async function lookupChineseWords(
  words: string[],
  concurrency = 2,
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const queue = [...new Set(words.map((word) => word.toLowerCase().trim()).filter(Boolean))]
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      const word = queue[cursor++]!
      const chinese = await lookupChineseWord(word)
      if (chinese) result.set(word, chinese)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()))
  return result
}
