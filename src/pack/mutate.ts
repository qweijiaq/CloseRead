import fs from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { chatJson } from '../analyze/chat.js'
import { lookupWords } from '../analyze/dictionary.js'
import { itemId } from '../analyze/item-id.js'
import { rawItemSchema, normalizeWordFormation } from '../analyze/item-schema.js'
import { findContextSentence } from '../analyze/tokenize.js'
import { hasLlm } from '../config.js'
import { loadStyleProfile, stylePromptBlock } from '../style/profile.js'
import type { LearningItem, LearningPack } from '../types.js'
import { renderAnkiCsv } from './anki.js'
import { renderHtml } from './html.js'
import { renderMarkdown } from './markdown.js'

const addItemSchema = z.object({
  item: rawItemSchema,
})

function unique(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function loadPack(dir: string): Promise<LearningPack> {
  return JSON.parse(await fs.readFile(path.join(dir, 'pack.json'), 'utf8')) as LearningPack
}

/** Re-render all pack files after an item is added or removed. */
export async function savePackFiles(pack: LearningPack, dir: string): Promise<void> {
  const audio = pack.audio ?? { items: {} }
  const files: Array<[string, string]> = [
    ['pack.json', JSON.stringify(pack, null, 2)],
    ['pack.md', renderMarkdown(pack)],
    ['anki.csv', renderAnkiCsv(pack)],
    ['index.html', renderHtml(pack, audio)],
  ]
  for (const [name, content] of files) {
    const target = path.join(dir, name)
    const temp = `${target}.tmp`
    await fs.writeFile(temp, content, 'utf8')
    await fs.rename(temp, target)
  }
}

/** Add one generated item and attach it to every paragraph that contains its lemma. */
export interface AddItemTarget {
  paragraphIndex?: number
  front?: boolean
  /** Manual additions belong in the supplemental module, not a paragraph. */
  manual?: boolean
}

/** Add one generated item and attach it to the selected paragraph, front matter, or matching paragraphs. */
export function addItemToPack(
  pack: LearningPack,
  item: LearningItem,
  target: AddItemTarget = {},
): LearningPack {
  const existing = pack.items.some((entry) => entry.id === item.id)
  const lemma = item.lemma.toLowerCase()
  let reading = pack.reading ?? []
  let frontMatter = pack.frontMatter
  if (target.manual) {
    if (existing) return pack
  } else if (target.front) {
    reading = reading.map((paragraph) => ({
      ...paragraph,
      itemIds: paragraph.itemIds.filter((id) => id !== item.id),
    }))
    frontMatter = {
      title: pack.title,
      ...frontMatter,
      itemIds: [...new Set([...(frontMatter?.itemIds ?? []), item.id])],
    }
  } else if (
    typeof target.paragraphIndex === 'number' &&
    Number.isInteger(target.paragraphIndex) &&
    reading.some((paragraph) => paragraph.index === target.paragraphIndex)
  ) {
    reading = reading.map((paragraph) => {
      const without = paragraph.itemIds.filter((id) => id !== item.id)
      return paragraph.index === target.paragraphIndex
        ? { ...paragraph, itemIds: [...new Set([...without, item.id])] }
        : { ...paragraph, itemIds: without }
    })
    if (frontMatter) {
      frontMatter = {
        ...frontMatter,
        itemIds: frontMatter.itemIds.filter((id) => id !== item.id),
      }
    }
  } else if (!existing) {
    reading = reading.map((paragraph) =>
      paragraph.original.toLowerCase().includes(lemma)
        ? { ...paragraph, itemIds: [...new Set([...paragraph.itemIds, item.id])] }
        : paragraph,
    )
  } else {
    return pack
  }
  const items = existing ? pack.items : [...pack.items, item]
  return {
    ...pack,
    items,
    reading,
    ...(frontMatter ? { frontMatter } : {}),
    stats: { ...pack.stats, itemCount: items.length },
  }
}

/** Add a sentence card without attaching it to a paragraph's word list. */
export function addSentenceToPack(pack: LearningPack, item: LearningItem): LearningPack {
  if (pack.items.some((existing) => existing.id === item.id)) return pack
  const items = [...pack.items, item]
  return {
    ...pack,
    items,
    stats: { ...pack.stats, itemCount: items.length },
  }
}

/** Remove an item from the pack, its paragraphs and any cloze that targets it. */
export function removeItemFromPack(pack: LearningPack, itemIdToRemove: string): LearningPack {
  const removed = pack.items.find((item) => item.id === itemIdToRemove)
  const items = pack.items.filter((item) => item.id !== itemIdToRemove)
  const reading = (pack.reading ?? []).map((paragraph) => ({
    ...paragraph,
    itemIds: paragraph.itemIds.filter((id) => id !== itemIdToRemove),
  }))
  const exercises = removed
    ? {
        ...pack.exercises,
        cloze: pack.exercises.cloze.filter(
          (exercise) => exercise.answer.toLowerCase() !== removed.lemma.toLowerCase(),
        ),
      }
    : pack.exercises
  return {
    ...pack,
    items,
    reading,
    exercises,
    ...(pack.frontMatter
      ? {
          frontMatter: {
            ...pack.frontMatter,
            itemIds: pack.frontMatter.itemIds.filter((id) => id !== itemIdToRemove),
          },
        }
      : {}),
    stats: { ...pack.stats, itemCount: items.length },
  }
}

/** Generate one new learning item in the pack's style, grounded in its source. */
export async function generatePackItem(pack: LearningPack, word: string): Promise<LearningItem> {
  if (!hasLlm()) {
    throw new Error('Adding a word needs an LLM. Configure LEARN_API_KEY or LEARN_ENV_FILE first.')
  }

  const style = pack.styleName ? await loadStyleProfile(pack.styleName).catch(() => undefined) : undefined
  const source = pack.sourceText ?? pack.reading?.map((paragraph) => paragraph.original).join('\n\n') ?? ''
  const existing = pack.items.map((item) => `- ${item.lemma}: ${item.sense}`).join('\n')

  const system = `You are extending an existing English-learning pack. Generate exactly one learning item for the word or phrase the user provides, in the same style and at the same level as the existing pack.

Use the source text if the word appears there: copy the exact context sentence and translate it naturally. If it does not appear, write one natural context sentence and mark it as “仿写”.

Return one item with exactly these fields (use lemma and sense, not word or meaning):
- lemma: base form
- sense: a short English gloss of the meaning used in the source
- pos: part of speech
- cefr: approximate CEFR level
- definition: learner-friendly English definition
- definitionZh: concise natural Chinese explanation
- contextSentence: the exact source sentence, or one natural generated sentence
- contextTranslation: natural Chinese translation
- collocations: array of strings
- examples: array of strings (English sentences only; never objects)
- confusables: array of strings
- wordFamily: array of strings
- synonyms: array of strings
- antonyms: array of strings
- notes: usage or L1-interference notes in Chinese
- wordFormation: {"roots":[{"form":"spect","meaning":"看","examples":["inspect","respect"]}],"prefixes":[...],"suffixes":[...]} — only when genuinely useful; omit otherwise
- memoryHook: a short Chinese mnemonic (optional)

All arrays above except wordFormation are arrays of plain strings, never objects. Return JSON only: {"item": {...}}
${style ? stylePromptBlock(style) : ''}`

  const user = `Word or phrase: ${word}

Source:
"""
${source.slice(0, 12_000)}
"""

Existing items (avoid duplicates):
${existing}

Return one item.`

  const generated = await chatJson(addItemSchema, system, user, { maxTokens: 3000 })
  const raw = generated.item
  const lookup = (await lookupWords([raw.lemma])).get(raw.lemma.toLowerCase())
  const wordPattern = new RegExp(`\\b${escapeRegExp(raw.lemma)}\\b`, 'i')
  const isSourceWord = wordPattern.test(source)
  let contextSentence = raw.contextSentence.trim()
  let contextTranslation = raw.contextTranslation

  if (isSourceWord) {
    if (
      !wordPattern.test(contextSentence) ||
      !source.replace(/\s+/g, ' ').includes(contextSentence.replace(/\s+/g, ' '))
    ) {
      contextSentence = findContextSentence(source, raw.lemma) || contextSentence
    }
  } else if (!wordPattern.test(contextSentence)) {
    const fallback = (raw.examples ?? []).find((text) => wordPattern.test(text))
    contextSentence = fallback ?? `Here is an example sentence using ${raw.lemma}.`
    contextTranslation = undefined
  }

  const paragraph = pack.reading?.find((entry) => entry.original.toLowerCase().includes(raw.lemma.toLowerCase()))
  const now = new Date().toISOString()

  const examples = [
    { text: contextSentence, origin: isSourceWord ? ('source' as const) : ('generated' as const) },
    ...(raw.examples ?? []).map((text) => ({ text, origin: 'generated' as const })),
    ...(lookup?.examples ?? []).map((text) => ({ text, origin: 'dictionary' as const })),
  ]
  const seen = new Set<string>()

  return {
    id: itemId(raw.lemma, raw.sense),
    type: 'word_sense',
    lemma: raw.lemma,
    sense: raw.sense,
    pos: raw.pos ?? lookup?.partOfSpeech,
    ipa: lookup?.phonetic,
    definition: raw.definition || lookup?.definition || raw.sense,
    definitionZh: raw.definitionZh,
    cefr: raw.cefr,
    contexts: [
      {
        resourceId: pack.resourceId,
        resourceTitle: pack.title,
        segmentIndex: paragraph?.index ?? 0,
        sentence: contextSentence,
        translation: contextTranslation,
      },
    ],
    collocations: unique(raw.collocations),
    examples: examples.filter((example) => {
      const key = example.text.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    }),
    relations: {
      synonyms: unique([...(raw.synonyms ?? []), ...(lookup?.synonyms ?? [])]),
      antonyms: unique([...(raw.antonyms ?? []), ...(lookup?.antonyms ?? [])]),
      confusables: unique(raw.confusables),
      wordFamily: unique(raw.wordFamily),
    },
    wordFormation: normalizeWordFormation(raw.wordFormation ?? undefined),
    memoryHook: raw.memoryHook ?? undefined,
    notes: raw.notes,
    tags: [raw.pos, raw.cefr].filter((value): value is string => Boolean(value)),
    sourceRef: `${pack.title} · 手动添加`,
    createdAt: now,
    updatedAt: now,
  }
}
