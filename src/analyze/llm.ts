import { z } from 'zod'

import { config } from '../config.js'
import type { StyleProfile } from '../style/profile.js'
import { stylePromptBlock } from '../style/profile.js'
import type { AnalysisResult, LearningItem, PackExercises, PackFrontMatter, Resource } from '../types.js'
import { lookupWords } from './dictionary.js'
import { chatJson } from './chat.js'
import { getCachedCard, putCachedCard } from './card-cache.js'
import type { CachedCard } from './card-cache.js'
import { fallbackExercises } from './exercises.js'
import { itemId } from './item-id.js'
import { promptKnownLemmas } from './known.js'
import { rawItemSchema, normalizeWordFormation } from './item-schema.js'
import type { RawItem } from './item-schema.js'
import { isSourceHeader, normalizeSourceParagraphs } from '../pack/paragraph-merge.js'
import { fallbackReading } from './reading.js'
import { paragraphNoteSchema, toParagraphNote } from './reading-note-schema.js'
import { extractStandfirst, splitDatedBody } from './reading-frontmatter.js'
import { estimateDifficulty, findContextSentence, sentences } from './tokenize.js'

const extractionSchema = z.object({
  items: z.array(rawItemSchema).default([]),
})

const selectionItemSchema = z.object({
  lemma: z.string().min(1),
  sense: z.string().min(1),
  pos: z.string().optional(),
  cefr: z.string().optional(),
  contextSentence: z.string().min(1),
  contextTranslation: z.string().optional(),
  valueScore: z.number().min(0).max(1).optional(),
})

type SelectionItem = z.infer<typeof selectionItemSchema>

const selectionSchema = z.object({
  items: z.array(selectionItemSchema).default([]),
})

const summarySchema = z.object({
  summary: z.string().min(1),
  cefr: z.string().min(1),
  difficultyReason: z.string().min(1),
})

const exercisesSchema = z.object({
  cloze: z
    .array(
      z.object({
        sentence: z.string().min(1),
        answer: z.string().min(1),
        hint: z.string().optional(),
      }),
    )
    .default([]),
  comprehension: z
    .array(z.object({ question: z.string().min(1), answer: z.string().min(1) }))
    .default([]),
  discussion: z
    .array(z.object({ question: z.string().min(1), answer: z.string().min(1) }))
    .default([]),
})

const frontMatterSchema = z.object({
  titleZh: z.string().nullable().optional(),
  titleNote: z.string().nullable().optional(),
  summaryZh: z.string().nullable().optional(),
  lead: z.string().nullable().optional(),
  leadZh: z.string().nullable().optional(),
  leadNote: z.string().nullable().optional(),
  section: z.string().nullable().optional(),
})

const readingParagraphSchema = z.object({
  index: z.number().int().min(0),
  translation: z.string().min(1),
  itemIndices: z.array(z.number().int().min(0)).default([]),
  note: paragraphNoteSchema.optional(),
})

const readingBatchSchema = z.object({
  paragraphs: z.array(readingParagraphSchema).default([]),
})

interface GeneratedReadingParagraph {
  index: number
  translation: string
  itemIndices: number[]
  note?: z.input<typeof paragraphNoteSchema>
}

const editorialSchema = z.object({
  editorial: z.string().min(1),
})

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

/**
 * How many model calls may be in flight at once. The build is latency-bound, so
 * parallelism is the main lever; raise it with LEARN_LLM_CONCURRENCY when the
 * provider allows more.
 */
const LLM_CONCURRENCY = Math.max(1, Math.min(12, Math.round(Number(process.env.LEARN_LLM_CONCURRENCY ?? 4) || 4)))

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Build cancelled')
}

function chunkText(text: string, maxChars = 6000, maxChunks = 24): string[] {
  const paragraphs = text.split(/\n{2,}/)
  const chunks: string[] = []
  let current = ''

  const push = () => {
    if (current.trim()) chunks.push(current.trim())
    current = ''
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      const parts = paragraph.match(/[^.!?]+[.!?]+/g) ?? [paragraph]
      for (const part of parts) {
        if (current.length + part.length + 1 > maxChars) push()
        current += `${current ? ' ' : ''}${part.trim()}`
      }
      continue
    }
    if (current.length + paragraph.length + 2 > maxChars) push()
    current += `${current ? '\n\n' : ''}${paragraph.trim()}`
  }
  push()
  return chunks.slice(0, maxChunks)
}

function candidateKey(item: { lemma: string; sense: string }): string {
  return `${item.lemma.toLowerCase().trim()}|${item.sense.toLowerCase().replace(/\s+/g, ' ').slice(0, 80)}`
}

function dedupeCandidates(items: SelectionItem[]): SelectionItem[] {
  const merged = new Map<string, SelectionItem>()
  for (const item of items) {
    const key = candidateKey(item)
    const existing = merged.get(key)
    if (!existing || (item.valueScore ?? 0) > (existing.valueScore ?? 0)) merged.set(key, item)
  }
  return [...merged.values()]
}

function rawFromCached(card: CachedCard, candidate: SelectionItem): RawItem {
  return {
    lemma: candidate.lemma,
    sense: candidate.sense,
    pos: candidate.pos ?? card.pos,
    cefr: candidate.cefr ?? card.cefr,
    definition: card.definition,
    definitionZh: card.definitionZh,
    contextSentence: candidate.contextSentence,
    contextTranslation: candidate.contextTranslation,
    collocations: card.collocations,
    examples: card.examples,
    confusables: card.confusables,
    wordFamily: card.wordFamily,
    synonyms: card.synonyms,
    antonyms: card.antonyms,
    notes: card.notes,
    wordFormation: card.wordFormation,
    memoryHook: card.memoryHook,
    valueScore: candidate.valueScore,
  }
}

function cardFromRaw(raw: RawItem): CachedCard {
  return {
    lemma: raw.lemma,
    sense: raw.sense,
    pos: raw.pos,
    cefr: raw.cefr,
    definition: raw.definition,
    definitionZh: raw.definitionZh,
    collocations: raw.collocations ?? [],
    examples: raw.examples ?? [],
    confusables: raw.confusables ?? [],
    wordFamily: raw.wordFamily ?? [],
    synonyms: raw.synonyms ?? [],
    antonyms: raw.antonyms ?? [],
    notes: raw.notes,
    wordFormation: raw.wordFormation ?? undefined,
    memoryHook: raw.memoryHook ?? undefined,
  }
}

function fallbackRaw(candidate: SelectionItem): RawItem {
  return {
    lemma: candidate.lemma,
    sense: candidate.sense,
    pos: candidate.pos,
    cefr: candidate.cefr,
    definition: candidate.sense,
    contextSentence: candidate.contextSentence,
    contextTranslation: candidate.contextTranslation,
    collocations: [],
    examples: [],
    confusables: [],
    wordFamily: [],
    synonyms: [],
    antonyms: [],
    notes: '卡片生成失败，已保留释义与原文语境。',
    valueScore: candidate.valueScore,
  }
}

async function generateCards(
  candidates: SelectionItem[],
  resource: Resource,
  style: StyleProfile | undefined,
  signal: AbortSignal | undefined,
  notes: string[],
  progress: (message: string) => void,
): Promise<Map<string, RawItem>> {
  const result = new Map<string, RawItem>()
  if (candidates.length === 0) return result

  /** Ask for a batch; on failure split it so one bad word cannot sink the rest. */
  const runBatch = async (batch: SelectionItem[]): Promise<Map<string, RawItem>> => {
    checkAbort(signal)
    const list = batch
      .map(
        (candidate, index) =>
          `${index + 1}. ${candidate.lemma} — ${candidate.sense}${candidate.pos ? ` (${candidate.pos})` : ''}${
            candidate.cefr ? ` [${candidate.cefr}]` : ''
          }\n   context: "${candidate.contextSentence}"\n   translation: "${candidate.contextTranslation ?? ''}"`,
      )
      .join('\n')
    try {
      const generated = await chatJson(
        extractionSchema,
        CARD_SYSTEM(style),
        `Source title: ${resource.title}\nTarget level: ${config.level}\n\nCandidates:\n${list}\n\nFill a complete card for every candidate. Return JSON only.`,
        { signal },
      )
      const byKey = new Map((generated.items ?? []).map((item) => [candidateKey(item), item]))
      const out = new Map<string, RawItem>()
      for (const candidate of batch) {
        const generatedItem = byKey.get(candidateKey(candidate))
        const raw = generatedItem ?? fallbackRaw(candidate)
        const normalized: RawItem = {
          ...raw,
          lemma: candidate.lemma,
          sense: candidate.sense,
          contextSentence: candidate.contextSentence,
          contextTranslation: candidate.contextTranslation,
          collocations: raw.collocations ?? [],
          examples: raw.examples ?? [],
          confusables: raw.confusables ?? [],
          wordFamily: raw.wordFamily ?? [],
          synonyms: raw.synonyms ?? [],
          antonyms: raw.antonyms ?? [],
          wordFormation: normalizeWordFormation(raw.wordFormation ?? undefined) ?? null,
        }
        out.set(candidateKey(candidate), normalized)
        if (generatedItem) await putCachedCard(cardFromRaw(normalized))
      }
      return out
    } catch (error) {
      if (signal?.aborted) throw new Error('Build cancelled')
      const message = error instanceof Error ? error.message : String(error)
      if (batch.length > 1) {
        const middle = Math.ceil(batch.length / 2)
        const [left, right] = await Promise.all([
          runBatch(batch.slice(0, middle)),
          runBatch(batch.slice(middle)),
        ])
        return new Map([...left, ...right])
      }
      progress(`Card generation failed for "${batch[0]?.lemma ?? '?'}": ${message}`)
      notes.push(`「${batch[0]?.lemma ?? '?'}」的卡片没有生成完整，已保留释义和原文语境。`)
      return new Map([[candidateKey(batch[0]!), fallbackRaw(batch[0]!)]])
    }
  }

  const batches: SelectionItem[][] = []
  const CARD_BATCH_SIZE = 4
  for (let index = 0; index < candidates.length; index += CARD_BATCH_SIZE) {
    batches.push(candidates.slice(index, index + CARD_BATCH_SIZE))
  }

  let completed = 0
  const maps = await mapLimit(batches, LLM_CONCURRENCY, async (batch) => {
    try {
      return await runBatch(batch)
    } finally {
      completed += 1
      progress(`Generated word cards ${completed}/${batches.length}.`)
    }
  })
  for (const map of maps) for (const [key, value] of map) result.set(key, value)
  return result
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await fn(items[index]!, index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

const READING_BATCH_SIZE = 3
const READING_BATCH_CHARS = 5000

function paragraphBatches(paragraphs: string[]): string[][] {
  const batches: string[][] = []
  let current: string[] = []
  let chars = 0
  for (const paragraph of paragraphs) {
    const tooMany = current.length >= READING_BATCH_SIZE
    const tooLong = current.length > 0 && chars + paragraph.length > READING_BATCH_CHARS
    if (tooMany || tooLong) {
      batches.push(current)
      current = []
      chars = 0
    }
    current.push(paragraph)
    chars += paragraph.length
  }
  if (current.length > 0) batches.push(current)
  return batches
}

async function requestReadingBatch(
  batch: string[],
  offset: number,
  title: string,
  itemList: string,
  signal: AbortSignal | undefined,
  notes: string[],
): Promise<GeneratedReadingParagraph[]> {
  const numbered = batch.map((paragraph, index) => `[${offset + index}] ${paragraph}`).join('\n\n')
  try {
    const generated = await chatJson(
      readingBatchSchema,
      READING_BATCH_SYSTEM,
      `Article title: ${title}\n\nNumbered paragraphs:\n${numbered}\n\nTarget items (use these contextual glosses consistently):\n${itemList}\n\nReturn JSON only.`,
      { maxTokens: 4000, signal },
    )
    return (generated.paragraphs ?? [])
      .filter((paragraph) => paragraph.index >= offset && paragraph.index < offset + batch.length)
      .map((paragraph) => ({ ...paragraph, itemIndices: paragraph.itemIndices ?? [] }))
  } catch (error) {
    if (signal?.aborted) throw new Error('Build cancelled')
    if (batch.length > 1) {
      const middle = Math.ceil(batch.length / 2)
      const left = await requestReadingBatch(batch.slice(0, middle), offset, title, itemList, signal, notes)
      const right = await requestReadingBatch(
        batch.slice(middle),
        offset + middle,
        title,
        itemList,
        signal,
        notes,
      )
      return [...left, ...right]
    }
    notes.push(`Reading notes skipped for one paragraph: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}

function groundedSentence(resource: Resource, candidate: string, lemma: string): string {
  const normalizedCandidate = candidate.replace(/\s+/g, ' ').trim()
  const normalizedText = resource.text.replace(/\s+/g, ' ')
  if (normalizedCandidate && normalizedText.includes(normalizedCandidate)) return candidate.trim()
  return findContextSentence(resource.text, lemma) || candidate.trim()
}

function segmentFor(resource: Resource, sentence: string, lemma: string) {
  return (
    resource.segments.find((segment) => segment.text.includes(sentence)) ??
    resource.segments.find((segment) => segment.text.toLowerCase().includes(lemma.toLowerCase()))
  )
}

function simpleSummary(text: string): string {
  return sentences(text).slice(0, 3).join(' ').slice(0, 800)
}

const SELECTION_SYSTEM = (style?: StyleProfile) => `You are selecting vocabulary for a Chinese learner at CEFR ${config.level}.

Select only items that are genuinely worth learning in context. Prefer sense-level vocabulary, collocations, and useful sentence patterns over proper nouns, numbers, and trivial words. Return a compact candidate list only; the full word cards are generated in a separate step.

For each candidate:
- lemma: base form
- sense: a short English gloss of the meaning used in this text (not every meaning)
- pos: part of speech
- cefr: approximate CEFR level of this item
- contextSentence: copy the exact sentence from the text where the item appears
- contextTranslation: natural, idiomatic Chinese translation of that sentence
- valueScore: 0–1 score for how useful this item is to a Chinese learner

Do not invent facts about the text. Do not quote sentences that are not present. Return JSON only:
{"items":[{"lemma":"...","sense":"...","pos":"...","cefr":"B2","contextSentence":"...","contextTranslation":"...","valueScore":0.8}]}${
  style
    ? '\n\nPrefer the kind of expressions this style reference values; the card details will follow it.'
    : ''
}`

const CARD_SYSTEM = (style?: StyleProfile) => `You are an English lexicographer and instructional designer compiling learning cards for a Chinese learner at CEFR ${config.level}.

The user provides an exact list of candidates. Fill a complete card for every candidate; do not add, remove, merge, or re-select candidates.

For each item:
- lemma: keep the provided lemma
- sense: keep the provided sense
- pos: part of speech
- cefr: approximate CEFR level of this item
- definition: learner-friendly English definition of this sense
- definitionZh: concise, natural Chinese explanation of this sense (avoid word-for-word calques)
- contextSentence: keep the provided context sentence
- contextTranslation: keep the provided Chinese translation
- collocations: 2-4 natural collocations or chunks using this sense
- examples: 1-2 natural example sentences, different from the context sentence
- confusables: similar words or common learner errors, if any
- wordFamily: derivatives, if any
- synonyms / antonyms: only when genuinely useful
- notes: usage, register, or Chinese-L1 interference notes in Chinese, if useful
- wordFormation: roots, prefixes and suffixes that genuinely help remember this word; each has a short Chinese meaning and 2-4 example words. Leave the arrays empty when the word is not usefully decomposable.
- memoryHook: a short, accurate mnemonic or usage hook in Chinese (optional)

When wordFormation is useful, use exactly this shape:
"wordFormation": {
  "roots": [{"form": "spect", "meaning": "看", "examples": ["inspect", "respect"]}],
  "prefixes": [{"form": "re-", "meaning": "再次", "examples": ["rebuild", "reconsider"]}],
  "suffixes": [{"form": "-tion", "meaning": "名词后缀", "examples": ["action", "creation"]}]
}
Omit empty arrays or the whole field when it is not useful.

Do not invent facts about the text. Return JSON only:
{"items":[{...}]}${
  style
    ? '\n\nWrite definitionZh and notes in a lively, teacherly voice consistent with the style reference; keep them concise.'
    : ''
}`

const SUMMARY_SYSTEM = () => `Summarize the following English text for a Chinese learner at CEFR ${config.level}.
Write 3-4 sentences in English, then estimate the text's CEFR level and explain briefly in Chinese.
Return JSON only: {"summary":"...","cefr":"B2","difficultyReason":"..."}`

const EXERCISES_SYSTEM = () => `You are an English teacher creating exercises from a text and a list of target items.
Return JSON only:
{
  "cloze":[{"sentence":"... ______ ...","answer":"...","hint":"..."}],
  "comprehension":[{"question":"...","answer":"..."}],
  "discussion":[{"question":"...","answer":"..."}]
}
Rules:
- cloze: 6-10 items taken from the text; each blank tests a collocation, register choice or logical connector, not an obscure word.
- comprehension: 4-6 items mixing fact, inference, main idea and "why did the author use this word/phrase"; every answer must be supported by a specific part of the text.
- discussion: 2-4 questions that connect the article's argument to the learner's experience; each answer is a 1-3 sentence reference response with a view AND a reason, not just a hint.
- Cover the article's main thread; do not ask about trivial details.`

const READING_RULES = `Style rules:
- Keep the Chinese natural and learner-friendly, never word-for-word.
- Translate titles, headings, idioms and figurative phrases by their contextual meaning, never word-for-word. When a target item is listed with a Chinese gloss, reuse that sense consistently wherever the item appears, including titleZh and leadZh (for example, "lose the plot" means 迷失方向/乱了阵脚, never 失去剧情).
- Keep every note field to one short Chinese sentence (roughly 40 characters or fewer); connectors at most 3; background and question may be "".
JSON rules:
- Every string must be valid JSON. Escape ASCII double quotes as \\", and inside Chinese text use 「」 or “” instead of raw ASCII double quotes. No trailing commas, no Markdown fences, no prose outside the object.
- Do not invent quotations or facts.`

const READING_HEAD_SYSTEM = `You are preparing the head of a bilingual intensive-reading page for a Chinese learner.
Return frontMatter for the article head:
- titleZh: natural Chinese translation of the article title
- titleNote: one concise Chinese note on the title's wording, image, or stance
- summaryZh: a 2-3 sentence Chinese summary of the article
- lead: the short standfirst/deck printed directly under the headline, copied exactly from the source (never the first body sentence), or "" when the source has none
- leadZh: natural Chinese translation of lead
- leadNote: one concise Chinese note on the lead's structure or rhetorical job
- section: the magazine section/column if evident, otherwise ""
${READING_RULES}
Return JSON only: {"titleZh":"...","titleNote":"...","summaryZh":"...","lead":"...","leadZh":"...","leadNote":"...","section":"..."}`

const READING_BATCH_SYSTEM = `You are preparing a paragraph-by-paragraph bilingual intensive-reading page for a Chinese learner.
You receive one numbered batch of article paragraphs. Treat each bracketed number as one finished paragraph: do not merge, split, reorder, or add paragraphs.
For each numbered paragraph return:
- index: the bracketed number, unchanged
- translation: natural Chinese translation
- itemIndices: 0-based indices of the target items that appear in this paragraph (an item may appear in more than one paragraph)
- note: a compact intensive-reading annotation:
  - summary: one Chinese sentence summarizing the paragraph's job, not a translation
  - role: a short label such as 背景 / 论点 / 例证 / 对比 / 转折 / 结论
  - keySentence: one exact sentence from the paragraph that is worth studying (or "")
  - keySentenceNote: concise Chinese analysis of that sentence's structure, rhetoric, or why it matters
  - grammar: one concise Chinese grammar/usage note from the paragraph (or "")
  - connectors: 0-3 discourse connectors with {"text":"...","usage":"中文作用"}
  - background: optional one-sentence Chinese background or cultural note (or "")
  - question: one short Chinese comprehension or reflection question (or "")
Return exactly one entry per numbered paragraph, in the same order.
${READING_RULES}
Return JSON only: {"paragraphs":[{"index":0,"translation":"...","itemIndices":[0,3],"note":{"summary":"...","role":"论点","keySentence":"...","keySentenceNote":"...","grammar":"...","connectors":[{"text":"Instead","usage":"转折"}],"background":"","question":"..."}}]}`

const EDITORIAL_SYSTEM = (style: StyleProfile) => `You are a Chinese English-learning writer. Write a long-form Chinese learning note in the style described below.

Use only the source excerpt and target items provided. Do not invent quotations or facts. Mark any invented example sentence as “仿写”.
All Chinese translations must read naturally, like something a Chinese English teacher would write — never translate word-for-word.

Structure:
1. A hook in Chinese that connects the source to a real learner problem.
2. One to three short English source sentences with natural Chinese translations. Use short excerpts; never quote long passages.
3. Eight to ten detailed expressions, or the count specified by the style reference. For each: a numbered heading such as '## 01 word', the expression, IPA when available, its contextual meaning, nuance/register, collocations, and 1-2 English examples with Chinese translations.
4. One short grammar/long-sentence breakdown or one reusable writing pattern, with an example.
5. A short output task (writing, speaking, or translation) with 2-3 feedback criteria.
6. A numbered recap of the expressions.

Write 1000-1800 Chinese characters, or the length specified by the style reference. If the style reference specifies a different number of expressions or a lighter/denser format, follow the style reference. Use Markdown headings and short paragraphs. Do not start with an H1 title; start directly with the hook. Return JSON only: {"editorial":"Markdown body"}.
${stylePromptBlock(style)}`

export async function analyzeWithLlm(
  resource: Resource,
  limit: number,
  style?: StyleProfile,
  onProgress?: (message: string) => void,
  signal?: AbortSignal,
  knownLemmas?: string[],
  avoidLemmas?: string[],
  existingLemmas?: string[],
): Promise<AnalysisResult> {
  checkAbort(signal)
  const chunks = chunkText(resource.text)
  const candidateTarget = Math.min(90, Math.max(limit + 6, Math.ceil(limit * 1.5)))
  const perChunk = Math.max(3, Math.ceil(candidateTarget / Math.max(1, chunks.length)))
  const known = promptKnownLemmas(knownLemmas ?? [])
  const avoid = promptKnownLemmas(avoidLemmas ?? [])
  const existing = promptKnownLemmas(
    (existingLemmas ?? []).filter(
      (lemma) => !known.includes(lemma.toLowerCase().trim()) && !avoid.includes(lemma.toLowerCase().trim()),
    ),
    80,
  )
  const knownSet = new Set(known)
  const avoidSet = new Set(avoid)
  const avoidBlock =
    known.length || avoid.length
      ? `\n\nThe learner already knows these words or has asked to skip them; do not select them: ${[...known, ...avoid].join(', ')}.`
      : ''
  const existingBlock = existing.length
    ? `\n\nThese words are already in the learner's library. Prefer genuinely new items; only include one when it is central to this text, because it will be shown as reinforcement rather than new review material: ${existing.join(', ')}.`
    : ''
  const notes: string[] = [`LLM extraction: ${config.llm.model}`]
  const progress = onProgress ?? (() => {})
  progress(`Extracting from ${chunks.length} text chunk${chunks.length === 1 ? '' : 's'}…`)

  let completedChunks = 0
  const noted: string[] = []
  const extractions = await mapLimit(chunks, LLM_CONCURRENCY, async (chunk, index) => {
    try {
      const result = await chatJson(
        selectionSchema,
        SELECTION_SYSTEM(style),
        `Text chunk ${index + 1} of ${chunks.length}:\n"""\n${chunk}\n"""\n\nSelect at most ${perChunk} candidates.${avoidBlock}${existingBlock} Return JSON only.`,
        // One candidate is roughly 120 tokens of JSON; without a raised limit a
        // 45-item request is cut off and the whole chunk looks like a failure.
        { signal, maxTokens: Math.min(8000, 800 + perChunk * 160) },
      )
      return result.items
    } catch (error) {
      if (signal?.aborted) throw new Error('Build cancelled')
      const detail = error instanceof Error ? error.message : String(error)
      noted.push(detail)
      notes.push(`第 ${index + 1}/${chunks.length} 段选取没有成功，这部分文章未进入学习包。`)
      return []
    } finally {
      completedChunks += 1
      progress(`Selected candidates from chunk ${completedChunks}/${chunks.length}.`)
    }
  })

  if (noted.length) progress(`Selection errors: ${noted.join(' | ')}`)

  const extracted = extractions.flat().filter((item): item is SelectionItem => Boolean(item))
  const filteredKnown = extracted.filter(
    (item) => !knownSet.has(item.lemma.toLowerCase().trim()) && !avoidSet.has(item.lemma.toLowerCase().trim()),
  )
  if (filteredKnown.length < extracted.length) {
    notes.push(`Excluded ${extracted.length - filteredKnown.length} known or skipped words.`)
  }
  const candidates = dedupeCandidates(filteredKnown)
    .sort((a, b) => (b.valueScore ?? 0) - (a.valueScore ?? 0))
    .slice(0, limit)
  if (candidates.length === 0) {
    throw new Error(`LLM selection returned no new items. ${notes.join(' | ')}`)
  }

  const cachedByKey = new Map<string, RawItem>()
  const missing: SelectionItem[] = []
  for (const candidate of candidates) {
    const cached = await getCachedCard(candidate.lemma, candidate.sense)
    if (cached) cachedByKey.set(candidateKey(candidate), rawFromCached(cached, candidate))
    else missing.push(candidate)
  }
  progress(
    `Selected ${candidates.length} candidates; ${cachedByKey.size} cache hits, ${missing.length} cards to generate…`,
  )
  const generated = await generateCards(missing, resource, style, signal, notes, progress)
  const rawItems = candidates.map(
    (candidate) =>
      cachedByKey.get(candidateKey(candidate)) ??
      generated.get(candidateKey(candidate)) ??
      fallbackRaw(candidate),
  )
  if (cachedByKey.size > 0) {
    notes.push(`Reused ${cachedByKey.size} cached word cards.`)
  }

  progress(`Found ${rawItems.length} candidates; looking up dictionary data…`)
  const dictionary = await lookupWords(rawItems.map((item) => item.lemma))
  const now = new Date().toISOString()

  const items: LearningItem[] = rawItems.map((raw) => {
    const info = dictionary.get(raw.lemma.toLowerCase())
    const contextSentence = groundedSentence(resource, raw.contextSentence, raw.lemma)
    const segment = segmentFor(resource, contextSentence, raw.lemma)
    const examples = [
      ...(contextSentence ? [{ text: contextSentence, origin: 'source' as const }] : []),
      ...raw.examples.map((text) => ({ text, origin: 'generated' as const })),
      ...(info?.examples ?? []).map((text) => ({ text, origin: 'dictionary' as const })),
    ]
    const seen = new Set<string>()
    const uniqueExamples = examples.filter((example) => {
      const key = example.text.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

    return {
      id: itemId(raw.lemma, raw.sense),
      type: 'word_sense',
      lemma: raw.lemma,
      sense: raw.sense,
      pos: raw.pos ?? info?.partOfSpeech,
      ipa: info?.phonetic,
      definition: raw.definition || info?.definition || raw.sense,
      definitionZh: raw.definitionZh,
      cefr: raw.cefr,
      contexts: [
        {
          resourceId: resource.id,
          resourceTitle: resource.title,
          segmentIndex: segment?.index ?? 0,
          sentence: contextSentence,
          page: segment?.page,
          timestamp: segment?.timestamp,
          translation: raw.contextTranslation,
        },
      ],
      collocations: unique(raw.collocations),
      examples: uniqueExamples,
      relations: {
        synonyms: unique([...raw.synonyms, ...(info?.synonyms ?? [])]),
        antonyms: unique([...raw.antonyms, ...(info?.antonyms ?? [])]),
        confusables: unique(raw.confusables),
        wordFamily: unique(raw.wordFamily),
      },
      notes: raw.notes,
      wordFormation: normalizeWordFormation(raw.wordFormation ?? undefined),
      memoryHook: raw.memoryHook ?? undefined,
      tags: [raw.pos, raw.cefr].filter((value): value is string => Boolean(value)),
      sourceRef: `${resource.title}${segment?.page ? `, p.${segment.page}` : ''}${
        segment?.timestamp ? ` @ ${segment.timestamp}` : ''
      }`,
      createdAt: now,
      updatedAt: now,
    }
  })

  checkAbort(signal)
  progress('Writing the summary, exercises and bilingual reading in parallel…')

  const summaryTask = (async () => {
    let summary = simpleSummary(resource.text)
    let difficulty = estimateDifficulty(resource.text)
    checkAbort(signal)
    try {
      const summaryResult = await chatJson(
        summarySchema,
        SUMMARY_SYSTEM(),
        `Text:\n"""\n${resource.text.slice(0, 14_000)}\n"""\n\nReturn JSON only.`,
        { signal },
      )
      summary = summaryResult.summary
      difficulty = { cefr: summaryResult.cefr, reason: summaryResult.difficultyReason }
    } catch (error) {
      notes.push(`Summary failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    return { summary, difficulty }
  })()

  const exercisesTask = (async () => {
    let exercises: PackExercises = fallbackExercises(items)
    checkAbort(signal)
    try {
      const generated = await chatJson(
        exercisesSchema,
        EXERCISES_SYSTEM(),
        `Target items:\n${items
          .map((item) => `- ${item.lemma}: ${item.sense}`)
          .join('\n')}\n\nText excerpt:\n"""\n${resource.text.slice(0, 12_000)}\n"""\n\nReturn JSON only.`,
        { signal },
      )
      exercises = {
        cloze: generated.cloze ?? [],
        comprehension: generated.comprehension ?? [],
        discussion: generated.discussion ?? [],
      }
    } catch (error) {
      notes.push(`Exercises failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    return exercises
  })()

  const readingTask = (async () => {
    let reading = fallbackReading(resource, items)
    let frontMatter: PackFrontMatter | undefined
    checkAbort(signal)
    const readingSource = normalizeSourceParagraphs(splitDatedBody(resource.text, resource.title), resource.title)
    const allParagraphs = readingSource
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(
        (paragraph) =>
          paragraph &&
          !/^#{1,6}\s/.test(paragraph) &&
          !isSourceHeader(paragraph, resource.title),
      )
    const sourceParagraphs: string[] = []
    let usedChars = 0
    for (const paragraph of allParagraphs) {
      if (usedChars + paragraph.length + 2 > 18_000 && sourceParagraphs.length > 0) break
      sourceParagraphs.push(paragraph)
      usedChars += paragraph.length + 2
    }
    if (sourceParagraphs.length < allParagraphs.length) {
      notes.push('Reading generation used the first part of a long document.')
    }
    const standfirst = extractStandfirst(resource.text, resource.title)
    const headTask = (async () => {
      const prompt = `Article title: ${resource.title}\n\nStandfirst: ${standfirst ?? '(none)'}\n\nOpening excerpt:\n"""\n${resource.text.slice(0, 2000)}\n"""\n\nReturn JSON only.`
      try {
        return await chatJson(frontMatterSchema, READING_HEAD_SYSTEM, prompt, { maxTokens: 3000, signal })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // A truncated reply used to leave the page head empty for the rest of the
        // build. Ask once more with a tighter brief before giving up.
        if (/cut off/i.test(message) && !signal?.aborted) {
          try {
            return await chatJson(
              frontMatterSchema,
              `${READING_HEAD_SYSTEM}\nKeep every field short: titleNote/leadNote under 40 Chinese characters, summaryZh at most 2 sentences.`,
              prompt,
              { maxTokens: 4000, signal },
            )
          } catch (retryError) {
            notes.push(`Reading head failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`)
            return undefined
          }
        }
        notes.push(`Reading head failed: ${message}`)
        return undefined
      }
    })()

    const itemList = items
      .map(
        (item, index) =>
          `${index}. ${item.lemma} — ${item.sense}${item.definitionZh ? `（${item.definitionZh}）` : ''}`,
      )
      .join('\n')
    let offset = 0
    const batchRanges = paragraphBatches(sourceParagraphs).map((batch) => {
      const start = offset
      offset += batch.length
      return { batch, offset: start }
    })
    const generated =
      batchRanges.length > 0
        ? (
            await mapLimit(batchRanges, LLM_CONCURRENCY, (range) =>
              requestReadingBatch(range.batch, range.offset, resource.title, itemList, signal, notes),
            )
          ).flat()
        : []

    const generatedFrontMatter = await headTask
    if (generatedFrontMatter) {
      const generatedLead = generatedFrontMatter.lead?.replace(/\s+/g, ' ').trim() ?? ''
      const leadMatches =
        Boolean(standfirst) &&
        generatedLead.toLowerCase().replace(/[’‘]/g, "'") ===
          standfirst!.toLowerCase().replace(/[’‘]/g, "'")
      frontMatter = {
        title: resource.title,
        ...(generatedFrontMatter.titleZh?.trim() ? { titleZh: generatedFrontMatter.titleZh.trim() } : {}),
        ...(generatedFrontMatter.titleNote?.trim() ? { titleNote: generatedFrontMatter.titleNote.trim() } : {}),
        ...(generatedFrontMatter.summaryZh?.trim() ? { summaryZh: generatedFrontMatter.summaryZh.trim() } : {}),
        ...(standfirst ? { lead: standfirst } : {}),
        ...(standfirst && leadMatches && generatedFrontMatter.leadZh?.trim()
          ? { leadZh: generatedFrontMatter.leadZh.trim() }
          : {}),
        ...(standfirst && leadMatches && generatedFrontMatter.leadNote?.trim()
          ? { leadNote: generatedFrontMatter.leadNote.trim() }
          : {}),
        ...(generatedFrontMatter.section?.trim() ? { section: generatedFrontMatter.section.trim() } : {}),
        itemIds: [],
      }
    }
    const byIndex = new Map(generated.map((paragraph) => [paragraph.index, paragraph]))
    if (sourceParagraphs.length > 0) {
      reading = sourceParagraphs.map((original, index) => {
        const paragraph = byIndex.get(index)
        const sourceSegment =
          resource.segments.find((segment) => segment.text.includes(original)) ?? resource.segments[index]
        return {
          index,
          original,
          ...(typeof sourceSegment?.page === 'number' ? { page: sourceSegment.page } : {}),
          ...(sourceSegment?.timestamp ? { timestamp: sourceSegment.timestamp } : {}),
          ...(paragraph?.translation ? { translation: paragraph.translation } : {}),
          itemIds: (paragraph?.itemIndices ?? [])
            .map((itemIndex) => items[itemIndex]?.id)
            .filter((id): id is string => Boolean(id)),
          ...(paragraph?.note ? { note: toParagraphNote(paragraph.note, original) } : {}),
        }
      })
    }
    return { reading, frontMatter }
  })()

  const editorialTask = (async () => {
    if (!style) return undefined
    const { summary } = await summaryTask
    checkAbort(signal)
    try {
      const editorialItems = items.slice(0, 10).map((item) => ({
        lemma: item.lemma,
        sense: item.sense,
        definitionZh: item.definitionZh,
        context: item.contexts[0]?.sentence,
        translation: item.contexts[0]?.translation,
        collocations: item.collocations,
        examples: item.examples.filter((example) => example.origin !== 'source').slice(0, 2).map((example) => example.text),
      }))
      const generated = await chatJson(
        editorialSchema,
        EDITORIAL_SYSTEM(style),
        `Source title: ${resource.title}\nSource: ${resource.source}\nSummary: ${summary}\n\nTarget items:\n${JSON.stringify(
          editorialItems,
          null,
          2,
        )}\n\nSource excerpt:\n"""\n${resource.text.slice(0, 8000)}\n"""\n\nReturn JSON only.`,
        { signal },
      )
      return generated.editorial
    } catch (error) {
      notes.push(`Editorial failed: ${error instanceof Error ? error.message : String(error)}`)
      return undefined
    }
  })()

  const [summaryResult, exercises, readingResult, editorial] = await Promise.all([
    summaryTask,
    exercisesTask,
    readingTask,
    editorialTask,
  ])
  const summary = summaryResult.summary
  const difficulty = summaryResult.difficulty
  const reading = readingResult.reading
  let frontMatter = readingResult.frontMatter

  const frontLead = frontMatter?.lead
  if (
    frontLead &&
    reading.some((paragraph) =>
      paragraph.original.replace(/\s+/g, ' ').toLowerCase().includes(frontLead.toLowerCase()),
    )
  ) {
    const { lead, leadZh, leadNote, ...rest } = frontMatter!
    frontMatter = rest
  }

  return { summary, difficulty, items, exercises, reading, notes, editorial, frontMatter, cachedCards: cachedByKey.size }
}
