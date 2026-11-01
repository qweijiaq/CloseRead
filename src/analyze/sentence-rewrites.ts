import { z } from 'zod'

import type { LearningItem, SentenceRewrite } from '../types.js'
import { chatJson } from './chat.js'

const rewriteSchema = z.object({
  rewrites: z
    .array(
      z.object({
        register: z.enum(['formal', 'casual', 'punchy']),
        text: z.string().min(1),
        note: z.string().min(1),
      }),
    )
    .min(3),
})

const SYSTEM = `You rewrite one English sentence for a Chinese learner.
Keep the original meaning and facts. Produce exactly three natural English versions:
- formal: suitable for an article, report or professional email
- casual: natural spoken English
- punchy: shorter and sharper, suitable for a headline or strong opinion
Do not add new facts. The note MUST be written in Chinese (15-40 characters) and explain the register or one wording choice; never write the note in English. Return JSON only:
{"rewrites":[{"register":"formal","text":"...","note":"中文说明"},{"register":"casual","text":"...","note":"中文说明"},{"register":"punchy","text":"...","note":"中文说明"}]}`

function compact(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

export async function generateSentenceRewrites(
  item: LearningItem,
  signal?: AbortSignal,
): Promise<SentenceRewrite[]> {
  const sentence = item.sentence
  if (!sentence) throw new Error('这不是句子卡。')
  const chunks = sentence.chunks.map((chunk) => `${chunk.role}: ${chunk.text}`).join('; ')
  const result = await chatJson(
    rewriteSchema,
    SYSTEM,
    `Original: ${sentence.original}
Chinese: ${sentence.translation}
Pattern: ${sentence.pattern ?? ''}
Chunks: ${chunks}

Return JSON only.`,
    { maxTokens: 1200, signal },
  )
  const seen = new Set<string>()
  const rewrites: SentenceRewrite[] = []
  for (const rewrite of result.rewrites) {
    if (seen.has(rewrite.register)) continue
    seen.add(rewrite.register)
    rewrites.push({
      register: rewrite.register,
      text: compact(rewrite.text, 500),
      note: compact(rewrite.note, 300),
    })
  }
  if (rewrites.length < 3) throw new Error('AI 没有返回完整的三种写法，请重试。')
  if (rewrites.some((rewrite) => !/[\u4e00-\u9fff]/.test(rewrite.note))) {
    throw new Error('AI 没有返回中文说明，请重试。')
  }
  return rewrites
}
