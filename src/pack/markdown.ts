import type { LearningPack } from '../types.js'
import { packReadingMinutes } from './reading-time.js'

function escapePipe(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()
}

export function renderMarkdown(pack: LearningPack): string {
  const lines: string[] = []

  lines.push(`# ${pack.title}`)
  lines.push('')
  lines.push(`> 来源：${pack.source}`)
  lines.push(
    `> 生成于 ${pack.generatedAt} · ${pack.stats.wordCount} 词 · ${pack.stats.itemCount} 个学习项 · ${pack.mode} 模式`,
  )
  if (pack.styleName) lines.push(`> 风格参考：${pack.styleName}`)
  lines.push('')
  lines.push('## 0. 导读')
  lines.push('')
  lines.push(`- 难度：**${pack.difficulty.cefr}**（${pack.difficulty.reason}）`)
  lines.push(`- 精读预计：${packReadingMinutes(pack)} 分钟（含笔记、句子分析与词卡）`)
  lines.push('- 建议顺序：逐段精读 → 速览 → 词汇 → 练习 → 复习。')
  lines.push('')

  if (pack.reading?.length) {
    const itemById = new Map(pack.items.map((item) => [item.id, item]))
    lines.push('## 逐段精读')
    lines.push('')
    for (const paragraph of pack.reading) {
      lines.push(`### 段落 ${String(paragraph.index + 1).padStart(2, '0')}`)
      lines.push('')
      lines.push(paragraph.original)
      lines.push('')
      if (paragraph.translation) {
        lines.push(`> 译文：${paragraph.translation}`)
        lines.push('')
      }
      const items = paragraph.itemIds.flatMap((id) => {
        const item = itemById.get(id)
        return item ? [item] : []
      })
      if (items.length) {
        lines.push(
          `**重点表达**：${items.map((item) => `${item.lemma}（${item.definitionZh ?? item.sense}）`).join('；')}`,
        )
        lines.push('')
      }
    }
  }

  const mappedIds = new Set((pack.reading ?? []).flatMap((paragraph) => paragraph.itemIds))
  const sentenceItems = pack.items.filter((item) => item.type === 'sentence' && item.sentence)
  const wordItems = pack.items.filter((item) => item.type !== 'sentence')
  const supplemental = wordItems.filter((item) => !mappedIds.has(item.id))
  if (supplemental.length) {
    lines.push('## 补充词汇')
    lines.push('')
    for (const item of supplemental) {
      lines.push(`- **${item.lemma}** — ${item.definitionZh ?? item.sense}（${item.sourceRef}）`)
    }
    lines.push('')
  }

  if (pack.editorial) {
    lines.push('## 风格化导读')
    lines.push('')
    lines.push(pack.editorial)
    lines.push('')
  }

  lines.push('## 1. 速览')
  lines.push('')
  lines.push(pack.summary)
  lines.push('')
  lines.push('## 2. 核心词汇')
  lines.push('')
  lines.push('| 词 | 义项 | 释义 | 搭配 |')
  lines.push('| --- | --- | --- | --- |')

  for (const item of wordItems) {
    const head = `**${escapePipe(item.lemma)}**${item.ipa ? ` ${escapePipe(item.ipa)}` : ''}`
    const sense = item.sense.trim() === item.definition.trim() ? '—' : escapePipe(item.sense)
    const meaning = `${escapePipe(item.definition)}${item.definitionZh ? `<br>${escapePipe(item.definitionZh)}` : ''}`
    lines.push(`| ${head} | ${sense} | ${meaning} | ${escapePipe(item.collocations.join('; '))} |`)
  }

  lines.push('')
  lines.push('## 3. 学习项详情')

  for (const item of wordItems) {
    lines.push('')
    lines.push(`### ${item.lemma}${item.ipa ? ` ${item.ipa}` : ''}`)
    lines.push('')
    if (item.sense.trim() !== item.definition.trim()) lines.push(`- **义项**：${item.sense}`)
    lines.push(`- **释义**：${item.definition}`)
    if (item.definitionZh) lines.push(`- **中文**：${item.definitionZh}`)
    if (item.pos) lines.push(`- **词性**：${item.pos}`)
    if (item.cefr) lines.push(`- **CEFR**：${item.cefr}`)
    if (item.collocations.length) lines.push(`- **搭配**：${item.collocations.join(' / ')}`)
    if (item.relations.synonyms.length) lines.push(`- **同义**：${item.relations.synonyms.join(', ')}`)
    if (item.relations.antonyms.length) lines.push(`- **反义**：${item.relations.antonyms.join(', ')}`)
    if (item.relations.confusables.length) lines.push(`- **易混**：${item.relations.confusables.join(', ')}`)
    if (item.relations.wordFamily.length) lines.push(`- **词族**：${item.relations.wordFamily.join(', ')}`)
    const formation = [
      ...(item.wordFormation?.roots ?? []).map(
        (part) =>
          `词根 ${part.form}（${part.meaning}）${part.examples.length ? `：${part.examples.join(', ')}` : ''}`,
      ),
      ...(item.wordFormation?.prefixes ?? []).map(
        (part) =>
          `前缀 ${part.form}（${part.meaning}）${part.examples.length ? `：${part.examples.join(', ')}` : ''}`,
      ),
      ...(item.wordFormation?.suffixes ?? []).map(
        (part) =>
          `后缀 ${part.form}（${part.meaning}）${part.examples.length ? `：${part.examples.join(', ')}` : ''}`,
      ),
    ]
    if (formation.length) lines.push(`- **词根词缀**：${formation.join('；')}`)
    if (item.memoryHook) lines.push(`- **记忆钩子**：${item.memoryHook}`)
    if (item.notes) lines.push(`- **笔记**：${item.notes}`)
    lines.push('')
    lines.push(`> ${item.contexts[0]?.sentence ?? ''}`)
    if (item.contexts[0]?.translation) lines.push(`>`)
    if (item.contexts[0]?.translation) lines.push(`> ${item.contexts[0].translation}`)
    lines.push('')

    const examples = item.examples.filter((example) => example.origin !== 'source').slice(0, 3)
    for (const example of examples) {
      lines.push(`- ${example.text} _(${example.origin})_`)
    }
    if (examples.length) lines.push('')
    lines.push(`<sub>来源：${item.sourceRef}</sub>`)
  }

  if (sentenceItems.length) {
    lines.push('')
    lines.push('## 句子卡')
    for (const item of sentenceItems) {
      const sentence = item.sentence!
      lines.push('')
      lines.push(`### ${item.lemma}`)
      lines.push('')
      lines.push(`- **原文**：${sentence.original}`)
      lines.push(`- **译文**：${sentence.translation}`)
      if (sentence.chunks.length) {
        lines.push(
          `- **意群**：${sentence.chunks
            .map((chunk) => `${chunk.text}（${chunk.role}${chunk.meaning ? `：${chunk.meaning}` : ''}）`)
            .join('；')}`,
        )
      }
      if (sentence.pattern) lines.push(`- **句型**：${sentence.pattern}`)
      if (sentence.grammar) lines.push(`- **语法**：${sentence.grammar}`)
      if (sentence.variants.length) lines.push(`- **替换**：${sentence.variants.join(' / ')}`)
      if (sentence.why) lines.push(`- **为什么值得学**：${sentence.why}`)
      lines.push('')
    }
  }

  lines.push('')
  lines.push('## 4. 练习')
  lines.push('')

  if (pack.exercises.cloze.length) {
    lines.push('### 完形填空')
    lines.push('')
    pack.exercises.cloze.forEach((exercise, index) => {
      lines.push(`${index + 1}. ${exercise.sentence}`)
      lines.push(`   - 答案：**${exercise.answer}**${exercise.hint ? `（${exercise.hint}）` : ''}`)
    })
    lines.push('')
  }

  if (pack.exercises.comprehension.length) {
    lines.push('### 阅读理解')
    lines.push('')
    pack.exercises.comprehension.forEach((exercise, index) => {
      lines.push(`${index + 1}. ${exercise.question}`)
      lines.push(`   - 参考答案：${exercise.answer}`)
    })
    lines.push('')
  }

  if (pack.exercises.discussion.length) {
    lines.push('### 讨论 / 输出')
    lines.push('')
    pack.exercises.discussion.forEach((entry, index) => {
      lines.push(`${index + 1}. ${entry.question}`)
      lines.push(`   - 参考回答：${entry.answer}`)
    })
    lines.push('')
  }

  if (pack.sourceText) {
    lines.push('## 5. 原文')
    lines.push('')
    lines.push(pack.sourceText)
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('由 CloseRead 生成。学习项已写入本地复习库。')
  lines.push('')

  return lines.join('\n')
}
