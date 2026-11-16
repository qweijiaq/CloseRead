import { z } from 'zod'

import type { WordFormation } from '../types.js'

export const wordFormationPartSchema = z.object({
  form: z.string().min(1),
  meaning: z.string().min(1),
  examples: looseStringList(),
})

export const wordFormationSchema = z.object({
  roots: z.array(wordFormationPartSchema).default([]),
  prefixes: z.array(wordFormationPartSchema).default([]),
  suffixes: z.array(wordFormationPartSchema).default([]),
})

const LIST_TEXT_KEYS = ['text', 'word', 'lemma', 'term', 'phrase', 'form', 'value', 'name', 'example'] as const

/**
 * Models sometimes return `[{ text: "..." }]` or `[{ word: "..." }]` for a
 * string array. Rejecting the whole batch over that wasted four cards and left
 * a red warning on the page, so unwrap the usual object shapes first.
 */
export function looseStringList(): z.ZodType<string[], z.ZodTypeDef, string[] | undefined> {
  // The declared input type keeps `chatJson` inferring the object's real output
  // shape; the preprocessor still accepts whatever the model actually sent.
  return z.preprocess((value) => {
    if (typeof value === 'string') return value.trim() ? [value] : []
    if (!Array.isArray(value)) return value
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry
        if (typeof entry === 'number') return String(entry)
        if (entry && typeof entry === 'object') {
          for (const key of LIST_TEXT_KEYS) {
            const field = (entry as Record<string, unknown>)[key]
            if (typeof field === 'string' && field.trim()) return field
          }
        }
        return ''
      })
      .map((text) => text.trim())
      .filter(Boolean)
  }, z.array(z.string()).default([])) as unknown as z.ZodType<string[], z.ZodTypeDef, string[] | undefined>
}

export const rawItemSchema = z.object({
  lemma: z.string().min(1),
  sense: z.string().min(1),
  pos: z.string().optional(),
  cefr: z.string().optional(),
  definition: z.string().min(1),
  definitionZh: z.string().optional(),
  contextSentence: z.string().min(1),
  contextTranslation: z.string().optional(),
  collocations: looseStringList(),
  examples: looseStringList(),
  confusables: looseStringList(),
  wordFamily: looseStringList(),
  synonyms: looseStringList(),
  antonyms: looseStringList(),
  notes: z.string().optional(),
  /** 0–1 usefulness score used to choose core items when the compiler suggests a count. */
  valueScore: z.number().min(0).max(1).optional(),
  wordFormation: z.preprocess(
    (value) => (typeof value === 'string' ? undefined : value),
    wordFormationSchema.nullable().optional(),
  ),
  memoryHook: z.string().nullable().optional(),
})

export type RawItem = z.infer<typeof rawItemSchema>

export interface RawWordFormation {
  roots?: Array<{ form: string; meaning: string; examples?: string[] }>
  prefixes?: Array<{ form: string; meaning: string; examples?: string[] }>
  suffixes?: Array<{ form: string; meaning: string; examples?: string[] }>
}

/** zod's `.default([])` makes nested arrays optional in the inferred type; normalize them for storage. */
export function normalizeWordFormation(raw?: RawWordFormation): WordFormation | undefined {
  if (!raw) return undefined
  const unique = (values?: string[]) => [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]
  const normalizePart = (part: { form: string; meaning: string; examples?: string[] }) => ({
    form: part.form,
    meaning: part.meaning,
    examples: unique(part.examples),
  })
  const roots = (raw.roots ?? []).map(normalizePart)
  const prefixes = (raw.prefixes ?? []).map(normalizePart)
  const suffixes = (raw.suffixes ?? []).map(normalizePart)
  if (roots.length === 0 && prefixes.length === 0 && suffixes.length === 0) return undefined
  return { roots, prefixes, suffixes }
}
