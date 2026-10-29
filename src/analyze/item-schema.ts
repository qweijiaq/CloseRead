import { z } from 'zod'

import type { WordFormation } from '../types.js'

export const wordFormationPartSchema = z.object({
  form: z.string().min(1),
  meaning: z.string().min(1),
  examples: z.array(z.string()).default([]),
})

export const wordFormationSchema = z.object({
  roots: z.array(wordFormationPartSchema).default([]),
  prefixes: z.array(wordFormationPartSchema).default([]),
  suffixes: z.array(wordFormationPartSchema).default([]),
})

export const rawItemSchema = z.object({
  lemma: z.string().min(1),
  sense: z.string().min(1),
  pos: z.string().optional(),
  cefr: z.string().optional(),
  definition: z.string().min(1),
  definitionZh: z.string().optional(),
  contextSentence: z.string().min(1),
  contextTranslation: z.string().optional(),
  collocations: z.array(z.string()).default([]),
  examples: z.array(z.string()).default([]),
  confusables: z.array(z.string()).default([]),
  wordFamily: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).default([]),
  antonyms: z.array(z.string()).default([]),
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
