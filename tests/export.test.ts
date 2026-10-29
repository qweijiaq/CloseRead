import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { strFromU8, unzipSync } from 'fflate'

import { exportFileName, renderPackEpub, renderPackExportHtml } from '../src/pack/export.js'
import type { LearningPack } from '../src/types.js'

function makePack(): LearningPack {
  return {
    id: 'pack-export-test',
    resourceId: 'r',
    title: 'Export Test: A/B',
    source: 'sample',
    mode: 'llm',
    generatedAt: new Date().toISOString(),
    summary: 'Summary',
    difficulty: { cefr: 'B2', reason: 'test' },
    frontMatter: {
      title: 'Export Test: A/B',
      titleZh: '导出测试',
      titleNote: '标题注释。',
      lead: 'This is the lead.',
      leadZh: '这是导语。',
      leadNote: '导语注释。',
      section: 'Leaders',
      itemIds: [],
    },
    stats: { wordCount: 120, itemCount: 2, readingMinutes: 1 },
    items: [
      {
        id: 'word-1',
        type: 'word_sense',
        lemma: 'attention',
        sense: 'mental focus',
        definition: 'the act of focusing the mind',
        definitionZh: '注意力',
        contexts: [{ resourceId: 'r', resourceTitle: 'Resource', segmentIndex: 0, sentence: 'Attention is scarce.' }],
        collocations: ['pay attention'],
        examples: [{ text: 'Pay attention.', origin: 'generated' }],
        relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
        tags: [],
        sourceRef: 'Resource',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'sentence-1',
        type: 'sentence',
        lemma: 'not so much A as B',
        sense: '与其说是 A，不如说是 B',
        definition: 'It is not so much a strategy as a reflex.',
        definitionZh: '与其说是战略，不如说是条件反射。',
        contexts: [{ resourceId: 'r', resourceTitle: 'Resource', segmentIndex: 0, sentence: 'It is not so much a strategy as a reflex.' }],
        collocations: [],
        examples: [],
        relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
        sentence: {
          original: 'It is not so much a strategy as a reflex.',
          translation: '与其说是战略，不如说是条件反射。',
          chunks: [{ text: 'not so much a strategy as a reflex', role: '表语', meaning: '与其说是战略，不如说是条件反射' }],
          pattern: 'not so much A as B',
          grammar: '把重点从 A 移到 B。',
          variants: ['It is not so much a crisis as a warning.'],
          why: '实用句型。',
        },
        tags: ['sentence'],
        sourceRef: 'Resource',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    exercises: {
      cloze: [{ sentence: '______ is scarce.', answer: 'attention' }],
      comprehension: [{ question: 'What is scarce?', answer: 'Attention.' }],
      discussion: [{ question: 'Why?', answer: 'Because it cannot be stored.' }],
    },
    reading: [
      {
        index: 0,
        original: 'Attention is scarce.',
        translation: '注意力是稀缺的。',
        itemIds: ['word-1'],
        note: {
          summary: '本段提出注意力稀缺。',
          role: '论点',
          keySentence: 'Attention is scarce.',
          keySentenceNote: '短句提出主张。',
          grammar: 'be + adjective 表状态。',
          connectors: [{ text: 'However', usage: '转折' }],
          background: '注意力经济背景。',
          question: '为什么注意力稀缺？',
        },
      },
    ],
    sourceText: 'Attention is scarce.',
  }
}

function packWordDerivation(pack: LearningPack): void {
  pack.items[0]!.derivation = {
    nodes: [
      { id: 'attention', word: 'attention', meaningZh: '注意力', kind: 'center' },
      { id: 'attentive', word: 'attentive', meaningZh: '专注的', kind: 'derivative' },
    ],
    edges: [{ from: 'attention', to: 'attentive', label: '派生' }],
  }
}

describe('pack export', () => {
  it('renders a static, fully expanded HTML export', () => {
    const pack = makePack()
    const html = renderPackExportHtml(pack)
    assert.ok(html.includes('class="sheet"'))
    assert.ok(html.includes('class="word-card"'))
    assert.ok(html.includes('class="sentence-card'))
    assert.ok(html.includes('class="note"'))
    assert.ok(html.includes('data-export-block="1"'))
    assert.ok(html.includes('data-block-kind="paragraph"'))
    assert.ok(html.includes('注意力是稀缺的'))
    assert.ok(html.includes('本段提出注意力稀缺'))
    assert.ok(html.includes('not so much A as B'))
    packWordDerivation(pack)
    const withGraph = renderPackExportHtml(pack)
    assert.ok(withGraph.includes('derivation-tree'))
    assert.ok(withGraph.includes('attentive'))
    assert.ok(!html.includes('<script'))
    assert.ok(!html.includes('<details'))
    assert.ok(!html.includes('<button'))
  })

  it('builds a valid EPUB archive with mimetype first, OPF, nav and content', () => {
    const pack = makePack()
    packWordDerivation(pack)
    const epub = renderPackEpub(pack)
    const files = unzipSync(epub)
    assert.equal(strFromU8(files['mimetype']!), 'application/epub+zip')
    assert.ok(files['META-INF/container.xml'])
    assert.ok(files['OEBPS/content.opf'])
    assert.ok(files['OEBPS/toc.xhtml'])
    const content = strFromU8(files['OEBPS/index.xhtml']!)
    assert.ok(content.includes('Export Test'))
    assert.ok(content.includes('注意力是稀缺的'))
    assert.ok(content.includes('not so much A as B'))
    assert.ok(content.includes('派生图'))
    assert.ok(content.includes('重点') || content.includes('词根') || content.includes('词汇与表达'))
  })

  it('sanitizes export file names', () => {
    assert.equal(exportFileName(makePack(), 'epub'), 'Export Test A B.epub')
  })
})
