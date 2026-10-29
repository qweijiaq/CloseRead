import { z } from 'zod'

import { chatJson } from './chat.js'
import { hasLlm } from '../config.js'

const answerSchema = z.object({
  answer: z.string().min(1),
})

/** Generate a model answer for a paragraph's reflection question. */
export async function answerReadingQuestion(
  paragraph: string,
  question: string,
  title: string,
): Promise<string> {
  if (!hasLlm()) throw new Error('生成参考答案需要配置 LLM。')
  const result = await chatJson(
    answerSchema,
    `You are a careful English-reading teacher answering a Chinese learner's reflection question about one paragraph.
Write a concise Chinese reference answer in 2-4 sentences. Ground it in the paragraph and the article; do not invent facts. If the question asks for opinion, answer as a thoughtful model reader and make the reasoning explicit. Quote one short English expression when it helps. Return JSON only: {"answer":"..."}`,
    `Article: ${title}
Paragraph:
"""
${paragraph.slice(0, 4000)}
"""

Question: ${question}

Return JSON only.`,
    { maxTokens: 700 },
  )
  return result.answer.trim()
}
