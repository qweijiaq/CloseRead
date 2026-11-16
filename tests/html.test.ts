import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { renderHtml } from '../src/pack/html.js'
import type { LearningItem, LearningPack } from '../src/types.js'

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

  it('marks packs built before build metadata as legacy', () => {
    const legacy = renderHtml(makePack(), { items: {} })
    assert.ok(legacy.includes('pill legacy'))
    assert.ok(legacy.includes('旧版'))
    const pack = makePack()
    pack.build = {
      inputHash: 'hash',
      mode: 'heuristic',
      provider: 'dictionary',
      model: 'dictionary',
      promptVersion: '2026-11-01',
      generatedAt: new Date().toISOString(),
      warnings: [],
    }
    const current = renderHtml(pack, { items: {} })
    assert.ok(!current.includes('pill legacy'))
  })

  it('offers reader theme and typography controls', () => {
    const html = renderHtml(makePack(), { items: {} })
    assert.ok(html.includes('id="reader-settings"'))
    assert.ok(html.includes('data-reader-theme="dark"'))
    assert.ok(html.includes('data-reader-size="17"'))
    assert.ok(html.includes('data-reader-leading="1.85"'))
    assert.ok(html.includes('data-reader-width="960"'))
    assert.ok(html.includes('id="reader-settings-open"'))
    assert.ok(html.includes('html[data-theme="dark"]'))
    assert.ok(!html.includes('id="toggle-font"'))
  })

  it('keeps exported packs light and script-free of reader controls', () => {
    const html = renderHtml(makePack(), { items: {} }, { exportMode: true })
    assert.ok(!html.includes('id="reader-settings"'))
    assert.ok(html.includes('var READER_INTERACTIVE = false;'))
  })

  it('serves the full pack as the in-app reading page', () => {
    const html = renderHtml(makePack(), { items: {} }, { inApp: true })
    assert.ok(html.includes('<base href="/pack/pack-html-test/">'))
    assert.ok(html.includes('CloseRead'))
    assert.ok(html.includes('id="reading"'))
    assert.ok(html.includes('精读笔记 · Markdown'))
    assert.ok(!html.includes('完整学习包'))
    assert.ok(!html.includes('精读模式'))
    assert.ok(!html.includes('在应用中打开'))
  })

  it('keeps the mobile reading grid shrinkable and long tokens wrappable', () => {
    const html = renderHtml(makePack(), { items: {} })
    assert.ok(html.includes('grid-template-columns: minmax(0, 1fr)'))
    assert.ok(html.includes('overflow-wrap: anywhere'))
    assert.ok(!html.includes('grid-template-columns: 1fr; gap: 8px'))
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
    assert.ok(html.includes('id="chapter-nav"'))
    assert.ok(html.includes('返回今日'))
    assert.ok(html.includes('id="jump-top"'))
    assert.ok(html.includes('id="lang-toggle"'))
    assert.ok(html.includes('closeread-lang'))
    assert.ok(html.includes("'http://127.0.0.1:4317/'"))
  })

  it('surfaces degraded build warnings on the pack page', () => {
    const pack = makePack()
    pack.mode = 'llm'
    pack.build = {
      inputHash: 'hash',
      mode: 'llm',
      provider: 'deepseek',
      model: 'deepseek-chat',
      promptVersion: '2026-11-01',
      generatedAt: new Date().toISOString(),
      warnings: [
        'LLM extraction: deepseek-chat',
        'Reading failed: LLM returned an empty response.',
        '补充了 22 段缺失译文。',
      ],
    }
    const html = renderHtml(pack, { items: {} })
    const banner = /<section class="build-warning"[\s\S]*?<\/section>/.exec(html)?.[0] ?? ''
    assert.ok(html.includes('id="build-warning"'))
    assert.ok(banner.includes('生成提醒'))
    assert.ok(banner.includes('Reading failed'))
    assert.ok(html.includes('部分降级'))
    assert.ok(!banner.includes('LLM extraction: deepseek-chat'))
  })

  it('does not warn for informational build notes', () => {
    const pack = makePack()
    pack.build = {
      inputHash: 'hash',
      mode: 'llm',
      provider: 'deepseek',
      model: 'deepseek-chat',
      promptVersion: '2026-11-01',
      generatedAt: new Date().toISOString(),
      warnings: ['LLM extraction: deepseek-chat', 'Reused 3 cached word cards.'],
    }
    const html = renderHtml(pack, { items: {} })
    assert.ok(!html.includes('id="build-warning"'))
    assert.ok(!html.includes('部分降级'))
  })

  it('treats a completed translation repair as informational', () => {
    const pack = makePack()
    pack.build = {
      inputHash: 'hash',
      mode: 'heuristic',
      provider: 'heuristic',
      model: 'dictionary',
      promptVersion: '2026-11-01',
      generatedAt: new Date().toISOString(),
      warnings: ['补充了 9 段缺失译文。'],
    }
    const html = renderHtml(pack, { items: {} })
    assert.ok(!html.includes('id="build-warning"'))
  })

  it('shows the adaptive selection rationale and reader link', () => {
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
    assert.ok(html.includes('7 项核心词已标注'))
    assert.ok(html.includes('2 项此前已标注'))
    assert.ok(html.includes('data-open-reader'))
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
    pack.reading![0]!.page = 3
    const html = renderHtml(pack, { items: {} })
    assert.ok(html.includes('para-page'))
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
    assert.ok(html.includes('data-pdf-density="compact"'))
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

  it('renders cached word stories and sentence rewrites', () => {
    const pack = makePack()
    const now = new Date().toISOString()
    const word: LearningItem = {
      id: 'story-word',
      type: 'word_sense',
      lemma: 'company',
      sense: 'companionship',
      definition: 'the state of being with others',
      definitionZh: '陪伴',
      contexts: [],
      collocations: [],
      examples: [],
      relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
      wordStory: {
        origin: '来自拉丁语 com 和 panis，原意是“一起吃面包的人”。',
        roots: 'com-（一起）+ panis（面包）',
        semanticShift: '从共同进餐的伙伴扩展为商业组织。',
        cognates: ['companion', 'company'],
        confusables: ['companionship'],
        hook: '一起吃过面包的人，才是 company。',
      },
      tags: [],
      sourceRef: 'Resource',
      createdAt: now,
      updatedAt: now,
    }
    const sentence: LearningItem = {
      id: 'rewrite-sentence',
      type: 'sentence',
      lemma: 'The rivalry is not so much a strategy as a reflex.',
      sense: '这场竞争与其说是战略，不如说是条件反射。',
      definition: 'not so much A as B',
      contexts: [],
      collocations: [],
      examples: [],
      relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
      sentence: {
        original: 'The rivalry is not so much a strategy as a reflex.',
        translation: '这场竞争与其说是战略，不如说是条件反射。',
        chunks: [],
        variants: [],
        rewrites: [
          { register: 'formal', text: 'The rivalry is less a deliberate strategy than a reflex.', note: '更书面，适合评论。' },
          { register: 'casual', text: 'The rivalry is basically a reflex, not a strategy.', note: '口语化。' },
          { register: 'punchy', text: 'Not strategy. Reflex.', note: '短句对照。' },
        ],
      },
      tags: ['sentence'],
      sourceRef: 'Resource',
      createdAt: now,
      updatedAt: now,
    }
    pack.items = [word, sentence]
    const html = renderHtml(pack, { items: {} })
    assert.ok(html.includes('data-word-story="story-word"'))
    assert.ok(html.includes('data-practice-word="story-word"'))
    assert.ok(html.includes('id="practice-modal"'))
    assert.ok(html.includes('词源小传'))
    assert.ok(html.includes('一起吃面包的人'))
    assert.ok(html.includes('sentence-rewrites'))
    assert.ok(html.includes('一句三写'))
    assert.ok(html.includes('正式'))
    assert.ok(html.includes('简短有力'))
  })

  it('includes the audio player, shadowing recorder and cached reading audio', () => {
    const pack = makePack()
    pack.audio = { items: {}, reading: 'audio/reading.m4a' }
    const html = renderHtml(pack, pack.audio)
    assert.ok(html.includes('id="audio-open"'))
    assert.ok(html.includes('id="audio-modal"'))
    assert.ok(html.includes('data-audio-mode="listen"'))
    assert.ok(html.includes('data-audio-mode="shadow"'))
    assert.ok(html.includes('id="reading-audio"'))
    assert.ok(html.includes('id="audio-generate"'))
    assert.ok(html.includes('id="audio-browser"'))
    assert.ok(html.includes('id="shadow-record"'))
    assert.ok(html.includes('id="shadow-playback"'))
    assert.ok(html.includes('id="shadow-source"'))
    assert.ok(html.includes('id="tts-settings"'))
    assert.ok(html.includes('id="tts-key"'))
    assert.ok(html.includes('id="tts-providers"'))
    assert.ok(html.includes('id="tts-local-voices"'))
    assert.ok(html.includes('function renderLocalVoices('))
    assert.ok(html.includes('function selectTtsProvider('))
    assert.ok(html.includes('/api/tts'))
    assert.ok(html.includes('function saveTtsSettingsRequest('))
    assert.ok(html.includes('/sentence-audio'))
    assert.ok(html.includes('function speakShadowBrowser('))
    assert.ok(html.includes('MediaRecorder'))
    assert.ok(html.includes('READING_AUDIO = \"audio/reading.m4a\"'))
    assert.ok(html.includes('/audio'))

    pack.reading = []
    const noReading = renderHtml(pack, pack.audio)
    assert.ok(!noReading.includes('id="audio-open"'))
  })})
