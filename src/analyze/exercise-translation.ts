import { z } from 'zod'

import { chatJson } from './chat.js'
import { hasLlm } from '../config.js'

const translationSchema = z.object({
  questionZh: z.string().min(1),
  answerZh: z.string().nullable().optional(),
})

export type ExerciseKind = 'cloze' | 'comprehension' | 'discussion'

/** Translate an exercise's prompt and answer into natural Chinese. */
export async function translateExercise(
  kind: ExerciseKind,
  prompt: string,
  answer: string,
  context: string,
): Promise<{ questionZh: string; answerZh?: string }> {
  if (!hasLlm()) throw new Error('生成练习题译文需要配置 LLM。')
  const result = await chatJson(
    translationSchema,
    `You translate an English learning exercise into natural Chinese for a Chinese learner.
For cloze questions, translate the sentence with the blank and keep "______" exactly as the blank.
For comprehension/discussion questions, translate the question itself, not an answer.
Also translate the reference answer when it is a phrase or sentence; if the answer is a single word, give its meaning in Chinese.
Return JSON only: {"questionZh":"...","answerZh":"..."}. Never add commentary.`,
    `Exercise type: ${kind}
Prompt: ${prompt}
Reference answer: ${answer}
Article context: ${context}

Return JSON only.`,
    { maxTokens: 900 },
  )
  return {
    questionZh: result.questionZh.trim(),
    ...(result.answerZh?.trim() ? { answerZh: result.answerZh.trim() } : {}),
  }
}
