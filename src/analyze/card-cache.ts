import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { config } from '../config.js'
import type { StoredItem, WordFormation } from '../types.js'

export interface CachedCard {
  lemma: string
  sense: string
  pos?: string
  cefr?: string
  definition: string
  definitionZh?: string
  collocations: string[]
  examples: string[]
  confusables: string[]
  wordFamily: string[]
  synonyms: string[]
  antonyms: string[]
  notes?: string
  wordFormation?: WordFormation
  memoryHook?: string
}

const memory = new Map<string, CachedCard[] | null>()

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.;:!?]+$/, '')
    .trim()
}

export function cardCacheKey(lemma: string): string {
  return createHash('sha1').update(normalize(lemma)).digest('hex')
}

function cacheDir(): string {
  return path.join(config.dataDir, 'cache', 'cards')
}

function senseTokens(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(/[^a-z0-9-]+/)
      .filter((token) => token.length > 2),
  )
}

function senseSimilarity(a: string, b: string): number {
  const left = senseTokens(a)
  const right = senseTokens(b)
  if (left.size === 0 || right.size === 0) return 0
  let overlap = 0
  for (const token of left) if (right.has(token)) overlap += 1
  return overlap / Math.min(left.size, right.size)
}

async function loadCards(lemma: string): Promise<CachedCard[]> {
  const key = cardCacheKey(lemma)
  const cached = memory.get(key)
  if (cached !== undefined) return cached ?? []
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(cacheDir(), `${key}.json`), 'utf8')) as {
      cards?: CachedCard[]
    }
    const cards = Array.isArray(parsed.cards) ? parsed.cards : []
    memory.set(key, cards)
    return cards
  } catch {
    memory.set(key, null)
    return []
  }
}

export async function getCachedCard(lemma: string, sense: string): Promise<CachedCard | null> {
  const cards = await loadCards(lemma)
  if (cards.length === 0) return null
  const target = normalize(sense)
  const exact = cards.find((card) => normalize(card.sense) === target)
  if (exact) return exact

  let best: CachedCard | null = null
  let bestScore = 0
  for (const card of cards) {
    const score = senseSimilarity(sense, card.sense)
    if (score > bestScore) {
      best = card
      bestScore = score
    }
  }
  if (best && bestScore >= 0.34) return best
  // If we only have one stored sense for this lemma, reuse it; otherwise a
  // different sense is likely, and the caller should generate a fresh card.
  return cards.length === 1 ? cards[0]! : null
}

export async function putCachedCard(card: CachedCard): Promise<void> {
  const key = cardCacheKey(card.lemma)
  const cards = await loadCards(card.lemma)
  const target = normalize(card.sense)
  const index = cards.findIndex((entry) => normalize(entry.sense) === target)
  if (index >= 0) cards[index] = card
  else cards.push(card)
  memory.set(key, cards)
  try {
    const dir = cacheDir()
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, `${key}.json`), JSON.stringify({ lemma: card.lemma, cards }, null, 2), 'utf8')
  } catch {
    // The cache is an optimisation; a failed write should not fail the build.
  }
}

/** Make existing review-library cards available before the first build of a session. */
export async function seedCardCache(items: StoredItem[]): Promise<void> {
  for (const item of items) {
    const cards = await loadCards(item.lemma)
    if (cards.some((card) => normalize(card.sense) === normalize(item.sense))) continue
    await putCachedCard({
      lemma: item.lemma,
      sense: item.sense,
      pos: item.pos,
      cefr: item.cefr,
      definition: item.definition,
      definitionZh: item.definitionZh,
      collocations: item.collocations ?? [],
      examples: item.examples.filter((example) => example.origin !== 'source').map((example) => example.text),
      confusables: item.relations.confusables ?? [],
      wordFamily: item.relations.wordFamily ?? [],
      synonyms: item.relations.synonyms ?? [],
      antonyms: item.relations.antonyms ?? [],
      notes: item.notes,
      wordFormation: item.wordFormation,
      memoryHook: item.memoryHook,
    })
  }
}
