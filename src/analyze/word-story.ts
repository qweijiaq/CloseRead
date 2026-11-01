import { z } from 'zod'

import type { LearningItem, WordStory } from '../types.js'
import { chatJson } from './chat.js'

const wordStorySchema = z.object({
  origin: z.string().min(1),
  roots: z.string().min(1),
  semanticShift: z.string().nullable().optional(),
  cognates: z.array(z.string()).default([]),
  confusables: z.array(z.string()).default([]),
  hook: z.string().min(1),
  caveat: z.string().nullable().optional(),
})

const SYSTEM = `You write short, accurate etymology notes for a Chinese learner.
Use standard dictionary etymology, not folk etymology. If a derivation is uncertain or disputed, say so explicitly instead of inventing a story.
Write in natural Chinese, concise and vivid. Return JSON only:
{"origin":"...","roots":"...","semanticShift":"...","cognates":["..."],"confusables":["..."],"hook":"...","caveat":"..."}`

function compact(value: string | undefined, max: number): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export async function generateWordStory(
  item: LearningItem,
  signal?: AbortSignal,
): Promise<WordStory> {
  const formation = item.wordFormation
    ? [
        ...item.wordFormation.roots.map((part) => `root ${part.form}: ${part.meaning}`),
        ...item.wordFormation.prefixes.map((part) => `prefix ${part.form}: ${part.meaning}`),
        ...item.wordFormation.suffixes.map((part) => `suffix ${part.form}: ${part.meaning}`),
      ].join('; ')
    : ''
  const context = item.contexts[0]?.sentence ?? ''
  const result = await chatJson(
    wordStorySchema,
    SYSTEM,
    `Word: ${item.lemma}
POS: ${item.pos ?? ''}
Sense: ${item.sense}
Definition: ${item.definition}
Chinese: ${item.definitionZh ?? ''}
Context: ${compact(context, 300)}
Known formation: ${formation || '(none)'}

Return JSON only.`,
    { maxTokens: 1200, signal },
  )
  return {
    origin: compact(result.origin, 600),
    roots: compact(result.roots, 400),
    ...(result.semanticShift?.trim() ? { semanticShift: compact(result.semanticShift, 400) } : {}),
    cognates: (result.cognates ?? []).map((value) => compact(value, 120)).filter(Boolean).slice(0, 6),
    confusables: (result.confusables ?? []).map((value) => compact(value, 120)).filter(Boolean).slice(0, 6),
    hook: compact(result.hook, 240),
    ...(result.caveat?.trim() ? { caveat: compact(result.caveat, 240) } : {}),
  }
}
