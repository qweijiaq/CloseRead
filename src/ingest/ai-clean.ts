import { z } from 'zod'

import { chatJson } from '../analyze/chat.js'

const cleanSchema = z.object({
  remove: z.array(z.number().int().min(0)).max(100).default([]),
  reason: z.string().trim().max(400).optional(),
})

export interface AiCleanResult {
  text: string
  removed: number
  skipped: boolean
}

function splitBlocks(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
  if (paragraphs.length >= 3) return paragraphs
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function chunksOf(blocks: string[]): Array<{ offset: number; blocks: string[] }> {
  const chunks: Array<{ offset: number; blocks: string[] }> = []
  let current: string[] = []
  let chars = 0
  for (const block of blocks) {
    if (current.length >= 40 || chars + block.length > 12_000) {
      chunks.push({ offset: chunks.reduce((sum, chunk) => sum + chunk.blocks.length, 0), blocks: current })
      current = []
      chars = 0
    }
    current.push(block)
    chars += block.length
  }
  if (current.length) chunks.push({ offset: chunks.reduce((sum, chunk) => sum + chunk.blocks.length, 0), blocks: current })
  return chunks
}

/**
 * Ask the model which numbered blocks are boilerplate. The model never
 * rewrites the article: we only drop blocks, so the original wording survives.
 */
export async function cleanArticleWithAi(raw: string, title = ''): Promise<AiCleanResult> {
  const blocks = splitBlocks(raw)
  if (blocks.length < 3 || raw.trim().length < 200) return { text: raw, removed: 0, skipped: false }

  const protectedIndex = title && blocks[0]?.toLowerCase().includes(title.slice(0, 30).toLowerCase()) ? 0 : -1
  const remove = new Set<number>()
  for (const chunk of chunksOf(blocks)) {
    const numbered = chunk.blocks
      .map((block, index) => `[${chunk.offset + index}] ${block.replace(/\s+/g, ' ').slice(0, 900)}`)
      .join('\n')
    const result = await chatJson(
      cleanSchema,
      `You clean raw text extracted from a web page, PDF or ebook before intensive reading.
Remove only boilerplate blocks: navigation, cookie/consent banners, newsletter/subscribe prompts, share/follow buttons, related/recommended links, ads/sponsored content, comment prompts, image credits, author bios, "read more", footer/legal text and paywall notices.
Keep the headline, standfirst, byline, body paragraphs, subheadings, pull quotes and captions that carry meaning. Do not remove a paragraph merely because it is short. If unsure, keep it.
Return JSON only: {"remove":[block numbers],"reason":"short Chinese note"}`,
      `Article title: ${title || '(unknown)'}
Numbered blocks:
${numbered}`,
      { maxTokens: 500, temperature: 0.1 },
    )
    for (const index of result.remove ?? []) {
      const global = chunk.offset + index
      if (global >= 0 && global < blocks.length && global !== protectedIndex) remove.add(global)
    }
  }

  if (remove.size === 0) return { text: raw, removed: 0, skipped: false }
  const kept = blocks.filter((_, index) => !remove.has(index))
  const cleaned = kept.join('\n\n').trim()
  if (cleaned.length < 100 || remove.size > blocks.length * 0.6) {
    return { text: raw, removed: 0, skipped: true }
  }
  return { text: cleaned, removed: remove.size, skipped: false }
}
