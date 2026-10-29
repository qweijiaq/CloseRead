import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { suggestSelection } from '../src/analyze/index.js'
import type { Resource } from '../src/types.js'

function makeResource(wordCount: number): Resource {
  return {
    id: 'r',
    title: 'Article',
    kind: 'text',
    source: 'pasted',
    text: 'The quick brown fox jumps over the lazy dog. '.repeat(Math.ceil(wordCount / 9)),
    wordCount,
    segments: [],
    metadata: {},
    createdAt: new Date().toISOString(),
  }
}

describe('adaptive selection', () => {
  it('keeps an explicit fixed count', () => {
    const selection = suggestSelection(makeResource(900), { limit: 10 })
    assert.equal(selection.mode, 'fixed')
    assert.equal(selection.recommended, 10)
    assert.match(selection.reason, /固定数量 10/)
  })

  it('recommends a bounded count from article length', () => {
    const short = suggestSelection(makeResource(300), { limit: 'auto' })
    const long = suggestSelection(makeResource(2500), { limit: 'auto' })
    assert.equal(short.mode, 'auto')
    assert.ok(short.recommended >= 6 && short.recommended <= 15)
    assert.ok(long.recommended >= short.recommended)
    assert.ok(long.recommended <= 15)
    assert.match(long.reason, /2500 词/)
  })

  it('tunes the count with the library known ratio', () => {
    const low = suggestSelection(makeResource(900), { limit: 'auto', knownRatio: 0.05 })
    const high = suggestSelection(makeResource(900), { limit: 'auto', knownRatio: 0.9 })
    assert.ok(high.recommended >= low.recommended)
  })

  it('applies pack feedback to the automatic count', () => {
    const base = suggestSelection(makeResource(900), { limit: 'auto' })
    const more = suggestSelection(makeResource(900), { limit: 'auto', selectionBias: 3 })
    const less = suggestSelection(makeResource(900), { limit: 'auto', selectionBias: -3 })
    assert.equal(more.recommended, base.recommended + 3)
    assert.equal(less.recommended, base.recommended - 3)
    assert.match(more.reason, /增加 3 项/)
    assert.match(less.reason, /减少 3 项/)

    const extreme = suggestSelection(makeResource(900), { limit: 'auto', selectionBias: 99 })
    assert.ok(extreme.recommended <= 20)
  })
})
