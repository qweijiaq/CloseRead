import { z } from 'zod'

import type { ParagraphNote } from '../types.js'

export const paragraphNoteSchema = z.object({
  summary: z.string().default(''),
  role: z.string().nullable().optional(),
  keySentence: z.string().nullable().optional(),
  keySentenceNote: z.string().nullable().optional(),
  grammar: z.string().nullable().optional(),
  connectors: z
    .array(
      z.object({
        text: z.string().min(1),
        usage: z.string().default(''),
      }),
    )
    .default([]),
  background: z.string().nullable().optional(),
  question: z.string().nullable().optional(),
})

export const readingNotesSchema = z.object({
  notes: z
    .array(
      paragraphNoteSchema.extend({
        index: z.number().int().min(0),
      }),
    )
    .default([]),
})

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function toParagraphNote(
  raw: {
    summary?: string
    role?: string | null
    keySentence?: string | null
    keySentenceNote?: string | null
    grammar?: string | null
    connectors?: Array<{ text: string; usage?: string }>
    background?: string | null
    question?: string | null
  },
  paragraph: string,
): ParagraphNote | undefined {
  const summary = normalize(raw.summary ?? '')
  const role = normalize(raw.role ?? '')
  const keySentence = normalize(raw.keySentence ?? '')
  const keySentenceNote = normalize(raw.keySentenceNote ?? '')
  const grammar = normalize(raw.grammar ?? '')
  const background = normalize(raw.background ?? '')
  const question = normalize(raw.question ?? '')
  const connectors = (raw.connectors ?? [])
    .map((connector) => ({
      text: normalize(connector.text),
      usage: normalize(connector.usage ?? ''),
    }))
    .filter((connector) => connector.text)
  if (!summary && !role && !keySentenceNote && !grammar && !background && connectors.length === 0) {
    return undefined
  }
  const groundedKeySentence =
    keySentence && normalize(paragraph).toLowerCase().includes(keySentence.toLowerCase())
      ? keySentence
      : undefined
  return {
    summary,
    ...(role ? { role } : {}),
    ...(groundedKeySentence ? { keySentence: groundedKeySentence } : {}),
    ...(keySentenceNote ? { keySentenceNote } : {}),
    ...(grammar ? { grammar } : {}),
    connectors,
    ...(background ? { background } : {}),
    ...(question ? { question } : {}),
  }
}
