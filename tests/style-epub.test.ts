import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { strToU8, zipSync } from 'fflate'

import { readEpub } from '../src/ingest/epub.js'
import { renderHtml } from '../src/pack/html.js'
import { renderMarkdown } from '../src/pack/markdown.js'
import { loadStyleProfile, listStyleProfiles, saveStyleProfile } from '../src/style/profile.js'
import type { LearningItem, LearningPack } from '../src/types.js'

function makeItem(): LearningItem {
  const now = new Date().toISOString()
  return {
    id: 'item-attention',
    type: 'word_sense',
    lemma: 'attention',
    sense: 'the focus of the mind',
    pos: 'noun',
    definition: 'the act of focusing your mind on something',
    definitionZh: '注意力',
    contexts: [
      {
        resourceId: 'r',
        resourceTitle: 'Resource',
        segmentIndex: 0,
        sentence: 'Attention is scarce.',
        translation: '注意力是稀缺的。',
      },
    ],
    collocations: ['pay attention'],
    examples: [{ text: 'Pay attention.', origin: 'generated' }],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Resource',
    createdAt: now,
    updatedAt: now,
  }
}

function makePack(): LearningPack {
  return {
    id: 'pack-r',
    resourceId: 'r',
    title: 'Resource',
    source: 'sample',
    mode: 'heuristic',
    generatedAt: new Date().toISOString(),
    summary: 'A short summary.',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 10, itemCount: 1, readingMinutes: 1 },
    items: [makeItem()],
    exercises: {
      cloze: [],
      comprehension: [],
      discussion: [{ question: 'Why is attention scarce?', answer: 'Because it cannot be stored or saved.' }],
    },
    reading: [
      {
        index: 0,
        original: 'Attention is scarce.',
        translation: '注意力是稀缺的。',
        itemIds: ['item-attention'],
      },
    ],
    styleName: 'teacher-a',
    editorial: '## 先看原文\n\nAttention is scarce.\n\n## 复盘总结\n\n1. **attention** — 注意力',
  }
}

describe('EPUB ingestion', () => {
  it('reads metadata, spine order and chapter text', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-epub-'))
    const file = path.join(dir, 'test.epub')
    const container = `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
    const opf = `<?xml version="1.0"?><package><metadata><dc:title>Test Book</dc:title><dc:creator>Test Author</dc:creator></metadata><manifest><item id="c1" href="Text/ch1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>`
    const chapter = `<html><body><h1>Chapter One</h1><p>Attention is scarce.</p><p>Deliberate thought takes time, and the modern economy is designed to fragment it. This fixture needs enough text to pass the minimum extraction threshold, so it adds one more sentence.</p></body></html>`
    const zip = zipSync({
      mimetype: strToU8('application/epub+zip'),
      'META-INF/container.xml': strToU8(container),
      'OEBPS/content.opf': strToU8(opf),
      'OEBPS/Text/ch1.xhtml': strToU8(chapter),
    })
    await fs.writeFile(file, Buffer.from(zip))

    try {
      const result = await readEpub(file)
      assert.equal(result.title, 'Test Book')
      assert.equal(result.creator, 'Test Author')
      assert.match(result.text, /Chapter One/)
      assert.match(result.text, /Attention is scarce/)
      assert.ok(result.segments.length >= 2)
      assert.equal(result.metadata.format, 'epub')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('style profiles', () => {
  it('saves, loads and lists a new style profile', async () => {
    const name = `test-style-${Date.now()}`
    const file = await saveStyleProfile(
      { name, title: 'Test Style', guide: '# Test Style\n\nA test guide.' },
      { force: true },
    )
    try {
      const loaded = await loadStyleProfile(name)
      assert.equal(loaded.title, 'Test Style')
      assert.match(loaded.guide, /A test guide/)
      const profiles = await listStyleProfiles()
      const found = profiles.find((profile) => profile.name === name)
      assert.equal(found?.title, 'Test Style')
    } finally {
      await fs.rm(file, { force: true })
      await fs.rm(file.replace(/\.md$/, '.json'), { force: true })
    }
  })

  it('renders the editorial, paragraph reader and discussion answers', () => {
    const pack = makePack()
    const markdown = renderMarkdown(pack)
    assert.match(markdown, /## 风格化导读/)
    assert.match(markdown, /## 逐段精读/)
    assert.match(markdown, /> 译文：注意力是稀缺的/)
    assert.match(markdown, /参考回答：Because it cannot be stored or saved/)
    assert.match(markdown, /复盘总结/)

    const html = renderHtml(pack)
    assert.match(html, /class="reading-preface"/)
    assert.match(html, /先看原文/)
    assert.match(html, /class="paragraph"/)
    assert.match(html, /注意力是稀缺的/)
    assert.match(html, /参考回答/)
  })
})
