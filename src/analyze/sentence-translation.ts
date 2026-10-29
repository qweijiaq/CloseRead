import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { chatJson } from './chat.js'
import { config, hasLlm } from '../config.js'

const translationSchema = z.object({
  translation: z.string().min(1),
})

const memory = new Map<string, string>()

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function cacheKey(sentence: string, context?: string): string {
  return createHash('sha1')
    .update(`${normalize(sentence)}|${normalize(context ?? '')}`)
    .digest('hex')
}

function cacheDir(): string {
  return path.join(config.dataDir, 'cache', 'sentences')
}

async function readCache(key: string): Promise<string | undefined> {
  const cached = memory.get(key)
  if (cached) return cached
  try {
    const parsed = JSON.parse(
      await fs.readFile(path.join(cacheDir(), `${key}.json`), 'utf8'),
    ) as { translation?: string }
    if (typeof parsed.translation === 'string' && parsed.translation.trim()) {
      memory.set(key, parsed.translation.trim())
      return parsed.translation.trim()
    }
  } catch {
    // A missing cache file simply means this sentence has not been translated yet.
  }
  return undefined
}

async function writeCache(key: string, sentence: string, translation: string): Promise<void> {
  memory.set(key, translation)
  await fs.mkdir(cacheDir(), { recursive: true })
  const target = path.join(cacheDir(), `${key}.json`)
  const temp = `${target}.tmp`
  await fs.writeFile(
    temp,
    JSON.stringify({ sentence: normalize(sentence), translation }, null, 2),
    'utf8',
  )
  await fs.rename(temp, target)
}

/** Translate one sentence in its paragraph context, cached by sentence + context. */
export async function translateSentence(sentence: string, context?: string): Promise<string> {
  const clean = normalize(sentence)
  if (!clean) throw new Error('请先选中一个句子。')
  const key = cacheKey(clean, context)
  const cached = await readCache(key)
  if (cached) return cached
  if (!hasLlm()) throw new Error('翻译本句需要配置 LLM。')

  const result = await chatJson(
    translationSchema,
    `You translate one English sentence from an article into natural, idiomatic Chinese for a Chinese learner.
Return JSON only: {"translation":"..."}.
Rules: translate the sentence as it is used in the provided paragraph; do not add explanation, notes, quotation marks, or the English sentence. Avoid word-for-word calques.`,
    `Sentence: ${clean}
${context ? `\nParagraph:\n${normalize(context)}` : ''}

Return the Chinese translation.`,
    { maxTokens: 500 },
  )
  const translation = normalize(result.translation)
  if (!translation) throw new Error('翻译结果为空。')
  await writeCache(key, clean, translation)
  return translation
}
