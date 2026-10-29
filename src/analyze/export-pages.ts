import { z } from 'zod'

import { hasLlm } from '../config.js'
import { planExportPages } from '../pack/page-plan.js'
import type { ExportPageBlock, ExportPageGroup } from '../pack/page-plan.js'
import { chatJson } from './chat.js'

const pagePlanSchema = z.object({
  pages: z.array(z.array(z.string())),
})

const SYSTEM = `You are laying out an exported intensive-reading pack as several shareable PNG images.
You receive atomic blocks in reading order with a height in CSS pixels and a target max height per image.
Group the blocks into pages. Rules:
- every block id appears exactly once, in the original order;
- never split a block, each block is atomic;
- keep a heading with at least the block that follows it;
- keep each page at or below maxHeight when possible;
- balance page heights and keep related blocks together;
- return JSON only: {"pages":[["block-id", ...], ...]}`

export interface ExportPagePlan {
  groups: ExportPageGroup[]
  planner: 'ai' | 'fallback'
  reason?: string
}

export async function planExportPagesWithAi(
  blocks: ExportPageBlock[],
  maxHeight: number,
): Promise<ExportPagePlan> {
  const fallback = planExportPages(blocks, maxHeight)
  if (!hasLlm() || blocks.length <= 1) {
    return { groups: fallback, planner: 'fallback', reason: hasLlm() ? 'single block' : 'LLM not configured' }
  }
  try {
    const listing = blocks
      .map((block) => `- ${block.id} | ${block.kind} | ${block.height}px | ${block.label}`)
      .join('\n')
    const result = await chatJson(
      pagePlanSchema,
      SYSTEM,
      `Target max height: ${maxHeight}px

Blocks:
${listing}

Return JSON only.`,
      { maxTokens: 1200 },
    )
    const ordered = result.pages.flat()
    const expected = blocks.map((block) => block.id)
    if (ordered.length !== expected.length || ordered.some((id, index) => id !== expected[index])) {
      return { groups: fallback, planner: 'fallback', reason: 'block order changed' }
    }
    const byId = new Map(blocks.map((block) => [block.id, block]))
    for (let index = 0; index < result.pages.length; index++) {
      const page = result.pages[index]!
      if (page.length === 0) return { groups: fallback, planner: 'fallback', reason: 'empty page' }
      const last = byId.get(page[page.length - 1]!)
      if (last?.kind === 'heading' && index < result.pages.length - 1) {
        return { groups: fallback, planner: 'fallback', reason: 'heading at page end' }
      }
    }
    const groups = result.pages.flatMap((page) => {
      const pageBlocks = page.flatMap((id) => {
        const block = byId.get(id)
        return block ? [block] : []
      })
      return planExportPages(pageBlocks, maxHeight)
    })
    return {
      groups: groups.map((group, index) => ({
        ...group,
        label: `第 ${index + 1} 张 · ${group.blocks[0]?.label ?? ''}`,
      })),
      planner: 'ai',
    }
  } catch (error) {
    return {
      groups: fallback,
      planner: 'fallback',
      reason: error instanceof Error ? error.message : String(error),
    }
  }
  return { groups: fallback, planner: 'fallback' }
}
