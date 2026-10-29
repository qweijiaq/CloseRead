import { z } from 'zod'

import { chatJson } from './chat.js'
import { itemId } from './item-id.js'
import { hasLlm } from '../config.js'
import { sentences } from './tokenize.js'
import type { LearningItem, SentenceChunk } from '../types.js'

const chunkSchema = z.object({
  text: z.string().min(1),
  role: z.string().default(''),
  meaning: z.string().nullable().optional(),
})

const sentenceCardSchema = z.object({
  label: z.string().nullable().optional(),
  translation: z.string().nullable().optional(),
  cefr: z.string().nullable().optional(),
  chunks: z.array(chunkSchema).default([]),
  pattern: z.string().nullable().optional(),
  grammar: z.string().nullable().optional(),
  variants: z.array(z.string()).default([]),
  why: z.string().nullable().optional(),
})

export interface SentenceCardOptions {
  resourceId: string
  resourceTitle: string
  paragraphIndex?: number
  surrounding?: string
  styleName?: string
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Stable identity for duplicate detection; a trailing period does not matter. */
export function sentenceIdentity(sentence: string): string {
  return normalize(sentence).toLowerCase().replace(/[.!?]+$/, '').trim()
}

/**
 * Expand a selected phrase/clause to the complete source sentence that contains it.
 * If the selection is already a sentence, keep it; add terminal punctuation when missing.
 */
export function completeSentence(selection: string, surrounding?: string): string {
  const clean = normalize(selection)
  if (!clean) return clean
  const context = surrounding ? normalize(surrounding) : ''
  if (context) {
    const target = clean.toLowerCase()
    const containing = sentences(context).find((sentence) => sentence.toLowerCase().includes(target))
    if (containing) return containing
  }
  return /[.!?]["'”’)\]]*$/.test(clean) ? clean : `${clean}.`
}

function unique(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => normalize(value)).filter(Boolean))]
}

function cleanChunks(
  sentence: string,
  chunks: Array<{ text: string; role?: string; meaning?: string | null }>,
): SentenceChunk[] {
  const haystack = sentence.toLowerCase()
  const cleaned = chunks
    .map((chunk) => ({
      text: normalize(chunk.text),
      role: normalize(chunk.role || '成分'),
      ...(chunk.meaning ? { meaning: normalize(chunk.meaning) } : {}),
    }))
    .filter((chunk) => chunk.text && haystack.includes(chunk.text.toLowerCase()))
  return cleaned.length
    ? cleaned
    : [{ text: sentence, role: '整句' }]
}

/** Build one sentence-level card for intensive reading and back-translation review. */
export async function generateSentenceCard(
  sentence: string,
  options: SentenceCardOptions,
): Promise<LearningItem> {
  const original = completeSentence(sentence, options.surrounding)
  if (!original) throw new Error('请先选中一个句子。')
  if (original.split(/\s+/).length < 3) throw new Error('句子太短，请选中完整的一句。')
  if (!hasLlm()) throw new Error('生成句子卡需要配置 LLM。')

  const result = await chatJson(
    sentenceCardSchema,
    `You are an English teacher creating one sentence card for a Chinese learner who is reading an authentic article.
Focus on the sentence's structure and the reusable pattern, not on isolated vocabulary.
Return JSON only:
{"label":"a short handle or reusable pattern, 2-8 words","translation":"natural, idiomatic Chinese translation","cefr":"B2","chunks":[{"text":"an exact substring of the sentence","role":"subject / verb phrase / relative clause / adverbial / complement","meaning":"Chinese meaning of this chunk"}],"pattern":"a reusable pattern with A/B placeholders if applicable","grammar":"a concise Chinese explanation of the structure or a common learner trap","variants":["2-3 natural substitutions that reuse the pattern"],"why":"one concise Chinese sentence explaining why this sentence is worth learning"}
Rules: the chunks must be exact substrings of the sentence, in order, and together cover the sentence; do not invent facts about the article; keep the Chinese natural and learner-friendly, not word-for-word.`,
    `Sentence: ${original}
${options.surrounding ? `\nParagraph context:\n${options.surrounding}\n` : ''}
Article: ${options.resourceTitle}
Target level: ${process.env.LEARN_LEVEL ?? 'B2'}${options.styleName ? `\nHouse style: ${options.styleName}` : ''}

Return one sentence card.`,
    { maxTokens: 1800 },
  )

  const translation = normalize(result.translation ?? '')
  const label = normalize(result.label ?? '').slice(0, 80) || original.split(/\s+/).slice(0, 6).join(' ')
  const now = new Date().toISOString()
  const chunks = cleanChunks(original, result.chunks ?? [])
  const variants = unique(result.variants)
  // 句末标点不参与身份判断，避免同一句因选区是否带句号而重复建卡
  const idSource = sentenceIdentity(original)
  const item: LearningItem = {
    id: itemId('sentence', idSource),
    type: 'sentence',
    lemma: label,
    sense: translation || original,
    definition: original,
    definitionZh: translation || undefined,
    cefr: result.cefr?.trim() || undefined,
    tier: 'core',
    libraryState: 'new',
    contexts: [
      {
        resourceId: options.resourceId,
        resourceTitle: options.resourceTitle,
        segmentIndex: options.paragraphIndex ?? 0,
        sentence: original,
        ...(translation ? { translation } : {}),
      },
    ],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    sentence: {
      original,
      translation,
      chunks,
      ...(result.pattern?.trim() ? { pattern: normalize(result.pattern) } : {}),
      ...(result.grammar?.trim() ? { grammar: normalize(result.grammar) } : {}),
      variants,
      ...(result.why?.trim() ? { why: normalize(result.why) } : {}),
      ...(options.paragraphIndex !== undefined ? { paragraphIndex: options.paragraphIndex } : {}),
    },
    notes: result.why?.trim() || undefined,
    tags: ['sentence', ...(result.cefr?.trim() ? [result.cefr.trim()] : [])],
    sourceRef: options.resourceTitle,
    createdAt: now,
    updatedAt: now,
  }

  return item
}
