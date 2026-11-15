import { chatJson } from './chat.js'
import { readingNotesSchema, toParagraphNote } from './reading-note-schema.js'
import { hasLlm } from '../config.js'
import { resolveDefaultStyle } from '../style/profile.js'
import { stylePromptBlock } from '../style/profile.js'
import type { LearningPack } from '../types.js'

const SYSTEM = `You are annotating an article for a Chinese learner's intensive reading page.
The user gives the article title and its paragraphs as JSON, with each paragraph's index, original text and existing Chinese translation.
For every paragraph, return a rich but compact note in Chinese:
- summary: what the paragraph DOES, not a translation. Prefer "提出…", "用…证明…", "把话题从…转到…".
- role: a precise functional label: 背景 / 现象 / 论点 / 例证 / 数据 / 对比 / 让步 / 转折 / 归因 / 后果 / 结论 / 呼吁. Do not label everything 论点.
- keySentence: one exact sentence copied from that paragraph that is worth studying (or "")
- keySentenceNote: three layers — (1) the grammatical subject and what it does; (2) how the key modifier, clause or collocation changes the meaning; (3) what the sentence does in the paragraph (advance, pivot, set the tone, close). Never just translate it.
- grammar: one structure that matters for understanding or transfers to other texts; state the pattern and its effect here, not a textbook definition (or "")
- connectors: 0-3 discourse connectors with {"text":"exact connector","usage":"中文作用"}
- background: one sentence only when background knowledge genuinely blocks understanding (or "")
- question: one question that sends the reader back to the text; prefer "why does the author say…", "what changes if we replace X", not a fact that can be copied.

Make adjacent notes connect: if one paragraph pivots or concedes, the next note should show what follows from it.
Rules: do not invent facts or quotations; do not translate the whole paragraph again; the key sentence must be an exact substring of its paragraph. Return JSON only:
{"notes":[{"index":0,"summary":"...","role":"论点","keySentence":"...","keySentenceNote":"...","grammar":"...","connectors":[{"text":"Instead","usage":"转折"}],"background":"","question":"..."}]}`

export async function enrichReadingNotes(
  pack: LearningPack,
  signal?: AbortSignal,
): Promise<number> {
  if (!hasLlm()) throw new Error('生成精读笔记需要配置 LLM。')
  const paragraphs = (pack.reading ?? []).filter((paragraph) => !paragraph.note)
  if (paragraphs.length === 0) return 0

  const payload = paragraphs.map((paragraph) => ({
    index: paragraph.index,
    original: paragraph.original.slice(0, 1800),
    translation: paragraph.translation ?? '',
  }))
  const style = await resolveDefaultStyle().catch(() => undefined)
  const result = await chatJson(
    readingNotesSchema,
    `${SYSTEM}${stylePromptBlock(style)}`,
    `Article: ${pack.title}\n\nParagraphs:\n${JSON.stringify(payload)}\n\nReturn one note for every paragraph index.`,
    { maxTokens: 7000, signal },
  )
  const byIndex = new Map((result.notes ?? []).map((note) => [note.index, note]))
  let updated = 0
  for (const paragraph of paragraphs) {
    const raw = byIndex.get(paragraph.index)
    if (!raw) continue
    const note = toParagraphNote(raw, paragraph.original)
    if (!note) continue
    paragraph.note = note
    updated += 1
  }
  return updated
}
