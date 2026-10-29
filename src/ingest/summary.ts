import type { Resource } from '../types.js'

export function countWords(text: string): number {
  return (text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length
}

export function previewText(text: string, max = 220): string {
  const clean = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`
}

export function resourceWarnings(resource: Resource): string[] {
  const warnings: string[] = []
  if (resource.wordCount < 300) {
    warnings.push(`只提取到 ${resource.wordCount} 个词，学习包可能偏薄。`)
  }
  if (resource.wordCount > 20_000) {
    warnings.push(
      `这是 ${resource.wordCount} 词的整本材料，当前学习包按单篇文章设计；从整本生成会较慢，阅读部分可能只覆盖开头，建议先按文章或栏目拆分。`,
    )
  }
  if (resource.kind === 'pdf') {
    const pages = Number(resource.metadata.pages ?? 0)
    const extractable = Number(resource.metadata.extractablePages ?? 0)
    if (pages > 0 && extractable > 0 && extractable < pages) {
      warnings.push(`${pages} 页中有 ${pages - extractable} 页没有可提取文字（可能是图片或扫描页）。`)
    }
  }
  if (resource.kind === 'web' && resource.metadata.extraction === 'body') {
    warnings.push('没有识别到正文容器，已提取整页，导航或页脚文字可能混入。')
  }
  return warnings
}
