import { marked } from 'marked'

import { detectBodyLead } from '../analyze/reading-frontmatter.js'
import { sentences } from '../analyze/tokenize.js'
import type { LearningItem, LearningPack, PackAudio, ParagraphNote } from '../types.js'
import { packReadingMinutes } from './reading-time.js'
import { readingGuideMarkdown } from './reading-guide.js'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/\n+/g, ' ')
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightParagraph(text: string, items: LearningItem[]): string {
  const lemmas = [...new Set(items.map((item) => item.lemma))].filter((lemma) => lemma.length >= 3)
  if (lemmas.length === 0) return escapeHtml(text).replace(/\n/g, '<br>')

  const pattern = new RegExp(`\\b(${lemmas.map(escapeRegExp).join('|')})\\w*\\b`, 'gi')
  let html = ''
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    html += escapeHtml(text.slice(cursor, index))
    html += `<mark>${escapeHtml(match[0])}</mark>`
    cursor = index + match[0].length
  }
  html += escapeHtml(text.slice(cursor))
  return html.replace(/\n/g, '<br>')
}

function renderWordFormation(item: LearningItem): string {
  const parts = [
    ...(item.wordFormation?.roots ?? []).map((part) => ({ ...part, label: '词根' })),
    ...(item.wordFormation?.prefixes ?? []).map((part) => ({ ...part, label: '前缀' })),
    ...(item.wordFormation?.suffixes ?? []).map((part) => ({ ...part, label: '后缀' })),
  ]
  if (parts.length === 0) return ''
  const examples = [...new Set(parts.flatMap((part) => part.examples))].slice(0, 8)
  return `
    <div class="formation">${parts
      .map(
        (part) =>
          `<span class="form-chip"><b>${part.label}</b> ${escapeHtml(part.form)} · ${escapeHtml(part.meaning)}</span>`,
      )
      .join('')}</div>
    ${examples.length ? `<div class="formation-examples">同族词：${examples.map(escapeHtml).join(', ')}</div>` : ''}
  `
}

function renderRelations(item: LearningItem): string {
  const groups: Array<[string, string[]]> = [
    ['同义', item.relations.synonyms],
    ['反义', item.relations.antonyms],
    ['词族', item.relations.wordFamily],
    ['易混', item.relations.confusables],
  ]
  const visible = groups.filter(([, values]) => values.length > 0)
  if (visible.length === 0) return ''
  return `<div class="relations">${visible
    .map(
      ([label, values]) =>
        `<span class="rel"><b>${label}</b> ${values
          .slice(0, 6)
          .map(escapeHtml)
          .join(', ')}</span>`,
    )
    .join('')}</div>`
}

function renderSentenceItem(item: LearningItem): string {
  const sentence = item.sentence
  if (!sentence) return ''
  return `
    <div class="item sentence-item">
      <div class="item-head">
        <div class="item-title">
          <span class="item-word">${escapeHtml(item.lemma)}</span>
          <span class="tag sentence">句子卡</span>
          ${sentence.stale ? '<span class="tag stale">原文已变更</span>' : ''}
          ${item.cefr ? `<span class="tag">${escapeHtml(item.cefr)}</span>` : ''}
        </div>
        <div class="item-actions">
          <button class="star" data-favorite="${escapeAttribute(item.id)}" title="收藏" aria-label="收藏">★</button>
          <button class="remove" data-remove="${escapeAttribute(item.id)}" title="从学习包移除并标记为已掌握" aria-label="移除">×</button>
        </div>
      </div>
      <div class="item-zh">${escapeHtml(sentence.translation)}</div>
      <blockquote class="sentence-original">${escapeHtml(sentence.original)}</blockquote>
      ${
        sentence.chunks.length
          ? `<div class="sentence-chunks">${sentence.chunks
              .map(
                (chunk) =>
                  `<span class="chunk"><b>${escapeHtml(chunk.role)}</b>${escapeHtml(chunk.text)}${
                    chunk.meaning ? `<i>${escapeHtml(chunk.meaning)}</i>` : ''
                  }</span>`,
              )
              .join('')}</div>`
          : ''
      }
      ${sentence.pattern ? `<div class="sentence-pattern"><b>句型</b>${escapeHtml(sentence.pattern)}</div>` : ''}
      ${sentence.grammar ? `<div class="sentence-grammar">${escapeHtml(sentence.grammar)}</div>` : ''}
      ${
        sentence.variants.length
          ? `<ul class="sentence-variants">${sentence.variants
              .map((variant) => `<li>${escapeHtml(variant)}</li>`)
              .join('')}</ul>`
          : ''
      }
      ${sentence.why ? `<div class="memory">${escapeHtml(sentence.why)}</div>` : ''}
    </div>
  `
}

function buildFocusData(pack: LearningPack) {
  const itemById = new Map(pack.items.map((item) => [item.id, item]))
  return (pack.reading ?? []).map((paragraph) => {
    const parts = paragraph.customSentences?.length ? paragraph.customSentences : sentences(paragraph.original)
    const list = parts.length ? parts : [paragraph.original]
    return {
      index: paragraph.index,
      translation: paragraph.translation ?? '',
      sentences: list.map((text, localIndex) => ({
        text,
        localIndex,
        paragraphIndex: paragraph.index,
        note: paragraph.note ?? null,
        items: paragraph.itemIds
          .flatMap((id) => {
            const item = itemById.get(id)
            return item && text.toLowerCase().includes(item.lemma.toLowerCase())
              ? [
                  {
                    id: item.id,
                    lemma: item.lemma,
                    definitionZh: item.definitionZh ?? item.sense,
                    pos: item.pos ?? '',
                    tier: item.tier ?? 'core',
                  },
                ]
              : []
          })
          .slice(0, 8),
      })),
    }
  })
}

function renderCompactItem(item: LearningItem, audio: PackAudio): string {
  if (item.type === 'sentence' && item.sentence) return renderSentenceItem(item)
  const examples = item.examples.filter((example) => example.origin !== 'source').slice(0, 3)
  const audioPath = audio.items[item.id]
  return `
    <div class="item${item.tier === 'bonus' ? ' bonus-item' : ''}">
      <div class="item-head">
        <div class="item-title">
          <span class="item-word">${escapeHtml(item.lemma)}</span>
          ${item.ipa ? `<span class="ipa">${escapeHtml(item.ipa)}</span>` : ''}
          ${item.pos ? `<span class="tag">${escapeHtml(item.pos)}</span>` : ''}
          ${item.libraryState === 'known' ? '<span class="tag known">已掌握</span>' : ''}
          ${item.libraryState === 'learning' ? '<span class="tag">已在词库</span>' : ''}
          ${item.tier === 'bonus' && item.libraryState !== 'known' ? '<span class="tag bonus">Bonus</span>' : ''}
        </div>
        <div class="item-actions">
          ${item.tier === 'bonus' && item.libraryState !== 'known' ? `<button class="adopt" data-adopt="${escapeAttribute(item.id)}">加入复习</button>` : ''}
          <button class="expand" data-expand-word="${escapeAttribute(item.id)}" title="AI 发散相关词" aria-label="发散相关词">发散</button>
          <button class="star" data-favorite="${escapeAttribute(item.id)}" title="收藏" aria-label="收藏">★</button>
          <button class="remove" data-remove="${escapeAttribute(item.id)}" title="从学习包移除并标记为已掌握" aria-label="移除">×</button>
        </div>
      </div>
      <div class="item-zh">${escapeHtml(item.definitionZh ?? item.sense)}</div>
      ${item.definitionZh ? `<div class="item-def">${escapeHtml(item.definition)}</div>` : ''}
      ${renderWordFormation(item)}
      ${renderRelations(item)}
      ${
        item.collocations.length
          ? `<div class="chips">${item.collocations
              .map((collocation) => `<span class="chip">${escapeHtml(collocation)}</span>`)
              .join('')}</div>`
          : ''
      }
      ${
        examples.length
          ? `<details class="examples"><summary>例句</summary><ul>${examples
              .map((example) => `<li>${escapeHtml(example.text)}</li>`)
              .join('')}</ul></details>`
          : ''
      }
      ${item.memoryHook ? `<div class="memory">记忆钩子：${escapeHtml(item.memoryHook)}</div>` : ''}
      ${item.notes ? `<div class="note">${escapeHtml(item.notes)}</div>` : ''}
      ${audioPath ? `<audio controls preload="none" src="${escapeAttribute(audioPath)}"></audio>` : ''}
    </div>
  `
}

function renderParagraphNote(note: ParagraphNote | undefined, index: number): string {
  const focusButton = `<button class="para-focus" data-focus-para="${index}" type="button">精读这段</button>`
  const editButton = `<button class="para-focus para-edit" data-edit-paragraph="${index}" type="button">编辑</button>`
  const noteButton = note ? `<button class="para-focus para-edit" data-edit-note="${index}" type="button">笔记</button>` : ''
  const tools = `<div class="para-tools">${focusButton}${editButton}${noteButton}</div>`
  if (!note) {
    return tools
  }
  const connectors = note.connectors.length
    ? `<div class="note-connectors">${note.connectors
        .map(
          (connector) =>
            `<span class="note-connector"><b>${escapeHtml(connector.text)}</b>${
              connector.usage ? ` ${escapeHtml(connector.usage)}` : ''
            }</span>`,
        )
        .join('')}</div>`
    : ''
  return `
    <aside class="para-note" data-note="${escapeAttribute(JSON.stringify(note))}">
      <div class="para-note-head">
        <div>
          ${note.role ? `<span class="note-role">${escapeHtml(note.role)}</span>` : ''}
          ${note.summary ? `<span class="note-summary">${escapeHtml(note.summary)}</span>` : ''}
        </div>
        ${tools}
      </div>
      ${
        note.keySentence
          ? `<blockquote class="note-key">${escapeHtml(note.keySentence)}</blockquote>${
              note.keySentenceNote ? `<p class="note-key-note">${escapeHtml(note.keySentenceNote)}</p>` : ''
            }`
          : ''
      }
      ${note.grammar ? `<div class="note-line"><b>语法</b>${escapeHtml(note.grammar)}</div>` : ''}
      ${connectors}
      ${note.background ? `<div class="note-background"><b>背景</b>${escapeHtml(note.background)}</div>` : ''}
      ${note.question
        ? `<div class="note-question"><b>想一想</b>${escapeHtml(note.question)}
            ${
              note.answer
                ? `<details class="note-answer"><summary>参考答案</summary><p>${escapeHtml(note.answer)}</p></details>`
                : `<button class="note-answer-btn" data-answer-index="${index}" type="button">看参考答案</button>`
            }
          </div>`
        : ''}
    </aside>
  `
}

function renderFrontMatter(pack: LearningPack, audio: PackAudio): string {
  const front = pack.frontMatter
  const itemById = new Map(pack.items.map((item) => [item.id, item]))
  const items = (front?.itemIds ?? []).flatMap((id) => {
    const item = itemById.get(id)
    return item ? [item] : []
  })
  if (!items.length) return ''
  return `
    <section class="front-matter" id="front-matter">
      <div class="front-kicker">标题与导语 · 重点词</div>
      <div class="front-items">${items.map((item) => renderCompactItem(item, audio)).join('')}</div>
    </section>
  `
}

function renderReading(pack: LearningPack, audio: PackAudio): string {
  if (!pack.reading?.length) return ''
  const itemById = new Map(pack.items.map((item) => [item.id, item]))
  const shownItems = new Set<string>()

  return pack.reading
    .map((paragraph, index) => {
      const items = paragraph.itemIds.flatMap((id) => {
        const item = itemById.get(id)
        return item ? [item] : []
      })
      const firstItems = items.filter((item) => {
        if (shownItems.has(item.id)) return false
        shownItems.add(item.id)
        return true
      })
      const label = String(index + 1).padStart(2, '0')
      return `
        <article class="paragraph" id="p-${label}" data-para-index="${index}">
          <div class="para-label"><button class="para-marker" data-para-read="${index}" data-label="${label}" type="button" aria-label="标记第 ${index + 1} 段已读">${label}</button></div>
          <div class="para-body">
            <div class="para-text">
              <div class="original">${highlightParagraph(paragraph.original, items)}</div>
              <div class="translation">${
                paragraph.translation ? escapeHtml(paragraph.translation) : '<span class="muted">暂无翻译</span>'
              }</div>
            </div>
            ${renderParagraphNote(paragraph.note, index)}
            ${
              firstItems.length
                ? `<details class="para-items-wrap"><summary>本段重点词 ${firstItems.length} 个</summary><div class="para-items">${firstItems
                    .map((item) => renderCompactItem(item, audio))
                    .join('')}</div></details>`
                : ''
            }
          </div>
        </article>
      `
    })
    .join('')
}

function renderVocabularyTable(pack: LearningPack): string {
  const rows = pack.items
    .filter((item) => item.type !== 'sentence')
    .map((item) => {
      const paragraphs = (pack.reading ?? [])
        .filter((paragraph) => paragraph.itemIds.includes(item.id))
        .map((paragraph) => {
          const label = String(paragraph.index + 1).padStart(2, '0')
          return `<a href="#p-${label}">${label}</a>`
        })
        .join(', ')
      return `
        <tr${item.tier === 'bonus' ? ' class="bonus-item"' : ''}>
          <td><span class="word">${escapeHtml(item.lemma)}</span>${item.ipa ? `<span class="ipa">${escapeHtml(item.ipa)}</span>` : ''}${item.libraryState === 'known' ? '<span class="tag known">已掌握</span>' : item.libraryState === 'learning' ? '<span class="tag">已在词库</span>' : ''}${item.tier === 'bonus' && item.libraryState !== 'known' ? '<span class="tag bonus">Bonus</span>' : ''}</td>
          <td>${escapeHtml(item.definitionZh ?? item.sense)}</td>
          <td>${escapeHtml(item.collocations.join(' / ')) || '—'}</td>
          <td>${paragraphs || '—'}</td>
        </tr>
      `
    })
    .join('')

  return `<table class="vocab-table">
    <thead><tr><th>词</th><th>中文</th><th>搭配</th><th>段落</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function renderExercises(pack: LearningPack): string {
  const blocks: string[] = []
  const isSentenceText = (value: string): boolean =>
    value.trim().split(/\s+/).length >= 4 || /[.!?]["'”’)\]]*$/.test(value.trim())

  if (pack.exercises.cloze.length) {
    blocks.push(`
      <div class="exercise">
        <h3>完形填空</h3>
        <ol>
          ${pack.exercises.cloze
            .map(
              (exercise, index) => `
            <li>
              <p class="cloze">${escapeHtml(exercise.sentence)}</p>
              <details class="exercise-answer" data-exercise-kind="cloze" data-exercise-index="${index}"${
                exercise.sentenceZh ? ' data-translation-loaded="1"' : ''
              }>
                <summary>答案与译文</summary>
                <p><strong>${escapeHtml(exercise.answer)}</strong>${
                  exercise.hint ? ` — ${escapeHtml(exercise.hint)}` : ''
                }</p>
                <p class="exercise-translation" data-role="question">${
                  exercise.sentenceZh ? `题干译文：${escapeHtml(exercise.sentenceZh)}` : '点击后加载题干译文…'
                }</p>
                <p class="exercise-translation" data-role="answer"${
                  isSentenceText(exercise.answer) ? '' : ' hidden'
                }>${exercise.answerZh ? `答案译文：${escapeHtml(exercise.answerZh)}` : ''}</p>
              </details>
            </li>`,
            )
            .join('')}
        </ol>
      </div>
    `)
  }

  if (pack.exercises.comprehension.length) {
    blocks.push(`
      <div class="exercise">
        <h3>阅读理解</h3>
        <ol>
          ${pack.exercises.comprehension
            .map(
              (exercise, index) => `
            <li>
              <p>${escapeHtml(exercise.question)}</p>
              <details class="exercise-answer" data-exercise-kind="comprehension" data-exercise-index="${index}"${
                exercise.questionZh ? ' data-translation-loaded="1"' : ''
              }>
                <summary>参考答案与译文</summary>
                <p>${escapeHtml(exercise.answer)}</p>
                <p class="exercise-translation" data-role="question">${
                  exercise.questionZh ? `题目译文：${escapeHtml(exercise.questionZh)}` : '点击后加载题目译文…'
                }</p>
                <p class="exercise-translation" data-role="answer">${
                  exercise.answerZh ? `答案译文：${escapeHtml(exercise.answerZh)}` : ''
                }</p>
              </details>
            </li>`,
            )
            .join('')}
        </ol>
      </div>
    `)
  }

  if (pack.exercises.discussion.length) {
    blocks.push(`
      <div class="exercise">
        <h3>讨论 / 输出</h3>
        <ol>
          ${pack.exercises.discussion
            .map(
              (entry, index) => `
            <li>
              <p>${escapeHtml(entry.question)}</p>
              <details class="exercise-answer" data-exercise-kind="discussion" data-exercise-index="${index}"${
                entry.questionZh ? ' data-translation-loaded="1"' : ''
              }>
                <summary>参考回答与译文</summary>
                <p>${escapeHtml(entry.answer)}</p>
                <p class="exercise-translation" data-role="question">${
                  entry.questionZh ? `题目译文：${escapeHtml(entry.questionZh)}` : '点击后加载题目译文…'
                }</p>
                <p class="exercise-translation" data-role="answer">${
                  entry.answerZh ? `答案译文：${escapeHtml(entry.answerZh)}` : ''
                }</p>
              </details>
            </li>`,
            )
            .join('')}
        </ol>
      </div>
    `)
  }

  return blocks.join('')
}

export function renderHtml(
  pack: LearningPack,
  audio: PackAudio = { items: {} },
  options: { exportMode?: boolean } = {},
): string {
  const exportMode = options.exportMode === true
  const readingGuide = readingGuideMarkdown(pack)
  const editorialLeadHtml = readingGuide ? (marked.parse(readingGuide, { async: false }) as string) : ''
  const readingHtml = renderReading(pack, audio)
  const sentenceItems = pack.items.filter((item) => item.type === 'sentence' && item.sentence)
  const sentenceHtml = sentenceItems.length
    ? `<section class="sentences" id="sentences">
        <div class="section-head"><h2>句子卡</h2><span>从原文选句生成 · 用于回译复习</span></div>
        <div class="para-items">${sentenceItems.map((item) => renderSentenceItem(item)).join('')}</div>
      </section>`
    : ''
  const focusData = buildFocusData(pack)
  const sentenceTotal = focusData.reduce((sum, paragraph) => sum + paragraph.sentences.length, 0)
  const longSentenceTotal = focusData.reduce(
    (sum, paragraph) =>
      sum +
      paragraph.sentences.filter((sentence) => sentence.text.split(/\s+/).length >= 28).length,
    0,
  )
  const readingWordCount = pack.items.filter((item) => item.type !== 'sentence').length
  const missingReadingNotes =
    (pack.reading ?? []).some((paragraph) => !paragraph.note) ||
    !pack.frontMatter?.titleZh ||
    !pack.readingGuide
  const readingContinuation =
    /(?:^|\s)(?:the|a|an|and|or|but|of|to|in|on|at|for|with|from|by|as|that|which|who|whose|where|when|if|because|although|while|than)\s*$/i
  const needsHeadRepair = Boolean(detectBodyLead(pack))
  const needsReadingRepair = (pack.reading ?? []).some((paragraph, index, list) => {
    if (index >= list.length - 1) return false
    const text = paragraph.original.trim()
    return !/[.!?]["'”’)\]]*$/.test(text) || readingContinuation.test(text)
  })
  const hasReadingNotes = (pack.reading ?? []).some((paragraph) => Boolean(paragraph.note))
  const readingMap = (pack.reading ?? []).some((paragraph) => paragraph.note?.role)
    ? `<div class="reading-map">${(pack.reading ?? [])
        .map((paragraph) => {
          const label = String(paragraph.index + 1).padStart(2, '0')
          const role = paragraph.note?.role
          return role
            ? `<a class="map-chip" href="#p-${label}"><b>${label}</b>${escapeHtml(role)}</a>`
            : ''
        })
        .join('')}</div>`
    : ''
  const mappedIds = new Set((pack.reading ?? []).flatMap((paragraph) => paragraph.itemIds))
  const supplemental = pack.items.filter(
    (item) => item.type !== 'sentence' && !mappedIds.has(item.id),
  )
  const supplementalHtml = supplemental.length
    ? `<section class="reader supplemental" id="supplemental">
        <div class="section-head"><h2>补充词汇</h2><span>手动添加 · 不在原文段落中</span></div>
        <div class="para-items">${supplemental.map((item) => renderCompactItem(item, audio)).join('')}</div>
      </section>`
    : ''
  const exercisesHtml = renderExercises(pack)
  const discussion = pack.exercises.discussion[0]
  const outputPractice = discussion
    ? `<section class="output-practice" id="output-practice">
        <div class="section-head"><h2>读完写三句</h2><span>保存后出现在「今日」的输出里</span></div>
        <p class="output-question">${escapeHtml(discussion.question)}</p>
        <textarea id="output-text" placeholder="Write 3 sentences in English…"></textarea>
        <div class="output-actions">
          <button class="focus-tool primary" id="output-save" type="button">保存输出</button>
          <span class="output-status" id="output-status"></span>
        </div>
      </section>`
    : ''
  const wordsAudio = audio.words
    ? `<audio controls preload="none" src="${escapeAttribute(audio.words)}"></audio>`
    : ''
  const selection = pack.selection
  const selectionNote = selection
    ? `<div class="selection-note"><strong>选词说明：</strong>${escapeHtml(selection.reason)} ${selection.core} 项核心词进入复习，${selection.bonus} 项 Bonus 只在本页展示。${
        selection.reused ? `${selection.reused} 项已在词库，只作巩固。` : ''
      }${selection.cachedCards ? `复用 ${selection.cachedCards} 张缓存卡片。` : ''}</div>`
    : ''
  const hasBonus = pack.items.some((item) => item.tier === 'bonus')
  const heroTitle = pack.frontMatter?.title ?? pack.title
  const heroTitleZh = pack.frontMatter?.titleZh?.trim() ?? ''
  const heroTitleNote = pack.frontMatter?.titleNote?.trim() ?? ''
  const heroLead = pack.frontMatter?.lead?.trim() ?? ''
  const heroLeadZh = pack.frontMatter?.leadZh?.trim() ?? ''
  const heroLeadNote = pack.frontMatter?.leadNote?.trim() ?? ''
  const heroSection = pack.frontMatter?.section?.trim() ?? ''
  const readingMinutes = packReadingMinutes(pack)

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(pack.title)} · Learning Pack</title>
<style>
  :root {
    color-scheme: light;
    --paper: #f6f2e8;
    --paper-2: #efe7d7;
    --card: #fffdf8;
    --ink: #1c1a16;
    --ink-70: rgba(28, 26, 22, .72);
    --ink-45: rgba(28, 26, 22, .45);
    --line: rgba(28, 26, 22, .12);
    --line-strong: rgba(28, 26, 22, .22);
    --cinnabar: #b03a2e;
    --indigo: #3f5f7f;
    --ochre: #a8732f;
    --sans: 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --serif: 'Songti SC', 'Noto Serif SC', 'Source Han Serif SC', STSong, SimSun, serif;
    --mono: 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace;
    --radius: 10px;
    --max: 960px;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1.75;
    -webkit-font-smoothing: antialiased;
  }
  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 28px;
    background: rgba(246, 242, 232, .92);
    border-bottom: 1px solid var(--line);
    backdrop-filter: blur(10px);
  }
  .brand { font-family: var(--serif); font-size: 16px; font-weight: 600; letter-spacing: .02em; color: inherit; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .topbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .topbar-right { display: flex; align-items: center; gap: 12px; }
  .export-wrap { position: relative; }
  .export-menu {
    position: absolute; right: 0; top: calc(100% + 6px); z-index: 75; min-width: 160px;
    padding: 5px; border: 1px solid var(--line); border-radius: 10px; background: var(--card);
    box-shadow: 0 10px 30px rgba(28,26,22,.16);
  }
  .export-menu[hidden] { display: none; }
  .export-menu button {
    display: block; width: 100%; border: 0; background: transparent; color: var(--ink);
    text-align: left; padding: 7px 9px; border-radius: 6px; font: inherit; font-size: 12px; cursor: pointer;
  }
  .export-menu button:hover { background: var(--paper-2); }
  .export-label { padding: 8px 9px 3px; color: var(--ink-45); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; }
  .export-progress {
    position: fixed; right: 24px; bottom: 24px; z-index: 125; display: flex; align-items: center; gap: 10px;
    max-width: min(360px, calc(100vw - 48px)); padding: 11px 14px; border: 1px solid var(--line);
    border-radius: 12px; background: var(--card); box-shadow: 0 12px 34px rgba(28,26,22,.2);
    color: var(--ink); font-size: 12.5px; line-height: 1.5;
  }
  .export-progress[hidden] { display: none; }
  .export-spinner {
    width: 15px; height: 15px; flex: none; border: 2px solid var(--line);
    border-top-color: var(--cinnabar); border-radius: 50%; animation: export-spin .8s linear infinite;
  }
  @keyframes export-spin { to { transform: rotate(360deg); } }
  .scroll-progress { position: fixed; top: 0; left: 0; height: 3px; width: 0; background: var(--cinnabar); z-index: 70; transition: width .1s linear; }
  .topbar .meta { display: flex; gap: 12px; color: var(--ink-45); font-size: 12px; }
  .topbar-action {
    border: 1px solid var(--line);
    background: var(--card);
    color: var(--ink);
    border-radius: 999px;
    padding: 5px 12px;
    font: inherit;
    font-size: 12px;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
  }
  .topbar-action:hover { border-color: var(--indigo); color: var(--indigo); }
  .page { max-width: var(--max); margin: 0 auto; padding: 48px 28px 80px; }
  .hero { padding-bottom: 28px; border-bottom: 1px solid var(--line); }
  .eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--cinnabar); }
  h1 {
    font-family: var(--serif);
    font-size: clamp(28px, 4vw, 40px);
    line-height: 1.2;
    letter-spacing: -.02em;
    margin: 12px 0 14px;
    max-width: 22ch;
  }
  .summary { font-size: 15px; color: var(--ink-70); max-width: 70ch; margin: 0 0 18px; }
  .meta-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill { border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; font-size: 12px; color: var(--ink-45); }
  .hero-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .reading-status { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 14px; color: var(--ink-45); font-size: 12px; }
  .reading-track { width: 220px; max-width: 50vw; height: 6px; border-radius: 999px; background: var(--paper-2); overflow: hidden; }
  .reading-fill { height: 100%; width: 0; background: var(--cinnabar); transition: width .25s ease; }
  .reading-finish { border: 1px solid var(--line-strong); background: var(--card); color: var(--ink); border-radius: 999px; padding: 4px 11px; font: inherit; font-size: 11.5px; cursor: pointer; }
  .reading-finish:hover { border-color: var(--cinnabar); color: var(--cinnabar); }
  .reading-finish:disabled { opacity: .6; cursor: default; border-color: var(--line); color: var(--ink-45); }
  .para-marker {
    width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--line);
    background: transparent; color: var(--ink-45); font-family: var(--mono); font-size: 10.5px;
    cursor: pointer; padding: 0; transition: all .18s ease;
  }
  .para-marker:hover { border-color: var(--cinnabar); color: var(--cinnabar); }
  .para-marker.read { background: rgba(176, 58, 46, .08); border-color: rgba(176, 58, 46, .35); color: var(--cinnabar); }
  .paragraph.is-read .original { opacity: .86; }
  .selection-note { margin-top: 14px; color: var(--ink-45); font-size: 12px; line-height: 1.7; }
  .selection-note strong { color: var(--ink); }
  .tag.bonus { color: var(--cinnabar); border-color: rgba(176, 58, 46, .3); background: rgba(176, 58, 46, .06); }
  .tag.known { color: var(--indigo); border-color: rgba(63, 95, 127, .3); background: rgba(63, 95, 127, .06); }
  .tag.stale { color: var(--cinnabar); border-color: rgba(176, 58, 46, .35); background: rgba(176, 58, 46, .07); }
  .adopt {
    border: 1px solid rgba(176, 58, 46, .3);
    background: rgba(176, 58, 46, .06);
    color: var(--cinnabar);
    border-radius: 999px;
    padding: 2px 8px;
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }
  .adopt:disabled { opacity: .6; cursor: default; }
  body.core-only .bonus-item { display: none !important; }
  body.hide-translation .translation { display: none !important; }
  body.font-large .para-text .original { font-size: 18px; line-height: 1.9; }
  body.font-large .para-text .translation { font-size: 15px; }
  body.font-large .summary { font-size: 16px; }
  .hero audio { margin-top: 16px; width: 100%; max-width: 480px; height: 34px; }
  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    margin: 40px 0 8px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
  }
  .section-head h2 { font-family: var(--serif); font-size: 22px; margin: 0; letter-spacing: -.01em; }
  .section-head span { color: var(--ink-45); font-size: 12px; }
  .sentences { margin-top: 40px; }
  .paragraph {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 16px;
    padding: 24px 0;
    border-bottom: 1px solid var(--line);
    scroll-margin-top: 82px;
    transition: background .2s ease;
  }
  .paragraph:hover { background: rgba(255, 253, 248, .55); }
  .para-label { font-family: var(--mono); font-size: 11px; color: var(--ink-45); padding-top: 5px; }
  .para-text { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; }
  .reader .paragraph:first-of-type .original::first-letter {
    float: left; font-family: var(--serif); font-size: 3.2em; line-height: .82;
    padding: 4px 7px 0 0; color: var(--cinnabar); font-weight: 600;
  }
  .reading-intro {
    margin: 18px 0 4px; padding: 18px 20px; border: 1px solid var(--line); border-radius: var(--radius);
    background: linear-gradient(135deg, rgba(255,253,248,.96), rgba(239,231,215,.55));
  }
  .reading-intro-kicker { color: var(--cinnabar); font-family: var(--mono); font-size: 10px; letter-spacing: .14em; }
  .front-matter { margin: 24px 0 6px; padding: 22px 24px; border: 1px solid var(--line); border-radius: var(--radius); background: rgba(255,253,248,.82); }
  .front-kicker { color: var(--cinnabar); font-family: var(--mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
  .front-title { margin: 10px 0 0; font-family: var(--serif); font-size: clamp(25px, 4vw, 38px); line-height: 1.3; letter-spacing: -.02em; }
  .front-title-zh { margin-top: 6px; color: var(--ink-45); font-size: 15px; }
  .front-note { margin: 8px 0 0; color: var(--ochre); font-size: 12.5px; line-height: 1.7; }
  .front-summary { margin: 12px 0 0; padding: 10px 12px; border-radius: 8px; background: rgba(239,231,215,.5); color: var(--ink-70); font-size: 13.5px; line-height: 1.8; }
  .front-lead-block { margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--line); }
  .front-lead { margin: 0; font-family: var(--serif); font-size: 17px; line-height: 1.8; color: var(--ink-70); }
  .front-lead-zh { margin: 7px 0 0; color: var(--ink-45); font-size: 13.5px; line-height: 1.8; }
  .hero-lead-block { margin: 0 0 18px; }
  .hero .front-title { max-width: 24ch; }
  .hero .front-title-zh { font-size: 17px; }
  .front-items { display: grid; gap: 8px; margin-top: 14px; }
  .reading-intro-stats { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 8px; color: var(--ink-70); font-size: 12.5px; }
  .reading-intro-stats strong { font-family: var(--serif); font-size: 20px; color: var(--ink); margin-right: 3px; }
  .reading-intro p { margin: 9px 0 0; color: var(--ink-45); font-size: 12.5px; line-height: 1.7; }
  .reading-map { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .map-chip { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--line); background: rgba(255,253,248,.72); border-radius: 999px; padding: 3px 9px; color: var(--ink-70); font-size: 11.5px; text-decoration: none; }
  .map-chip b { color: var(--cinnabar); font-family: var(--mono); font-size: 10px; font-weight: 500; }
  .map-chip:hover { border-color: var(--cinnabar); color: var(--cinnabar); }
  .enrich-reading { margin-left: 10px; padding: 3px 9px; font-size: 11px; }
  .para-tools { display: flex; justify-content: flex-end; margin-top: 10px; }
  .para-focus { border: 1px solid var(--line); background: transparent; color: var(--indigo); border-radius: 999px; padding: 3px 10px; font: inherit; font-size: 11px; cursor: pointer; }
  .para-focus:hover { border-color: var(--indigo); background: rgba(63,95,127,.06); }
  .para-edit { color: var(--ochre); }
  .para-edit:hover { border-color: var(--ochre); background: rgba(168,115,47,.06); }
  .front-actions { display: flex; gap: 7px; margin-top: 12px; }
  .para-note {
    margin-top: 14px; padding: 14px 16px; border-left: 2px solid var(--ochre);
    border-radius: 0 10px 10px 0; background: rgba(239, 231, 215, .48);
  }
  .para-note-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .note-role {
    display: inline-block; margin-right: 7px; padding: 1px 7px; border-radius: 999px;
    background: rgba(168, 115, 47, .12); color: var(--ochre); font-family: var(--mono);
    font-size: 10px; letter-spacing: .04em; vertical-align: 1px;
  }
  .note-summary { color: var(--ink); font-size: 13.5px; font-weight: 600; line-height: 1.65; }
  .note-key {
    margin: 14px 0 6px; padding: 9px 0 9px 14px; border-left: 2px solid var(--line-strong);
    font-family: var(--serif); font-size: 14.5px; line-height: 1.75; color: var(--ink-70);
  }
  .note-key-note { margin: 0; color: var(--ink-45); font-size: 12.5px; line-height: 1.7; }
  .note-line, .note-background, .note-question { margin-top: 9px; color: var(--ink-70); font-size: 12.5px; line-height: 1.7; }
  .note-line b, .note-background b, .note-question b {
    display: inline-block; min-width: 38px; margin-right: 6px; color: var(--ochre);
    font-weight: 600; font-size: 11px;
  }
  .note-connectors { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
  .note-connector { border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; color: var(--ink-45); font-size: 11.5px; }
  .note-connector b { color: var(--ink); font-weight: 600; margin-right: 3px; }
  .note-question { padding: 8px 10px; border-radius: 7px; background: rgba(255,253,248,.7); }
  .note-answer-btn { margin-top: 6px; border: 1px solid var(--line); background: var(--card); color: var(--indigo); border-radius: 999px; padding: 2px 9px; font: inherit; font-size: 11px; cursor: pointer; }
  .note-answer-btn:hover { border-color: var(--indigo); }
  .note-answer { margin-top: 6px; color: var(--ink-70); }
  .note-answer summary { cursor: pointer; color: var(--indigo); font-size: 11.5px; }
  .note-answer p { margin: 6px 0 0; line-height: 1.75; }
  .hide-notes .para-note { display: none; }
  .export-mode .topbar-right, .export-mode .hero-actions, .export-mode .add-panel,
  .export-mode .reading-status, .export-mode .para-marker, .export-mode .para-tools,
  .export-mode .expand, .export-mode .remove, .export-mode .adopt, .export-mode .star,
  .export-mode .enrich-reading, .export-mode [data-feedback], .export-mode .output-practice,
  .export-mode .footer-actions, .export-mode .scroll-progress, .export-mode .select-pop,
  .export-mode .word-modal, .export-mode .focus-mode, .export-mode .front-actions { display: none !important; }
  .export-mode .note-answer-btn { display: none !important; }
  .original { font-family: var(--serif); font-size: 17px; line-height: 1.85; }
  .original mark { background: linear-gradient(180deg, transparent 58%, rgba(201, 162, 39, .32) 58%); color: inherit; padding: 0 1px; }
  .translation { color: var(--ink-70); font-size: 14px; line-height: 1.85; border-left: 2px solid var(--line-strong); padding-left: 18px; }
  .para-items { display: grid; gap: 8px; margin-top: 16px; }
  .para-items-wrap { margin-top: 14px; }
  .para-items-wrap summary { cursor: pointer; color: var(--indigo); font-size: 12px; }
  .para-items-wrap .para-items { margin-top: 8px; }
  .item { border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); padding: 12px 14px; }
  .item-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .item-title { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  .item-word { font-family: var(--serif); font-size: 19px; font-weight: 600; }
  .item .ipa { font-family: var(--sans); font-size: 12px; color: var(--ink-45); }
  .tag {
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: var(--ink-45);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0 5px;
  }
  .star { border: 0; background: transparent; color: var(--line-strong); font-size: 16px; cursor: pointer; padding: 0 2px; line-height: 1; }
  .star.active { color: var(--cinnabar); }
  .item-actions { display: flex; align-items: center; gap: 4px; }
  .remove { border: 0; background: transparent; color: var(--line-strong); font-size: 16px; cursor: pointer; padding: 0 2px; line-height: 1; }
  .remove:hover { color: var(--cinnabar); }
  .expand { border: 1px solid var(--line); background: transparent; color: var(--indigo); border-radius: 999px; padding: 1px 8px; font: inherit; font-size: 10.5px; cursor: pointer; }
  .expand:hover { border-color: var(--indigo); background: rgba(63,95,127,.06); }
  .formation { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .form-chip { font-size: 12px; color: var(--ochre); background: rgba(168, 115, 47, .08); border-radius: 4px; padding: 1px 7px; }
  .form-chip b { font-weight: 600; }
  .formation-examples { margin-top: 4px; font-size: 12px; color: var(--ink-45); }
  .relations { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; font-size: 12px; color: var(--ink-70); }
  .relations .rel b { color: var(--ink-45); font-weight: 500; margin-right: 3px; }
  .memory { margin-top: 8px; font-size: 12.5px; color: var(--indigo); }
  .tag.sentence { color: var(--cinnabar); border-color: rgba(176, 58, 46, .3); background: rgba(176, 58, 46, .06); }
  .sentence-item { background: linear-gradient(135deg, rgba(255,253,248,.96), rgba(245,230,218,.28)); }
  .sentence-original { margin: 8px 0 0; padding: 8px 0 8px 14px; border-left: 2px solid var(--rust); font-family: var(--serif); font-size: 15.5px; line-height: 1.75; color: var(--ink); }
  .sentence-chunks { display: grid; gap: 5px; margin-top: 10px; }
  .sentence-chunks .chunk { font-size: 12.5px; color: var(--ink-70); }
  .sentence-chunks .chunk b { display: inline-block; min-width: 58px; margin-right: 6px; color: var(--ink-45); font-weight: 500; }
  .sentence-chunks .chunk i { display: block; margin-left: 64px; color: var(--ink-45); font-style: normal; font-size: 12px; }
  .sentence-pattern { margin-top: 8px; font-size: 12.5px; color: var(--ink); }
  .sentence-pattern b { color: var(--cinnabar); margin-right: 6px; font-weight: 600; }
  .sentence-grammar { margin-top: 6px; font-size: 12.5px; color: var(--ink-70); line-height: 1.7; }
  .sentence-variants { margin: 8px 0 0; padding-left: 18px; color: var(--ink-70); font-size: 12.5px; }
  .output-practice { margin-top: 40px; padding: 20px 22px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); }
  .output-question { margin: 0 0 10px; padding-left: 12px; border-left: 2px solid var(--rust); color: var(--ink-70); font-size: 14px; line-height: 1.75; }
  .output-practice textarea { width: 100%; min-height: 110px; border: 1px solid var(--line); border-radius: 8px; background: #fffdf8; padding: 10px 12px; font: inherit; font-size: 14px; line-height: 1.7; resize: vertical; outline: none; }
  .output-practice textarea:focus { border-color: var(--cinnabar); }
  .output-actions { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  .output-status { color: var(--ink-45); font-size: 12px; }
  .item-zh { margin-top: 4px; font-size: 14px; color: var(--ink); }
  .item-def { margin-top: 2px; font-size: 12.5px; color: var(--ink-45); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .chip { font-size: 12px; color: var(--indigo); background: rgba(63, 95, 127, .08); border-radius: 4px; padding: 1px 7px; }
  .examples { margin-top: 8px; font-size: 13px; color: var(--ink-70); }
  .examples summary { cursor: pointer; color: var(--indigo); font-size: 12px; }
  .examples ul { margin: 6px 0 0; padding-left: 18px; }
  .examples li { margin: 3px 0; }
  .note { margin-top: 8px; font-size: 12.5px; color: var(--ochre); }
  .item audio { width: 100%; height: 30px; margin-top: 8px; }
  .editorial { margin: 36px 0; border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); padding: 14px 18px; }
  .reading-preface {
    margin: 36px 0 8px; padding: 22px 24px; border: 1px solid var(--line);
    border-radius: var(--radius); background: var(--card);
  }
  .preface-excerpt {
    margin: 0; font-family: var(--serif); font-size: 16px; line-height: 1.95; color: var(--ink-70);
  }
  .preface-excerpt h3 { margin: 16px 0 6px; font-family: var(--sans); font-size: 12px; color: var(--ochre); letter-spacing: .05em; }
  .preface-excerpt p { margin: 0 0 10px; }
  .preface-excerpt ul { margin: 6px 0 0; padding-left: 20px; font-family: var(--sans); font-size: 13px; line-height: 1.8; }
  .preface-excerpt strong { color: var(--ink); }
  .preface-full { margin-top: 12px; }
  .preface-full > summary { cursor: pointer; color: var(--indigo); font-size: 12.5px; }
  .preface-full .editorial-body { max-width: 760px; }
  .editorial > summary { cursor: pointer; font-family: var(--serif); font-size: 18px; font-weight: 600; }
  .editorial > summary span { font-family: var(--sans); font-size: 11px; font-weight: 400; color: var(--ink-45); margin-left: 8px; }
  .editorial-body { margin-top: 16px; line-height: 1.85; }
  .editorial-body h2, .editorial-body h3 { font-family: var(--serif); }
  .editorial-body blockquote { margin: 12px 0; padding: 8px 14px; border-left: 2px solid var(--cinnabar); background: rgba(176, 58, 46, .05); }
  .editorial-body ul, .editorial-body ol { padding-left: 22px; }
  .vocab audio { width: 100%; max-width: 480px; height: 30px; margin: 8px 0 14px; }
  .add-panel {
    margin: 28px 0 0;
    padding: 20px 22px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--card);
  }
  .add-panel h2 { font-family: var(--serif); font-size: 20px; margin: 4px 0 6px; }
  .add-panel p { margin: 0 0 14px; color: var(--ink-70); font-size: 13px; max-width: 70ch; }
  .add-panel .eyebrow { color: var(--indigo); }
  .add-panel .add-word { margin: 0; }
  .manual-add { margin-top: 10px; }
  .manual-add summary { cursor: pointer; color: var(--indigo); font-size: 12px; }
  .manual-add .add-word { margin-top: 10px; }
  .select-pop {
    position: fixed;
    z-index: 90;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--ink);
    box-shadow: 0 8px 24px rgba(28, 26, 22, .18);
    max-width: 360px;
    max-height: 62vh;
    overflow-y: auto;
  }
  .select-pop[hidden] { display: none; }
  .select-pop .select-label {
    color: var(--paper);
    font-size: 11px;
    opacity: .65;
    padding: 2px 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .select-pop .select-meaning {
    color: var(--paper);
    font-size: 12px;
    opacity: .85;
    padding: 0 8px 4px;
  }
  .select-pop .select-translation {
    color: var(--paper);
    font-size: 12.5px;
    line-height: 1.6;
    padding: 3px 8px;
    border-top: 1px solid rgba(246, 242, 232, .15);
  }
  .select-pop .select-annotation, .select-pop .select-examples {
    color: var(--paper);
    font-size: 11.5px;
    line-height: 1.6;
    opacity: .72;
    padding: 2px 8px;
  }
  .select-pop .select-examples { font-style: italic; }
  .select-pop button {
    border: 0;
    background: transparent;
    color: var(--paper);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 6px;
    text-align: left;
    white-space: normal;
    line-height: 1.4;
  }
  .select-pop button:hover { background: rgba(246, 242, 232, .12); }
  .select-pop button:disabled { opacity: .7; cursor: default; }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .add-word { display: flex; gap: 8px; margin: 10px 0 4px; }
  .add-word input {
    flex: 1;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px 10px;
    font: inherit;
    background: var(--card);
    color: var(--ink);
    outline: none;
  }
  .add-word input:focus { border-color: var(--indigo); }
  .add-word button {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px 14px;
    background: var(--card);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }
  .add-word button:hover { border-color: var(--indigo); color: var(--indigo); }
  .add-word button:disabled { opacity: .6; cursor: wait; }
  .add-status { min-height: 18px; font-size: 12px; color: var(--cinnabar); margin: 4px 0 8px; }
  .add-hint { font-size: 12px; color: var(--ink-45); margin-bottom: 12px; }
  .remove.confirming { font-size: 12px; color: var(--cinnabar); }
  .toast {
    position: fixed;
    left: 50%;
    bottom: 26px;
    transform: translateX(-50%) translateY(12px);
    background: var(--ink);
    color: var(--paper);
    padding: 8px 14px;
    border-radius: 999px;
    font-size: 13px;
    opacity: 0;
    pointer-events: none;
    transition: opacity .2s ease, transform .2s ease;
    z-index: 100;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  .vocab-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .vocab-table th, .vocab-table td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .vocab-table th { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-45); font-weight: 500; }
  .vocab-table .word { font-family: var(--serif); font-size: 15px; font-weight: 600; }
  .vocab-table .ipa { display: block; font-family: var(--sans); font-size: 11px; color: var(--ink-45); }
  .vocab-table a { color: var(--indigo); text-decoration: none; }
  .vocab-table a:hover { text-decoration: underline; }
  .practice { margin-top: 40px; }
  .exercise { margin-top: 18px; }
  .exercise h3 { font-family: var(--serif); font-size: 18px; margin: 0 0 6px; }
  .exercise ol { padding-left: 22px; }
  .exercise li { margin: 8px 0; }
  .exercise details { margin-top: 4px; }
  .exercise summary { color: var(--indigo); font-size: 12px; cursor: pointer; }
  .exercise-translation { margin: 6px 0 0; color: var(--ink-45); font-size: 12.5px; line-height: 1.7; }
  .exercise-answer[open] summary { color: var(--cinnabar); }
  .cloze { font-family: var(--serif); font-size: 15px; }
  .muted { color: var(--ink-45); }
  footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--ink-45); font-size: 12px; display: flex; flex-direction: column; gap: 12px; }
  .footer-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .focus-mode { position: fixed; inset: 0; z-index: 80; background: var(--paper); overflow: auto; }
  body.focus-open { overflow: hidden; }
  .focus-shell { max-width: 920px; margin: 0 auto; padding: 26px 24px 90px; }
  .focus-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
  .focus-meter { flex: 1; min-width: 120px; height: 6px; border-radius: 999px; background: var(--paper-2); overflow: hidden; }
  .focus-meter-fill { height: 100%; width: 0; background: var(--cinnabar); transition: width .2s ease; }
  #focus-count { color: var(--ink-45); font-size: 11.5px; font-family: var(--mono); }
  .focus-tool { border: 1px solid var(--line); background: var(--card); color: var(--ink); border-radius: 999px; padding: 7px 12px; font: inherit; font-size: 12.5px; cursor: pointer; }
  .focus-tool:hover { border-color: var(--cinnabar); color: var(--cinnabar); }
  .focus-tool.primary { background: var(--cinnabar); border-color: var(--cinnabar); color: #fff; }
  .focus-tool:disabled { opacity: .45; cursor: default; }
  .focus-close { border: 0; background: transparent; color: var(--indigo); font: inherit; font-size: 13px; cursor: pointer; padding: 0; }
  .focus-body { padding-top: 7vh; }
  .focus-kicker { color: var(--cinnabar); font-family: var(--mono); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
  .focus-original { font-family: var(--serif); font-size: clamp(28px, 4.6vw, 46px); line-height: 1.5; letter-spacing: -.015em; margin: 18px 0 24px; }
  .focus-translation { color: var(--ink-70); border-left: 2px solid var(--line-strong); padding-left: 16px; font-size: 15px; line-height: 1.85; margin-bottom: 22px; }
  .focus-sentence-translation { color: var(--ink); border-left: 2px solid var(--cinnabar); background: rgba(176, 58, 46, .05); border-radius: 0 9px 9px 0; padding: 10px 14px; font-size: 15.5px; line-height: 1.85; margin-bottom: 14px; }
  .focus-note { margin: -4px 0 16px; color: var(--ochre); font-size: 12.5px; line-height: 1.7; }
  .focus-items { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 28px; }
  .focus-chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 4px 10px; font-size: 12px; color: var(--ink-70); }
  .focus-chip b { color: var(--ink); font-weight: 600; margin-right: 4px; }
  .focus-actions { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 20px; border-top: 1px solid var(--line); }
  .focus-hint { margin-top: 18px; color: var(--ink-45); font-size: 11.5px; }
  .word-modal { position: fixed; inset: 0; z-index: 95; background: rgba(28,26,22,.38); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .word-modal[hidden] { display: none; }
  .edit-modal { position: fixed; inset: 0; z-index: 96; background: rgba(28,26,22,.42); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .edit-modal[hidden] { display: none; }
  body.edit-modal-open { overflow: hidden; }
  .edit-modal-card { width: min(760px, 100%); background: var(--card); border-radius: 16px; box-shadow: 0 20px 60px rgba(28,26,22,.25); padding: 0 0 18px; }
  .edit-modal-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 18px; border-bottom: 1px solid var(--line); color: var(--ink-45); font-size: 12px; }
  .edit-modal-card textarea { display: block; width: calc(100% - 36px); min-height: 220px; margin: 16px 18px 0; border: 1px solid var(--line); border-radius: 10px; background: #fffdf8; padding: 12px 14px; font: inherit; font-size: 15px; line-height: 1.75; resize: vertical; outline: none; }
  .edit-modal-card textarea:focus { border-color: var(--cinnabar); }
  .edit-modal-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 18px 0; }
  .edit-modal-status { color: var(--ink-45); font-size: 12px; }
  .note-modal { position: fixed; inset: 0; z-index: 96; background: rgba(28,26,22,.42); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .note-modal[hidden] { display: none; }
  .split-modal { position: fixed; inset: 0; z-index: 96; background: rgba(28,26,22,.42); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .split-modal[hidden] { display: none; }
  .split-modal-card { width: min(680px, 100%); background: var(--card); border-radius: 16px; box-shadow: 0 20px 60px rgba(28,26,22,.25); padding-bottom: 16px; }
  .split-hint { margin: 14px 18px 6px; color: var(--ink-45); font-size: 12.5px; }
  .split-modal-card textarea { display: block; width: calc(100% - 36px); min-height: 110px; margin: 0 18px; border: 1px solid var(--line); border-radius: 8px; background: #fffdf8; padding: 10px 12px; font: inherit; font-size: 14px; line-height: 1.7; resize: vertical; outline: none; }
  .split-modal-card textarea:focus { border-color: var(--cinnabar); }
  .note-modal-card { width: min(760px, 100%); max-height: 88vh; overflow: auto; background: var(--card); border-radius: 16px; box-shadow: 0 20px 60px rgba(28,26,22,.25); }
  .note-form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; padding: 14px 18px 4px; }
  .note-form label { display: flex; flex-direction: column; gap: 4px; color: var(--ink-45); font-size: 11px; }
  .note-form input, .note-form textarea { border: 1px solid var(--line); border-radius: 8px; background: #fffdf8; padding: 7px 9px; font: inherit; font-size: 12.5px; line-height: 1.6; outline: none; }
  .note-form textarea { min-height: 56px; resize: vertical; }
  .note-form label:nth-child(n+4) { grid-column: 1 / -1; }
  .note-form input:focus, .note-form textarea:focus { border-color: var(--cinnabar); }
  .note-form label:first-child { grid-column: 1 / -1; }
  body.word-modal-open, body.note-modal-open { overflow: hidden; }
  .export-mode .note-modal { display: none !important; }
  .word-modal-card { width: min(720px, 100%); max-height: 82vh; overflow: auto; background: var(--card); border-radius: 16px; box-shadow: 0 20px 60px rgba(28,26,22,.25); }
  .word-modal-bar { position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 18px; background: var(--card); border-bottom: 1px solid var(--line); color: var(--ink-45); font-size: 12px; }
  .word-modal-close { border: 1px solid var(--line); background: var(--card); color: var(--ink); border-radius: 999px; padding: 4px 10px; font: inherit; font-size: 11.5px; cursor: pointer; }
  .word-modal-body { padding: 18px 22px 24px; }
  .word-modal-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .word-modal-head h3 { margin: 0; font-family: var(--serif); font-size: 28px; }
  .word-modal-def { margin-top: 6px; color: var(--ink-70); font-size: 14px; line-height: 1.7; }
  .word-modal-section { margin-top: 16px; }
  .word-modal-section h4 { margin: 0 0 6px; color: var(--ochre); font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; }
  .word-modal-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .word-modal-chip { border: 1px solid var(--line); background: rgba(255,253,248,.8); border-radius: 999px; padding: 3px 9px; font-size: 12.5px; color: var(--ink-70); }
  .word-modal-chip b { color: var(--ink); font-weight: 600; }
  .word-modal-list { margin: 0; padding-left: 20px; color: var(--ink-70); font-size: 13px; line-height: 1.7; }
  .word-modal-empty { color: var(--ink-45); font-size: 12.5px; }
  .derivation-tree { margin-top: 8px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 10px; background: rgba(255,253,248,.55); overflow-x: auto; }
  .derivation-tree > li { padding-left: 0; }
  .derivation-tree > li::before { display: none; }
  .derivation-tree ul { list-style: none; margin: 0; padding-left: 0; }
  .derivation-tree ul.tree-children { margin-left: 10px; padding-left: 16px; border-left: 1px solid var(--line); }
  .derivation-tree ul.tree-children > li { position: relative; padding: 4px 0 4px 0; }
  .derivation-tree ul.tree-children > li::before { content: ''; position: absolute; left: -16px; top: 18px; width: 14px; border-top: 1px solid var(--line); }
  .tree-node { display: inline-flex; align-items: baseline; flex-wrap: wrap; gap: 5px; padding: 3px 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--card); font-size: 12px; }
  .tree-node b { font-family: var(--serif); font-size: 13px; }
  .tree-node span { color: var(--ink-45); font-size: 11px; }
  .tree-node.tree-center { border-color: var(--cinnabar); background: rgba(176,58,46,.07); }
  .tree-node.tree-center b { color: var(--cinnabar); }
  .tree-node.tree-root { border-color: rgba(63,95,127,.35); }
  .tree-node.tree-prefix, .tree-node.tree-suffix { border-color: rgba(168,115,47,.35); }
  .tree-edge { display: block; margin: 1px 0 2px; color: var(--ochre); font-family: var(--mono); font-size: 9.5px; }
  @media (max-width: 760px) {
    .focus-shell { padding: 18px 16px 70px; }
    .focus-body { padding-top: 5vh; }
    .focus-original { font-size: 29px; }
    .focus-bar { gap: 8px; }
  }
  @media (max-width: 760px) {
    .topbar { padding: 10px 16px; }
    .topbar .meta { display: none; }
    .page { padding: 32px 16px 60px; }
    .paragraph { grid-template-columns: 1fr; gap: 8px; }
    .para-label { display: block; padding-top: 0; }
    .para-text { grid-template-columns: 1fr; gap: 12px; }
    .translation { border-left: 0; border-top: 1px solid var(--line); padding-left: 0; padding-top: 10px; }
    .reading-intro { padding: 14px 16px; }
    .front-matter { padding: 16px; }
    .reading-intro-stats { gap: 10px; }
    .para-note { padding: 12px 13px; }
    .note-summary { font-size: 13px; }
    .vocab-table { font-size: 12px; }
  }
  @media print {
    body { background: #fff; }
    .topbar, .star, .para-marker, audio, details > summary { display: none !important; }
    .page { max-width: none; padding: 0; }
    .item, .editorial, .paragraph { break-inside: avoid; }
    details[open] > * { display: block; }
    .item details { display: block; }
    .item details > summary { display: none; }
    .item details > * { display: block; }
  }
</style>
</head>
<body${exportMode ? ' class="export-mode"' : ''}>
<header class="topbar">
  <div class="topbar-left">
    <a class="topbar-action" id="back-review" data-home href="/" aria-label="返回今日">← 今日</a>
    <a class="brand" data-home href="/">Learning Pack</a>
  </div>
  <div class="topbar-right">
    <div class="meta">
      <span>${escapeHtml(pack.difficulty.cefr)}</span>
      <span>${pack.stats.wordCount} 词</span>
      <span>${pack.stats.itemCount} 项</span>
      <span>精读约 ${readingMinutes} 分钟</span>
    </div>
    <button class="topbar-action" id="jump-add">添加单词</button>
    ${pack.reading?.length ? '<button class="topbar-action" id="top-focus" type="button">单句精读</button>' : ''}
    <div class="export-wrap">
      <button class="topbar-action" id="export-toggle" type="button">导出</button>
      <div class="export-menu" id="export-menu" hidden>
        <button type="button" data-export="html">网页 HTML</button>
        <button type="button" data-export="epub">EPUB</button>
        <button type="button" data-export="pdf">PDF</button>
        <div class="export-label">PNG 长图</div>
        <button type="button" data-export="png" data-png-width="900">手机宽 · 900</button>
        <button type="button" data-export="png" data-png-width="1200">标准 · 1200</button>
        <button type="button" data-export="png" data-png-width="900" data-png-scale="2">高清 2× · 1800</button>
        <button type="button" data-export="png-pages">PNG 分图 · AI 智能分页</button>
        <button type="button" data-export="mobi">MOBI（需 Calibre）</button>
      </div>
    </div>
  </div>
</header>
<div class="scroll-progress" id="scroll-progress"></div>
<main class="page">
  <section class="hero">
    <div class="eyebrow">${heroSection ? `${escapeHtml(heroSection)} · ` : ''}${escapeHtml(pack.mode)} mode · ${escapeHtml(pack.styleName ?? 'house style')}</div>
    <h1 class="front-title original" data-source="front">${escapeHtml(heroTitle)}</h1>
    ${heroTitleZh ? `<div class="front-title-zh">${escapeHtml(heroTitleZh)}</div>` : ''}
    ${heroTitleNote ? `<p class="front-note">${escapeHtml(heroTitleNote)}</p>` : ''}
    ${
      heroLead
        ? `<div class="front-lead-block hero-lead-block">
            <p class="front-lead original" data-source="front">${escapeHtml(heroLead)}</p>
            ${heroLeadZh ? `<p class="front-lead-zh">${escapeHtml(heroLeadZh)}</p>` : ''}
            ${heroLeadNote ? `<p class="front-note">${escapeHtml(heroLeadNote)}</p>` : ''}
          </div>`
        : ''
    }
    <div class="meta-row">
      <span class="pill">${escapeHtml(pack.difficulty.cefr)}</span>
      <span class="pill">${pack.stats.wordCount} 词</span>
      <span class="pill">${pack.stats.itemCount} 个学习项</span>
      <span class="pill">精读约 ${readingMinutes} 分钟</span>
    </div>
    ${selectionNote}
    <div class="hero-actions">
      <a class="topbar-action" data-review-pack href="/?tab=review&pack=${encodeURIComponent(pack.id)}">复习这篇</a>
      ${pack.parentResourceId ? '<a class="topbar-action" data-article-list href="#">返回文章列表</a>' : ''}
      ${hasBonus ? '<button class="topbar-action" id="toggle-bonus" type="button">只看核心词</button>' : ''}
      ${pack.reading?.length ? '<button class="topbar-action" id="focus-mode-open" type="button">单句精读</button><button class="topbar-action" id="toggle-translation" type="button">隐藏译文</button><button class="topbar-action" id="toggle-font" type="button">大字</button>' : ''}
      <button class="topbar-action" data-feedback="less" type="button">词太多</button>
      <button class="topbar-action" data-feedback="more" type="button">词太少</button>
      <button class="topbar-action" data-edit-front="title" type="button">编辑标题</button>
      ${heroLead ? '<button class="topbar-action" data-edit-front="lead" type="button">编辑导语</button>' : ''}
    </div>
    ${
      pack.reading?.length
        ? `<div class="reading-status" id="reading-status">
            <div class="reading-track"><div class="reading-fill" id="reading-fill"></div></div>
            <span id="reading-text">已读 0 / ${pack.reading.length} 段</span>
            <button class="reading-finish" id="reading-finish" type="button">精读完成</button>
            <button class="reading-finish" id="reading-reset" type="button" hidden>重新开始</button>
          </div>`
        : ''
    }
  </section>

  <section class="add-panel" id="add-panel">
    <div class="eyebrow">ADD WORDS</div>
    <h2>选中即加词 / 加句</h2>
    <p>在下面原文中选中 1–8 个词，页面会浮出“添加”按钮，直接生成学习卡；选中一整句，可以生成用于回译的句子卡。没有出现在原文里的词会放进“补充词汇”。</p>
    <details class="manual-add">
      <summary>手动输入一个词或短语</summary>
      <form class="add-word" id="add-word">
        <label class="sr-only" for="add-word-input">单词或短语</label>
        <input id="add-word-input" type="text" placeholder="例如 resilience / take a toll on" autocomplete="off">
        <button id="add-word-submit" type="submit">生成学习卡</button>
      </form>
      <div class="add-status" id="add-status"></div>
    </details>
    <div class="add-hint">生成通常需要 20–40 秒。移除词卡时，点右上角 × 两次确认。</div>
  </section>

  ${
    readingHtml
      ? `<section class="reader" id="reading">
          <div class="section-head"><h2>逐段精读</h2><span>${pack.reading?.length ?? 0} 段 · 原文 / 译文 / 精读笔记${
            hasReadingNotes ? '<button class="topbar-action enrich-reading" id="toggle-notes" type="button">隐藏笔记</button>' : ''
          }${
            missingReadingNotes ? '<button class="topbar-action enrich-reading" id="enrich-reading" type="button">补齐导读与笔记</button>' : ''
          }${
            needsReadingRepair ? '<button class="topbar-action enrich-reading" id="repair-reading" type="button">修复分段</button>' : ''
          }${
            needsHeadRepair ? '<button class="topbar-action enrich-reading" id="repair-head" type="button">修复文章头</button>' : ''
          }</span></div>
          ${renderFrontMatter(pack, audio)}
          ${
            editorialLeadHtml
              ? `<section class="reading-preface">
                  <div class="section-head"><h2>精读导读</h2><span>${escapeHtml(pack.styleName ?? 'house style')} · 读前先看老师怎么拆<button class="topbar-action enrich-reading" id="regenerate-guide" type="button">${pack.readingGuide ? '重写导读' : '生成导读'}</button></span></div>
                  <div class="preface-excerpt">${editorialLeadHtml}</div>
                </section>`
              : ''
          }
          <div class="reading-intro">
            <div class="reading-intro-kicker">INTENSIVE READING</div>
            <div class="reading-intro-stats">
              <span><strong>${pack.reading?.length ?? 0}</strong> 段</span>
              <span><strong>${sentenceTotal}</strong> 句</span>
              <span><strong>${longSentenceTotal}</strong> 个长句</span>
              <span><strong>${readingWordCount}</strong> 个重点词</span>
            </div>
            <p>先通读一遍，再逐段看结构、长句和语法笔记。每段右上角的“精读这段”可以直接进入单句模式。</p>
            ${readingMap}
          </div>
          ${readingHtml}
        </section>`
      : ''
  }

  ${sentenceHtml}

  ${supplementalHtml}

  <section class="vocab" id="vocab">
    <div class="section-head"><h2>词汇总表</h2><span>${pack.items.filter((item) => item.type !== 'sentence').length} 项 · 点击段落编号回到原文</span></div>
    ${wordsAudio}
    ${renderVocabularyTable(pack)}
  </section>

  ${
    exercisesHtml
      ? `<section class="practice"><div class="section-head"><h2>练习与讨论</h2><span>答案可展开</span></div>${exercisesHtml}</section>`
      : ''
  }

  ${outputPractice}

  <footer>
    <div class="footer-actions">
      <a class="topbar-action" data-home href="/">← 返回今日</a>
      <a class="topbar-action" data-review-pack href="/?tab=review&pack=${encodeURIComponent(pack.id)}">复习这篇</a>
      ${pack.parentResourceId ? '<a class="topbar-action" data-article-list href="#">返回文章列表</a>' : ''}
      <button class="topbar-action" id="jump-top" type="button">回到顶部</button>
    </div>
    <div>由 CloseRead 生成 · ${escapeHtml(pack.generatedAt)} · ${escapeHtml(pack.source)}</div>
  </footer>
</main>
<div class="focus-mode" id="focus-mode" hidden>
  <div class="focus-shell">
    <div class="focus-bar">
      <button class="focus-close" id="focus-close" type="button">← 退出精读</button>
      <div class="focus-meter"><div class="focus-meter-fill" id="focus-meter-fill"></div></div>
      <span id="focus-count"></span>
      <button class="focus-tool" id="focus-translation" type="button">显示译文</button>
      <button class="focus-tool" id="focus-sentence-translation-btn" type="button">翻译本句</button>
      <button class="focus-tool" id="focus-speak" type="button">发音</button>
    </div>
    <div class="focus-body">
      <div class="focus-kicker" id="focus-kicker"></div>
      <div class="original focus-original" id="focus-original"></div>
      <div class="focus-sentence-translation" id="focus-sentence-translation" hidden></div>
      <div class="focus-note" id="focus-note"></div>
      <div class="focus-translation" id="focus-translation-text" hidden></div>
      <div class="focus-items" id="focus-items"></div>
      <div class="focus-actions">
        <button class="focus-tool" id="focus-prev" type="button">← 上一句</button>
        <button class="focus-tool primary" id="focus-next" type="button">下一句 →</button>
        <button class="focus-tool" id="focus-add-sentence" type="button">加入句子卡</button>
        <button class="focus-tool" id="focus-merge" type="button">合并下一句</button>
        <button class="focus-tool" id="focus-split" type="button">拆分本句</button>
        <button class="focus-tool" id="focus-mark-read" type="button">本段已读</button>
        <button class="focus-tool" id="focus-finish" type="button">完成精读</button>
      </div>
      <div class="focus-hint">← → 切换句子 · Esc 退出 · 选中句中的词可以直接加入生词</div>
    </div>
  </div>
</div>
<div class="word-modal" id="word-modal" hidden>
  <div class="word-modal-card" role="dialog" aria-modal="true" aria-label="词汇发散">
    <div class="word-modal-bar">
      <span>词汇发散 · AI 相关词</span>
      <button class="word-modal-close" id="word-modal-close" type="button">关闭</button>
    </div>
    <div class="word-modal-body" id="word-modal-body"></div>
  </div>
</div>
<div class="edit-modal" id="edit-modal" hidden>
  <div class="edit-modal-card" role="dialog" aria-modal="true" aria-label="编辑精读内容">
    <div class="edit-modal-bar">
      <span id="edit-modal-title">编辑原文</span>
      <button class="word-modal-close" id="edit-modal-close" type="button">关闭</button>
    </div>
    <textarea id="edit-modal-text" placeholder="Edit the English text…"></textarea>
    <div class="edit-modal-actions">
      <button class="focus-tool primary" id="edit-modal-save" type="button">保存并更新译文</button>
      <button class="focus-tool" id="edit-modal-delete" type="button">删除本段</button>
      <span class="edit-modal-status" id="edit-modal-status"></span>
    </div>
  </div>
</div>
<div class="split-modal" id="split-modal" hidden>
  <div class="split-modal-card" role="dialog" aria-modal="true" aria-label="拆分句子">
    <div class="edit-modal-bar">
      <span>拆分这句</span>
      <button class="word-modal-close" id="split-modal-close" type="button">关闭</button>
    </div>
    <p class="split-hint">在要断开的位置插入 <b>|</b>，然后保存。例如：前半句 | 后半句。</p>
    <textarea id="split-modal-text"></textarea>
    <div class="edit-modal-actions">
      <button class="focus-tool primary" id="split-modal-save" type="button">保存断句</button>
      <span class="edit-modal-status" id="split-modal-status"></span>
    </div>
  </div>
</div>
<div class="note-modal" id="note-modal" hidden>
  <div class="note-modal-card" role="dialog" aria-modal="true" aria-label="编辑精读笔记">
    <div class="edit-modal-bar">
      <span>编辑精读笔记</span>
      <button class="word-modal-close" id="note-modal-close" type="button">关闭</button>
    </div>
    <div class="note-form">
      <label>段落作用<input id="note-role" type="text"></label>
      <label>摘要<textarea id="note-summary"></textarea></label>
      <label>关键句<textarea id="note-key"></textarea></label>
      <label>关键句解析<textarea id="note-key-note"></textarea></label>
      <label>语法<textarea id="note-grammar"></textarea></label>
      <label>背景<textarea id="note-background"></textarea></label>
      <label>想一想<textarea id="note-question"></textarea></label>
      <label>参考答案<textarea id="note-answer"></textarea></label>
    </div>
    <div class="edit-modal-actions">
      <button class="focus-tool primary" id="note-modal-save" type="button">保存笔记</button>
      <button class="focus-tool" id="note-modal-regenerate" type="button">AI 重新生成本段笔记</button>
      <button class="focus-tool" id="note-modal-answer" type="button">重新生成答案</button>
      <span class="edit-modal-status" id="note-modal-status"></span>
    </div>
  </div>
</div>
<div class="select-pop" id="select-pop" hidden></div>
<div class="toast" id="toast"></div>
<div class="export-progress" id="export-progress" role="status" aria-live="polite" hidden><span class="export-spinner"></span><span id="export-progress-text"></span></div>
<script>
  (function () {
    var storageKey = 'learn-pack-favorites';
    var favorites = new Set();
    try { favorites = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch (error) {}
    var PACK_ID = ${JSON.stringify(pack.id)};
    var PACK_TITLE = ${jsonForScript(pack.title)};
    var PARENT_RESOURCE = ${JSON.stringify(pack.parentResourceId ?? null)};
    var ARTICLE_INDEX = ${JSON.stringify(pack.articleIndex ?? null)};
    var editable = location.protocol !== 'file:';
    var READING_TOTAL = ${pack.reading?.length ?? 0};
    var FOCUS_PARAGRAPHS = ${jsonForScript(focusData)};
    var OUTPUT_PROMPT = ${jsonForScript(discussion?.question ?? '')};
    var OUTPUT_ANSWER = ${jsonForScript(discussion?.answer ?? '')};
    var readingState = { read: [], last: 0, lastSentence: 0, finished: false, started: false };
    var readingSaveTimer;
    var readingStatus = document.getElementById('reading-status');
    var readingFill = document.getElementById('reading-fill');
    var readingText = document.getElementById('reading-text');
    var readingFinish = document.getElementById('reading-finish');
    var readingReset = document.getElementById('reading-reset');
    var toast = document.getElementById('toast');
    var toastTimer;

    var homeHref = location.protocol === 'file:' ? 'http://127.0.0.1:4317/' : '/';
    document.querySelectorAll('[data-home]').forEach(function (link) {
      link.setAttribute('href', homeHref);
      if (location.protocol === 'file:') link.setAttribute('title', '先运行 pnpm dev review 启动复习服务');
    });
    var reviewBase = location.protocol === 'file:' ? 'http://127.0.0.1:4317' : '';
    document.querySelectorAll('[data-review-pack]').forEach(function (link) {
      link.setAttribute('href', reviewBase + '/?tab=review&pack=' + encodeURIComponent(PACK_ID));
      if (location.protocol === 'file:') link.setAttribute('title', '先运行 pnpm dev review 启动复习服务');
    });
    if (PARENT_RESOURCE) {
      var articleBase = location.protocol === 'file:' ? 'http://127.0.0.1:4317' : '';
      document.querySelectorAll('[data-article-list]').forEach(function (link) {
        link.setAttribute('href', articleBase + '/?tab=import&resource=' + encodeURIComponent(PARENT_RESOURCE) +
          '&articles=1' + (ARTICLE_INDEX === null ? '' : '&article=' + ARTICLE_INDEX));
      });
    }
    var jumpTop = document.getElementById('jump-top');
    if (jumpTop) jumpTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

    var toggleBonus = document.getElementById('toggle-bonus');
    if (toggleBonus) {
      toggleBonus.addEventListener('click', function () {
        var coreOnly = document.body.classList.toggle('core-only');
        toggleBonus.textContent = coreOnly ? '显示全部词' : '只看核心词';
      });
    }
    var toggleTranslation = document.getElementById('toggle-translation');
    if (toggleTranslation) {
      toggleTranslation.addEventListener('click', function () {
        var hidden = document.body.classList.toggle('hide-translation');
        toggleTranslation.textContent = hidden ? '显示译文' : '隐藏译文';
      });
    }
    var toggleFont = document.getElementById('toggle-font');
    if (toggleFont) {
      toggleFont.addEventListener('click', function () {
        var large = document.body.classList.toggle('font-large');
        toggleFont.textContent = large ? '标准字号' : '大字';
      });
    }

    function paintReading() {
      var percent = readingState.finished
        ? 100
        : READING_TOTAL > 0
          ? Math.min(99, Math.round((readingState.read.length / READING_TOTAL) * 100))
          : 0;
      if (readingFill) readingFill.style.width = percent + '%';
      if (readingText) {
        readingText.textContent = readingState.finished
          ? '已精读完成 · ' + READING_TOTAL + ' 段'
          : '已读 ' + readingState.read.length + ' / ' + READING_TOTAL + ' 段';
      }
      if (readingFinish) {
        readingFinish.disabled = readingState.finished;
        readingFinish.textContent = readingState.finished ? '已精读完成' : '精读完成';
      }
      if (readingReset) {
        readingReset.hidden = !readingState.finished;
        readingReset.textContent = '重新开始';
        readingReset.dataset.confirm = '';
      }
      document.querySelectorAll('[data-para-read]').forEach(function (button) {
        var index = Number(button.getAttribute('data-para-read'));
        var read = readingState.read.indexOf(index) !== -1;
        button.textContent = read ? '✓' : button.getAttribute('data-label') || String(index + 1);
        button.classList.toggle('read', read);
        var paragraph = button.closest('.paragraph');
        if (paragraph) paragraph.classList.toggle('is-read', read);
      });
    }

    function saveReading(extra, immediate) {
      if (!editable) return;
      var payload = {
        readParagraphs: readingState.read,
        lastParagraph: readingState.last,
        lastSentence: readingState.lastSentence,
      };
      if (extra) {
        Object.keys(extra).forEach(function (key) { payload[key] = extra[key]; });
      }
      fetch('/api/packs/' + encodeURIComponent(PACK_ID) + '/reading', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '进度保存失败');
          if (data.progress) {
            readingState.read = data.progress.readParagraphs || readingState.read;
            readingState.last = data.progress.lastParagraph;
            readingState.lastSentence = Number(data.progress.lastSentence) || readingState.lastSentence;
            readingState.finished = Boolean(data.progress.finishedAt);
            paintReading();
          }
        });
      }).catch(function (error) {
        if (immediate) showToast(error.message);
      });
    }

    function queueReadingSave() {
      clearTimeout(readingSaveTimer);
      readingSaveTimer = setTimeout(function () { saveReading({}, false); }, 800);
    }

    function toggleParagraph(index) {
      if (readingState.finished) {
        showToast('这篇已经标记为精读完成');
        return;
      }
      var position = readingState.read.indexOf(index);
      if (position === -1) readingState.read.push(index);
      else readingState.read.splice(position, 1);
      readingState.read.sort(function (a, b) { return a - b; });
      readingState.last = index;
      paintReading();
      saveReading({}, true);
    }

    function finishReading() {
      if (readingState.finished) return;
      readingState.finished = true;
      paintReading();
      saveReading({ finished: true }, true);
      showToast('已记录精读完成，回到今日查看进度');
    }

    function loadReading() {
      if (!READING_TOTAL) return Promise.resolve();
      if (!editable) {
        if (readingStatus) readingStatus.hidden = true;
        document.querySelectorAll('[data-para-read]').forEach(function (button) { button.hidden = true; });
        return Promise.resolve();
      }
      return fetch('/api/packs/' + encodeURIComponent(PACK_ID) + '/reading').then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '进度加载失败');
          var progress = data.progress || {};
          readingState.read = Array.isArray(progress.readParagraphs) ? progress.readParagraphs : [];
          readingState.last = Number(progress.lastParagraph) || 0;
          readingState.lastSentence = Number(progress.lastSentence) || 0;
          readingState.finished = Boolean(progress.finishedAt);
          readingState.started = Boolean(progress.startedAt);
          paintReading();
        });
      }).catch(function (error) {
        showToast(error.message);
      });
    }

    document.querySelectorAll('[data-para-read]').forEach(function (button) {
      button.addEventListener('click', function () {
        toggleParagraph(Number(button.getAttribute('data-para-read')));
      });
    });
    if (readingFinish) readingFinish.addEventListener('click', finishReading);
    if (readingReset) {
      readingReset.addEventListener('click', function () {
        if (readingReset.dataset.confirm !== '1') {
          readingReset.dataset.confirm = '1';
          readingReset.textContent = '确认重新开始';
          return;
        }
        readingReset.disabled = true;
        fetch('/api/packs/' + encodeURIComponent(PACK_ID) + '/reading/reset', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }).then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok) throw new Error(data.error || '重置失败');
            showToast('已重新开始，可以再读一遍');
            location.reload();
          });
        }).catch(function (error) {
          readingReset.disabled = false;
          readingReset.textContent = '重新开始';
          showToast(error.message);
        });
      });
    }
    var readingPromise = loadReading();

    var outputSave = document.getElementById('output-save');
    var outputText = document.getElementById('output-text');
    var outputStatus = document.getElementById('output-status');
    var exportToggle = document.getElementById('export-toggle');
    var exportMenu = document.getElementById('export-menu');
    var exportProgress = document.getElementById('export-progress');
    var exportProgressText = document.getElementById('export-progress-text');
    var exportTimer = null;
    var exportStartedAt = 0;

    function beginExport(label) {
      if (!exportProgress || !exportProgressText) return;
      exportStartedAt = Date.now();
      exportProgress.hidden = false;
      var tick = function () {
        var seconds = Math.max(0, Math.floor((Date.now() - exportStartedAt) / 1000));
        exportProgressText.textContent = label + ' · 已等待 ' + seconds + ' 秒';
      };
      tick();
      clearInterval(exportTimer);
      exportTimer = setInterval(tick, 1000);
    }

    function endExport(label) {
      clearInterval(exportTimer);
      exportTimer = null;
      if (!exportProgress || !exportProgressText) return;
      if (!label) {
        exportProgress.hidden = true;
        return;
      }
      exportProgressText.textContent = label;
      setTimeout(function () {
        if (!exportTimer) exportProgress.hidden = true;
      }, 900);
    }

    function closeExportMenu() {
      if (exportMenu) exportMenu.hidden = true;
    }

    function downloadExport(format, button) {
      if (!editable) {
        showToast('请通过 pnpm dev review 打开学习包后再导出');
        return;
      }
      closeExportMenu();
      var width = button && Number(button.getAttribute('data-png-width')) || 1200;
      var scale = button && Number(button.getAttribute('data-png-scale')) || 1;
      width = Math.max(640, Math.min(2400, width));
      scale = Math.max(1, Math.min(3, scale));
      var query = format === 'png' && (width !== 1200 || scale > 1)
        ? '?width=' + width + '&scale=' + scale
        : '';
      var label = format === 'pdf'
        ? '正在生成 PDF'
        : format === 'png'
          ? '正在生成 PNG 长图（' + width + (scale > 1 ? ' · ' + scale + '×' : '') + '）'
          : format === 'png-pages'
            ? '正在用 AI 规划分页，并生成多张 PNG'
            : '正在补全发散、答案和译文，然后导出';
      beginExport(label);
      fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/export/' + format + query).then(function (response) {
        if (!response.ok) {
          return response.json().catch(function () { return {}; }).then(function (data) {
            throw new Error(data.error || '导出失败');
          });
        }
        return response.blob();
      }).then(function (blob) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        var safeTitle = PACK_TITLE.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'learning-pack';
        var suffix = format === 'png' && (width !== 1200 || scale > 1)
          ? '-' + width + 'w' + (scale > 1 ? '-' + scale + 'x' : '')
          : '';
        var extension = format === 'png-pages' ? 'zip' : format;
        link.href = url;
        link.download = safeTitle + suffix + '.' + extension;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        endExport(format === 'png-pages'
          ? '已导出 PNG 分图 ZIP'
          : '已导出 ' + format.toUpperCase() + (suffix ? '（' + width + 'px' + (scale > 1 ? ' · ' + scale + '×' : '') + '）' : ''));
      }).catch(function (error) {
        endExport();
        showToast(error.message);
        if (format === 'pdf') {
          // Chrome 不可用时退回浏览器打印，用户仍可“存储为 PDF”
          setTimeout(function () { window.print(); }, 300);
        }
      });
    }

    if (exportToggle) {
      if (!editable) exportToggle.hidden = true;
      exportToggle.addEventListener('click', function (event) {
        event.stopPropagation();
        if (exportMenu) exportMenu.hidden = !exportMenu.hidden;
      });
    }
    if (exportMenu) {
      exportMenu.addEventListener('click', function (event) {
        var button = event.target && event.target.closest ? event.target.closest('[data-export]') : null;
        if (!button) return;
        downloadExport(button.getAttribute('data-export'), button);
      });
    }
    document.addEventListener('click', closeExportMenu);

    var enrichReading = document.getElementById('enrich-reading');
    var repairReading = document.getElementById('repair-reading');
    var repairHead = document.getElementById('repair-head');
    if (repairHead) {
      repairHead.addEventListener('click', function () {
        repairHead.disabled = true;
        repairHead.textContent = '修复中…';
        showToast('正在把首句放回正文，并重新生成文章头…');
        fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/repair-head', { method: 'POST' })
          .then(function (response) {
            return response.json().then(function (data) {
              if (!response.ok) throw new Error(data.error || '修复失败');
              location.reload();
            });
          })
          .catch(function (error) {
            repairHead.disabled = false;
            repairHead.textContent = '修复文章头';
            showToast(error.message);
          });
      });
    }
    var toggleNotes = document.getElementById('toggle-notes');
    if (toggleNotes) {
      var hideNotes = false;
      try {
        hideNotes = localStorage.getItem('learn-hide-notes') === '1';
      } catch (error) {}
      var applyNotes = function () {
        document.body.classList.toggle('hide-notes', hideNotes);
        toggleNotes.textContent = hideNotes ? '显示笔记' : '隐藏笔记';
      };
      applyNotes();
      toggleNotes.addEventListener('click', function () {
        hideNotes = !hideNotes;
        try {
          localStorage.setItem('learn-hide-notes', hideNotes ? '1' : '0');
        } catch (error) {}
        applyNotes();
      });
    }
    var wordModal = document.getElementById('word-modal');
    var wordModalBody = document.getElementById('word-modal-body');
    var wordModalClose = document.getElementById('word-modal-close');

    function closeWordModal() {
      if (!wordModal) return;
      wordModal.hidden = true;
      document.body.classList.remove('word-modal-open');
    }

    function modalSection(title, values, asList) {
      if (!values || values.length === 0) return;
      var section = document.createElement('div');
      section.className = 'word-modal-section';
      var heading = document.createElement('h4');
      heading.textContent = title;
      section.appendChild(heading);
      if (asList) {
        var list = document.createElement('ul');
        list.className = 'word-modal-list';
        values.forEach(function (value) {
          var item = document.createElement('li');
          item.textContent = value;
          list.appendChild(item);
        });
        section.appendChild(list);
      } else {
        var chips = document.createElement('div');
        chips.className = 'word-modal-chips';
        values.forEach(function (value) {
          var chip = document.createElement('span');
          chip.className = 'word-modal-chip';
          chip.textContent = value;
          chips.appendChild(chip);
        });
        section.appendChild(chips);
      }
      wordModalBody.appendChild(section);
    }

    function renderDerivationGraph(graph, slot) {
      slot.innerHTML = '';
      var heading = document.createElement('h4');
      heading.textContent = '派生图 · 思维导图';
      slot.appendChild(heading);
      var nodes = graph.nodes || [];
      if (!nodes.length) return;
      var byId = {};
      nodes.forEach(function (node) { byId[node.id] = node; });
      var center = nodes.find(function (node) { return node.kind === 'center'; }) || nodes[0];
      if (!center) return;
      var adjacency = {};
      nodes.forEach(function (node) { adjacency[node.id] = []; });
      var edges = graph.edges && graph.edges.length
        ? graph.edges
        : nodes.filter(function (node) { return node.id !== center.id; }).map(function (node) {
            return { from: center.id, to: node.id };
          });
      edges.forEach(function (edge) {
        if (!byId[edge.from] || !byId[edge.to] || edge.from === edge.to) return;
        if (!adjacency[edge.from].some(function (entry) { return entry.id === edge.to; })) {
          adjacency[edge.from].push({ id: edge.to, label: edge.label || '' });
        }
        if (!adjacency[edge.to].some(function (entry) { return entry.id === edge.from; })) {
          adjacency[edge.to].push({ id: edge.from, label: edge.label || '' });
        }
      });
      var visited = {};
      function build(nodeId, depth) {
        if (visited[nodeId] || depth > 6) return null;
        visited[nodeId] = true;
        var node = byId[nodeId];
        var item = document.createElement('li');
        var nodeElement = document.createElement('div');
        nodeElement.className = 'tree-node tree-' + (node.kind || 'related');
        var word = document.createElement('b');
        word.textContent = node.word;
        nodeElement.appendChild(word);
        if (node.meaningZh) {
          var meaning = document.createElement('span');
          meaning.textContent = node.meaningZh;
          nodeElement.appendChild(meaning);
        }
        item.appendChild(nodeElement);
        var children = adjacency[nodeId] || [];
        if (children.length) {
          var list = document.createElement('ul');
          list.className = 'tree-children';
          children.forEach(function (edge) {
            if (visited[edge.id]) return;
            var child = build(edge.id, depth + 1);
            if (!child) return;
            var childNode = byId[edge.id];
            var kindLabels = { root: '词根', prefix: '前缀', suffix: '后缀', derivative: '派生', related: '相关' };
            var edgeLabel = childNode && (childNode.kind === 'root' || childNode.kind === 'prefix' || childNode.kind === 'suffix')
              ? kindLabels[childNode.kind]
              : edge.label || (childNode ? kindLabels[childNode.kind] : '');
            if (edgeLabel) {
              var label = document.createElement('span');
              label.className = 'tree-edge';
              label.textContent = edgeLabel;
              child.insertBefore(label, child.firstChild);
            }
            list.appendChild(child);
          });
          if (list.children.length) item.appendChild(list);
        }
        return item;
      }
      var tree = document.createElement('div');
      tree.className = 'derivation-tree';
      var root = build(center.id, 0);
      if (root) tree.appendChild(root);
      slot.appendChild(tree);
    }

    function addDerivationSlot(item) {
      if (!wordModalBody) return;
      var slot = document.createElement('div');
      slot.className = 'word-modal-section';
      slot.id = 'derivation-slot';
      if (item.derivation) {
        renderDerivationGraph(item.derivation, slot);
      } else {
        var heading = document.createElement('h4');
        heading.textContent = '派生图';
        slot.appendChild(heading);
        var loading = document.createElement('p');
        loading.className = 'word-modal-empty';
        loading.textContent = 'AI 正在生成派生图…';
        slot.appendChild(loading);
      }
      wordModalBody.appendChild(slot);
      return slot;
    }

    function loadDerivation(itemId) {
      var slot = document.getElementById('derivation-slot');
      if (!slot) return;
      fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/items/' + encodeURIComponent(itemId) + '/derivation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '派生图生成失败');
          renderDerivationGraph(data.derivation, slot);
        });
      }).catch(function (error) {
        slot.innerHTML = '';
        var heading = document.createElement('h4');
        heading.textContent = '派生图';
        slot.appendChild(heading);
        var message = document.createElement('p');
        message.className = 'word-modal-empty';
        message.textContent = error.message;
        slot.appendChild(message);
      });
    }

    function renderWordExpansion(item) {
      if (!wordModalBody) return;
      wordModalBody.innerHTML = '';
      var head = document.createElement('div');
      head.className = 'word-modal-head';
      var word = document.createElement('h3');
      word.textContent = item.lemma;
      head.appendChild(word);
      if (item.ipa) {
        var ipa = document.createElement('span');
        ipa.className = 'ipa';
        ipa.textContent = item.ipa;
        head.appendChild(ipa);
      }
      wordModalBody.appendChild(head);
      var definition = document.createElement('p');
      definition.className = 'word-modal-def';
      definition.textContent = [item.definitionZh, item.definition].filter(Boolean).join(' · ');
      wordModalBody.appendChild(definition);

      modalSection('词族 / 派生', item.relations?.wordFamily ?? []);
      modalSection('同义词', item.relations?.synonyms ?? []);
      modalSection('反义词', item.relations?.antonyms ?? []);
      modalSection('易混词', item.relations?.confusables ?? []);
      modalSection('搭配', item.collocations ?? []);

      var formation = item.wordFormation;
      if (formation) {
        ['roots', 'prefixes', 'suffixes'].forEach(function (key) {
          var parts = formation[key] || [];
          if (!parts.length) return;
          modalSection(
            key === 'roots' ? '词根' : key === 'prefixes' ? '前缀' : '后缀',
            parts.map(function (part) {
              return part.form + ' · ' + part.meaning +
                (part.examples && part.examples.length ? '（' + part.examples.slice(0, 4).join(' / ') + '）' : '');
            }),
          );
        });
      }

      var examples = (item.examples || []).filter(function (example) { return example.origin !== 'source'; });
      modalSection('例句', examples.map(function (example) { return example.text; }), true);
      if (item.memoryHook) modalSection('记忆钩子', [item.memoryHook], true);

      var hasContent = wordModalBody.querySelector('.word-modal-section');
      if (!hasContent) {
        var empty = document.createElement('p');
        empty.className = 'word-modal-empty';
        empty.textContent = 'AI 这次没有返回更多关联词，可以稍后重试。';
        wordModalBody.appendChild(empty);
      }
      addDerivationSlot(item);
    }

    function openWordExpansion(itemId) {
      if (!editable) {
        showToast('请通过 pnpm dev review 打开学习包后再发散');
        return;
      }
      if (!wordModal || !wordModalBody) return;
      wordModal.hidden = false;
      document.body.classList.add('word-modal-open');
      wordModalBody.innerHTML = '';
      var loading = document.createElement('p');
      loading.className = 'word-modal-empty';
      loading.textContent = 'AI 正在发散相关词，通常需要 20–40 秒…';
      wordModalBody.appendChild(loading);
      fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/items/' + encodeURIComponent(itemId) + '/expand', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '发散失败');
          renderWordExpansion(data.item);
          if (!data.item.derivation) loadDerivation(itemId);
        });
      }).catch(function (error) {
        wordModalBody.innerHTML = '';
        var message = document.createElement('p');
        message.className = 'word-modal-empty';
        message.textContent = error.message;
        wordModalBody.appendChild(message);
      });
    }

    if (wordModalClose) wordModalClose.addEventListener('click', closeWordModal);
    if (wordModal) {
      wordModal.addEventListener('click', function (event) {
        if (event.target === wordModal) closeWordModal();
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && wordModal && !wordModal.hidden) {
        closeWordModal();
      }
    });
    document.addEventListener('click', function (event) {
      var trigger = event.target && event.target.closest ? event.target.closest('[data-expand-word]') : null;
      if (!trigger) return;
      event.preventDefault();
      openWordExpansion(trigger.getAttribute('data-expand-word'));
    });

    document.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-answer-index]') : null;
      if (!button) return;
      event.preventDefault();
      var index = Number(button.getAttribute('data-answer-index'));
      button.disabled = true;
      button.textContent = '生成中…';
      fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/reading/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ index: index }),
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '生成参考答案失败');
          var details = document.createElement('details');
          details.className = 'note-answer';
          var summary = document.createElement('summary');
          summary.textContent = '参考答案';
          var answer = document.createElement('p');
          answer.textContent = data.answer;
          details.appendChild(summary);
          details.appendChild(answer);
          button.replaceWith(details);
        });
      }).catch(function (error) {
        button.disabled = false;
        button.textContent = '看参考答案';
        showToast(error.message);
      });
    });

    function loadExerciseTranslation(details) {
      if (!editable || details.dataset.translationLoaded === '1') return;
      var kind = details.getAttribute('data-exercise-kind');
      var index = Number(details.getAttribute('data-exercise-index'));
      var question = details.querySelector('.exercise-translation[data-role="question"]');
      var answer = details.querySelector('.exercise-translation[data-role="answer"]');
      if (question) question.textContent = '译文加载中…';
      fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/exercises/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: kind, index: index }),
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '译文加载失败');
          if (question) question.textContent = (kind === 'cloze' ? '题干译文：' : '题目译文：') + data.questionZh;
          if (answer && !answer.hidden && data.answerZh) answer.textContent = '答案译文：' + data.answerZh;
          details.dataset.translationLoaded = '1';
        });
      }).catch(function (error) {
        if (question) question.textContent = error.message;
      });
    }

    document.querySelectorAll('details[data-exercise-kind]').forEach(function (details) {
      details.addEventListener('toggle', function () {
        if (details.open) loadExerciseTranslation(details);
      });
    });
    if (!editable) {
      document.querySelectorAll('.exercise-translation').forEach(function (element) {
        if (/点击后加载/.test(element.textContent || '')) element.hidden = true;
      });
    }

    var editModal = document.getElementById('edit-modal');
    var editModalTitle = document.getElementById('edit-modal-title');
    var editModalText = document.getElementById('edit-modal-text');
    var editModalSave = document.getElementById('edit-modal-save');
    var editModalDelete = document.getElementById('edit-modal-delete');
    var editModalClose = document.getElementById('edit-modal-close');
    var editModalStatus = document.getElementById('edit-modal-status');
    var editTarget = { kind: null, index: null };

    function closeEditModal() {
      if (!editModal) return;
      editModal.hidden = true;
      document.body.classList.remove('edit-modal-open');
      editTarget = { kind: null, index: null };
    }

    function openEditModal(kind, index, text, label) {
      if (!editable) {
        showToast('请通过 pnpm dev review 打开学习包后再编辑');
        return;
      }
      if (!editModal || !editModalText) return;
      editTarget = { kind: kind, index: index };
      if (editModalTitle) editModalTitle.textContent = label;
      editModalText.value = text;
      if (editModalStatus) editModalStatus.textContent = '';
      if (editModalDelete) {
        editModalDelete.hidden = kind !== 'paragraph';
        editModalDelete.dataset.confirm = '';
        editModalDelete.textContent = '删除本段';
        editModalDelete.disabled = false;
      }
      if (editModalSave) {
        editModalSave.disabled = false;
        editModalSave.textContent = '保存并更新译文';
      }
      editModal.hidden = false;
      document.body.classList.add('edit-modal-open');
      editModalText.focus();
    }

    function saveEdit() {
      if (!editTarget.kind || !editModalText) return;
      var text = editModalText.value.trim();
      if (!text) {
        if (editModalStatus) editModalStatus.textContent = '内容不能为空';
        return;
      }
      if (editModalSave) {
        editModalSave.disabled = true;
        editModalSave.textContent = '正在重新翻译…';
      }
      if (editModalStatus) editModalStatus.textContent = '保存中，通常需要 10–30 秒…';
      fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/reading/edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: editTarget.kind, index: editTarget.index, text: text }),
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '保存失败');
          showToast('已保存并更新译文');
          location.reload();
        });
      }).catch(function (error) {
        if (editModalSave) {
          editModalSave.disabled = false;
          editModalSave.textContent = '保存并更新译文';
        }
        if (editModalStatus) editModalStatus.textContent = error.message;
      });
    }

    function deleteParagraph() {
      if (!editModalDelete) return;
      if (editTarget.kind !== 'paragraph') return;
      if (editModalDelete.dataset.confirm !== '1') {
        editModalDelete.dataset.confirm = '1';
        editModalDelete.textContent = '确认删除本段';
        return;
      }
      editModalDelete.disabled = true;
      if (editModalStatus) editModalStatus.textContent = '删除中…';
      fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/reading/edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'paragraph', index: editTarget.index, delete: true }),
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '删除失败');
          showToast('已删除本段');
          location.reload();
        });
      }).catch(function (error) {
        editModalDelete.disabled = false;
        if (editModalStatus) editModalStatus.textContent = error.message;
      });
    }

    if (editModalClose) editModalClose.addEventListener('click', closeEditModal);
    if (editModal) {
      editModal.addEventListener('click', function (event) {
        if (event.target === editModal) closeEditModal();
      });
    }
    if (editModalSave) editModalSave.addEventListener('click', saveEdit);
    if (editModalDelete) editModalDelete.addEventListener('click', deleteParagraph);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && editModal && !editModal.hidden) closeEditModal();
    });
    document.addEventListener('click', function (event) {
      var paragraphTrigger = event.target && event.target.closest ? event.target.closest('[data-edit-paragraph]') : null;
      if (paragraphTrigger) {
        event.preventDefault();
        var paragraphIndex = Number(paragraphTrigger.getAttribute('data-edit-paragraph'));
        var paragraph = document.querySelector('[data-para-index="' + paragraphIndex + '"]');
        var original = paragraph ? paragraph.querySelector('.original') : null;
        openEditModal(
          'paragraph',
          paragraphIndex,
          original ? original.textContent || '' : '',
          '编辑第 ' + (paragraphIndex + 1) + ' 段',
        );
        return;
      }
      var frontTrigger = event.target && event.target.closest ? event.target.closest('[data-edit-front]') : null;
      if (!frontTrigger) return;
      event.preventDefault();
      var kind = frontTrigger.getAttribute('data-edit-front');
      var element = kind === 'title' ? document.querySelector('.front-title') : document.querySelector('.front-lead');
      openEditModal(kind, null, element ? element.textContent || '' : '', kind === 'title' ? '编辑标题' : '编辑导语');
    });
    if (!editable) {
      document.querySelectorAll('[data-edit-paragraph],[data-edit-front]').forEach(function (button) {
        button.hidden = true;
      });
    }

    var noteModal = document.getElementById('note-modal');
    var noteModalClose = document.getElementById('note-modal-close');
    var noteModalSave = document.getElementById('note-modal-save');
    var noteModalRegenerate = document.getElementById('note-modal-regenerate');
    var noteModalAnswer = document.getElementById('note-modal-answer');
    var noteModalStatus = document.getElementById('note-modal-status');
    var noteTargetIndex = null;
    var noteInputs = {
      role: document.getElementById('note-role'),
      summary: document.getElementById('note-summary'),
      keySentence: document.getElementById('note-key'),
      keySentenceNote: document.getElementById('note-key-note'),
      grammar: document.getElementById('note-grammar'),
      background: document.getElementById('note-background'),
      question: document.getElementById('note-question'),
      answer: document.getElementById('note-answer')
    };

    function closeNoteModal() {
      if (!noteModal) return;
      noteModal.hidden = true;
      document.body.classList.remove('note-modal-open');
      noteTargetIndex = null;
    }

    function openNoteModal(index, note) {
      if (!editable) {
        showToast('请通过 pnpm dev review 打开学习包后再编辑笔记');
        return;
      }
      if (!noteModal) return;
      noteTargetIndex = index;
      Object.keys(noteInputs).forEach(function (key) {
        if (noteInputs[key]) noteInputs[key].value = note[key] || '';
      });
      if (noteModalStatus) noteModalStatus.textContent = '';
      if (noteModalAnswer) noteModalAnswer.disabled = !note.question;
      noteModal.hidden = false;
      document.body.classList.add('note-modal-open');
      if (noteInputs.summary) noteInputs.summary.focus();
    }

    function notePayload() {
      var note = {};
      Object.keys(noteInputs).forEach(function (key) {
        if (noteInputs[key]) note[key] = noteInputs[key].value.trim();
      });
      return note;
    }

    function saveNote() {
      if (noteTargetIndex === null) return;
      if (noteModalSave) { noteModalSave.disabled = true; noteModalSave.textContent = '保存中…'; }
      fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/reading/note', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ index: noteTargetIndex, note: notePayload() })
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '保存笔记失败');
          showToast('笔记已保存');
          location.reload();
        });
      }).catch(function (error) {
        if (noteModalSave) { noteModalSave.disabled = false; noteModalSave.textContent = '保存笔记'; }
        if (noteModalStatus) noteModalStatus.textContent = error.message;
      });
    }

    function regenerateNote() {
      if (noteTargetIndex === null) return;
      if (noteModalRegenerate) { noteModalRegenerate.disabled = true; noteModalRegenerate.textContent = '生成中…'; }
      if (noteModalStatus) noteModalStatus.textContent = '正在重新翻译并生成笔记，通常需要 10–30 秒…';
      fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/reading/note', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ index: noteTargetIndex, regenerate: true })
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '重新生成失败');
          showToast('本段笔记已重新生成');
          location.reload();
        });
      }).catch(function (error) {
        if (noteModalRegenerate) { noteModalRegenerate.disabled = false; noteModalRegenerate.textContent = 'AI 重新生成本段笔记'; }
        if (noteModalStatus) noteModalStatus.textContent = error.message;
      });
    }

    function regenerateNoteAnswer() {
      if (noteTargetIndex === null) return;
      if (noteModalAnswer) { noteModalAnswer.disabled = true; noteModalAnswer.textContent = '生成中…'; }
      if (noteModalStatus) noteModalStatus.textContent = '正在生成参考答案…';
      fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/reading/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ index: noteTargetIndex, regenerate: true })
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '生成参考答案失败');
          showToast('参考答案已更新');
          location.reload();
        });
      }).catch(function (error) {
        if (noteModalAnswer) { noteModalAnswer.disabled = false; noteModalAnswer.textContent = '重新生成答案'; }
        if (noteModalStatus) noteModalStatus.textContent = error.message;
      });
    }

    if (noteModalClose) noteModalClose.addEventListener('click', closeNoteModal);
    if (noteModal) {
      noteModal.addEventListener('click', function (event) {
        if (event.target === noteModal) closeNoteModal();
      });
    }
    if (noteModalSave) noteModalSave.addEventListener('click', saveNote);
    if (noteModalRegenerate) noteModalRegenerate.addEventListener('click', regenerateNote);
    if (noteModalAnswer) noteModalAnswer.addEventListener('click', regenerateNoteAnswer);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && noteModal && !noteModal.hidden) closeNoteModal();
    });
    document.addEventListener('click', function (event) {
      var trigger = event.target && event.target.closest ? event.target.closest('[data-edit-note]') : null;
      if (!trigger) return;
      event.preventDefault();
      var index = Number(trigger.getAttribute('data-edit-note'));
      var noteElement = trigger.closest('.para-note');
      var note = {};
      try { note = JSON.parse(noteElement.getAttribute('data-note') || '{}'); } catch (error) {}
      openNoteModal(index, note);
    });
    if (!editable) {
      document.querySelectorAll('[data-edit-note]').forEach(function (button) { button.hidden = true; });
    }

    var regenerateGuide = document.getElementById('regenerate-guide');
    if (regenerateGuide) {
      if (!editable) {
        regenerateGuide.hidden = true;
      } else {
        regenerateGuide.addEventListener('click', function () {
          regenerateGuide.disabled = true;
          regenerateGuide.textContent = '生成中…';
          showToast('正在压缩导读，通常需要 10–20 秒…');
          fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/reading-guide/regenerate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}'
          }).then(function (response) {
            return response.json().then(function (data) {
              if (!response.ok) throw new Error(data.error || '生成导读失败');
              showToast('导读已更新');
              location.reload();
            });
          }).catch(function (error) {
            regenerateGuide.disabled = false;
            regenerateGuide.textContent = '重写导读';
            showToast(error.message);
          });
        });
      }
    }

    if (repairReading) {
      if (!editable) {
        repairReading.hidden = true;
      } else {
        repairReading.addEventListener('click', function () {
          repairReading.disabled = true;
          repairReading.textContent = '修复中…';
          showToast('正在合并被截断的段落并重新翻译…');
          fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/repair-reading', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          }).then(function (response) {
            return response.json().then(function (data) {
              if (!response.ok) throw new Error(data.error || '修复失败');
              showToast(data.merged ? '已修复 ' + data.merged + ' 处段落' : '没有发现需要修复的段落');
              location.reload();
            });
          }).catch(function (error) {
            repairReading.disabled = false;
            repairReading.textContent = '修复分段';
            showToast(error.message);
          });
        });
      }
    }
    if (enrichReading) {
      if (!editable) {
        enrichReading.hidden = true;
      } else {
        enrichReading.addEventListener('click', function () {
          enrichReading.disabled = true;
          enrichReading.textContent = '生成中…';
          showToast('正在生成逐段精读笔记，通常需要 30–60 秒…');
          fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/enrich-reading', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          }).then(function (response) {
            return response.json().then(function (data) {
              if (!response.ok) throw new Error(data.error || '生成失败');
              showToast('精读笔记已生成，正在刷新…');
              location.reload();
            });
          }).catch(function (error) {
            enrichReading.disabled = false;
            enrichReading.textContent = '补齐导读与笔记';
            showToast(error.message);
          });
        });
      }
    }
    if (outputSave) {
      if (!editable) {
        outputSave.disabled = true;
        if (outputStatus) outputStatus.textContent = '通过 pnpm dev review 打开后可以保存';
      } else {
        outputSave.addEventListener('click', function () {
          var text = outputText ? outputText.value.trim() : '';
          if (!text) {
            showToast('先写下三句英文');
            if (outputText) outputText.focus();
            return;
          }
          outputSave.disabled = true;
          outputSave.textContent = '保存中…';
          if (outputStatus) outputStatus.textContent = '';
          fetch('/api/today/output', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              text: text,
              prompt: OUTPUT_PROMPT,
              answer: OUTPUT_ANSWER,
              packId: PACK_ID,
            }),
          }).then(function (response) {
            return response.json().then(function (data) {
              if (!response.ok) throw new Error(data.error || '保存失败');
              outputSave.textContent = '已保存';
              if (outputStatus) outputStatus.textContent = '已保存到「今日」的输出历史';
              showToast('输出已保存');
            });
          }).catch(function (error) {
            outputSave.disabled = false;
            outputSave.textContent = '保存输出';
            if (outputStatus) outputStatus.textContent = error.message;
            showToast(error.message);
          });
        });
      }
    }

    var focusMode = document.getElementById('focus-mode');
    var focusOpen = document.getElementById('focus-mode-open');
    var topFocus = document.getElementById('top-focus');
    var scrollProgress = document.getElementById('scroll-progress');
    var focusClose = document.getElementById('focus-close');
    var focusOriginal = document.getElementById('focus-original');
    var focusNote = document.getElementById('focus-note');
    var focusTranslationText = document.getElementById('focus-translation-text');
    var focusSentenceTranslationText = document.getElementById('focus-sentence-translation');
    var focusSentenceTranslationBtn = document.getElementById('focus-sentence-translation-btn');
    var focusItems = document.getElementById('focus-items');
    var focusKicker = document.getElementById('focus-kicker');
    var focusCount = document.getElementById('focus-count');
    var focusMeter = document.getElementById('focus-meter-fill');
    var focusPrev = document.getElementById('focus-prev');
    var focusNext = document.getElementById('focus-next');
    var focusTranslation = document.getElementById('focus-translation');
    var focusSpeak = document.getElementById('focus-speak');
    var focusMarkRead = document.getElementById('focus-mark-read');
    var focusFinish = document.getElementById('focus-finish');
    var focusAddSentence = document.getElementById('focus-add-sentence');
    var focusMerge = document.getElementById('focus-merge');
    var focusSplit = document.getElementById('focus-split');
    var splitModal = document.getElementById('split-modal');
    var splitModalText = document.getElementById('split-modal-text');
    var splitModalSave = document.getElementById('split-modal-save');
    var splitModalClose = document.getElementById('split-modal-close');
    var splitModalStatus = document.getElementById('split-modal-status');
    var focusSentences = [];
    var focusIndex = 0;
    var focusShowTranslation = false;
    var focusSentenceTranslations = {};
    var focusSentenceTranslationVisible = false;
    var focusLastText = '';
    var focusAddSentenceHandler = null;

    function rebuildFocusSentences() {
      focusSentences = [];
      FOCUS_PARAGRAPHS.forEach(function (paragraph) {
        paragraph.sentences.forEach(function (sentence, localIndex) {
          focusSentences.push({
            text: sentence.text,
            localIndex: localIndex,
            paragraphIndex: paragraph.index,
            translation: paragraph.translation,
            note: paragraph.note || sentence.note || null,
            items: sentence.items || [],
          });
        });
      });
    }
    rebuildFocusSentences();

    function focusParagraph(paragraphIndex) {
      for (var i = 0; i < FOCUS_PARAGRAPHS.length; i++) {
        if (FOCUS_PARAGRAPHS[i].index === paragraphIndex) return FOCUS_PARAGRAPHS[i];
      }
      return null;
    }

    function focusIndexFor(paragraphIndex, localIndex) {
      for (var i = 0; i < focusSentences.length; i++) {
        if (focusSentences[i].paragraphIndex === paragraphIndex && focusSentences[i].localIndex === localIndex) return i;
      }
      return focusIndex;
    }

    function dedupeFocusItems(lists) {
      var seen = {};
      var merged = [];
      lists.forEach(function (list) {
        (list || []).forEach(function (item) {
          if (!item || seen[item.id]) return;
          seen[item.id] = true;
          merged.push(item);
        });
      });
      return merged;
    }

    function saveSentenceBounds(paragraphIndex, texts, resolvedItems, focusLocalIndex, message) {
      var paragraph = focusParagraph(paragraphIndex);
      if (!paragraph) return;
      if (focusMerge) focusMerge.disabled = true;
      if (focusSplit) focusSplit.disabled = true;
      fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/reading/sentences', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ index: paragraphIndex, sentences: texts }),
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '断句保存失败');
          var saved = Array.isArray(data.sentences) ? data.sentences : texts;
          paragraph.sentences = saved.map(function (text, localIndex) {
            return {
              text: text,
              localIndex: localIndex,
              paragraphIndex: paragraphIndex,
              note: paragraph.note || null,
              items: resolvedItems[localIndex] || [],
            };
          });
          rebuildFocusSentences();
          renderFocus(focusIndexFor(paragraphIndex, focusLocalIndex));
          showToast(message);
        });
      }).catch(function (error) {
        showToast(error.message);
      }).then(function () {
        if (focusMerge) focusMerge.disabled = false;
        if (focusSplit) focusSplit.disabled = false;
      });
    }

    function mergeFocusSentence() {
      var current = focusCurrent();
      if (!current) return;
      var paragraph = focusParagraph(current.paragraphIndex);
      if (!paragraph || current.localIndex >= paragraph.sentences.length - 1) {
        showToast('已是本段最后一句');
        return;
      }
      var texts = paragraph.sentences.map(function (sentence) { return sentence.text; });
      var items = paragraph.sentences.map(function (sentence) { return sentence.items || []; });
      var mergedText = (texts[current.localIndex] + ' ' + texts[current.localIndex + 1])
        .replace(/\\s+/g, ' ')
        .trim();
      var mergedItems = dedupeFocusItems([items[current.localIndex], items[current.localIndex + 1]]);
      texts.splice(current.localIndex, 2, mergedText);
      items.splice(current.localIndex, 2, mergedItems);
      saveSentenceBounds(current.paragraphIndex, texts, items, current.localIndex, '已合并这两句');
    }

    function openSplitModal() {
      var current = focusCurrent();
      if (!current || !splitModal || !splitModalText) return;
      splitModalText.value = current.text;
      if (splitModalStatus) splitModalStatus.textContent = '';
      splitModal.hidden = false;
      splitModalText.focus();
      splitModalText.setSelectionRange(current.text.length, current.text.length);
    }

    function closeSplitModal() {
      if (splitModal) splitModal.hidden = true;
    }

    function saveSplitSentence() {
      var current = focusCurrent();
      if (!current) return;
      var paragraph = focusParagraph(current.paragraphIndex);
      if (!paragraph) return;
      var raw = splitModalText ? splitModalText.value : '';
      var parts = raw.split('|').map(function (part) {
        return part.replace(/\\s+/g, ' ').trim();
      }).filter(function (part) { return part.length > 0; });
      if (parts.length < 2) {
        if (splitModalStatus) splitModalStatus.textContent = '请在要断开的位置插入 |';
        return;
      }
      var texts = paragraph.sentences.map(function (sentence) { return sentence.text; });
      var items = paragraph.sentences.map(function (sentence) { return sentence.items || []; });
      var splitItems = parts.map(function (part) {
        var lower = part.toLowerCase();
        return current.items.filter(function (item) {
          return item.lemma && lower.indexOf(String(item.lemma).toLowerCase()) !== -1;
        });
      });
      texts.splice(current.localIndex, 1, ...parts);
      items.splice(current.localIndex, 1, ...splitItems);
      closeSplitModal();
      saveSentenceBounds(current.paragraphIndex, texts, items, current.localIndex, '已按新断点拆分');
    }

    if (splitModalSave) splitModalSave.addEventListener('click', saveSplitSentence);
    if (splitModalClose) splitModalClose.addEventListener('click', closeSplitModal);
    if (splitModal) {
      splitModal.addEventListener('click', function (event) {
        if (event.target === splitModal) closeSplitModal();
      });
    }
    if (splitModalText) {
      splitModalText.addEventListener('keydown', function (event) {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          saveSplitSentence();
        }
      });
    }
    if (focusMerge) focusMerge.addEventListener('click', mergeFocusSentence);
    if (focusSplit) focusSplit.addEventListener('click', openSplitModal);
    if (focusMerge) focusMerge.hidden = !editable;
    if (focusSplit) focusSplit.hidden = !editable;

    function focusCurrent() {
      return focusSentences[focusIndex];
    }

    function renderFocus(index) {
      if (focusSentences.length === 0) return;
      focusIndex = Math.max(0, Math.min(focusSentences.length - 1, index));
      var current = focusCurrent();
      if (!current) return;
      if (focusLastText !== current.text) {
        focusLastText = current.text;
        focusSentenceTranslationVisible = false;
      }
      focusOriginal.textContent = current.text;
      focusTranslationText.textContent = current.translation
        ? '本段译文：' + current.translation
        : '本段暂无译文';
      focusTranslationText.hidden = !focusShowTranslation;
      focusTranslation.textContent = focusShowTranslation ? '隐藏译文' : '显示译文';
      var sentenceTranslation = focusSentenceTranslations[current.text] || '';
      focusSentenceTranslationText.textContent = sentenceTranslation ? '本句译文：' + sentenceTranslation : '';
      focusSentenceTranslationText.hidden = !(sentenceTranslation && focusSentenceTranslationVisible);
      focusSentenceTranslationBtn.textContent = sentenceTranslation
        ? (focusSentenceTranslationVisible ? '隐藏本句译文' : '显示本句译文')
        : '翻译本句';
      focusSentenceTranslationBtn.disabled = false;
      if (focusNote) {
        if (current.note) {
          var noteBits = [];
          if (current.note.role) noteBits.push(current.note.role);
          if (current.note.summary) noteBits.push(current.note.summary);
          if (current.note.grammar) noteBits.push('语法：' + current.note.grammar);
          focusNote.textContent = noteBits.join(' · ');
          focusNote.hidden = noteBits.length === 0;
        } else {
          focusNote.textContent = '';
          focusNote.hidden = true;
        }
      }
      focusKicker.textContent = '第 ' + (current.paragraphIndex + 1) + ' 段 · 单句精读';
      focusCount.textContent = (focusIndex + 1) + ' / ' + focusSentences.length;
      focusMeter.style.width = (((focusIndex + 1) / focusSentences.length) * 100) + '%';
      focusPrev.disabled = focusIndex === 0;
      focusNext.disabled = focusIndex >= focusSentences.length - 1;
      focusItems.innerHTML = '';
      current.items.forEach(function (item) {
        var chip = document.createElement('span');
        chip.className = 'focus-chip';
        var word = document.createElement('b');
        word.textContent = item.lemma;
        chip.appendChild(word);
        chip.appendChild(document.createTextNode(item.definitionZh || ''));
        focusItems.appendChild(chip);
      });
      focusMarkRead.textContent = readingState.read.indexOf(current.paragraphIndex) !== -1
        ? '本段已读 ✓'
        : '本段已读';
      readingState.lastSentence = focusIndex;
      readingState.last = current.paragraphIndex;
      queueReadingSave();
    }

    function openFocus(start) {
      if (!focusMode || focusSentences.length === 0) return;
      document.body.classList.add('focus-open');
      focusMode.hidden = false;
      focusMode.scrollTop = 0;
      var initial = typeof start === 'number' ? start : (readingState.lastSentence || 0);
      if (!Number.isFinite(initial) || initial >= focusSentences.length) initial = 0;
      renderFocus(initial);
    }

    function openFocusAtParagraph(paragraphIndex) {
      for (var i = 0; i < focusSentences.length; i++) {
        if (focusSentences[i].paragraphIndex === paragraphIndex) {
          openFocus(i);
          return;
        }
      }
      openFocus();
    }

    function closeFocus() {
      if (!focusMode) return;
      focusMode.hidden = true;
      document.body.classList.remove('focus-open');
      var current = focusCurrent();
      if (current) {
        var anchor = document.getElementById('p-' + String(current.paragraphIndex + 1).padStart(2, '0'));
        if (anchor) anchor.scrollIntoView({ block: 'start' });
      }
    }

    function focusNextSentence() {
      if (focusIndex >= focusSentences.length - 1) return;
      var current = focusCurrent();
      var next = focusSentences[focusIndex + 1];
      if (current && next && next.paragraphIndex !== current.paragraphIndex &&
          readingState.read.indexOf(current.paragraphIndex) === -1) {
        toggleParagraph(current.paragraphIndex);
      }
      renderFocus(focusIndex + 1);
    }

    function focusPrevSentence() {
      if (focusIndex <= 0) return;
      renderFocus(focusIndex - 1);
    }

    function focusSpeakSentence() {
      var current = focusCurrent();
      if (!current) return;
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
        showToast('当前浏览器不支持发音');
        return;
      }
      window.speechSynthesis.cancel();
      var utterance = new SpeechSynthesisUtterance(current.text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }

    function toggleFocusSentenceTranslation() {
      var current = focusCurrent();
      if (!current) return;
      var cached = focusSentenceTranslations[current.text];
      if (cached) {
        focusSentenceTranslationVisible = !focusSentenceTranslationVisible;
        renderFocus(focusIndex);
        return;
      }
      focusSentenceTranslationBtn.disabled = true;
      focusSentenceTranslationBtn.textContent = '翻译中…';
      fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/translate-sentence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sentence: current.text }),
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '翻译失败');
          focusSentenceTranslations[current.text] = data.translation;
          focusSentenceTranslationVisible = true;
          renderFocus(focusIndex);
        });
      }).catch(function (error) {
        focusSentenceTranslationBtn.disabled = false;
        focusSentenceTranslationBtn.textContent = '翻译本句';
        showToast(error.message);
      });
    }

    if (focusOpen) focusOpen.addEventListener('click', function () { openFocus(); });
    if (topFocus) topFocus.addEventListener('click', function () { openFocus(); });
    document.addEventListener('click', function (event) {
      var trigger = event.target && event.target.closest ? event.target.closest('[data-focus-para]') : null;
      if (!trigger) return;
      openFocusAtParagraph(Number(trigger.getAttribute('data-focus-para')));
    });
    if (focusClose) focusClose.addEventListener('click', closeFocus);
    if (!editable && focusAddSentence) focusAddSentence.hidden = true;
    if (focusPrev) focusPrev.addEventListener('click', focusPrevSentence);
    if (focusNext) focusNext.addEventListener('click', focusNextSentence);
    if (focusSpeak) focusSpeak.addEventListener('click', focusSpeakSentence);
    if (focusSentenceTranslationBtn) {
      focusSentenceTranslationBtn.addEventListener('click', toggleFocusSentenceTranslation);
    }
    if (focusTranslation) {
      focusTranslation.addEventListener('click', function () {
        focusShowTranslation = !focusShowTranslation;
        renderFocus(focusIndex);
      });
    }
    if (focusMarkRead) {
      focusMarkRead.addEventListener('click', function () {
        var current = focusCurrent();
        if (!current) return;
        toggleParagraph(current.paragraphIndex);
        renderFocus(focusIndex);
      });
    }
    if (focusFinish) {
      focusFinish.addEventListener('click', function () {
        finishReading();
        closeFocus();
      });
    }
    if (focusAddSentence) {
      focusAddSentence.addEventListener('click', function () {
        var current = focusCurrent();
        if (!current || !focusAddSentenceHandler) return;
        focusAddSentenceHandler(current.text);
      });
    }
    document.addEventListener('keydown', function (event) {
      if (!focusMode || focusMode.hidden) return;
      if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); focusNextSentence(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); focusPrevSentence(); }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (splitModal && !splitModal.hidden) { closeSplitModal(); return; }
        closeFocus();
      }
    });
    var focusParam = new URLSearchParams(location.search).get('focus');
    if (focusParam === '1') {
      if (readingPromise && readingPromise.then) {
        readingPromise.then(function () { openFocus(); });
      } else {
        openFocus();
      }
    }

    if (scrollProgress) {
      var updateScrollProgress = function () {
        var root = document.documentElement;
        var total = root.scrollHeight - window.innerHeight;
        var percent = total > 0 ? Math.min(100, Math.max(0, (window.scrollY / total) * 100)) : 0;
        scrollProgress.style.width = percent + '%';
      };
      window.addEventListener('scroll', updateScrollProgress, { passive: true });
      window.addEventListener('resize', updateScrollProgress);
      updateScrollProgress();
    }


    if (READING_TOTAL && editable && typeof IntersectionObserver !== 'undefined') {
      var paragraphObserver = new IntersectionObserver(function (entries) {
        if (readingState.finished) return;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var index = Number(entry.target.getAttribute('data-para-index'));
          if (!Number.isFinite(index) || index === readingState.last) return;
          readingState.last = index;
          queueReadingSave();
        });
      }, { threshold: 0.55 });
      document.querySelectorAll('.paragraph[data-para-index]').forEach(function (paragraph) {
        paragraphObserver.observe(paragraph);
      });
    }

    document.querySelectorAll('[data-feedback]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (!editable) {
          showToast('请通过 pnpm dev review 打开学习包后再反馈');
          return;
        }
        var direction = button.getAttribute('data-feedback');
        document.querySelectorAll('[data-feedback]').forEach(function (entry) { entry.disabled = true; });
        fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/feedback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ direction: direction }),
        }).then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok) throw new Error(data.error || '反馈失败');
            showToast(direction === 'more' ? '已记录：下次多选几项' : '已记录：下次少选几项');
          });
        }).catch(function (error) {
          showToast(error.message);
          document.querySelectorAll('[data-feedback]').forEach(function (entry) { entry.disabled = false; });
        });
      });
    });

    document.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-adopt]') : null;
      if (!button) return;
      if (!editable) {
        showToast('请通过 pnpm dev review 打开学习包后再加入复习');
        return;
      }
      button.disabled = true;
      fetch('/api/packs/' + encodeURIComponent(PACK_ID) + '/adopt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: button.getAttribute('data-adopt') }),
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || '加入失败');
          showToast('已加入复习，正在刷新…');
          setTimeout(function () { location.reload(); }, 600);
        });
      }).catch(function (error) {
        button.disabled = false;
        showToast(error.message);
      });
    });

    function showToast(message) {
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2400);
    }

    document.querySelectorAll('[data-favorite]').forEach(function (button) {
      var id = button.getAttribute('data-favorite');
      if (favorites.has(id)) button.classList.add('active');
      button.addEventListener('click', function () {
        if (favorites.has(id)) favorites.delete(id);
        else favorites.add(id);
        button.classList.toggle('active');
        localStorage.setItem(storageKey, JSON.stringify(Array.from(favorites)));
      });
    });

    var pendingRemove = null;
    var pendingTimer;
    function resetRemove(button) {
      button.textContent = '×';
      button.classList.remove('confirming');
    }

    document.querySelectorAll('[data-remove]').forEach(function (button) {
      if (!editable) { button.style.display = 'none'; return; }
      button.addEventListener('click', function () {
        var id = button.getAttribute('data-remove');
        if (pendingRemove !== id) {
          if (pendingRemove) {
            var previous = document.querySelector('[data-remove="' + pendingRemove + '"]');
            if (previous) resetRemove(previous);
          }
          pendingRemove = id;
          clearTimeout(pendingTimer);
          button.textContent = '确认';
          button.classList.add('confirming');
          pendingTimer = setTimeout(function () {
            if (pendingRemove === id) {
              pendingRemove = null;
              resetRemove(button);
            }
          }, 2600);
          return;
        }

        clearTimeout(pendingTimer);
        pendingRemove = null;
        resetRemove(button);
        fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/remove', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ itemId: id })
        }).then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok) throw new Error(data.error || '移除失败');
            location.reload();
          });
        }).catch(function (error) { showToast(error.message); });
      });
    });

    var form = document.getElementById('add-word');
    if (form) {
      if (!editable) {
        form.innerHTML = '<span class="muted">通过 pnpm dev review 打开以添加单词</span>';
      } else {
        var input = document.getElementById('add-word-input');
        var status = document.getElementById('add-status');
        var submit = document.getElementById('add-word-submit');
        var jump = document.getElementById('jump-add');
        if (jump) {
          jump.addEventListener('click', function () {
            var panel = document.getElementById('add-panel');
            if (panel) panel.scrollIntoView({ behavior: 'smooth' });
            showToast('在原文中选中单词或短语即可添加');
          });
        }
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          if (form.dataset.busy === '1') return;
          var word = input.value.trim();
          if (!word) {
            showToast('请输入一个单词或短语');
            return;
          }
          form.dataset.busy = '1';
          status.textContent = '生成中…';
          showToast('正在生成，请稍候…');
          if (submit) {
            submit.disabled = true;
            submit.textContent = '生成中…';
          }
          fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/add', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ word: word, source: 'manual' })
          }).then(function (response) {
            return response.json().then(function (data) {
              if (!response.ok) throw new Error(data.error || '添加失败');
              location.reload();
            });
          }).catch(function (error) {
            form.dataset.busy = '';
            status.textContent = error.message;
            showToast(error.message);
            if (submit) {
              submit.disabled = false;
              submit.textContent = '生成学习卡';
            }
          });
        });
      }
    }

    if (editable) {
      var pop = document.getElementById('select-pop');
      var knownLemmas = new Set(${JSON.stringify(pack.items.map((item) => item.lemma.toLowerCase()))});
      var selectionToken = 0;

      function hidePop() {
        if (pop) pop.hidden = true;
      }

      function selectionInOriginal(selection) {
        if (!selection || selection.rangeCount === 0) return null;
        var range = selection.getRangeAt(0);
        var node = range.commonAncestorContainer;
        var element = node && node.nodeType === 3 ? node.parentElement : node;
        return element && element.closest ? element.closest('.original') : null;
      }

      function selectionTarget(selection) {
        var original = selectionInOriginal(selection);
        if (!original) return null;
        var paragraph = original.closest('[data-para-index]');
        var paragraphIndex = paragraph ? Number(paragraph.getAttribute('data-para-index')) : undefined;
        return {
          original: original,
          front: original.getAttribute('data-source') === 'front',
          paragraphIndex: Number.isFinite(paragraphIndex) ? paragraphIndex : undefined,
        };
      }

      function positionPop(rect) {
        if (!pop) return;
        pop.hidden = false;
        var height = pop.offsetHeight || 44;
        var width = pop.offsetWidth || 240;
        var top = rect.top - height - 8;
        if (top < 8) top = rect.bottom + 8;
        if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8);
        var left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left));
        pop.style.top = top + 'px';
        pop.style.left = left + 'px';
      }

      function createButton(label, onClick) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
      }

      function addWords(words, target) {
        var unique = [];
        words.forEach(function (word) {
          var clean = word.trim();
          if (clean && unique.indexOf(clean) === -1) unique.push(clean);
        });
        var pending = unique.filter(function (word) { return !knownLemmas.has(word.toLowerCase()); });
        if (pending.length === 0) {
          showToast('这些词已经在学习包中');
          return;
        }
        var buttons = pop ? pop.querySelectorAll('button') : [];
        buttons.forEach(function (button) { button.disabled = true; });

        var targetPayload = {};
        if (target && target.front) targetPayload.source = 'front';
        else if (target && typeof target.paragraphIndex === 'number') targetPayload.paragraphIndex = target.paragraphIndex;

        var index = 0;
        function step() {
          if (index >= pending.length) {
            location.reload();
            return;
          }
          var word = pending[index];
          showToast('生成中 ' + (index + 1) + '/' + pending.length + '：' + word);
          fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/add', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(Object.assign({ word: word }, targetPayload))
          }).then(function (response) {
            return response.json().then(function (data) {
              if (!response.ok) throw new Error(data.error || '添加失败');
              index++;
              step();
            });
          }).catch(function (error) {
            showToast(error.message);
            buttons.forEach(function (button) { button.disabled = false; });
          });
        }
        step();
      }

      function addSentence(sentence, button, keepOpen) {
        if (button) {
          button.disabled = true;
          button.textContent = '生成句子卡中…';
        }        if (pop) {
          pop.querySelectorAll('button').forEach(function (entry) { entry.disabled = true; });
        }
        showToast('正在生成句子卡，通常需要 20–40 秒…');
        fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/sentence', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sentence: sentence })
        }).then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok) throw new Error(data.error || '生成句子卡失败');
            if (data.duplicate) {
              showToast('这句话已经在句子卡中');
              hidePop();
              if (button) {
                button.disabled = false;
                button.textContent = keepOpen ? '已在句子卡中' : '加入句子卡';
              }
              return;
            }
            if (keepOpen) {
              showToast('已加入句子卡，继续精读');
              if (button) {
                button.disabled = false;
                button.textContent = '已加入句子卡';
              }
              if (pop) {
                pop.querySelectorAll('button').forEach(function (entry) { entry.disabled = false; });
              }
              return;
            }
            location.reload();
          });
        }).catch(function (error) {
          showToast(error.message);
          if (button) {
            button.disabled = false;
            button.textContent = '加入句子卡';
          }
          if (pop) {
            pop.querySelectorAll('button').forEach(function (entry) { entry.disabled = false; });
          }
        });
      }

      focusAddSentenceHandler = function (sentence) {
        addSentence(sentence, focusAddSentence, true);
      };

      function renderOptions(text, analysis, rect, target) {        if (!pop) return;
        pop.innerHTML = '';

        var label = document.createElement('div');
        label.className = 'select-label';
        label.textContent = '选中：' + text;
        pop.appendChild(label);

        if (analysis.meaningZh) {
          var meaning = document.createElement('div');
          meaning.className = 'select-meaning';
          meaning.textContent = analysis.meaningZh;
          pop.appendChild(meaning);
        }
        if (analysis.translation) {
          var translation = document.createElement('div');
          translation.className = 'select-translation';
          translation.textContent = '译文：' + analysis.translation;
          pop.appendChild(translation);
        }
        if (analysis.annotation) {
          var annotation = document.createElement('div');
          annotation.className = 'select-annotation';
          annotation.textContent = '注释：' + analysis.annotation;
          pop.appendChild(annotation);
        }
        if (analysis.examples && analysis.examples.length) {
          var examples = document.createElement('div');
          examples.className = 'select-examples';
          examples.textContent = '例：' + analysis.examples.join(' / ');
          pop.appendChild(examples);
        }

        var parts = [];
        (analysis.parts || []).forEach(function (part) {
          var value = (part && part.text ? part.text : '').trim();
          if (value && parts.indexOf(value) === -1) parts.push(value);
        });
        if (parts.length === 0 && text.split(/\\s+/).length > 1) {
          parts = fallbackAnalysis(text).parts.map(function (part) { return part.text; });
        }

        var wholeText = ((analysis.phrase || text) + '').trim();
        var wholeKnown = knownLemmas.has(wholeText.toLowerCase()) || knownLemmas.has(text.toLowerCase());
        var allPartsKnown = parts.length > 0 && parts.every(function (word) { return knownLemmas.has(word.toLowerCase()); });
        var isSentence = analysis.kind === 'sentence' || text.split(/\\s+/).length >= 5 || /[.!?]["']?$/.test(text);
        var sentenceButton = null;

        if (isSentence) {
          var shortText = text.length > 34 ? text.slice(0, 31) + '…' : text;
          sentenceButton = createButton('加入句子卡「' + shortText + '」', function () {
            addSentence(text, sentenceButton);
          });
        }

        var wholeButton = createButton(
          wholeKnown ? '已在学习包：' + wholeText : '整体添加「' + wholeText + '」',
          function () { addWords([wholeText], target); }
        );
        wholeButton.disabled = wholeKnown;

        var separateButton = null;
        if (parts.length > 0) {
          separateButton = createButton(
            allPartsKnown ? '分别在包内：' + parts.join(' / ') : '分别添加：' + parts.join(' / '),
            function () { addWords(parts, target); }
          );
          separateButton.disabled = allPartsKnown;
        }

        if (isSentence) {
          if (sentenceButton) pop.appendChild(sentenceButton);
          if (separateButton) pop.appendChild(separateButton);
        } else if (analysis.recommendation === 'separate' && separateButton) {
          pop.appendChild(separateButton);
          pop.appendChild(wholeButton);
        } else {
          pop.appendChild(wholeButton);
          if (separateButton) pop.appendChild(separateButton);
        }

        positionPop(rect);
      }

      function renderLoading(text, rect) {
        if (!pop) return;
        pop.innerHTML = '';
        var label = document.createElement('div');
        label.className = 'select-label';
        label.textContent = '选中：' + text;
        pop.appendChild(label);
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = '分析中…';
        button.disabled = true;
        pop.appendChild(button);
        positionPop(rect);
      }

      function fallbackAnalysis(text) {
        var stop = new Set('a an the and or but if because as at by for from in into of on onto to with without is are was were be been has have had do does did will would can could should may might not no it its this that these those he she they we you i his her their our your my me him them us'.split(' '));
        var parts = [];
        text.split(/\\s+/).forEach(function (token) {
          var clean = token.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
          if (clean && !stop.has(clean.toLowerCase()) && parts.indexOf(clean) === -1) parts.push(clean);
        });
        return {
          isMeaningfulPhrase: false,
          kind: 'unknown',
          parts: parts.map(function (word) { return { text: word }; }),
          recommendation: parts.length > 1 ? 'separate' : 'phrase',
          meaningZh: ''
        };
      }

      function analyze(text, rect, token, target) {
        fetch('/api/pack/' + encodeURIComponent(PACK_ID) + '/analyze-selection', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            text: text,
            context: target && target.original ? target.original.textContent || '' : ''
          })
        }).then(function (response) {
          return response.json().then(function (data) {
            if (token !== selectionToken) return;
            if (!response.ok) throw new Error(data.error || '分析失败');
            renderOptions(text, data.analysis || fallbackAnalysis(text), rect, target);
          });
        }).catch(function () {
          if (token !== selectionToken) return;
          showToast('分析失败，已按内容词拆分');
          renderOptions(text, fallbackAnalysis(text), rect, target);
        });
      }

      function handleSelection() {
        if (!pop) return;
        var selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
          var range = selection.getRangeAt(0);
          var startNode = range.startContainer;
          var endNode = range.endContainer;
          if (startNode.nodeType === 3) {
            var startText = startNode.textContent || '';
            var startOffset = range.startOffset;
            while (startOffset > 0 && /[A-Za-z'’\\-]/.test(startText.charAt(startOffset - 1))) startOffset--;
            range.setStart(startNode, startOffset);
          }
          if (endNode.nodeType === 3) {
            var endText = endNode.textContent || '';
            var endOffset = range.endOffset;
            while (endOffset < endText.length && /[A-Za-z'’\\-]/.test(endText.charAt(endOffset))) endOffset++;
            range.setEnd(endNode, endOffset);
          }
          selection.removeAllRanges();
          selection.addRange(range);
        }
        var text = selection ? selection.toString().replace(/\\s+/g, ' ').trim() : '';
        text = text.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
        var target = selectionTarget(selection);
        if (
          !text ||
          text.length > 500 ||
          text.split(/\\s+/).length > 60 ||
          !/^[A-Za-z][A-Za-z0-9'’“”".,;:!?()\\-— ]*$/.test(text) ||
          !target
        ) {
          hidePop();
          return;
        }
        var rect = selection.getRangeAt(0).getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          hidePop();
          return;
        }

        var token = ++selectionToken;
        renderLoading(text, rect);
        analyze(text, rect, token, target);
      }

      document.addEventListener('mouseup', function () { setTimeout(handleSelection, 0); });
      document.addEventListener('keyup', function (event) {
        if (event.key === 'Shift' || event.key.indexOf('Arrow') === 0) setTimeout(handleSelection, 0);
      });
      document.addEventListener('mousedown', function (event) {
        if (pop && !pop.contains(event.target)) hidePop();
      });
      window.addEventListener('scroll', hidePop, true);
    }
  })();
</script>
</body>
</html>`
}
