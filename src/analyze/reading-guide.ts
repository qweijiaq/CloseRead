import { z } from 'zod'

import { chatJson } from './chat.js'
import { hasLlm } from '../config.js'
import type { LearningPack } from '../types.js'

const guideSchema = z.object({
  guide: z.string().min(1),
})

/**
 * Compress the long editorial into a reading-page guide: keep the hook and a
 * short language thread, but do not repeat the word cards or paragraph notes.
 */
export async function generateReadingGuide(pack: LearningPack): Promise<string> {
  if (!hasLlm()) throw new Error('生成精读导读需要配置 LLM。')
  const expressions = pack.items
    .filter((item) => item.type !== 'sentence')
    .slice(0, 12)
    .map((item) => `${item.lemma}（${item.definitionZh ?? item.sense}）`)
    .join('；')
  const result = await chatJson(
    guideSchema,
    `You are compressing a long Chinese editorial into the short 导读 at the top of an intensive-reading page.
Keep the original hook's idea and voice where it is good. Then create one coherent language thread: group 4-6 key expressions by the job they do in the article (for example: describing harm, control, escalation, or the author's stance). Give only a short Chinese gloss and one sentence about the effect; do NOT repeat full word-card definitions, paragraph translations or a full expression list.
End with one short reading strategy for the learner.
Write 300-600 Chinese characters in Markdown with 2-4 short headings or paragraphs. Do not start with an H1. Return JSON only: {"guide":"..."}`,
    `Article: ${pack.title}
Summary: ${pack.summary}
Key expressions: ${expressions}

Original editorial:
"""
${(pack.editorial ?? pack.summary).slice(0, 7000)}
"""

Return the compressed guide only.`,
    { maxTokens: 1800 },
  )
  return result.guide.trim()
}
