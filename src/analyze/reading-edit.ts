import { z } from 'zod'

import { chatJson } from './chat.js'
import { paragraphNoteSchema, toParagraphNote } from './reading-note-schema.js'
import { hasLlm } from '../config.js'
import type { ParagraphNote } from '../types.js'

const paragraphEditSchema = z.object({
  translation: z.string().min(1),
  note: paragraphNoteSchema.optional(),
})

const frontEditSchema = z.object({
  translation: z.string().min(1),
  note: z.string().nullable().optional(),
})

export async function editParagraphText(
  original: string,
  surrounding: string,
  title: string,
): Promise<{ translation: string; note?: ParagraphNote }> {
  if (!hasLlm()) throw new Error('修改后重新翻译需要配置 LLM。')
  const result = await chatJson(
    paragraphEditSchema,
    `You are updating one paragraph of a Chinese learner's intensive-reading page.
The learner has corrected the English paragraph. Re-translate it into natural, idiomatic Chinese, then write a compact updated note.
Note fields: summary (one Chinese sentence on the paragraph's job), role (背景/论点/例证/对比/转折/结论), keySentence (an exact sentence from the paragraph), keySentenceNote (Chinese analysis), grammar (one Chinese usage note), connectors (0-3 exact connectors with Chinese usage), background, question.
Do not invent facts. Return JSON only:
{"translation":"...","note":{"summary":"...","role":"论点","keySentence":"...","keySentenceNote":"...","grammar":"...","connectors":[{"text":"...","usage":"..."}],"background":"","question":"..."}}`,
    `Article: ${title}
Surrounding context:
"""
${surrounding.slice(0, 3000)}
"""

Edited paragraph:
"""
${original.slice(0, 4000)}
"""

Return JSON only.`,
    { maxTokens: 2500 },
  )
  return {
    translation: result.translation.trim(),
    ...(result.note ? { note: toParagraphNote(result.note, original) } : {}),
  }
}

export async function editFrontMatterText(
  kind: 'title' | 'lead',
  text: string,
  summary: string,
): Promise<{ translation: string; note?: string }> {
  if (!hasLlm()) throw new Error('修改后重新翻译需要配置 LLM。')
  const result = await chatJson(
    frontEditSchema,
    `You are updating the article head of a Chinese learner's intensive-reading page.
Translate the edited ${kind} into natural Chinese, then write one concise Chinese note on its wording, structure, image or rhetorical job.
Return JSON only: {"translation":"...","note":"..."}`,
    `Article summary: ${summary}
Edited ${kind}: ${text}

Return JSON only.`,
    { maxTokens: 1200 },
  )
  return {
    translation: result.translation.trim(),
    ...(result.note?.trim() ? { note: result.note.trim() } : {}),
  }
}
