import { createRequire } from 'node:module'

import { itemId } from '../analyze/item-id.js'
import type { Store } from '../store/store.js'
import type { LearningItem } from '../types.js'
const require = createRequire(import.meta.url)
const cet4 = require('./cet4.json') as Wordbook
const cet6 = require('./cet6.json') as Wordbook
const ielts = require('./ielts.json') as Wordbook
const toefl = require('./toefl.json') as Wordbook

export interface WordbookExample {
  en: string
  zh?: string
}

export interface WordbookWord {
  w: string
  p?: string
  t: string
  pos?: string
  d?: string
  cefr?: string
  family?: string[]
  syn?: string[]
  ant?: string[]
  examples?: WordbookExample[]
  collocations?: string[]
  tip?: string
  note?: string
  topic?: string
}

export interface Wordbook {
  id: string
  name: string
  short: string
  description: string
  source: string
  license: string
  count?: number
  words: WordbookWord[]
}

const BOOKS = [cet4, cet6, toefl, ielts] as Wordbook[]

export function listWordbooks(): Wordbook[] {
  return BOOKS
}

export function getWordbook(id: string): Wordbook | undefined {
  return BOOKS.find((book) => book.id === id)
}

function wordsOf(book: Wordbook): WordbookWord[] {
  return Array.isArray(book.words) ? book.words : []
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export interface WordbookProgress {
  total: number
  enrolled: number
  known: number
  due: number
  fresh: number
  staged: number
}

/** Match by lemma, because a word may already exist from an article. */
export function wordbookProgress(store: Store, book: Wordbook): WordbookProgress {
  const byLemma = new Map(store.listItems().map((item) => [item.lemma.toLowerCase(), item]))
  const now = new Date()
  let enrolled = 0
  let known = 0
  let due = 0
  let fresh = 0
  let staged = 0
  for (const word of wordsOf(book)) {
    const item = byLemma.get(word.w.toLowerCase())
    if (!item) continue
    enrolled += 1
    if (item.status === 'known') known += 1
    else if (item.status === 'active' && item.staged === true) staged += 1
    else if (item.status === 'active' && item.review.reps === 0) fresh += 1
    else if (item.status === 'active' && new Date(item.review.due) <= now) due += 1
  }
  return { total: wordsOf(book).length, enrolled, known, due, fresh, staged }
}

function toItem(book: Wordbook, word: WordbookWord): LearningItem {
  const now = new Date().toISOString()
  const definitionZh = word.t.trim()
  const sense = definitionZh.slice(0, 160)
  const definition = (word.d || definitionZh).trim().slice(0, 500)
  return {
    id: itemId(word.w, sense),
    type: 'word_sense',
    lemma: word.w.trim(),
    ...(word.p ? { ipa: word.p } : {}),
    ...(word.pos ? { pos: word.pos } : {}),
    ...(word.cefr ? { cefr: word.cefr } : {}),
    sense,
    definition,
    definitionZh,
    contexts: [],
    collocations: word.collocations ?? [],
    examples: (word.examples ?? []).map((example) => ({
      text: example.zh ? `${example.en} — ${example.zh}` : example.en,
      origin: 'generated' as const,
    })),
    relations: {
      synonyms: word.syn ?? [],
      antonyms: word.ant ?? [],
      confusables: [],
      wordFamily: word.family ?? [],
    },
    ...(word.tip ? { memoryHook: word.tip } : {}),
    ...(word.note || word.topic
      ? { notes: [word.note, word.topic ? `话题：${word.topic}` : ''].filter(Boolean).join(' · ') }
      : {}),
    tags: ['wordbook', `wordbook:${book.id}`, ...(word.topic ? [`topic:${word.topic}`] : [])],
    sourceRef: `${book.short} 词书 · ${book.source}`,
    staged: true,
    createdAt: now,
    updatedAt: now,
  }
}

export interface EnrollResult {
  added: number
  merged: number
  skipped: number
  total: number
}

/** Seed a wordbook into the same store/FSRS library as article words. */
export async function enrollWordbook(
  store: Store,
  book: Wordbook,
  options: { limit?: number } = {},
): Promise<EnrollResult> {
  const existingItems = store.listItems()
  const existing = new Map(existingItems.map((item) => [item.lemma.toLowerCase(), item]))
  const seen = new Set(existing.keys())
  const words = wordsOf(book)
  const target = options.limit && options.limit > 0 ? words.slice(0, options.limit) : words
  const items: LearningItem[] = []
  const merged: LearningItem[] = []
  let skipped = 0
  for (const word of target) {
    if (!word.w.trim() || !word.t.trim()) {
      skipped += 1
      continue
    }
    const key = word.w.toLowerCase()
    const current = existing.get(key)
    const incoming = toItem(book, word)
    if (current) {
      // A word already learned from an article should keep its context and
      // review state, but it can still receive the wordbook's phonetics,
      // examples, collocations and relations.
      merged.push({
        ...current,
        ipa: current.ipa || incoming.ipa,
        pos: current.pos || incoming.pos,
        cefr: current.cefr || incoming.cefr,
        definition: current.definition || incoming.definition,
        definitionZh: current.definitionZh || incoming.definitionZh,
        collocations: unique([...current.collocations, ...incoming.collocations]),
        examples: mergeExamples(current.examples, incoming.examples),
        relations: {
          synonyms: unique([...current.relations.synonyms, ...incoming.relations.synonyms]),
          antonyms: unique([...current.relations.antonyms, ...incoming.relations.antonyms]),
          confusables: unique([...current.relations.confusables, ...incoming.relations.confusables]),
          wordFamily: unique([...current.relations.wordFamily, ...incoming.relations.wordFamily]),
        },
        memoryHook: current.memoryHook || incoming.memoryHook,
        notes: mergeNotes(current.notes, incoming.notes),
        tags: unique([...current.tags, ...incoming.tags]),
      })
      skipped += 1
      continue
    }
    if (seen.has(key)) {
      skipped += 1
      continue
    }
    seen.add(key)
    items.push(incoming)
  }
  if (items.length || merged.length) await store.upsertItems([...items, ...merged])
  return { added: items.length, merged: merged.length, skipped, total: words.length }
}

function mergeExamples(
  current: LearningItem['examples'],
  incoming: LearningItem['examples'],
): LearningItem['examples'] {
  const seen = new Set(current.map((example) => example.text.trim().toLowerCase()))
  return [
    ...current,
    ...incoming.filter((example) => {
      const key = example.text.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    }),
  ]
}

function mergeNotes(current: string | undefined, incoming: string | undefined): string | undefined {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const note of [current, incoming]) {
    for (const paragraph of (note ?? '').split(/\n{2,}/)) {
      const value = paragraph.trim()
      if (!value || seen.has(value)) continue
      seen.add(value)
      parts.push(value)
    }
  }
  return parts.length ? parts.join('\n\n') : undefined
}

export function wordbookView(store: Store, book: Wordbook) {
  return {
    id: book.id,
    name: book.name,
    short: book.short,
    description: book.description,
    source: book.source,
    license: book.license,
    progress: wordbookProgress(store, book),
    sample: wordsOf(book).slice(0, 6).map((word) => ({ w: word.w, t: word.t })),
  }
}
