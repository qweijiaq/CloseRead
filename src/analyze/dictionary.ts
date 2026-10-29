import fs from 'node:fs/promises'
import path from 'node:path'

import { config } from '../config.js'

export interface DictionaryInfo {
  word: string
  phonetic?: string
  audio?: string
  partOfSpeech?: string
  definition?: string
  example?: string
  synonyms: string[]
  antonyms: string[]
  examples: string[]
}

interface RawEntry {
  word?: string
  phonetic?: string
  phonetics?: Array<{ text?: string; audio?: string }>
  meanings?: Array<{
    partOfSpeech?: string
    definitions?: Array<{
      definition?: string
      example?: string
      synonyms?: string[]
      antonyms?: string[]
    }>
    synonyms?: string[]
    antonyms?: string[]
  }>
}

interface DatamuseEntry {
  word?: string
  tags?: string[]
  defs?: string[]
}

const POS: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  u: 'unknown',
}

const GRAMMAR_LABEL_RE =
  /^(?:\((?:transitive|intransitive|ambitransitive|countable|uncountable|figurative|literally|informal|formal|slang|archaic|obsolete|dated|rare|chiefly\s+[^)]+|mainly\s+[^)]+|UK|US|British|American|Australian)\)\s*)+/i

function cleanDefinition(value: string): string {
  return value.replace(GRAMMAR_LABEL_RE, '').trim()
}

const memoryCache = new Map<string, DictionaryInfo | null>()
let lastRequestAt = 0

function cacheFile(word: string): string {
  return path.join(config.dataDir, 'cache', 'dictionary', `${word.toLowerCase().replace(/[^a-z0-9-]/g, '_')}.json`)
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/** Keep a minimum gap between outbound dictionary requests. The free endpoints
 *  rate-limit aggressively when a whole article is enriched at once. */
async function politeFetch(url: string, timeoutMs: number): Promise<Response> {
  const wait = Math.max(0, 220 - (Date.now() - lastRequestAt))
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
  return fetch(url, {
    headers: { 'user-agent': 'CloseRead/0.1' },
    signal: AbortSignal.timeout(timeoutMs),
  })
}

function normalizeDictionaryApi(raw: RawEntry[], preferredPos?: string): DictionaryInfo | null {
  if (raw.length === 0) return null
  const entry = raw[0]!
  const meanings = entry.meanings ?? []
  const meaning = meanings.find((item) => item.partOfSpeech === preferredPos) ?? meanings[0]
  const definitions = meaning?.definitions ?? []
  const firstDefinition =
    cleanDefinition(definitions.find((item) => item.definition)?.definition?.trim() ?? '') || undefined

  const phonetics = entry.phonetics ?? []
  const phonetic = entry.phonetic?.trim() || phonetics.find((item) => item.text)?.text?.trim()
  const audio = phonetics.find((item) => item.audio && /^https?:\/\//.test(item.audio))?.audio

  const synonyms = new Set<string>()
  const antonyms = new Set<string>()
  for (const item of meanings) {
    for (const synonym of item.synonyms ?? []) synonyms.add(synonym)
    for (const antonym of item.antonyms ?? []) antonyms.add(antonym)
    for (const definition of item.definitions ?? []) {
      for (const synonym of definition.synonyms ?? []) synonyms.add(synonym)
      for (const antonym of definition.antonyms ?? []) antonyms.add(antonym)
    }
  }

  const examples = [
    ...new Set(
      definitions
        .map((item) => item.example?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ].slice(0, 3)

  return {
    word: entry.word?.trim() || raw[0]?.word || '',
    phonetic,
    audio,
    partOfSpeech: meaning?.partOfSpeech,
    definition: firstDefinition,
    example: examples[0],
    synonyms: [...synonyms].slice(0, 8),
    antonyms: [...antonyms].slice(0, 8),
    examples,
  }
}

async function lookupDictionaryApi(word: string, preferredPos?: string): Promise<DictionaryInfo | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await politeFetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        6_000,
      )
      if (response.status === 429 || response.status >= 500) {
        await sleep(400 * (attempt + 1))
        continue
      }
      if (!response.ok) return null
      return normalizeDictionaryApi((await response.json()) as RawEntry[], preferredPos)
    } catch {
      if (attempt === 0) await sleep(350)
    }
  }
  return null
}

async function lookupDatamuse(word: string): Promise<DictionaryInfo | null> {
  try {
    const response = await politeFetch(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=dp&max=1`,
      6_000,
    )
    if (!response.ok) return null
    const entries = (await response.json()) as DatamuseEntry[]
    const definitions = (entries[0]?.defs ?? [])
      .map((line) => {
        const [code, ...rest] = line.split('\t')
        return {
          partOfSpeech: POS[code ?? ''] ?? code,
          definition: cleanDefinition(rest.join('\t').trim()),
        }
      })
      .filter((entry) => entry.definition)
    if (definitions.length === 0) return null
    const first = definitions[0]!
    return {
      word,
      partOfSpeech: first.partOfSpeech,
      definition: first.definition,
      synonyms: [],
      antonyms: [],
      examples: [],
    }
  } catch {
    return null
  }
}

export async function lookupWord(word: string, preferredPos?: string): Promise<DictionaryInfo | null> {
  const key = word.toLowerCase()
  if (memoryCache.has(key)) return memoryCache.get(key) ?? null

  const file = cacheFile(key)
  try {
    const cached = JSON.parse(await fs.readFile(file, 'utf8')) as DictionaryInfo | { missing: true }
    if ('missing' in cached && cached.missing) {
      memoryCache.set(key, null)
      return null
    }
    memoryCache.set(key, cached as DictionaryInfo)
    return cached as DictionaryInfo
  } catch {
    // Not cached yet.
  }

  const fromDictionaryApi = await lookupDictionaryApi(key, preferredPos)
  const info = fromDictionaryApi ?? (await lookupDatamuse(key))
  if (!info) {
    // Do not cache failures: the endpoints are flaky, and a later run should retry.
    return null
  }

  try {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(info, null, 2), 'utf8')
  } catch {
    // A cache write failure must not fail the build.
  }
  memoryCache.set(key, info)
  return info
}

export async function lookupWords(words: string[], concurrency = 3): Promise<Map<string, DictionaryInfo>> {
  const result = new Map<string, DictionaryInfo>()
  const queue = [...new Set(words.map((word) => word.toLowerCase()))]
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      const word = queue[cursor++]!
      const info = await lookupWord(word)
      if (info) result.set(word, info)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()))
  return result
}
