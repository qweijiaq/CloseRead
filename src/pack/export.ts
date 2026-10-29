import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { strToU8, zipSync } from 'fflate'
import { marked } from 'marked'

import { answerReadingQuestion } from '../analyze/note-answer.js'
import { generateDerivationGraph } from '../analyze/derivation.js'
import { generateFrontMatter } from '../analyze/reading-frontmatter.js'
import { generateReadingGuide } from '../analyze/reading-guide.js'
import { translateExercise } from '../analyze/exercise-translation.js'
import { packReadingMinutes } from './reading-time.js'
import { readingGuideMarkdown } from './reading-guide.js'
import { hasLlm } from '../config.js'
import type { DerivationGraph, LearningItem, LearningPack, ParagraphNote } from '../types.js'

const execFileAsync = promisify(execFile)

function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function safeTitle(pack: LearningPack): string {
  return pack.title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || pack.id
}

export function exportFileName(pack: LearningPack, extension: string): string {
  return `${safeTitle(pack)}.${extension}`
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++]!
      await fn(current)
    }
  })
  await Promise.all(workers)
}

export interface ExportPreparation {
  changed: number
  errors: string[]
}

/** Fill derivations, reflection answers and exercise translations before export. */
export async function preparePackForExport(pack: LearningPack): Promise<ExportPreparation> {
  if (!hasLlm()) return { changed: 0, errors: ['LLM not configured; skipped export enrichment.'] }
  let changed = 0
  const errors: string[] = []

  if (!pack.frontMatter?.titleZh) {
    try {
      const frontMatter = await generateFrontMatter(pack)
      if (frontMatter) {
        pack.frontMatter = frontMatter
        changed += 1
      }
    } catch (error) {
      errors.push(`front matter: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (!pack.readingGuide) {
    try {
      pack.readingGuide = await generateReadingGuide(pack)
      changed += 1
    } catch (error) {
      errors.push(`reading guide: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const words = pack.items.filter((item) => item.type !== 'sentence' && !item.derivation)
  await mapLimit(words, 3, async (item) => {
    try {
      item.derivation = await generateDerivationGraph(item)
      changed += 1
    } catch (error) {
      errors.push(`derivation ${item.lemma}: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  const paragraphs = (pack.reading ?? []).filter(
    (paragraph) => paragraph.note?.question && !paragraph.note.answer,
  )
  await mapLimit(paragraphs, 2, async (paragraph) => {
    try {
      paragraph.note!.answer = await answerReadingQuestion(
        paragraph.original,
        paragraph.note!.question!,
        pack.title,
      )
      changed += 1
    } catch (error) {
      errors.push(`answer p${paragraph.index + 1}: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  type ExerciseTarget = {
    kind: 'cloze' | 'comprehension' | 'discussion'
    index: number
    prompt: string
    answer: string
    apply: (questionZh: string, answerZh?: string) => void
  }
  const exerciseTargets: ExerciseTarget[] = []
  pack.exercises.cloze.forEach((exercise, index) => {
    if (!exercise.sentenceZh) {
      exerciseTargets.push({
        kind: 'cloze',
        index,
        prompt: exercise.sentence,
        answer: exercise.answer,
        apply: (questionZh, answerZh) => {
          exercise.sentenceZh = questionZh
          if (answerZh) exercise.answerZh = answerZh
        },
      })
    }
  })
  for (const kind of ['comprehension', 'discussion'] as const) {
    const list = pack.exercises[kind]
    list.forEach((exercise, index) => {
      if (!exercise.questionZh) {
        exerciseTargets.push({
          kind,
          index,
          prompt: exercise.question,
          answer: exercise.answer,
          apply: (questionZh, answerZh) => {
            exercise.questionZh = questionZh
            if (answerZh) exercise.answerZh = answerZh
          },
        })
      }
    })
  }
  await mapLimit(exerciseTargets, 2, async (target) => {
    try {
      const translated = await translateExercise(target.kind, target.prompt, target.answer, pack.summary)
      target.apply(translated.questionZh, translated.answerZh)
      changed += 1
    } catch (error) {
      errors.push(`exercise ${target.kind} ${target.index + 1}: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  return { changed, errors }
}

function renderDerivationTree(graph: DerivationGraph): string {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const center = graph.nodes.find((node) => node.kind === 'center') || graph.nodes[0]
  if (!center) return ''
  const adjacency = new Map<string, Array<{ id: string; label: string }>>()
  for (const node of graph.nodes) adjacency.set(node.id, [])
  const edges = graph.edges.length
    ? graph.edges
    : graph.nodes
        .filter((node) => node.id !== center.id)
        .map((node) => ({ from: center.id, to: node.id, label: '' }))
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to) || edge.from === edge.to) continue
    const forward = adjacency.get(edge.from)!
    const backward = adjacency.get(edge.to)!
    if (!forward.some((entry) => entry.id === edge.to)) {
      forward.push({ id: edge.to, label: edge.label ?? '' })
    }
    if (!backward.some((entry) => entry.id === edge.from)) {
      backward.push({ id: edge.from, label: edge.label ?? '' })
    }
  }
  const visited = new Set<string>()
  const build = (id: string, depth: number, label: string): string => {
    if (visited.has(id) || depth > 6) return ''
    visited.add(id)
    const node = byId.get(id)
    if (!node) return ''
    const kindLabels: Record<string, string> = { root: '词根', prefix: '前缀', suffix: '后缀', derivative: '派生', related: '相关' }
    const children = (adjacency.get(id) ?? [])
      .map((edge) => {
        const child = byId.get(edge.id)
        const label = child && (child.kind === 'root' || child.kind === 'prefix' || child.kind === 'suffix')
          ? kindLabels[child.kind] ?? edge.label
          : edge.label || (child ? kindLabels[child.kind] ?? '' : '')
        return build(edge.id, depth + 1, label)
      })
      .filter(Boolean)
      .join('')
    return `<li>${label ? `<span class="tree-edge">${escapeXml(label)}</span>` : ''}<div class="tree-node tree-${escapeXml(node.kind)}"><b>${escapeXml(node.word)}</b>${node.meaningZh ? `<span>${escapeXml(node.meaningZh)}</span>` : ''}</div>${children ? `<ul class="tree-children">${children}</ul>` : ''}</li>`
  }
  const root = build(center.id, 0, '')
  return `<div class="derivation-tree"><div class="derivation-caption">派生图 · 思维导图</div><ul>${root}</ul></div>`
}

/** A static, print-ready page: no scripts, no collapsed details, every card expanded. */
export function renderPackExportHtml(pack: LearningPack): string {
  const itemById = new Map(pack.items.map((item) => [item.id, item]))
  const wordItems = pack.items.filter((item) => item.type !== 'sentence')
  const sentenceItems = pack.items.filter((item) => item.type === 'sentence' && item.sentence)
  const shown = new Set<string>()
  const front = pack.frontMatter
  const blockAttrs = (id: string, label: string, kind: string): string =>
    `data-export-block="1" data-block-id="${escapeXml(id)}" data-block-label="${escapeXml(label)}" data-block-kind="${kind}"`
  const headingBlock = (id: string, text: string): string =>
    `<section class="export-block export-heading" ${blockAttrs(id, text, 'heading')}><h2>${escapeXml(text)}</h2></section>`

  const renderWordCard = (item: LearningItem, blockId?: string, blockLabel?: string): string => {
    const relations = [
      ['近义', item.relations.synonyms],
      ['反义', item.relations.antonyms],
      ['易混', item.relations.confusables],
      ['词族', item.relations.wordFamily],
    ]
      .filter(([, values]) => (values as string[]).length > 0)
      .map(
        ([label, values]) =>
          `<p class="rel"><b>${label}</b> ${(values as string[]).map(escapeXml).join('、')}</p>`,
      )
      .join('')
    const formation = item.wordFormation
      ? [
          ...item.wordFormation.roots.map((part) => `词根 ${part.form}（${part.meaning}）`),
          ...item.wordFormation.prefixes.map((part) => `前缀 ${part.form}（${part.meaning}）`),
          ...item.wordFormation.suffixes.map((part) => `后缀 ${part.form}（${part.meaning}）`),
        ]
      : []
    return `<article class="word-card${blockId ? ' export-block' : ''}"${blockId ? ` ${blockAttrs(blockId, blockLabel ?? item.lemma, 'word')}` : ''}>
      <div class="word-head">
        <span class="word-lemma">${escapeXml(item.lemma)}</span>
        ${item.ipa ? `<span class="word-ipa">${escapeXml(item.ipa)}</span>` : ''}
        ${item.pos ? `<span class="word-tag">${escapeXml(item.pos)}</span>` : ''}
        ${item.cefr ? `<span class="word-tag">${escapeXml(item.cefr)}</span>` : ''}
      </div>
      <p class="word-zh">${escapeXml(item.definitionZh ?? item.sense)}</p>
      <p class="word-def">${escapeXml(item.definition)}</p>
      ${
        item.collocations.length
          ? `<div class="chips">${item.collocations.map((value) => `<span>${escapeXml(value)}</span>`).join('')}</div>`
          : ''
      }
      ${
        item.examples.length
          ? `<ul class="examples">${item.examples
              .slice(0, 4)
              .map((example) => `<li>${escapeXml(example.text)}</li>`)
              .join('')}</ul>`
          : ''
      }
      ${relations}
      ${formation.length ? `<p class="formation">${formation.map(escapeXml).join('；')}</p>` : ''}
      ${item.memoryHook ? `<p class="memory">${escapeXml(item.memoryHook)}</p>` : ''}
      ${item.notes ? `<p class="memory">${escapeXml(item.notes)}</p>` : ''}
      ${item.derivation ? renderDerivationTree(item.derivation) : ''}
    </article>`
  }

  const renderNote = (note: ParagraphNote | undefined): string => {
    if (!note) return ''
    return `<aside class="note">
      ${note.role ? `<span class="note-role">${escapeXml(note.role)}</span>` : ''}
      ${note.summary ? `<p class="note-summary">${escapeXml(note.summary)}</p>` : ''}
      ${note.keySentence ? `<blockquote>${escapeXml(note.keySentence)}</blockquote>` : ''}
      ${note.keySentenceNote ? `<p>${escapeXml(note.keySentenceNote)}</p>` : ''}
      ${note.grammar ? `<p><b>语法</b> ${escapeXml(note.grammar)}</p>` : ''}
      ${
        note.connectors.length
          ? `<p><b>连接</b> ${note.connectors
              .map((connector) => `${escapeXml(connector.text)}（${escapeXml(connector.usage)}）`)
              .join('；')}</p>`
          : ''
      }
      ${note.background ? `<p><b>背景</b> ${escapeXml(note.background)}</p>` : ''}
      ${note.question ? `<p><b>想一想</b> ${escapeXml(note.question)}</p>` : ''}
      ${note.answer ? `<p><b>参考答案</b> ${escapeXml(note.answer)}</p>` : ''}
    </aside>`
  }

  const renderSentenceCard = (item: LearningItem, index: number): string => {
    const sentence = item.sentence!
    return `<article class="sentence-card export-block" ${blockAttrs(`sentence-${index + 1}`, `句子卡：${item.lemma}`, 'sentence')}>
      <h3>${escapeXml(item.lemma)}</h3>
      <p class="quote">${escapeXml(sentence.original)}</p>
      <p class="word-zh">${escapeXml(sentence.translation)}</p>
      ${
        sentence.chunks.length
          ? `<ul class="chunks">${sentence.chunks
              .map(
                (chunk) =>
                  `<li><b>${escapeXml(chunk.role)}</b> ${escapeXml(chunk.text)}${
                    chunk.meaning ? ` — ${escapeXml(chunk.meaning)}` : ''
                  }</li>`,
              )
              .join('')}</ul>`
          : ''
      }
      ${sentence.pattern ? `<p><b>句型</b> ${escapeXml(sentence.pattern)}</p>` : ''}
      ${sentence.grammar ? `<p><b>语法</b> ${escapeXml(sentence.grammar)}</p>` : ''}
      ${
        sentence.variants.length
          ? `<p><b>替换</b> ${sentence.variants.map(escapeXml).join(' / ')}</p>`
          : ''
      }
      ${sentence.why ? `<p class="note-summary">${escapeXml(sentence.why)}</p>` : ''}
    </article>`
  }

  const renderExerciseBlock = (
    title: string,
    id: string,
    items: Array<{
      question: string
      answer: string
      questionZh?: string
      answerZh?: string
      hint?: string
    }>,
  ): string =>
    items.length
      ? `<section class="exercise export-block" ${blockAttrs(id, title, 'exercise')}><h2>${escapeXml(title)}</h2><ol>${items
          .map(
            (item) =>
              `<li><p>${escapeXml(item.question)}</p>${
                item.questionZh ? `<p class="translation">${escapeXml(item.questionZh)}</p>` : ''
              }<p class="answer"><b>答案：</b>${escapeXml(item.answer)}${
                item.hint ? ` — ${escapeXml(item.hint)}` : ''
              }</p>${item.answerZh ? `<p class="translation">答案译文：${escapeXml(item.answerZh)}</p>` : ''}</li>`,
          )
          .join('')}</ol></section>`
      : ''

  const frontItems = (front?.itemIds ?? []).flatMap((id) => {
    const item = itemById.get(id)
    return item ? [item] : []
  })
  for (const item of frontItems) shown.add(item.id)

  const paragraphs = (pack.reading ?? [])
    .map((paragraph) => {
      const items = paragraph.itemIds.flatMap((id) => {
        const item = itemById.get(id)
        if (!item || shown.has(item.id)) return []
        shown.add(item.id)
        return [item]
      })
      const label = String(paragraph.index + 1).padStart(2, '0')
      return `<section class="para export-block" id="p-${label}" ${blockAttrs(`para-${label}`, `第 ${label} 段`, 'paragraph')}>
        <div class="para-no">${label}</div>
        <div class="para-body">
          <p class="original">${escapeXml(paragraph.original)}</p>
          ${paragraph.translation ? `<p class="translation">${escapeXml(paragraph.translation)}</p>` : ''}
          ${renderNote(paragraph.note)}
          ${items.length ? `<div class="para-words">${items.map((item) => renderWordCard(item)).join('')}</div>` : ''}
        </div>
      </section>`
    })
    .join('')

  const supplemental = wordItems.filter((item) => !shown.has(item.id))
  const readingGuide = readingGuideMarkdown(pack)
  const editorial = readingGuide
    ? `<section class="preface export-block" ${blockAttrs('guide', '精读导读', 'section')}><h2>精读导读</h2>${marked.parse(readingGuide, { async: false }) as string}</section>`
    : ''

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeXml(pack.title)} · 精读导出</title>
<style>
  :root { --ink: #1c1a16; --muted: rgba(28,26,22,.55); --line: rgba(28,26,22,.14); --paper: #f6f2e8; --card: #fffdf8; --rust: #b03a2e; --ochre: #a8732f; --indigo: #3f5f7f; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif; line-height: 1.75; }
  .sheet { max-width: 840px; margin: 0 auto; padding: 48px 48px 70px; background: var(--card); }
  .export-block { break-inside: avoid; }
  .export-heading { margin-top: 8px; }
  h1, h2, h3 { font-family: "Songti SC", "Noto Serif SC", "Source Han Serif SC", STSong, SimSun, serif; }
  .cover { text-align: center; padding: 30px 0 34px; border-bottom: 2px solid var(--ink); }
  .kicker { color: var(--rust); font-family: "SF Mono", monospace; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
  .cover h1 { font-size: 36px; line-height: 1.25; margin: 14px 0 8px; }
  .title-zh { color: var(--muted); font-size: 18px; }
  .title-note { color: var(--ochre); font-size: 13px; margin-top: 10px; }
  .summary { max-width: 680px; margin: 18px auto 0; color: var(--muted); font-size: 14px; text-align: left; }
  .lead { max-width: 680px; margin: 20px auto 0; padding-top: 16px; border-top: 1px dashed var(--line); font-family: "Songti SC", serif; font-size: 16px; text-align: left; }
  .lead .translation { margin-top: 7px; }
  h2 { font-size: 22px; margin: 34px 0 12px; padding-bottom: 7px; border-bottom: 1px solid var(--line); break-after: avoid; }
  .preface { margin-top: 22px; }
  .preface h3 { margin: 14px 0 5px; color: var(--ochre); font-family: monospace; font-size: 11px; letter-spacing: .05em; }
  .preface p { margin: 0 0 9px; font-size: 13.5px; line-height: 1.75; }
  .preface ul { margin: 5px 0 10px; padding-left: 20px; font-size: 12.5px; line-height: 1.7; }
  .para { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 14px; padding: 18px 0; border-bottom: 1px solid var(--line); break-inside: avoid; }
  .para-no { color: var(--muted); font-family: "SF Mono", monospace; font-size: 11px; padding-top: 4px; }
  .original { margin: 0; font-family: "Songti SC", "Noto Serif SC", serif; font-size: 17px; line-height: 1.85; }
  .translation { color: var(--muted); font-size: 13.5px; line-height: 1.8; margin: 7px 0 0; }
  .note { margin-top: 12px; padding: 12px 15px; border-left: 3px solid var(--ochre); background: rgba(239,231,215,.55); break-inside: avoid; }
  .note p { margin: 5px 0; font-size: 12.5px; line-height: 1.7; }
  .note-role { display: inline-block; margin-right: 7px; color: var(--ochre); font-family: monospace; font-size: 10px; }
  .note-summary { font-weight: 700; }
  blockquote { margin: 8px 0; padding-left: 12px; border-left: 2px solid var(--line); color: var(--muted); font-family: "Songti SC", serif; }
  .para-words { margin-top: 12px; display: grid; gap: 10px; }
  .word-card { padding: 12px 14px; border: 1px solid var(--line); border-radius: 9px; background: #fff; break-inside: avoid; }
  .word-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  .word-lemma { font-family: "Songti SC", serif; font-size: 18px; font-weight: 700; }
  .word-ipa { color: var(--muted); font-size: 12px; }
  .word-tag { padding: 1px 6px; border: 1px solid var(--line); border-radius: 4px; color: var(--muted); font-family: monospace; font-size: 10px; }
  .word-zh { margin: 4px 0 0; font-weight: 700; font-size: 14px; }
  .word-def { margin: 2px 0 0; color: var(--muted); font-size: 12.5px; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
  .chips span { padding: 1px 7px; border-radius: 999px; background: rgba(63,95,127,.08); color: var(--indigo); font-size: 11.5px; }
  .examples { margin: 7px 0 0; padding-left: 18px; color: var(--muted); font-size: 12.5px; }
  .rel, .formation, .memory { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
  .rel b, .formation b, .memory b { color: var(--ink); }
  .derivation-tree { margin-top: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: #fffdf8; break-inside: avoid; }
  .derivation-caption { color: var(--muted); font-size: 10px; margin: 2px 3px 0; }
  .derivation-tree ul { list-style: none; margin: 0; padding-left: 0; }
  .derivation-tree ul.tree-children { margin-left: 9px; padding-left: 14px; border-left: 1px solid var(--line); }
  .derivation-tree li { position: relative; padding: 4px 0; }
  .derivation-tree ul.tree-children > li::before { content: ''; position: absolute; left: -14px; top: 17px; width: 12px; border-top: 1px solid var(--line); }
  .tree-node { display: inline-flex; align-items: baseline; flex-wrap: wrap; gap: 5px; padding: 2px 7px; border: 1px solid var(--line); border-radius: 6px; background: #fff; font-size: 12px; }
  .tree-node b { font-family: "Songti SC", serif; font-size: 13px; }
  .tree-node span { color: var(--muted); font-size: 10.5px; }
  .tree-node.tree-center { border-color: var(--rust); background: rgba(176,58,46,.06); }
  .tree-node.tree-center b { color: var(--rust); }
  .tree-node.tree-root { border-color: rgba(63,95,127,.4); }
  .tree-node.tree-prefix, .tree-node.tree-suffix { border-color: rgba(168,115,47,.4); }
  .tree-edge { display: block; margin-bottom: 2px; color: var(--ochre); font-family: "SF Mono", monospace; font-size: 9px; }
  .sentence-card { padding: 14px 16px; margin: 12px 0; border: 1px solid var(--line); border-radius: 9px; break-inside: avoid; }
  .sentence-card h3 { margin: 0 0 7px; font-size: 19px; }
  .quote { margin: 0; padding-left: 12px; border-left: 3px solid var(--rust); font-family: "Songti SC", serif; font-size: 15px; }
  .chunks { margin: 8px 0; padding-left: 18px; color: var(--muted); font-size: 12.5px; }
  .sentence-card p { margin: 5px 0; font-size: 12.5px; }
  .exercise li { margin: 10px 0; }
  .answer { color: var(--ink); }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
  .footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; }
  @page { margin: 12mm 12mm; }
  @media print {
    body { background: #fff; font-size: 13px; }
    .sheet { max-width: none; padding: 0; background: #fff; }
    a { color: inherit; text-decoration: none; }
    .cover { padding: 8px 0 18px; }
    .cover h1 { font-size: 28px; }
    .summary, .lead { margin-top: 10px; }
    .original { font-size: 15.5px; line-height: 1.7; }
    .translation { font-size: 12.5px; line-height: 1.7; }
    .para { padding: 9px 0; break-inside: auto; }
    .para-words { break-inside: auto; }
    .word-card { padding: 8px 10px; margin-bottom: 2px; }
    .word-lemma { font-size: 16px; }
    .note { margin-top: 8px; padding: 8px 10px; }
    .sentence-card, .exercise li { break-inside: auto; }
    h2 { margin-top: 20px; break-after: avoid; }
    .word-card, .sentence-card, .note, .exercise li, .derivation-tree { break-inside: auto; }
  }
</style>
</head>
<body>
<main class="sheet">
  <header class="cover export-block" ${blockAttrs('cover', '封面与导语', 'cover')}>
    <div class="kicker">${escapeXml(front?.section ?? 'INTENSIVE READING')} · ${pack.stats.wordCount} 词 · 精读约 ${packReadingMinutes(pack)} 分钟</div>
    <h1>${escapeXml(pack.title)}</h1>
    ${front?.titleZh ? `<div class="title-zh">${escapeXml(front.titleZh)}</div>` : ''}
    ${front?.titleNote ? `<div class="title-note">${escapeXml(front.titleNote)}</div>` : ''}
    ${
      front?.lead
        ? `<div class="lead">${escapeXml(front.lead)}${
            front.leadZh ? `<p class="translation">${escapeXml(front.leadZh)}</p>` : ''
          }${front.leadNote ? `<p class="title-note">${escapeXml(front.leadNote)}</p>` : ''}</div>`
        : ''
    }
  </header>
  ${frontItems.length ? `<section class="para-words export-block" ${blockAttrs('front-words', '标题与导语重点词', 'words')}>${frontItems.map((item) => renderWordCard(item)).join('')}</section>` : ''}
  ${editorial}
  ${headingBlock('reading-heading', '逐段精读')}
  ${paragraphs}
  ${
    sentenceItems.length
      ? `${headingBlock('sentence-heading', '句子卡')}${sentenceItems.map((item, index) => renderSentenceCard(item, index)).join('')}`
      : ''
  }
  ${
    supplemental.length
      ? `${headingBlock('words-heading', '补充词汇')}${supplemental.map((item, index) => renderWordCard(item, `word-${index + 1}`, `补充词：${item.lemma}`)).join('')}`
      : ''
  }
  ${renderExerciseBlock('完形填空', 'exercise-cloze', pack.exercises.cloze.map((exercise) => ({
    question: exercise.sentence,
    answer: exercise.answer,
    ...(exercise.sentenceZh ? { questionZh: exercise.sentenceZh } : {}),
    ...(exercise.answerZh ? { answerZh: exercise.answerZh } : {}),
    ...(exercise.hint ? { hint: exercise.hint } : {}),
  })))}
  ${renderExerciseBlock('阅读理解', 'exercise-comprehension', pack.exercises.comprehension.map((exercise) => ({
    question: exercise.question,
    answer: exercise.answer,
    ...(exercise.questionZh ? { questionZh: exercise.questionZh } : {}),
    ...(exercise.answerZh ? { answerZh: exercise.answerZh } : {}),
  })))}
  ${renderExerciseBlock('讨论 / 输出', 'exercise-discussion', pack.exercises.discussion.map((exercise) => ({
    question: exercise.question,
    answer: exercise.answer,
    ...(exercise.questionZh ? { questionZh: exercise.questionZh } : {}),
    ...(exercise.answerZh ? { answerZh: exercise.answerZh } : {}),
  })))}
  <div class="footer export-block" ${blockAttrs('footer', '页脚', 'footer')}>由 CloseRead 导出 · ${escapeXml(pack.source)} · ${escapeXml(pack.generatedAt)}</div>
</main>
</body>
</html>`
}

export function findChrome(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  return [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((candidate) => existsSync(candidate))
}

async function findEbookConvert(): Promise<string | undefined> {
  if (process.env.EBOOK_CONVERT) return process.env.EBOOK_CONVERT
  try {
    const { stdout } = await execFileAsync('which', ['ebook-convert'])
    const found = stdout.trim()
    return found || undefined
  } catch {
    return undefined
  }
}

/** Render the pack to PDF with local headless Chrome. */
export async function renderPackPdf(pack: LearningPack): Promise<Uint8Array> {
  const chrome = findChrome()
  if (!chrome) {
    throw new Error('本机没有找到 Chrome/Chromium，暂时无法生成 PDF。可以先用浏览器打印页面保存为 PDF。')
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-pdf-'))
  const htmlPath = path.join(dir, 'pack.html')
  const pdfPath = path.join(dir, 'pack.pdf')
  try {
    await fs.writeFile(htmlPath, renderPackExportHtml(pack), 'utf8')
    await execFileAsync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--no-pdf-header-footer',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=3000',
        `--print-to-pdf=${pdfPath}`,
        `file://${htmlPath}`,
      ],
      { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
    )
    return await fs.readFile(pdfPath)
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

function sentenceCardXhtml(pack: LearningPack): string {
  const items = pack.items.filter((item) => item.type === 'sentence' && item.sentence)
  if (items.length === 0) return ''
  return `<section><h2>句子卡</h2>${items
    .map((item) => {
      const sentence = item.sentence!
      return `<article class="sentence">
        <h3>${escapeXml(item.lemma)}</h3>
        <p class="quote">${escapeXml(sentence.original)}</p>
        <p>${escapeXml(sentence.translation)}</p>
        ${sentence.chunks.length ? `<ul>${sentence.chunks.map((chunk) => `<li><b>${escapeXml(chunk.role)}</b> ${escapeXml(chunk.text)}${chunk.meaning ? ` — ${escapeXml(chunk.meaning)}` : ''}</li>`).join('')}</ul>` : ''}
        ${sentence.pattern ? `<p><b>句型：</b>${escapeXml(sentence.pattern)}</p>` : ''}
        ${sentence.grammar ? `<p><b>语法：</b>${escapeXml(sentence.grammar)}</p>` : ''}
        ${sentence.variants.length ? `<p><b>替换：</b>${escapeXml(sentence.variants.join(' / '))}</p>` : ''}
        ${sentence.why ? `<p class="note">${escapeXml(sentence.why)}</p>` : ''}
      </article>`
    })
    .join('')}</section>`
}

function wordCardsXhtml(pack: LearningPack): string {
  const items = pack.items.filter((item) => item.type !== 'sentence')
  if (items.length === 0) return ''
  return `<section><h2>词汇与表达</h2>${items
    .map((item) => {
      const formation = item.wordFormation
      const formationParts = formation
        ? [
            ...formation.roots.map((part) => `词根 ${part.form}（${part.meaning}）`),
            ...formation.prefixes.map((part) => `前缀 ${part.form}（${part.meaning}）`),
            ...formation.suffixes.map((part) => `后缀 ${part.form}（${part.meaning}）`),
          ]
        : []
      const relations = [
        item.relations.synonyms.length ? `同义：${item.relations.synonyms.join(', ')}` : '',
        item.relations.antonyms.length ? `反义：${item.relations.antonyms.join(', ')}` : '',
        item.relations.confusables.length ? `易混：${item.relations.confusables.join(', ')}` : '',
        item.relations.wordFamily.length ? `词族：${item.relations.wordFamily.join(', ')}` : '',
        formationParts.length ? `词根词缀：${formationParts.join('；')}` : '',
      ].filter(Boolean)
      const derivation = item.derivation
        ? (() => {
            const byId = new Map(item.derivation!.nodes.map((node) => [node.id, node.word]))
            const edges = item.derivation!.edges.length
              ? item.derivation!.edges
              : item.derivation!.nodes
                  .filter((node) => node.kind !== 'center')
                  .map((node) => ({
                    from: item.derivation!.nodes.find((entry) => entry.kind === 'center')?.id ?? '',
                    to: node.id,
                    label: '',
                  }))
            return edges
              .filter((edge) => byId.has(edge.from) && byId.has(edge.to))
              .map(
                (edge) =>
                  `${byId.get(edge.from)} → ${byId.get(edge.to)}${edge.label ? `（${edge.label}）` : ''}`,
              )
              .join('；')
          })()
        : ''
      return `<article class="word">
        <h3>${escapeXml(item.lemma)}${item.ipa ? ` <small>${escapeXml(item.ipa)}</small>` : ''}</h3>
        <p class="zh">${escapeXml(item.definitionZh ?? item.sense)}</p>
        <p>${escapeXml(item.definition)}</p>
        ${derivation ? `<p><b>派生图：</b>${escapeXml(derivation)}</p>` : ''}
        ${item.collocations.length ? `<p><b>搭配：</b>${escapeXml(item.collocations.join(' / '))}</p>` : ''}
        ${item.examples.length ? `<ul>${item.examples.slice(0, 3).map((example) => `<li>${escapeXml(example.text)}</li>`).join('')}</ul>` : ''}
        ${relations.length ? `<p class="note">${escapeXml(relations.join('；'))}</p>` : ''}
        ${item.memoryHook ? `<p class="note">${escapeXml(item.memoryHook)}</p>` : ''}
      </article>`
    })
    .join('')}</section>`
}

function exercisesXhtml(pack: LearningPack): string {
  const blocks: string[] = []
  if (pack.exercises.cloze.length) {
    blocks.push(
      `<h3>完形填空</h3><ol>${pack.exercises.cloze
        .map(
          (exercise) =>
            `<li><p>${escapeXml(exercise.sentence)}</p>${
              exercise.sentenceZh ? `<p class="translation">${escapeXml(exercise.sentenceZh)}</p>` : ''
            }<p class="answer">答案：${escapeXml(exercise.answer)}${exercise.hint ? ` — ${escapeXml(exercise.hint)}` : ''}</p>${
              exercise.answerZh ? `<p class="translation">答案译文：${escapeXml(exercise.answerZh)}</p>` : ''
            }</li>`,
        )
        .join('')}</ol>`,
    )
  }
  if (pack.exercises.comprehension.length) {
    blocks.push(
      `<h3>阅读理解</h3><ol>${pack.exercises.comprehension
        .map(
          (exercise) =>
            `<li><p>${escapeXml(exercise.question)}</p>${
              exercise.questionZh ? `<p class="translation">${escapeXml(exercise.questionZh)}</p>` : ''
            }<p class="answer">参考答案：${escapeXml(exercise.answer)}</p>${
              exercise.answerZh ? `<p class="translation">答案译文：${escapeXml(exercise.answerZh)}</p>` : ''
            }</li>`,
        )
        .join('')}</ol>`,
    )
  }
  if (pack.exercises.discussion.length) {
    blocks.push(
      `<h3>讨论 / 输出</h3><ol>${pack.exercises.discussion
        .map(
          (exercise) =>
            `<li><p>${escapeXml(exercise.question)}</p>${
              exercise.questionZh ? `<p class="translation">${escapeXml(exercise.questionZh)}</p>` : ''
            }<p class="answer">参考回答：${escapeXml(exercise.answer)}</p>${
              exercise.answerZh ? `<p class="translation">答案译文：${escapeXml(exercise.answerZh)}</p>` : ''
            }</li>`,
        )
        .join('')}</ol>`,
    )
  }
  return blocks.length ? `<section><h2>练习与讨论</h2>${blocks.join('')}</section>` : ''
}

function epubContent(pack: LearningPack): string {
  const front = pack.frontMatter
  const paragraphs = (pack.reading ?? [])
    .map((paragraph) => {
      const note = paragraph.note
      return `<section class="para">
        <p class="para-no">${String(paragraph.index + 1).padStart(2, '0')}</p>
        <p class="original">${escapeXml(paragraph.original)}</p>
        ${paragraph.translation ? `<p class="translation">${escapeXml(paragraph.translation)}</p>` : ''}
        ${
          note
            ? `<aside class="note">
                ${note.role ? `<p class="role">${escapeXml(note.role)}</p>` : ''}
                ${note.summary ? `<p><b>${escapeXml(note.summary)}</b></p>` : ''}
                ${note.keySentence ? `<blockquote>${escapeXml(note.keySentence)}</blockquote>` : ''}
                ${note.keySentenceNote ? `<p>${escapeXml(note.keySentenceNote)}</p>` : ''}
                ${note.grammar ? `<p><b>语法：</b>${escapeXml(note.grammar)}</p>` : ''}
                ${note.connectors.length ? `<p><b>连接：</b>${escapeXml(note.connectors.map((connector) => `${connector.text}（${connector.usage}）`).join('；'))}</p>` : ''}
                ${note.background ? `<p><b>背景：</b>${escapeXml(note.background)}</p>` : ''}
                ${note.question ? `<p><b>想一想：</b>${escapeXml(note.question)}</p>` : ''}
                ${note.answer ? `<p><b>参考答案：</b>${escapeXml(note.answer)}</p>` : ''}
              </aside>`
            : ''
        }
      </section>`
    })
    .join('')
  const readingGuide = readingGuideMarkdown(pack)
  const editorial = readingGuide
    ? `<section><h2>精读导读</h2>${marked.parse(readingGuide, { async: false }) as string}</section>`
    : ''
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head><meta charset="utf-8"/><title>${escapeXml(pack.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
  <header class="title-page">
    <p class="kicker">${escapeXml(pack.difficulty.cefr)} · ${pack.stats.wordCount} 词 · 精读约 ${packReadingMinutes(pack)} 分钟</p>
    <h1>${escapeXml(pack.title)}</h1>
    ${front?.titleZh ? `<p class="title-zh">${escapeXml(front.titleZh)}</p>` : ''}
    ${front?.titleNote ? `<p class="note">${escapeXml(front.titleNote)}</p>` : ''}
    ${front?.lead ? `<p class="lead">${escapeXml(front.lead)}</p>` : ''}
    ${front?.leadZh ? `<p class="translation">${escapeXml(front.leadZh)}</p>` : ''}
    ${front?.leadNote ? `<p class="note">${escapeXml(front.leadNote)}</p>` : ''}
  </header>
  ${editorial}
  <section><h2>逐段精读</h2>${paragraphs}</section>
  ${sentenceCardXhtml(pack)}
  ${wordCardsXhtml(pack)}
  ${exercisesXhtml(pack)}
</body>
</html>`
}

function epubCss(): string {
  return `body { font-family: "Songti SC", "Noto Serif SC", serif; line-height: 1.8; margin: 5%; color: #1c1a16; }
h1 { font-size: 2em; line-height: 1.35; }
h2 { margin-top: 2em; border-bottom: 1px solid #ddd; padding-bottom: .3em; }
h3 { font-size: 1.15em; }
.title-page { text-align: center; margin: 2em 0 3em; }
.kicker, .role { color: #b03a2e; font-size: .8em; letter-spacing: .08em; text-transform: uppercase; }
.title-zh { color: #666; font-size: 1.05em; }
.lead { font-style: italic; color: #444; }
.translation { color: #555; border-left: 2px solid #ddd; padding-left: 1em; }
.note { background: #f4efe3; border-left: 3px solid #a8732f; padding: .7em 1em; margin: 1em 0; color: #444; font-size: .92em; }
.note blockquote { margin: .6em 0; font-style: italic; }
.para { margin: 2em 0; }
.para-no { color: #999; font-size: .75em; font-family: monospace; }
.original { font-size: 1.05em; }
.sentence { margin: 1.5em 0; }
.quote { font-style: italic; border-left: 2px solid #b03a2e; padding-left: 1em; }
.word { margin: 1.2em 0; }
.word h3 { margin-bottom: .2em; }
.zh { font-weight: bold; }
.answer { color: #666; font-size: .9em; }
.summary { color: #555; }
`
}

/** Build a valid EPUB 3 archive from the pack. */
export function renderPackEpub(pack: LearningPack): Uint8Array {
  const title = escapeXml(pack.title)
  const identifier = `urn:x-code:${pack.id}`
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const content = epubContent(pack)
  const nav = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN">
<head><meta charset="utf-8"/><title>目录</title></head>
<body><nav epub:type="toc"><h1>目录</h1><ol><li><a href="index.xhtml">${title}</a></li></ol></nav></body>
</html>`
  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:language>zh-CN</dc:language>
    <dc:creator>CloseRead</dc:creator>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="content" href="index.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
  </manifest>
  <spine><itemref idref="content"/></spine>
</package>`
  const container = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
  return zipSync({
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': strToU8(container),
    'OEBPS/content.opf': strToU8(opf),
    'OEBPS/toc.xhtml': strToU8(nav),
    'OEBPS/style.css': strToU8(epubCss()),
    'OEBPS/index.xhtml': strToU8(content),
  })
}

export interface PngRenderOptions {
  /** CSS viewport width in pixels. */
  width?: number
  /** Device pixel ratio; 2 produces a 2× resolution image. */
  scale?: number
}

/** Render the full static page as one long PNG using local Chrome. */
export async function renderPackPng(pack: LearningPack, options: PngRenderOptions = {}): Promise<Uint8Array> {
  const width = Math.max(640, Math.min(2400, Math.round(options.width ?? 1200)))
  const scale = Math.max(1, Math.min(3, Math.round(options.scale ?? 1)))
  const chrome = findChrome()
  if (!chrome) {
    throw new Error('本机没有找到 Chrome/Chromium，暂时无法生成 PNG 长图。')
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-png-'))
  const htmlPath = path.join(dir, 'pack.html')
  const pngPath = path.join(dir, 'pack.png')
  const measurePath = path.join(dir, 'measure.html')
  try {
    const html = renderPackExportHtml(pack)
    const measureHtml = html.replace(
      '</body>',
      `<script>window.addEventListener('load',function(){setTimeout(function(){document.title='HEIGHT:'+Math.ceil(document.documentElement.scrollHeight);},120);});</script></body>`,
    )
    await fs.writeFile(htmlPath, html, 'utf8')
    await fs.writeFile(measurePath, measureHtml, 'utf8')

    let height = 12000
    try {
      const { stdout } = await execFileAsync(
        chrome,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-sandbox',
          '--virtual-time-budget=2500',
          '--dump-dom',
          `file://${measurePath}`,
        ],
        { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 },
      )
      const match = /HEIGHT:(\d+)/.exec(stdout)
      if (match) height = Number(match[1])
    } catch {
      // Fall back to a tall enough viewport when measurement is unavailable.
    }

    const viewportHeight = Math.max(2400, Math.min(30000, height + 60))
    const scaleFlag = scale > 1 ? [`--force-device-scale-factor=${scale}`] : []
    await execFileAsync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        '--default-background-color=ffffff',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=3000',
        ...scaleFlag,
        `--window-size=${width},${viewportHeight}`,
        `--screenshot=${pngPath}`,
        `file://${measurePath}`,
      ],
      { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
    )
    return await fs.readFile(pngPath)
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/** Convert EPUB to MOBI/AZW3 through Calibre when it is installed. */
export async function renderPackMobi(pack: LearningPack): Promise<Uint8Array> {
  const converter = await findEbookConvert()
  if (!converter) {
    throw new Error('本机没有安装 Calibre 的 ebook-convert，暂时无法生成 MOBI；可以先下载 EPUB，再用 Calibre 转换。')
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-mobi-'))
  const epubPath = path.join(dir, 'pack.epub')
  const mobiPath = path.join(dir, 'pack.mobi')
  try {
    await fs.writeFile(epubPath, renderPackEpub(pack))
    await execFileAsync(
      converter,
      [epubPath, mobiPath, '--output-profile', 'kindle'],
      { timeout: 180_000, maxBuffer: 8 * 1024 * 1024 },
    )
    return await fs.readFile(mobiPath)
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
