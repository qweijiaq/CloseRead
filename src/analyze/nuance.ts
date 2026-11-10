import { z } from 'zod'

import { config } from '../config.js'
import type { LearningItem } from '../types.js'
import { chatJson } from './chat.js'

const nuanceSchema = z.object({
  scenario: z.string().trim().min(20).max(600),
  options: z.array(z.string().trim().min(5).max(240)).length(3),
  answer: z.number().int().min(0).max(2),
  explanation: z.string().trim().min(5).max(600),
})

export interface NuanceQuiz {
  lemma: string
  scenario: string
  options: string[]
  answer: number
  explanation: string
}

const cache = new Map<string, NuanceQuiz>()

const SYSTEM = `You are an English usage coach for a Chinese learner of English.
The learner is reviewing one expression from a real article. Build a tiny "usage detective" puzzle.

Rules:
- scenario: 2–3 natural English sentences setting a concrete situation where the target expression matters.
- options: exactly 3 English sentences, and every sentence must contain the target expression.
- Exactly one option is natural and correct in the scenario. The other two must contain a clear usage error: wrong collocation, wrong preposition, wrong register, wrong sense or grammar. Make the errors clear to an experienced teacher, not merely less idiomatic.
- Do not label the options, do not put the explanation inside them, and do not make the correct option noticeably longer.
- explanation: Chinese, 1–3 sentences; say why the correct option works and what is wrong with the other two.
- Use plain text only in options and scenario. Return JSON only in this shape:
{"scenario":"...","options":["...","...","..."],"answer":0,"explanation":"..."}`

function compact(value: string | undefined, max: number): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Shuffle so the correct option is not always at the same index. */
function shuffleOptions(options: string[], answer: number): { options: string[]; answer: number } {
  const order = options.map((_, index) => index)
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = order[index]!
    order[index] = order[swap]!
    order[swap] = current
  }
  return {
    options: order.map((index) => options[index]!),
    answer: order.indexOf(answer),
  }
}

export async function generateNuanceQuiz(item: LearningItem): Promise<NuanceQuiz> {
  const key = `${item.id}:${item.sense}:${item.updatedAt}`
  const cached = cache.get(key)
  if (cached) return cached

  const context = item.contexts[0]?.sentence ?? ''
  const result = await chatJson(
    nuanceSchema,
    SYSTEM,
    `Target expression: ${compact(item.lemma, 80)}
Sense: ${compact(item.sense, 160)}
Definition: ${compact(item.definition, 300)}
Article context: ${compact(context, 400) || '(none)'}
Collocations: ${item.collocations.slice(0, 6).join('; ') || '(none)'}
Learner level: ${config.level}

Return one puzzle. Every option must contain the target expression exactly as written.`,
    { maxTokens: 1200, temperature: 0.7 },
  )

  const options = result.options.map((option) => compact(option, 240))
  if (new Set(options.map((option) => option.toLowerCase())).size !== 3) {
    throw new Error('语境侦探生成了重复选项，请再试一次。')
  }
  const shuffled = shuffleOptions(options, result.answer)
  const quiz: NuanceQuiz = {
    lemma: item.lemma,
    scenario: compact(result.scenario, 600),
    options: shuffled.options,
    answer: shuffled.answer,
    explanation: compact(result.explanation, 600),
  }
  cache.set(key, quiz)
  return quiz
}
