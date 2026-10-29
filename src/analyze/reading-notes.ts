import { chatJson } from './chat.js'
import { readingNotesSchema, toParagraphNote } from './reading-note-schema.js'
import { hasLlm } from '../config.js'
import type { LearningPack } from '../types.js'

const SYSTEM = `You are annotating an article for a Chinese learner's intensive reading page.
The user gives the article title and its paragraphs as JSON, with each paragraph's index, original text and existing Chinese translation.
For every paragraph, return a compact note in Chinese:
- summary: one Chinese sentence summarizing what the paragraph does, not a translation
- role: a short label such as 背景 / 论点 / 例证 / 对比 / 转折 / 结论
- keySentence: one exact sentence copied from that paragraph that is worth studying (or "")
- keySentenceNote: concise Chinese analysis of the sentence's structure, rhetoric, or why it matters
- grammar: one concise Chinese grammar/usage note from the paragraph (or "")
- connectors: 0-3 discourse connectors with {"text":"exact connector","usage":"中文作用"}
- background: optional one-sentence Chinese background or cultural note (or "")
- question: one short Chinese comprehension or reflection question (or "")

Rules: do not invent facts or quotations; do not translate the whole paragraph again; keep notes useful and concise; the key sentence must be an exact substring of its paragraph. Return JSON only:
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
  const result = await chatJson(
    readingNotesSchema,
    SYSTEM,
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
