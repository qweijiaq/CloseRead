import type { LearningPack } from '../types.js'

function hook(markdown?: string): string {
  if (!markdown) return ''
  const value = markdown.trim()
  const heading = value.search(/\n#{1,6}\s+/)
  return (heading >= 0 ? value.slice(0, heading) : value).trim()
}

const POS_LABELS: Record<string, string> = {
  verb: '动作与影响',
  noun: '局势与对象',
  adjective: '评价与程度',
  adverb: '方式与程度',
}

/**
 * A short reading guide for the page. An LLM-compressed guide wins; otherwise
 * keep the editorial hook and a compact expression thread from the word cards.
 */
export function readingGuideMarkdown(pack: LearningPack): string {
  const generated = pack.readingGuide?.trim()
  if (generated) return generated
  const intro = hook(pack.editorial)
  const items = pack.items.filter((item) => item.type !== 'sentence').slice(0, 8)
  const groups = new Map<string, string[]>()
  for (const item of items) {
    const key = POS_LABELS[(item.pos ?? '').toLowerCase()] ?? '其他表达'
    const label = item.definitionZh ?? item.sense
    groups.set(key, [...(groups.get(key) ?? []), `**${item.lemma}** — ${label}`])
  }
  const thread = [...groups.entries()]
    .map(([label, values]) => `**${label}**\n${values.map((value) => `- ${value}`).join('\n')}`)
    .join('\n\n')
  return [
    intro,
    thread ? `### 本篇表达线索\n${thread}` : '',
    '### 阅读提示\n先通读一遍，注意每段的 role 和关键句；遇到细节再回到段落笔记和词卡。',
  ]
    .filter(Boolean)
    .join('\n\n')
}
