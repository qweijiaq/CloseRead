import { z } from 'zod'

import { chatJson } from './chat.js'
import { hasLlm } from '../config.js'
import { resolveDefaultStyle } from '../style/profile.js'
import { stylePromptBlock } from '../style/profile.js'
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
  const style = await resolveDefaultStyle().catch(() => undefined)
  const paragraphs = (pack.reading ?? [])
    .slice(0, 10)
    .map((paragraph) => `${paragraph.index + 1}. ${paragraph.note?.role ?? ''} ${paragraph.note?.summary ?? ''} ${paragraph.original.slice(0, 220)}`)
    .join('\n')
  const result = await chatJson(
    guideSchema,
    `You are compressing a long Chinese editorial into the short 导读 at the top of an intensive-reading page.
Build a 读前简报 that works as a map, not a summary. Include, in this order:
1. A one-sentence hook connecting the article to a real reading problem.
2. 文章地图: 3-5 short beats showing what the opening does, how the middle moves, and where the ending lands.
3. 作者站位: one sentence on stance and tone, naming one or two attitude words to watch.
4. 语言线索: group 4-6 key expressions by the job they do in the article (describing harm, control, escalation, the author's stance, etc.); give only a short Chinese gloss and one sentence about the effect. Do NOT repeat full word-card definitions, paragraph translations or a full expression list.
5. 阅读策略: one concrete action for the first read.

Write 300-600 Chinese characters in Markdown with short headings or paragraphs. Do not start with an H1. Return JSON only: {"guide":"..."}`,
    `Article: ${pack.title}
Summary: ${pack.summary}
Key expressions: ${expressions}

Original editorial:
"""
${(pack.editorial ?? pack.summary).slice(0, 7000)}
"""

Paragraph map (role + summary + opening words):
${paragraphs}
${stylePromptBlock(style)}

Return the compressed guide only.`,
    { maxTokens: 1800 },
  )
  return result.guide.trim()
}
