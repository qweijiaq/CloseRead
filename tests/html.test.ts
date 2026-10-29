import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { renderHtml } from '../src/pack/html.js'
import { renderReviewApp } from '../src/review/web.js'
import type { LearningPack } from '../src/types.js'

function makePack(): LearningPack {
  return {
    id: 'pack-html-test',
    resourceId: 'r',
    title: 'HTML Test',
    source: 'sample',
    mode: 'heuristic',
    generatedAt: new Date().toISOString(),
    summary: 'Summary',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 12, itemCount: 0, readingMinutes: 1 },
    items: [],
    exercises: { cloze: [], comprehension: [], discussion: [] },
    reading: [
      {
        index: 0,
        original: 'That is a heavy job.',
        translation: '那是一项沉重的任务。',
        itemIds: [],
      },
    ],
    sourceText: 'That is a heavy job.',
  }
}

describe('pack html', () => {
  it('keeps regex backslashes in the embedded client script', () => {
    const html = renderHtml(makePack(), { items: {} })
    // 模板字符串会吃掉单反斜杠：`\s` 会变成字母 s，白空格正则退化成删除字母 s
    assert.ok(html.includes("selection.toString().replace(/\\s+/g, ' ')"))
    assert.ok(html.includes('text.split(/\\s+/)'))
    assert.ok(!html.includes('replace(/s+/g'))
    assert.ok(!html.includes('split(/s+/)'))
  })

  it('emits syntactically valid inline scripts', () => {
    const html = renderHtml(makePack(), { items: {} })
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? '')
    assert.ok(scripts.length > 0)
    for (const script of scripts) new Function(script)
  })

  it('offers a way back to the review home from the top and the footer', () => {
    const html = renderHtml(makePack(), { items: {} })
    assert.ok(html.includes('id="back-review"'))
    assert.ok(html.includes('data-home'))
    assert.ok(html.includes('返回今日'))
    assert.ok(html.includes('id="jump-top"'))
    assert.ok(html.includes("'http://127.0.0.1:4317/'"))
  })

  it('shows the adaptive selection rationale and review link', () => {
    const pack = makePack()
    pack.selection = {
      mode: 'auto',
      recommended: 10,
      core: 7,
      bonus: 3,
      wordCount: 1000,
      cefr: 'B2',
      reason: '原文 1000 词；建议 10 项。',
      reused: 2,
    }
    const html = renderHtml(pack, { items: {} })
    assert.ok(html.includes('选词说明'))
    assert.ok(html.includes('7 项核心词进入复习'))
    assert.ok(html.includes('2 项已在词库'))
    assert.ok(html.includes('data-review-pack'))
  })

  it('collects pack-level selection feedback', () => {
    const html = renderHtml(makePack(), { items: {} })
    assert.ok(html.includes('data-feedback="less"'))
    assert.ok(html.includes('data-feedback="more"'))
    assert.ok(html.includes('/feedback'))
  })

  it('tracks reading progress and completion in the pack', () => {
    const html = renderHtml(makePack(), { items: {} })
    assert.ok(html.includes('id="reading-status"'))
    assert.ok(html.includes('id="reading-finish"'))
    assert.ok(html.includes('id="reading-reset"'))
    assert.ok(html.includes('data-para-read="0"'))
    assert.ok(html.includes('/reading'))
    assert.ok(html.includes('READING_TOTAL = 1'))
  })

  it('includes the reading overview and on-demand note generation', () => {
    const html = renderHtml(makePack(), { items: {} })
    assert.ok(html.includes('reading-intro'))
    assert.ok(html.includes('id="enrich-reading"'))
    assert.ok(html.includes('data-focus-para="0"'))
    assert.ok(html.includes('补齐导读与笔记'))
  })

  it('renders per-paragraph intensive-reading notes', () => {
    const pack = makePack()
    pack.frontMatter = {
      title: pack.title,
      titleZh: '标题中文',
      summaryZh: '摘要中文',
      itemIds: [],
    }
    pack.readingGuide = '读前导读。'
    pack.reading![0]!.note = {
      summary: '这一段用对比引出文章问题。',
      role: '转折',
      keySentence: 'That is a heavy job.',
      keySentenceNote: '短句收束，形成反差。',
      grammar: 'That 指代前文。',
      connectors: [{ text: 'Instead', usage: '转折' }],
      background: '背景说明。',
      question: '作者为什么这样说？',
    }
    const html = renderHtml(pack, { items: {} })
    assert.ok(html.includes('para-note'))
    assert.ok(html.includes('转折'))
    assert.ok(html.includes('note-key'))
    assert.ok(html.includes('作者为什么这样说'))
    assert.ok(html.includes('id="toggle-notes"'))
    assert.ok(html.includes('data-edit-paragraph="0"'))
    assert.ok(html.includes('data-answer-index="0"'))
    assert.ok(html.includes('reading-map'))
    assert.ok(!html.includes('id="enrich-reading"'))
  })

  it('includes exercise prompt and answer translation slots', () => {
    const pack = makePack()
    pack.exercises.cloze = [{ sentence: '______ is scarce.', answer: 'attention' }]
    pack.exercises.discussion = [{ question: 'Why does it matter?', answer: 'Because attention cannot be stored.' }]
    const html = renderHtml(pack, { items: {} })
    assert.ok(html.includes('data-exercise-kind="cloze"'))
    assert.ok(html.includes('数据') || html.includes('答案与译文'))
    assert.ok(html.includes('exercise-translation'))
    assert.ok(html.includes('参考答案与译文') || html.includes('参考回答与译文'))
  })

  it('surfaces the editorial as a reading preface', () => {
    const pack = makePack()
    pack.editorial = '读前导读：先看作者如何用词。\n\n## 原文选段\n\n这是一段精读导读，用来解释文章的表达和结构。'
    const html = renderHtml(pack, { items: {} })
    assert.ok(html.includes('reading-preface'))
    assert.ok(html.includes('精读导读'))
    assert.ok(html.includes('preface-excerpt'))
    assert.ok(!html.includes('展开完整导读'))
  })

  it('offers a repair action when a paragraph was cut mid-sentence', () => {
    const pack = makePack()
    pack.reading![0]!.original = 'That is a heavy job. The'
    pack.reading!.push({
      index: 1,
      original: 'next paragraph continues the sentence.',
      translation: '下一段继续。',
      itemIds: [],
    })
    const html = renderHtml(pack, { items: {} })
    assert.ok(html.includes('id="repair-reading"'))
    assert.ok(html.includes('repair-reading'))
  })

  it('renders article front matter with title and lead translations', () => {
    const pack = makePack()
    pack.frontMatter = {
      title: pack.title,
      titleZh: '标题中文',
      titleNote: '标题用了双关。',
      summaryZh: '这是一段中文摘要。',
      lead: 'This is the standfirst.',
      leadZh: '这是导语。',
      leadNote: '导语先抛出判断。',
      section: 'Leaders',
      itemIds: [],
    }
    const html = renderHtml(pack, { items: {} })
    assert.ok(html.includes('front-matter'))
    assert.ok(html.includes('标题中文'))
    assert.ok(html.includes('This is the standfirst.'))
    assert.ok(html.includes('这是导语。'))
    assert.ok(html.includes('Leaders'))
    assert.ok(html.includes('data-edit-front="title"'))
    assert.ok(html.includes('front-lead-block hero-lead-block'))
    assert.ok(html.includes('class="front-lead original"'))
    assert.ok(html.includes('精读约'))
  })

  it('exposes export formats and AI word expansion controls', () => {
    const html = renderHtml(makePack(), { items: {} })
    assert.ok(html.includes('id="export-toggle"'))
    assert.ok(html.includes('data-export="html"'))
    assert.ok(html.includes('data-export="epub"'))
    assert.ok(html.includes('data-export="pdf"'))
    assert.ok(html.includes('data-export="png"'))
    assert.ok(html.includes('data-export="mobi"'))
    assert.ok(html.includes('data-export="png-pages"'))
    assert.ok(html.includes('data-png-width="900"'))
    assert.ok(html.includes('data-png-scale="2"'))
    assert.ok(html.includes('id="export-progress"'))
    assert.ok(html.includes('id="word-modal"'))
    assert.ok(html.includes('select-translation'))
    assert.ok(html.includes('select-annotation'))
  })

  it('includes sentence merge and split controls in focus mode', () => {
    const pack = makePack()
    const html = renderHtml(pack, { items: {} })
    assert.ok(html.includes('id="focus-merge"'))
    assert.ok(html.includes('id="focus-split"'))
    assert.ok(html.includes('id="split-modal"'))
    assert.ok(html.includes('/reading/sentences'))
  })

  it('includes the sentence-focus reading mode', () => {
    const html = renderHtml(makePack(), { items: {} })
    assert.ok(html.includes('id="focus-mode"'))
    assert.ok(html.includes('id="focus-mode-open"'))
    assert.ok(html.includes('FOCUS_PARAGRAPHS'))
    assert.ok(html.includes('id="focus-next"'))
    assert.ok(html.includes('id="focus-finish"'))
    assert.ok(html.includes('id="top-focus"'))
    assert.ok(html.includes('id="scroll-progress"'))
    assert.ok(html.includes('id="focus-sentence-translation-btn"'))
    assert.ok(html.includes('translate-sentence'))
    assert.ok(html.includes('单句精读'))
  })

  it('embeds a written output practice when a discussion question exists', () => {
    const pack = makePack()
    pack.exercises.discussion = [{ question: 'What do you think?', answer: 'A reference answer.' }]
    const html = renderHtml(pack, { items: {} })
    assert.ok(html.includes('id="output-practice"'))
    assert.ok(html.includes('id="output-save"'))
    assert.ok(html.includes('OUTPUT_PROMPT'))
    assert.ok(html.includes('/api/today/output'))
  })

  it('renders sentence cards separately from vocabulary cards', () => {
    const pack = makePack()
    const now = new Date().toISOString()
    pack.items.push({
      id: 'sentence-1',
      type: 'sentence',
      lemma: 'not so much A as B',
      sense: '与其说是 A，不如说是 B',
      definition: 'The rivalry is not so much a strategy as a reflex.',
      definitionZh: '这场竞争与其说是战略，不如说是条件反射。',
      contexts: [
        {
          resourceId: 'r',
          resourceTitle: 'Resource',
          segmentIndex: 0,
          sentence: 'The rivalry is not so much a strategy as a reflex.',
        },
      ],
      collocations: [],
      examples: [],
      relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
      sentence: {
        original: 'The rivalry is not so much a strategy as a reflex.',
        translation: '这场竞争与其说是战略，不如说是条件反射。',
        chunks: [{ text: 'not so much a strategy as a reflex', role: '表语', meaning: '与其说是战略，不如说是条件反射' }],
        pattern: 'not so much A as B',
        grammar: '把重点从 A 移到 B。',
        variants: ['It is not so much a crisis as a warning.'],
        why: '表达“表面是 A，实质是 B”。',
      },
      tags: ['sentence'],
      sourceRef: 'Resource',
      createdAt: now,
      updatedAt: now,
    })
    const html = renderHtml(pack, { items: {} })
    assert.ok(html.includes('句子卡'))
    assert.ok(html.includes('sentence-item'))
    assert.ok(html.includes('not so much A as B'))
    assert.ok(html.includes('sentence-original'))
  })
})

describe('review html', () => {
  it('emits syntactically valid inline scripts', () => {
    const html = renderReviewApp()
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? '')
    assert.ok(scripts.length > 0)
    for (const script of scripts) new Function(script)
  })

  it('has a first-class import entry for text, URL and PDF', () => {
    const html = renderReviewApp()
    assert.ok(html.includes('data-tab="import"'))
    assert.ok(html.includes('id="view-import"'))
    assert.ok(html.includes('id="import-text-form"'))
    assert.ok(html.includes('id="import-url-form"'))
    assert.ok(html.includes('id="import-pdf-form"'))
    assert.ok(html.includes('id="import-ebook-form"'))
    assert.ok(html.includes('data-go-tab="import"'))
    assert.ok(html.includes('data-build-article'))
    assert.ok(html.includes('article-search'))
    assert.ok(html.includes('renderArticleList'))
  })

  it('includes the daily loop, cloze practice and pronunciation controls', () => {
    const html = renderReviewApp()
    assert.ok(html.includes('/api/today'))
    assert.ok(html.includes('today-output-save'))
    assert.ok(html.includes('id="practice-input"'))
    assert.ok(html.includes('clozeSentence'))
    assert.ok(html.includes('speechSynthesis'))
    assert.ok(html.includes('id="only-new"'))
    assert.ok(html.includes('id="selection-size"'))
    assert.ok(html.includes('value="6"'))
    assert.ok(html.includes('value="22"'))
  })

  it('opens on a reading-first home and keeps review as a separate tab', () => {
    const html = renderReviewApp()
    assert.ok(html.includes('id="view-home"'))
    assert.ok(html.includes('id="home-hero"'))
    assert.ok(html.includes('data-tab="home"'))
    assert.ok(html.includes('data-tab="review"'))
    assert.ok(html.includes('继续精读'))
    assert.ok(html.includes('最近精读'))
  })

  it('includes a sentence-only review shortcut and reading stats', () => {
    const html = renderReviewApp()
    assert.ok(html.includes('id="review-sentence-only"'))
    assert.ok(html.includes('data-sentence-review="1"'))
    assert.ok(html.includes('paragraphsRead'))
  })

  it('includes sentence back-translation review controls', () => {
    const html = renderReviewApp()
    assert.ok(html.includes('sentenceScore'))
    assert.ok(html.includes('sentence-input'))
    assert.ok(html.includes('sentence-title'))
    assert.ok(html.includes('把这句话译回英文'))
    assert.ok(html.includes('句子卡 · 回译'))
  })

  it('includes written output capture and history', () => {
    const html = renderReviewApp()
    assert.ok(html.includes('today-output-input'))
    assert.ok(html.includes('today-output-save'))
    assert.ok(html.includes('home-outputs'))
    assert.ok(html.includes('最近输出'))
    assert.ok(html.includes('/api/today/output'))
  })

  it('filters the library by words and sentence cards', () => {
    const html = renderReviewApp()
    assert.ok(html.includes('data-lib-filter="word"'))
    assert.ok(html.includes('data-lib-filter="sentence"'))
    assert.ok(html.includes('applyLibraryFilter'))
    assert.ok(html.includes('sentence-row'))
    assert.ok(html.includes('sentence-original'))
  })
})
