import { z } from 'zod'

import { chatJson } from '../analyze/chat.js'
import { findContextSentence } from '../analyze/tokenize.js'
import { hasLlm } from '../config.js'
import type { LearningPack } from '../types.js'

export type SelectionKind = 'word' | 'collocation' | 'idiom' | 'phrase' | 'sentence' | 'unknown'

export interface SelectionPart {
  text: string
  reason?: string
}

export interface SelectionAnalysis {
  isMeaningfulPhrase: boolean
  kind: SelectionKind
  meaningZh?: string
  /** Natural Chinese translation of the selection in its paragraph context. */
  translation?: string
  /** Short Chinese annotation: grammar, register, nuance or why it matters. */
  annotation?: string
  /** 1-2 short usage examples when useful. */
  examples?: string[]
  /** Canonical unit to add as one item, e.g. "a heavy job" for "is a heavy job". */
  phrase?: string
  parts: SelectionPart[]
  recommendation: 'phrase' | 'separate' | 'ask'
  reason?: string
  mode: 'llm' | 'heuristic'
}

const STOPWORDS = new Set(
  `a an the and or but if because as at by for from in into of on onto to with without about above after again against all am are be been before being below between both can could did do does doing down during each few from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves`.split(
    /\s+/,
  ),
)

const partSchema = z.object({
  text: z.string().min(1),
  reason: z.string().nullable().optional(),
})

const analysisSchema = z.object({
  isMeaningfulPhrase: z.boolean().default(false),
  kind: z.enum(['word', 'collocation', 'idiom', 'phrase', 'sentence', 'unknown']).default('unknown'),
  meaningZh: z.string().nullable().optional(),
  translation: z.string().nullable().optional(),
  annotation: z.string().nullable().optional(),
  examples: z.array(z.string()).default([]),
  phrase: z.string().nullable().optional(),
  parts: z.array(partSchema).default([]),
  recommendation: z.enum(['phrase', 'separate', 'ask']).default('ask'),
  reason: z.string().nullable().optional(),
})

const cache = new Map<string, SelectionAnalysis>()

export function heuristicSelection(text: string): SelectionAnalysis {
  const clean = text.replace(/\s+/g, ' ').trim()
  const tokens = clean.split(/\s+/).filter(Boolean)
  if (tokens.length <= 1) {
    return {
      isMeaningfulPhrase: true,
      kind: 'word',
      phrase: clean,
      parts: [],
      recommendation: 'phrase',
      reason: 'Single word',
      mode: 'heuristic',
    }
  }

  const parts = [...new Set(
    tokens
      .map((token) => token.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ''))
      .filter((token) => token && !STOPWORDS.has(token.toLowerCase())),
  )].map((token) => ({ text: token, reason: 'content word' }))

  return {
    isMeaningfulPhrase: false,
    kind: 'unknown',
    phrase: clean,
    parts,
    recommendation: parts.length > 1 ? 'separate' : 'phrase',
    reason: 'No LLM; split into content words',
    mode: 'heuristic',
  }
}

/** Decide whether a multi-word selection is one unit or several words worth learning. */
export async function analyzeSelection(
  pack: LearningPack,
  text: string,
  options: { useLlm?: boolean; context?: string } = {},
): Promise<SelectionAnalysis> {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) throw new Error('Selection is empty')

  const key = `${pack.id}:${clean.toLowerCase()}:${(options.context ?? '').toLowerCase().slice(0, 160)}`
  const cached = cache.get(key)
  if (cached) return cached

  if (options.useLlm === false || !hasLlm()) return heuristicSelection(clean)

  const source = pack.sourceText ?? pack.reading?.map((paragraph) => paragraph.original).join('\n\n') ?? ''
  const paragraph =
    options.context?.trim() ||
    pack.reading?.find((entry) => entry.original.toLowerCase().includes(clean.toLowerCase()))?.original ||
    findContextSentence(source, clean) ||
    ''

  const system = `You are analyzing a text selection from an English article for a Chinese learner.

First, translate the selection naturally in this context:
- translation: natural Chinese translation of the selected text as used here; never word-for-word
- annotation: one concise Chinese note on grammar, register, nuance, or why the expression matters (optional)
- examples: 0-2 short usage examples only when they genuinely help (optional)

Then decide whether the whole selection forms a meaningful word, collocation, idiom, phrase or sentence in this context. Examples of meaningful units: "attention economy", "take a toll on", "in the long run". Examples of non-units: "the quick brown fox", "attention has become".

If it is a meaningful unit: set isMeaningfulPhrase true, recommendation "phrase", give a short Chinese meaning, a canonical phrase to add as one item, and optionally the component words worth learning. Drop leading copulas (is/are/was/were) and unnecessary leading articles when they are not part of the unit: for "is a heavy job" the canonical phrase is "a heavy job". The canonical phrase must be a contiguous substring of the selection.
If it is not: set isMeaningfulPhrase false, recommendation "separate", and extract the content words or meaningful chunks worth learning individually. Exclude articles, prepositions, auxiliaries, pronouns and other function words. Prefer 1-4 parts.
If the selection is a complete sentence, set kind "sentence" and prefer the whole sentence as one unit.

Return JSON only: {"translation":"...","annotation":"...","examples":[],"isMeaningfulPhrase":true,"kind":"collocation","meaningZh":"...","phrase":"a heavy job","parts":[{"text":"heavy job","reason":"..."}],"recommendation":"phrase","reason":"..."}`

  const user = `Selection: "${clean}"

Paragraph:
"""
${paragraph.slice(0, 3000)}
"""

Source title: ${pack.title}
Target level: ${pack.difficulty.cefr}

Return JSON only.`

  try {
    const result = await chatJson(analysisSchema, system, user, { maxTokens: 1200 })
    const selectionLower = clean.toLowerCase()
    const rawParts = (result.parts ?? [])
      .map((part) => ({ text: part.text.trim(), reason: part.reason ?? undefined }))
      .filter((part) => {
        if (!part.text) return false
        const words = part.text.toLowerCase().split(/\s+/)
        return words.every((word) => selectionLower.includes(word))
      })
      .filter((part) => part.text.split(/\s+/).some((word) => !STOPWORDS.has(word.toLowerCase())))

    const heuristicParts = heuristicSelection(clean).parts
    const parts = rawParts.length > 0 ? rawParts : heuristicParts
    const phraseCandidate = result.phrase?.trim()
    const phrase =
      phraseCandidate && clean.toLowerCase().includes(phraseCandidate.toLowerCase()) ? phraseCandidate : clean
    const analysis: SelectionAnalysis = {
      isMeaningfulPhrase: result.isMeaningfulPhrase ?? false,
      kind: result.kind ?? 'unknown',
      meaningZh: result.meaningZh ?? undefined,
      translation: result.translation?.trim() || undefined,
      annotation: result.annotation?.trim() || undefined,
      examples: (result.examples ?? []).map((example) => example.trim()).filter(Boolean).slice(0, 2),
      phrase,
      parts,
      recommendation:
        result.recommendation ?? ((result.isMeaningfulPhrase ?? false) ? 'phrase' : 'separate'),
      reason: result.reason ?? undefined,
      mode: 'llm',
    }
    cache.set(key, analysis)
    if (cache.size > 200) cache.delete(cache.keys().next().value as string)
    return analysis
  } catch {
    return heuristicSelection(clean)
  }
}
