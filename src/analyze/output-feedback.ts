import { z } from 'zod'

import type { EditorFeedback } from '../store/store.js'
import { chatJson } from './chat.js'

const feedbackSchema = z.object({
  praise: z.string().min(1),
  upgrade: z.string().min(1),
  revision: z.string().min(1),
  question: z.string().nullable().optional(),
})

const SYSTEM = `You are a concise, encouraging English editor replying to a Chinese learner's three-sentence output.
Reply in JSON with:
- praise: one specific thing that worked, in Chinese, referencing their actual wording.
- upgrade: one concrete expression or grammar upgrade, in Chinese.
- revision: a polished English version of their text that preserves their meaning and voice.
- question: one short Chinese follow-up question that invites them to say more, or null.
Do not give a numeric score. Do not invent facts. Return JSON only.`

export async function generateOutputFeedback(
  text: string,
  prompt: string,
  answer: string | undefined,
  articleTitle: string | undefined,
  signal?: AbortSignal,
): Promise<EditorFeedback> {
  const result = await chatJson(
    feedbackSchema,
    SYSTEM,
    `Article: ${articleTitle ?? '(unknown)'}
Prompt: ${prompt || '(none)'}
${answer ? `Reference answer: ${answer}` : ''}
Learner output:
"""
${text}
"""

Return JSON only.`,
    { maxTokens: 1200, signal },
  )
  if (!/[\u4e00-\u9fff]/.test(result.praise + result.upgrade)) {
    throw new Error('AI 没有返回中文点评，请重试。')
  }
  return {
    praise: result.praise.trim(),
    upgrade: result.upgrade.trim(),
    revision: result.revision.trim(),
    ...(result.question?.trim() ? { question: result.question.trim() } : {}),
  }
}
