import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  applyReadingTranslations,
  ensureReadingTranslations,
  missingTranslationIndexes,
} from '../src/analyze/reading-translation.js'
import type { ReadingParagraph } from '../src/types.js'

function makeReading(): ReadingParagraph[] {
  return [
    { index: 0, original: 'First paragraph.', itemIds: [] },
    { index: 1, original: 'Second paragraph.', translation: '第二段。', itemIds: [] },
    { index: 2, original: 'Third paragraph.', itemIds: [] },
  ]
}

describe('reading translation repair', () => {
  it('finds only paragraphs without translations', () => {
    assert.deepEqual(missingTranslationIndexes(makeReading()), [0, 2])
  })

  it('fills missing paragraphs without overwriting existing translations', () => {
    const reading = makeReading()
    const filled = applyReadingTranslations(
      reading,
      new Map([
        [0, '第一段。'],
        [1, '不应覆盖。'],
        [2, '第三段。'],
      ]),
    )
    assert.equal(filled, 2)
    assert.equal(reading[0]?.translation, '第一段。')
    assert.equal(reading[1]?.translation, '第二段。')
    assert.equal(reading[2]?.translation, '第三段。')
    assert.deepEqual(missingTranslationIndexes(reading), [])
  })

  it('does nothing when the reading is already complete', async () => {
    const reading = makeReading()
    reading[0]!.translation = '第一段。'
    reading[2]!.translation = '第三段。'
    const result = await ensureReadingTranslations(reading)
    assert.equal(result.filled, 0)
    assert.deepEqual(result.remaining, [])
    assert.equal(result.source, 'none')
  })
})
