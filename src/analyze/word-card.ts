import { z } from 'zod'

import { chatJson } from './chat.js'
import { getCachedCard, putCachedCard } from './card-cache.js'
import { lookupWords } from './dictionary.js'
import { hasLlm } from '../config.js'
import { itemId } from './item-id.js'
import { rawItemSchema, wordFormationSchema, normalizeWordFormation } from './item-schema.js'
import type { CachedCard } from './card-cache.js'
import type { LearningItem, StoredItem } from '../types.js'

const wordCardSchema = z.object({
  item: rawItemSchema,
})

const relationsSchema = z.object({
  synonyms: z.array(z.string()).default([]),
  antonyms: z.array(z.string()).default([]),
  confusables: z.array(z.string()).default([]),
  wordFamily: z.array(z.string()).default([]),
  wordFormation: z.preprocess(
    (value) => (typeof value === 'string' ? undefined : value),
    wordFormationSchema.nullable().optional(),
  ),
  memoryHook: z.string().nullable().optional(),
})

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

/** Fill in missing relations/morphology for an isolated word. */
export async function enrichWordRelations<T extends LearningItem>(item: T): Promise<T> {
  if (!hasLlm()) throw new Error('补全关系需要配置 LLM。')
  const result = await chatJson(
    relationsSchema,
    `You are enriching a word card in a Chinese learner's vocabulary network.
Return only real, useful relationships. It is fine to return empty arrays. Prefer common single-word or short-phrase synonyms/antonyms; do not invent obscure words. Shared roots/prefixes/suffixes should genuinely help memory.
Return JSON only: {"synonyms":[],"antonyms":[],"confusables":[],"wordFamily":[],"wordFormation":null,"memoryHook":""}`,
    `Word: ${item.lemma}
Sense: ${item.sense}
Definition: ${item.definition}
Existing synonyms: ${item.relations.synonyms.join(', ') || '(none)'}
Existing antonyms: ${item.relations.antonyms.join(', ') || '(none)'}
Existing word family: ${item.relations.wordFamily.join(', ') || '(none)'}
Existing confusables: ${item.relations.confusables.join(', ') || '(none)'}

Return extra relationships and a concise Chinese memory hook.`,
    { maxTokens: 800 },
  )
  item.relations = {
    synonyms: unique([...item.relations.synonyms, ...(result.synonyms ?? [])]),
    antonyms: unique([...item.relations.antonyms, ...(result.antonyms ?? [])]),
    confusables: unique([...item.relations.confusables, ...(result.confusables ?? [])]),
    wordFamily: unique([...item.relations.wordFamily, ...(result.wordFamily ?? [])]),
  }
  const formation = normalizeWordFormation(result.wordFormation ?? undefined)
  if (formation) item.wordFormation = formation
  if (result.memoryHook?.trim() && !item.memoryHook) item.memoryHook = result.memoryHook.trim()

  await putCachedCard({
    lemma: item.lemma,
    sense: item.sense,
    pos: item.pos,
    cefr: item.cefr,
    definition: item.definition,
    definitionZh: item.definitionZh,
    collocations: item.collocations,
    examples: item.examples.filter((example) => example.origin !== 'source').map((example) => example.text),
    confusables: item.relations.confusables,
    wordFamily: item.relations.wordFamily,
    synonyms: item.relations.synonyms,
    antonyms: item.relations.antonyms,
    notes: item.notes,
    wordFormation: item.wordFormation,
    memoryHook: item.memoryHook,
  })
  return item
}

function itemFromCard(card: CachedCard): LearningItem {
  const now = new Date().toISOString()
  const context = card.examples[0] ?? `A useful word: ${card.lemma}.`
  return {
    id: itemId(card.lemma, card.sense),
    type: 'word_sense',
    lemma: card.lemma,
    sense: card.sense,
    pos: card.pos,
    ipa: undefined,
    definition: card.definition,
    definitionZh: card.definitionZh,
    cefr: card.cefr,
    tier: 'core',
    libraryState: 'new',
    contexts: [
      {
        resourceId: 'word-graph',
        resourceTitle: '词网',
        segmentIndex: 0,
        sentence: context,
      },
    ],
    collocations: card.collocations,
    examples: card.examples.map((text) => ({ text, origin: 'generated' as const })),
    relations: {
      synonyms: card.synonyms,
      antonyms: card.antonyms,
      confusables: card.confusables,
      wordFamily: card.wordFamily,
    },
    wordFormation: card.wordFormation,
    memoryHook: card.memoryHook,
    notes: card.notes,
    tags: [card.pos, card.cefr].filter((value): value is string => Boolean(value)),
    sourceRef: '词网 · 手动加入',
    createdAt: now,
    updatedAt: now,
  }
}

/** Build one standalone card for a ghost node and make it reviewable. */
export async function generateWordCard(lemma: string): Promise<LearningItem> {
  const clean = lemma.trim()
  if (!clean) throw new Error('Word is empty.')

  const cached = await getCachedCard(clean, '')
  if (cached) {
    const item = itemFromCard(cached)
    const lookup = (await lookupWords([clean])).get(clean.toLowerCase())
    if (lookup?.phonetic) item.ipa = lookup.phonetic
    return item
  }

  if (!hasLlm()) {
    const lookup = (await lookupWords([clean])).get(clean.toLowerCase())
    if (!lookup) throw new Error(`No card is available for "${clean}". Configure an LLM to generate one.`)
    return itemFromCard({
      lemma: lookup.word,
      sense: lookup.definition ?? clean,
      pos: lookup.partOfSpeech,
      definition: lookup.definition ?? clean,
      definitionZh: undefined,
      collocations: [],
      examples: lookup.examples,
      confusables: [],
      wordFamily: [],
      synonyms: lookup.synonyms,
      antonyms: lookup.antonyms,
      notes: '词网手动加入；配置 LLM 可获得更完整的中文卡片。',
    })
  }

  const generated = await chatJson(
    wordCardSchema,
    `You are adding one English word to a Chinese learner's word graph. Generate exactly one complete learning card.
Use learner-friendly English definitions and concise, natural Chinese explanations. Include collocations, one or two examples, synonyms/antonyms when useful, word roots/affixes when genuinely useful, and a short Chinese memory hook.
Return JSON only: {"item":{"lemma":"...","sense":"...","pos":"...","cefr":"B2","definition":"...","definitionZh":"...","contextSentence":"...","contextTranslation":"...","collocations":[],"examples":[],"confusables":[],"wordFamily":[],"synonyms":[],"antonyms":[],"notes":"...","wordFormation":null,"memoryHook":"..."}}`,
    `Word or phrase: ${clean}\nTarget level: ${process.env.LEARN_LEVEL ?? 'B2'}\nReturn one card.`,
    { maxTokens: 2200 },
  )
  const raw = generated.item
  const lookup = (await lookupWords([raw.lemma])).get(raw.lemma.toLowerCase())
  const now = new Date().toISOString()
  const item: LearningItem = {
    id: itemId(raw.lemma, raw.sense),
    type: 'word_sense',
    lemma: raw.lemma,
    sense: raw.sense,
    pos: raw.pos ?? lookup?.partOfSpeech,
    ipa: lookup?.phonetic,
    definition: raw.definition || lookup?.definition || raw.sense,
    definitionZh: raw.definitionZh,
    cefr: raw.cefr,
    tier: 'core',
    libraryState: 'new',
    contexts: [
      {
        resourceId: 'word-graph',
        resourceTitle: '词网',
        segmentIndex: 0,
        sentence: raw.contextSentence,
        translation: raw.contextTranslation,
      },
    ],
    collocations: raw.collocations ?? [],
    examples: [
      { text: raw.contextSentence, origin: 'generated' as const },
      ...(raw.examples ?? []).map((text) => ({ text, origin: 'generated' as const })),
    ],
    relations: {
      synonyms: raw.synonyms ?? [],
      antonyms: raw.antonyms ?? [],
      confusables: raw.confusables ?? [],
      wordFamily: raw.wordFamily ?? [],
    },
    wordFormation: normalizeWordFormation(raw.wordFormation ?? undefined),
    memoryHook: raw.memoryHook ?? undefined,
    notes: raw.notes,
    tags: [raw.pos, raw.cefr].filter((value): value is string => Boolean(value)),
    sourceRef: '词网 · 手动加入',
    createdAt: now,
    updatedAt: now,
  }

  await putCachedCard({
    lemma: item.lemma,
    sense: item.sense,
    pos: item.pos,
    cefr: item.cefr,
    definition: item.definition,
    definitionZh: item.definitionZh,
    collocations: item.collocations,
    examples: raw.examples ?? [],
    confusables: item.relations.confusables,
    wordFamily: item.relations.wordFamily,
    synonyms: item.relations.synonyms,
    antonyms: item.relations.antonyms,
    notes: item.notes,
    wordFormation: item.wordFormation,
    memoryHook: item.memoryHook,
  })
  return item
}
