import { z } from 'zod'

import type { LearningItem, LearningPack } from '../types.js'
import { chatJson } from './chat.js'

export type TheaterMode = 'interview' | 'debate'

export interface TheaterMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TheaterRecap {
  used: string[]
  missed: string[]
  summary: string
  suggestion: string
}

export interface TheaterTurnResult {
  reply: string
  translation: string
  note: string
  used: string[]
  missed: string[]
  recap?: TheaterRecap
}

const theaterSchema = z.object({
  reply: z.string().min(1),
  translation: z.string().min(1),
  note: z.string().min(1),
  recap: z
    .object({
      summary: z.string().min(1),
      suggestion: z.string().min(1),
    })
    .nullable()
    .optional(),
})

const SYSTEM = `You are running a bounded three-turn English role-play for a Chinese learner who has just read an article.
You play the article's author. Stay grounded in the supplied article; do not invent quotations, statistics or facts that are not in the excerpt.
For every turn return JSON:
- reply: your in-character English reply, 2-3 natural sentences
- translation: a natural Chinese translation of reply
- note: one short Chinese coaching note about the learner's latest message (word choice, grammar, or how to use a target expression)
- recap: null for turns 1-2; for turn 3 return {"summary":"2-3 句中文复盘","suggestion":"一句最值得继续练的表达或说法"}
The learner must stay within the article's topic. If they drift, answer briefly and bring them back. Return JSON only.`

function targetItems(pack: LearningPack): LearningItem[] {
  return pack.items.filter((item) => item.type !== 'sentence').slice(0, 8)
}

function targetUsed(lemma: string, messages: TheaterMessage[]): boolean {
  const text = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content.toLowerCase())
    .join(' ')
  return text.includes(lemma.toLowerCase())
}

export async function generateTheaterTurn(
  pack: LearningPack,
  mode: TheaterMode,
  messages: TheaterMessage[],
  signal?: AbortSignal,
): Promise<{ result: TheaterTurnResult; turn: number }> {
  const userMessages = messages.filter((message) => message.role === 'user')
  const turn = userMessages.length
  if (turn < 1 || turn > 3) throw new Error('这一局已经结束，请重新开始。')
  const targets = targetItems(pack)
  const targetText = targets
    .map((item) => `${item.lemma}（${item.definitionZh ?? item.sense}）`)
    .join('；')
  const article = [
    pack.title,
    pack.frontMatter?.lead ?? '',
    ...(pack.reading ?? []).slice(0, 8).map((paragraph) => paragraph.original),
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 7000)
  const role =
    mode === 'interview'
      ? 'The learner is interviewing you as the article author. Answer their questions in character.'
      : 'The learner is challenging your argument. Respond as the author: defend, qualify or concede, then invite a sharper rebuttal.'
  const history = messages
    .map((message) => `${message.role === 'user' ? 'Learner' : 'Author'}: ${message.content}`)
    .join('\n')
  const result = await chatJson(
    theaterSchema,
    SYSTEM,
    `Mode: ${mode}
${role}
Turn: ${turn} of 3
Target expressions the learner should try to use: ${targetText || '(none)'}

Article material:
"""
${article}
"""

Conversation so far:
${history}

Return JSON only.`,
    { maxTokens: 1400, signal },
  )
  const used = targets.filter((item) => targetUsed(item.lemma, messages)).map((item) => item.lemma)
  const missed = targets.filter((item) => !targetUsed(item.lemma, messages)).map((item) => item.lemma)
  const recap =
    turn === 3
      ? {
          used,
          missed,
          summary: result.recap?.summary?.trim() || '这一局已经完成三轮表达练习。',
          suggestion: result.recap?.suggestion?.trim() || '下一轮试着把没用的目标表达带进回答。',
        }
      : undefined
  return {
    result: {
      reply: result.reply.trim(),
      translation: result.translation.trim(),
      note: result.note.trim(),
      used,
      missed,
      ...(recap ? { recap } : {}),
    },
    turn,
  }
}
