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
import { normalizeSourceParagraphs } from '../pack/paragraph-merge.js'
import { fallbackReading, groundParagraph } from './reading.js'
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

const readingSchema = z.object({
  frontMatter: frontMatterSchema.optional(),
  paragraphs: z
    .array(
      z.object({
        original: z.string().min(1),
        translation: z.string().min(1),
        itemIndices: z.array(z.number().int().min(0)).default([]),
        note: paragraphNoteSchema.optional(),
      }),
    )
    .default([]),
})

const editorialSchema = z.object({
  editorial: z.string().min(1),
})

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

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
  const batches: SelectionItem[][] = []
  for (let index = 0; index < candidates.length; index += 5) {
    batches.push(candidates.slice(index, index + 5))
  }

  let completed = 0
  await mapLimit(batches, 2, async (batch) => {
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
        result.set(candidateKey(candidate), normalized)
        if (generatedItem) await putCachedCard(cardFromRaw(normalized))
      }
    } catch (error) {
      if (signal?.aborted) throw new Error('Build cancelled')
      notes.push(`Card generation failed for a batch: ${error instanceof Error ? error.message : String(error)}`)
      for (const candidate of batch) result.set(candidateKey(candidate), fallbackRaw(candidate))
    } finally {
      completed += 1
      progress(`Generated word cards ${completed}/${batches.length}.`)
    }
  })
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
Rules: cloze sentences must come from the text; comprehension answers must be supported by the text; discussion questions should invite an opinion or personal response, and each answer must be a 1-3 sentence reference answer, not just a hint.`

const READING_SYSTEM = `You are preparing a paragraph-by-paragraph bilingual intensive-reading page for a Chinese learner.
Split the source into its natural body paragraphs. Skip title and heading lines; do not include them as paragraphs. Keep the original order and copy each paragraph verbatim.
If a paragraph ends with an article, preposition, conjunction, or no terminal punctuation, merge it with the following paragraph and translate the merged paragraph as one unit.
Also return frontMatter for the article head:
- titleZh: natural Chinese translation of the article title
- titleNote: one concise Chinese note on the title's wording, image, or stance
- summaryZh: a 2-3 sentence Chinese summary of the article
- lead: the short standfirst/deck printed directly under the headline, copied exactly from the source (never the first body sentence), or "" when the source has none
- leadZh: natural Chinese translation of lead
- leadNote: one concise Chinese note on the lead's structure or rhetorical job
- section: the magazine section/column if evident, otherwise ""
For each paragraph return:
- original: the exact paragraph
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

Do not invent quotations or facts. Keep the Chinese natural and learner-friendly, never word-for-word. Do not merge paragraphs.
Return JSON only: {"frontMatter":{"titleZh":"...","titleNote":"...","summaryZh":"...","lead":"...","leadZh":"...","leadNote":"...","section":"..."},"paragraphs":[{"original":"...","translation":"...","itemIndices":[0,3],"note":{"summary":"...","role":"论点","keySentence":"...","keySentenceNote":"...","grammar":"...","connectors":[{"text":"Instead","usage":"转折"}],"background":"","question":"..."}}]}`

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
  const candidateTarget = Math.min(40, Math.max(limit, Math.ceil(limit * 1.6)))
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
  const extractions = await mapLimit(chunks, 2, async (chunk, index) => {
    try {
      const result = await chatJson(
        selectionSchema,
        SELECTION_SYSTEM(style),
        `Text chunk ${index + 1} of ${chunks.length}:\n"""\n${chunk}\n"""\n\nSelect at most ${perChunk} candidates.${avoidBlock}${existingBlock} Return JSON only.`,
        { signal },
      )
      return result.items
    } catch (error) {
      if (signal?.aborted) throw new Error('Build cancelled')
      notes.push(`Chunk ${index + 1} failed: ${error instanceof Error ? error.message : String(error)}`)
      return []
    } finally {
      completedChunks += 1
      progress(`Selected candidates from chunk ${completedChunks}/${chunks.length}.`)
    }
  })

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

  let summary = simpleSummary(resource.text)
  let difficulty = estimateDifficulty(resource.text)
  checkAbort(signal)
  progress('Writing summary and difficulty…')
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

  let exercises: PackExercises = fallbackExercises(items)
  checkAbort(signal)
  progress('Writing exercises and discussion questions…')
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

  let reading = fallbackReading(resource, items)
  let frontMatter: PackFrontMatter | undefined
  checkAbort(signal)
  progress('Writing the bilingual paragraph reading…')
  const readingSource = normalizeSourceParagraphs(splitDatedBody(resource.text, resource.title), resource.title)
  const readingText = readingSource.length > 18_000 ? readingSource.slice(0, 18_000) : readingSource
  if (readingText.length < readingSource.length) {
    notes.push('Reading generation used the first part of a long document.')
  }
  try {
    const itemList = items.map((item, index) => `${index}. ${item.lemma} — ${item.sense}`).join('\n')
    const generated = await chatJson(
      readingSchema,
      READING_SYSTEM,
      `Text:\n"""\n${readingText}\n"""\n\nTarget items:\n${itemList}\n\nReturn JSON only.`,
      { maxTokens: 9000, signal },
    )
    const generatedFrontMatter = generated.frontMatter
    const standfirst = extractStandfirst(resource.text, resource.title)
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
    const paragraphs = (generated.paragraphs ?? []).filter(
      (paragraph) => !/^#{1,6}\s/.test(paragraph.original.trim()),
    )
    if (paragraphs.length > 0) {
      reading = paragraphs.map((paragraph, index) => {
        const original = groundParagraph(resource, paragraph.original, index)
        return {
          index,
          original,
          translation: paragraph.translation,
          itemIds: (paragraph.itemIndices ?? [])
            .map((itemIndex) => items[itemIndex]?.id)
            .filter((id): id is string => Boolean(id)),
          ...(paragraph.note ? { note: toParagraphNote(paragraph.note, original) } : {}),
        }
      })
    }
  } catch (error) {
    notes.push(`Reading failed: ${error instanceof Error ? error.message : String(error)}`)
  }

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

  let editorial: string | undefined
  if (style) {
    checkAbort(signal)
    progress('Writing the styled editorial…')
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
      editorial = generated.editorial
    } catch (error) {
      notes.push(`Editorial failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { summary, difficulty, items, exercises, reading, notes, editorial, frontMatter, cachedCards: cachedByKey.size }
}
