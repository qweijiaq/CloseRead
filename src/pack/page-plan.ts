export interface ExportPageBlock {
  id: string
  label: string
  kind: string
  height: number
}

export interface ExportPageGroup {
  blocks: ExportPageBlock[]
  height: number
  label: string
}

function groupHeight(blocks: ExportPageBlock[]): number {
  return blocks.reduce((sum, block) => sum + Math.max(1, block.height), 0)
}

/** Greedy fallback: fill each image until the height cap, then start a new one. */
export function planExportPages(blocks: ExportPageBlock[], maxHeight: number): ExportPageGroup[] {
  if (blocks.length === 0) return []
  const groups: ExportPageBlock[][] = []
  let current: ExportPageBlock[] = []
  let height = 0
  for (const block of blocks) {
    const blockHeight = Math.max(1, block.height)
    const needsRoomForNext = block.kind === 'heading' && current.length > 0
    if (current.length > 0 && (height + blockHeight > maxHeight || (needsRoomForNext && height + blockHeight + 900 > maxHeight))) {
      groups.push(current)
      current = []
      height = 0
    }
    current.push(block)
    height += blockHeight
  }
  if (current.length > 0) groups.push(current)
  // A heading must travel with the block that follows it; if it landed at the
  // bottom of a page, move it to the next page (order stays unchanged).
  for (let index = 0; index < groups.length - 1; index++) {
    const group = groups[index]!
    const next = groups[index + 1]!
    while (group.length > 1 && group[group.length - 1]?.kind === 'heading') {
      next.unshift(group.pop()!)
    }
  }
  return groups.map((group, index) => ({
    blocks: group,
    height: groupHeight(group),
    label: group.length === 1 ? `第 ${index + 1} 张` : `第 ${index + 1} 张 · ${group[0]!.label} 起`,
  }))
}

/** Reject AI plans that drop blocks, duplicate them, or split a heading from its content. */
export function pagePlanProblem(
  blocks: ExportPageBlock[],
  pages: string[][],
  maxHeight: number,
): string | undefined {
  if (pages.length === 0) return 'no pages'
  const ids = new Set(blocks.map((block) => block.id))
  const seen = new Set<string>()
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex]!
    if (page.length === 0) return `page ${pageIndex + 1} is empty`
    let height = 0
    for (const id of page) {
      if (!ids.has(id)) return `unknown block ${id}`
      if (seen.has(id)) return `duplicate block ${id}`
      seen.add(id)
      height += Math.max(1, blocks.find((block) => block.id === id)?.height ?? 1)
    }
    if (height > maxHeight && page.length > 1) return `page ${pageIndex + 1} is ${height}px`
    const last = blocks.find((block) => block.id === page[page.length - 1])
    if (last?.kind === 'heading' && pageIndex < pages.length - 1) {
      return `page ${pageIndex + 1} ends with a heading`
    }
    if (page.length === 1 && last?.kind === 'heading') return `page ${pageIndex + 1} is a lone heading`
  }
  if (seen.size !== ids.size) return 'missing blocks'
  const ordered = pages.flat()
  const expected = blocks.map((block) => block.id)
  if (ordered.length !== expected.length || ordered.some((id, index) => id !== expected[index])) {
    return 'block order changed'
  }
  return undefined
}

export function validatePagePlan(
  blocks: ExportPageBlock[],
  pages: string[][],
  maxHeight: number,
): boolean {
  return pagePlanProblem(blocks, pages, maxHeight) === undefined
}

export function groupsFromIds(blocks: ExportPageBlock[], pages: string[][]): ExportPageGroup[] {
  const byId = new Map(blocks.map((block) => [block.id, block]))
  return pages.map((page, index) => {
    const group = page.flatMap((id) => {
      const block = byId.get(id)
      return block ? [block] : []
    })
    return {
      blocks: group,
      height: groupHeight(group),
      label: group.length === 1 ? `第 ${index + 1} 张` : `第 ${index + 1} 张 · ${group[0]!.label} 起`,
    }
  })
}
