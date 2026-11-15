import { sentences } from '../analyze/tokenize.js'
import { themeBootScript } from '../theme.js'
import type { LearningPack } from '../types.js'
import { pwaHead } from './pwa.js'
import type { ReadingProgress } from '../reading/progress.js'

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface ChapterLink {
  id: string
  title: string
  url: string
  index: number
}

export interface ChapterNav {
  index: number | null
  total: number
  resourceTitle: string
  previous: ChapterLink | null
  next: ChapterLink | null
}

export function renderReaderApp(
  pack: LearningPack,
  progress: ReadingProgress,
  record: { id: string },
  chapter?: ChapterNav | null,
): string {
  const title = pack.frontMatter?.title ?? pack.title
  const titleZh = pack.frontMatter?.titleZh ?? ''
  const read = new Set(progress.readParagraphs)
  const total = pack.reading?.length ?? 0
  const percent = total > 0 ? Math.round((read.size / total) * 100) : 0
  const firstUnread = (pack.reading ?? []).find((paragraph) => !read.has(paragraph.index))
  const continueIndex = firstUnread?.index ?? 0
  const words = pack.items.filter((item) => item.type !== 'sentence').slice(0, 14)
  const annotations = progress.annotations ?? []
  const outline = (pack.reading ?? []).map((paragraph, index) => ({
    index,
    number: String(index + 1).padStart(2, '0'),
    label: paragraph.original.replace(/\s+/g, ' ').trim().slice(0, 46),
    role: paragraph.note?.role ?? '',
  }))
  const outlineMarkup = outline.length
    ? outline
        .map(
          (entry) =>
            `<a href="#p-${entry.number}" data-outline-link><span>${entry.number}</span><b>${escapeHtml(entry.label)}${entry.label.length >= 46 ? '…' : ''}</b>${
              entry.role ? `<em>${escapeHtml(entry.role)}</em>` : ''
            }</a>`,
        )
        .join('')
    : '<p class="muted">这篇文章还没有分段。</p>'
  const paragraphs = (pack.reading ?? [])
    .map((paragraph, index) => {
      const isRead = read.has(paragraph.index)
      const wordChips = pack.items
        .filter((item) => paragraph.itemIds.includes(item.id))
        .slice(0, 5)
        .map((item) => `<span class="r-word-chip" title="${escapeHtml(item.definitionZh ?? item.definition)}">${escapeHtml(item.lemma)}</span>`)
        .join('')
      const note = paragraph.note
      const noteMarkup = note
        ? `<details class="r-note">
            <summary>精读笔记${note.role ? ' · ' + escapeHtml(note.role) : ''}</summary>
            <div class="r-note-body">
              ${note.summary ? `<p>${escapeHtml(note.summary)}</p>` : ''}
              ${note.keySentence ? `<p class="r-note-key">“${escapeHtml(note.keySentence)}”</p>` : ''}
              ${note.keySentenceNote ? `<p class="r-note-muted">${escapeHtml(note.keySentenceNote)}</p>` : ''}
              ${note.grammar ? `<p><b>语法</b> ${escapeHtml(note.grammar)}</p>` : ''}
              ${note.background ? `<p><b>背景</b> ${escapeHtml(note.background)}</p>` : ''}
              ${
                note.connectors?.length
                  ? `<p><b>连接</b> ${note.connectors.map((entry) => escapeHtml(entry.text)).join(' · ')}</p>`
                  : ''
              }
              ${
                note.question
                  ? `<div class="r-note-question"><b>想一想</b><p>${escapeHtml(note.question)}</p>${
                      note.answer
                        ? `<details><summary>参考答案</summary><p>${escapeHtml(note.answer)}</p></details>`
                        : ''
                    }</div>`
                  : ''
              }
            </div>
          </details>`
        : ''
      const parts = paragraph.customSentences?.length ? paragraph.customSentences : sentences(paragraph.original)
      const normalized = paragraph.original.replace(/\s+/g, ' ').trim()
      const canSplit = parts.length > 0 && parts.join(' ') === normalized
      const original = canSplit
        ? parts
            .map(
              (part, sentenceIndex) =>
                `<span class="r-sentence" data-para="${paragraph.index}" data-sentence="${sentenceIndex}" role="button" tabindex="0" title="点击听这一句">${escapeHtml(part)}</span>`,
            )
            .join(' ')
        : escapeHtml(paragraph.original)
      return `<section class="r-para${isRead ? ' is-read' : ''}" id="p-${String(index + 1).padStart(2, '0')}" data-para="${paragraph.index}">
        <div class="r-para-head">
          <span class="r-num">${String(index + 1).padStart(2, '0')}</span>
          <button class="r-mark" type="button" data-mark="${paragraph.index}">${isRead ? '✓ 已读' : '标记已读'}</button>
        </div>
        <p class="r-original">${original}</p>
        ${paragraph.translation ? `<div class="r-translation" data-translation="${paragraph.index}" hidden><p>${escapeHtml(paragraph.translation)}</p></div>` : ''}
        ${wordChips ? `<div class="r-words">${wordChips}</div>` : ''}
        ${paragraph.translation ? `<button class="r-translate" type="button" data-translate="${paragraph.index}">显示翻译</button>` : ''}
        ${noteMarkup}
      </section>`
    })
    .join('')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(title)} · CloseRead</title>
${themeBootScript()}
${pwaHead()}
<link rel="stylesheet" href="/reader.css">
</head>
<body data-pack-id="${escapeHtml(record.id)}" data-total="${total}" data-read="${[...read].join(',')}" data-finished="${progress.finishedAt ? '1' : '0'}">
<a class="skip-link" href="#main-content">跳到正文</a>
<div class="app-shell reader-shell">
  <aside class="sidebar">
    <a class="brand" href="/" aria-label="CloseRead 首页"><span class="brand-mark">CR</span><span class="brand-copy">CloseRead<small>learning studio</small></span></a>
    <a class="side-import" href="/?tab=import">＋ 导入文章</a>
    <div class="side-label">学习</div>
    <nav class="side-nav">
      <a class="nav-link active" href="/?tab=read"><span class="nav-icon">◉</span><span>精读</span></a>
      <a class="nav-link" href="/?tab=packs"><span class="nav-icon">▦</span><span>文章</span></a>
    </nav>
    <details class="side-more">
      <summary>更多</summary>
      <nav class="side-nav side-more-list">
        <a class="nav-link" href="/?tab=passport"><span class="nav-icon">◈</span><span>成长</span></a>
        <a class="nav-link" href="/?tab=insights"><span class="nav-icon">▥</span><span>复盘</span></a>
      </nav>
    </details>
    <div class="sidebar-spacer"></div>
    <div class="reader-side-meta">${escapeHtml(pack.difficulty.cefr)} · ${pack.stats.wordCount} 词<br>${total} 段 · ${pack.stats.readingMinutes} 分钟</div>
  </aside>
  <div class="app-main">
    <header class="topbar">
      <div class="topbar-title"><span class="topbar-eyebrow">INTENSIVE READING</span><h1>精读</h1></div>
      <div class="topbar-actions">
        <button class="icon-btn" id="reader-theme" type="button">自动</button>
        <button class="btn btn-primary" id="reader-finish" type="button">${progress.finishedAt ? '已完成' : '完成精读'}</button>
      </div>
    </header>
    <main class="reader-main" id="main-content" tabindex="-1">
      <section class="reader-hero">
        <div class="reader-kicker">${escapeHtml(pack.difficulty.cefr)} · ${pack.stats.wordCount} WORDS · ${pack.stats.readingMinutes} MIN</div>
        <h1>${escapeHtml(title)}</h1>
        ${titleZh ? `<p class="reader-title-zh">${escapeHtml(titleZh)}</p>` : ''}
        <div class="reader-progress-row"><div class="reader-track"><span id="reader-fill" style="width:${percent}%"></span></div><span id="reader-percent">${percent}%</span></div>
        <div class="reader-hero-actions">
          <a class="btn btn-primary" href="#p-${String(continueIndex + 1).padStart(2, '0')}">${progress.startedAt ? '继续精读' : '开始精读'}</a>
          ${pack.reading?.length ? `<button class="btn" id="reader-sentence-start" type="button">▶ 逐句听</button>` : ''}
          ${pack.reading?.length ? `<button class="btn" id="reader-audio" type="button"${pack.audio?.reading ? ` data-src="/pack/${encodeURIComponent(record.id)}/${escapeHtml(pack.audio.reading)}"` : ''}>▶ 听全文</button>` : ''}
          <button class="btn" id="reader-focus" type="button" aria-pressed="false">专注</button>
          <button class="btn" id="reader-outline" type="button" aria-expanded="false">目录</button>
          <button class="btn" id="reader-type" type="button" aria-expanded="false">Aa</button>
          <button class="btn" id="reader-help" type="button" aria-expanded="false">快捷键</button>
        </div>
        <details class="reader-more-tools">
          <summary>更多阅读工具</summary>
          <div class="reader-more-actions">
            ${chapter?.previous ? `<a href="${escapeHtml(chapter.previous.url)}">← ${escapeHtml(chapter.previous.title)}</a>` : ''}
            ${chapter?.next ? `<a href="${escapeHtml(chapter.next.url)}">${escapeHtml(chapter.next.title)} →</a>` : ''}
          </div>
        </details>
        ${chapter ? `<p class="reader-chapter">${escapeHtml(chapter.resourceTitle)} · 第 ${chapter.index ?? '?'} / ${chapter.total} 篇</p>` : ''}
        <p class="reader-select-hint">选中一个词或一句话，可以直接加入词卡或句子卡；点句子可以逐句听读。</p>
      </section>
      <div class="reader-layout">
        <article class="reader-article">${paragraphs || '<div class="reader-empty">这篇文章还没有分段。</div>'}</article>
        <aside class="reader-rail">
          <section class="rail-card"><h2>本篇词汇</h2>${words.length ? words.map((item) => `<div class="rail-word"><b>${escapeHtml(item.lemma)}</b><span>${escapeHtml(item.definitionZh ?? item.definition)}</span></div>`).join('') : '<p class="muted">暂无词卡。</p>'}</section>
          <section class="rail-card"><h2>我的批注 <span class="rail-count">${annotations.length}</span></h2>${annotations.length ? annotations.map((entry) => `<div class="rail-annotation"><p>${escapeHtml(entry.quote)}</p>${entry.note ? `<span>${escapeHtml(entry.note)}</span>` : ''}<button type="button" data-annotation-delete="${escapeHtml(entry.id)}">删除</button></div>`).join('') : '<p class="muted">选中一句话后可以加批注。</p>'}</section>
          <section class="rail-card"><h2>阅读工具</h2><a href="/read/${encodeURIComponent(record.id)}/notes.md">导出精读笔记</a><a href="/?tab=insights">查看本周复盘</a><p class="small muted" style="margin:8px 0 0;color:var(--muted);font-size:10px;line-height:1.6">快捷键：J / K 段落 · T 翻译</p></section>
          <section class="rail-card rail-note"><h2>读法</h2><p>先读原文，遇到生词先猜；读完一段再看翻译，最后用本篇词汇复述一遍。</p></section>
        </aside>
      </div>
      <section class="reader-next" id="reader-next" hidden>
        <h2>接下来读</h2>
        <div class="reader-next-list" id="reader-next-list"></div>
      </section>
      <div class="reader-footer"><button class="btn btn-primary" id="reader-finish-bottom" type="button">${progress.finishedAt ? '已完成' : '完成精读'}</button><a class="btn" href="/?tab=packs">回到文章列表</a></div>
    </main>
  </div>
  <div class="reader-outline-panel" id="reader-outline-panel" hidden>
    <div class="reader-panel-head"><strong>目录</strong><button type="button" data-panel-close="outline">关闭</button></div>
    <div class="reader-outline-list">${outlineMarkup}</div>
  </div>
  <div class="reader-type-panel" id="reader-type-panel" hidden>
    <div class="reader-panel-head"><strong>阅读设置</strong><button type="button" data-panel-close="type">关闭</button></div>
    <div class="reader-type-group"><span>字号</span><div class="reader-type-options">
      <button type="button" data-type-size="sm">小</button><button type="button" data-type-size="md" class="active">标准</button><button type="button" data-type-size="lg">大</button>
    </div></div>
    <div class="reader-type-group"><span>行宽</span><div class="reader-type-options">
      <button type="button" data-type-width="sm">窄</button><button type="button" data-type-width="md" class="active">标准</button><button type="button" data-type-width="lg">宽</button>
    </div></div>
    <div class="reader-type-group"><span>字体</span><div class="reader-type-options">
      <button type="button" data-type-face="serif" class="active">衬线</button><button type="button" data-type-face="sans">无衬线</button>
    </div></div>
  </div>
  <div class="reader-help-panel" id="reader-help-panel" hidden>
    <div class="reader-panel-head"><strong>快捷键</strong><button type="button" data-panel-close="help">关闭</button></div>
    <div class="reader-help-list">
      <div><kbd>J</kbd><span>下一段</span></div>
      <div><kbd>K</kbd><span>上一段</span></div>
      <div><kbd>T</kbd><span>翻译当前段落</span></div>
      <div><kbd>?</kbd><span>打开这个面板</span></div>
      <div><kbd>Esc</kbd><span>关闭面板</span></div>
    </div>
    <p class="reader-help-note">选中文字可以加词卡、句子卡或批注；点击句子可以逐句听读。</p>
  </div>
  <nav class="mobile-nav" aria-label="移动导航">
    <a class="active" href="/?tab=read"><span>◉</span>精读</a>
    <a href="/?tab=packs"><span>▦</span>文章</a>
    <button data-reader-more type="button"><span>⋯</span>更多</button>
  </nav>
  <div class="reader-mobile-more" id="reader-mobile-more" hidden>
    <div class="reader-mobile-more-panel" role="dialog" aria-modal="true" aria-label="更多">
      <div class="reader-mobile-more-head"><strong>更多</strong><button type="button" data-reader-more-close>关闭</button></div>
      <a href="/?tab=passport">成长</a>
      <a href="/?tab=insights">复盘</a>
      <a href="/?tab=settings">设置</a>
    </div>
  </div>
</div>
<audio id="reader-player" controls hidden></audio>
<audio id="reader-sentence-player" preload="none" hidden></audio>
<div class="reader-sentence-bar" id="reader-sentence-bar" hidden>
  <span class="reader-sentence-label" id="reader-sentence-label">逐句朗读</span>
  <button class="reader-sentence-btn" type="button" data-sentence-prev>上一句</button>
  <button class="reader-sentence-btn primary" type="button" data-sentence-toggle>暂停</button>
  <button class="reader-sentence-btn" type="button" data-sentence-next>下一句</button>
  <button class="reader-sentence-btn" type="button" data-sentence-close aria-label="退出逐句朗读">×</button>
</div>
<div class="reader-select" id="reader-select" hidden>
  <div class="reader-select-text" id="reader-select-text"></div>
  <div class="reader-select-actions">
    <button class="reader-select-btn" type="button" data-reader-analyze="1">看释义</button>
    <button class="reader-select-btn primary" type="button" data-reader-add="word">加入词卡</button>
    <button class="reader-select-btn" type="button" data-reader-add="sentence">加入句子卡</button>
    <button class="reader-select-btn" type="button" data-reader-annotate="1">加批注</button>
    <button class="reader-select-close" type="button" id="reader-select-close" aria-label="关闭">×</button>
  </div>
  <div class="reader-select-analysis" id="reader-select-analysis" hidden></div>
  <div class="reader-note-box" id="reader-note-box" hidden>
    <textarea id="reader-note-input" placeholder="写一句批注（可选）…"></textarea>
    <button class="reader-select-btn primary" type="button" id="reader-note-save">保存批注</button>
  </div>
</div>
<div class="reader-toast" id="reader-toast" hidden></div>
<script src="/reader.js" defer></script>
</body>
</html>`
}
