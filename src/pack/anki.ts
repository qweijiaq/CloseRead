import type { LearningPack } from '../types.js'

function csvEscape(value: string): string {
  const cleaned = value.replace(/\r?\n/g, '<br>').trim()
  return /[",]/.test(cleaned) ? `"${cleaned.replace(/"/g, '""')}"` : cleaned
}

export function renderAnkiCsv(pack: LearningPack): string {
  const header = [
    'Word',
    'Sense',
    'Definition',
    'DefinitionZh',
    'Context',
    'ContextTranslation',
    'Collocations',
    'Examples',
    'Source',
  ]

  const rows = pack.items.map((item) => [
    item.lemma,
    item.sense,
    item.definition,
    item.definitionZh ?? '',
    item.contexts[0]?.sentence ?? '',
    item.contexts[0]?.translation ?? '',
    item.collocations.join('; '),
    item.examples
      .slice(0, 4)
      .map((example) => example.text)
      .join(' | '),
    item.sourceRef,
  ])

  const lines = [header, ...rows].map((row) => row.map(csvEscape).join(','))
  // BOM keeps Excel and Anki from mangling Chinese text.
  return `﻿${lines.join('\n')}\n`
}
