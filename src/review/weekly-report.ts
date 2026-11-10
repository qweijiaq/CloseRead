import type { WeeklyPayload } from './weekly.js'

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

/** Render the weekly payload as a portable Markdown report. */
export function weeklyMarkdown(payload: WeeklyPayload): string {
  const lines: string[] = []
  lines.push('# CloseRead 本周复盘', '')
  lines.push(`**周期**：${payload.range.start} → ${payload.range.end}（${payload.range.days} 天）`)
  if (payload.level) lines.push(`**当前水平**：${payload.level}`)
  lines.push('')

  lines.push('## 概览', '')
  lines.push(`- 完成精读：${payload.articles.finished} 篇，共 ${payload.articles.words} 词`)
  for (const title of payload.articles.titles) lines.push(`  - ${clean(title)}`)
  lines.push(
    `- 复习：${payload.reviews.total} 次，正确率 ${percent(payload.reviews.accuracy)}；首次正确率 ${
      payload.reviews.firstTotal ? percent(payload.reviews.firstAccuracy) : '—'
    }`,
  )
  lines.push(`- 新增词条：${payload.newItems} 个`)
  lines.push(`- 输出：${payload.outputs.count} 次`)
  lines.push(`- 学习天数：${payload.studyDays} / ${payload.range.days}`)
  lines.push(`- 本周目标：文章 ${payload.articles.finished} / ${payload.goals.articles} 篇，学习 ${payload.studyDays} / ${payload.goals.studyDays} 天`)
  lines.push(`- 当前到期：${payload.due}；待学：${payload.backlog}`)
  lines.push('')

  lines.push('## 需要回看的词', '')
  if (payload.missed.length) {
    lines.push('| 单词 | 释义 | 错误次数 |', '| --- | --- | --- |')
    for (const entry of payload.missed) {
      lines.push(`| ${clean(entry.lemma)} | ${clean(entry.definition).replace(/\|/g, '\\|')} | ${entry.misses} |`)
    }
  } else {
    lines.push('这周没有 Again / Hard 的词。')
  }
  lines.push('')

  if (payload.outputs.latest) {
    lines.push('## 最近的输出', '', payload.outputs.latest.text.replace(/\s+/g, ' ').trim(), '')
  }

  lines.push('## 下周建议', '', payload.suggestion, '')
  return `${lines.join('\n')}\n`
}
