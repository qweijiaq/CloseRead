import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { renderReaderApp } from '../src/review/reader.js'
import type { LearningPack } from '../src/types.js'

function makePack(): LearningPack {
  return {
    id: 'pack-reader',
    resourceId: 'r',
    title: 'Reader Test',
    source: 'test',
    mode: 'heuristic',
    generatedAt: new Date().toISOString(),
    summary: 'A short article.',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 40, itemCount: 0, readingMinutes: 2 },
    items: [],
    exercises: { cloze: [], comprehension: [], discussion: [] },
    reading: [
      {
        index: 0,
        original: 'Attention is scarce. Focus is a skill.',
        translation: '注意力是稀缺的。',
        itemIds: [],
        note: {
          summary: '用一个反差句引出主题。',
          role: '引入',
          keySentence: 'Attention is scarce.',
          keySentenceNote: '把注意力比作稀缺资源。',
          grammar: '两个短句形成对照。',
          background: '经济学里的稀缺性。',
          connectors: [{ text: 'but', usage: '转折' }],
          question: '为什么作者先说不容易专注？',
          answer: '因为后面要给出方法。',
        },
      },
      { index: 1, original: 'Friction can help.', translation: '阻力可能有帮助。', itemIds: [] },
    ],
  }
}

describe('integrated reader', () => {
  it('renders paragraphs, progress and the shared shell', () => {
    const html = renderReaderApp(
      makePack(),
      {
        packId: 'pack-reader',
        totalParagraphs: 2,
        readParagraphs: [0],
        lastParagraph: 0,
        updatedAt: new Date().toISOString(),
      },
      { id: 'pack-reader' },
      {
        index: 2,
        total: 3,
        resourceTitle: 'Reader Book',
        previous: { id: 'pack-prev', title: 'Previous chapter', url: '/read/pack-prev', index: 1 },
        next: { id: 'pack-next', title: 'Next chapter', url: '/read/pack-next', index: 3 },
      },
    )
    assert.match(html, /Reader Test/)
    assert.match(html, /Attention is scarce/)
    assert.match(html, /data-mark="1"/)
    assert.match(html, /is-read/)
    assert.match(html, /reader\.js/)
    assert.doesNotMatch(html, /工具模式|完整学习包/)
    assert.match(html, /reader-more-tools/)
    assert.match(html, /回到文章列表/)
    assert.match(html, /href="\/\?tab=read"/)
    assert.match(html, /href="\/\?tab=packs"/)
    assert.match(html, /reader-select/)
    assert.match(html, /加入词卡/)
    assert.match(html, /看释义/)
    assert.match(html, /加批注/)
    assert.match(html, /我的批注/)
    assert.match(html, /reader-audio/)
    assert.match(html, /逐句听/)
    assert.match(html, /reader-sentence-bar/)
    assert.match(html, /reader-next/)
    assert.match(html, /接下来读/)
    assert.match(html, /manifest\.webmanifest/)
    assert.match(html, /apple-touch-icon/)
    assert.match(html, /r-sentence/)
    assert.match(html, /data-sentence="1"/)
    assert.match(html, /Focus is a skill/)
    assert.match(html, /精读笔记/)
    assert.match(html, /用一个反差句引出主题/)
    assert.match(html, /参考答案/)
    assert.match(html, /Previous chapter/)
    assert.match(html, /Next chapter/)
    assert.match(html, /第 2 \/ 3 篇/)
    assert.match(html, /50%/)
    assert.match(html, /reader-outline-panel/)
    assert.match(html, /href="#p-01"/)
    assert.match(html, /data-outline-link/)
    assert.match(html, /reader-type-panel/)
    assert.match(html, /data-type-size="lg"/)
    assert.match(html, /data-type-width="sm"/)
    assert.match(html, /data-type-face="sans"/)
    assert.match(html, /href="\/read\/pack-reader\/notes\.md"/)
    assert.match(html, /reader-help-panel/)
    assert.match(html, /data-panel-close="help"/)
    assert.match(html, /<kbd>J<\/kbd>/)
    assert.doesNotMatch(html, /<script>alert/)
  })
})
