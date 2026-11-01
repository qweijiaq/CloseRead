import { z } from 'zod'

import type { LearningItem } from '../types.js'
import { chatJson } from './chat.js'

const practiceSchema = z.object({
  praise: z.string().min(1),
  improvement: z.string().min(1),
  revision: z.string().min(1),
  followUp: z.string().nullable().optional(),
})

export interface PracticeFeedback {
  praise: string
  improvement: string
  revision: string
  followUp?: string
}

const SCENES: Record<string, string> = {
  work: '工作 / 会议 / 邮件',
  travel: '旅行 / 机场 / 酒店',
  argument: '争论 / 表达不同意见',
  daily: '日常聊天 / 日记',
}

const SYSTEM = `You are a patient English writing coach for a Chinese learner.
The learner writes one sentence using a target word in a chosen scene.
Reply in JSON with:
- praise: one specific thing they did well, in Chinese, quoting or naming the exact wording; never empty generic praise.
- improvement: one concrete improvement (word choice, grammar, collocation or register), in Chinese.
- revision: a more natural English version of their sentence that keeps their idea.
- followUp: one short Chinese question inviting them to extend the sentence, or null.
Do not rewrite unrelated content. If the target word is missing or used with the wrong sense, say so in improvement. Return JSON only.`

export async function generatePracticeFeedback(
  item: LearningItem,
  sentence: string,
  scene: string,
  signal?: AbortSignal,
): Promise<PracticeFeedback> {
  const result = await chatJson(
    practiceSchema,
    SYSTEM,
    `Target: ${item.lemma}
Sense: ${item.definitionZh ?? item.sense}
Definition: ${item.definition}
Context: ${item.contexts[0]?.sentence ?? ''}
Scene: ${SCENES[scene] ?? SCENES.daily}
Learner sentence: ${sentence}

Return JSON only.`,
    { maxTokens: 900, signal },
  )
  if (!/[\u4e00-\u9fff]/.test(result.praise + result.improvement)) {
    throw new Error('AI 没有返回中文点评，请重试。')
  }
  return {
    praise: result.praise.trim(),
    improvement: result.improvement.trim(),
    revision: result.revision.trim(),
    ...(result.followUp?.trim() ? { followUp: result.followUp.trim() } : {}),
  }
}
