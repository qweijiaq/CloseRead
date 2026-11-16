import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { applySelectionTiers, suggestSelection } from '../src/analyze/index.js'
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

  it('recommends one item per 20 words, rounded and capped', () => {
    const short = suggestSelection(makeResource(300), { limit: 'auto' })
    const long = suggestSelection(makeResource(2500), { limit: 'auto' })
    assert.equal(short.mode, 'auto')
    assert.equal(short.recommended, 15)
    // 125 items would be unusable in one session, so the cap wins.
    assert.equal(long.recommended, 60)
    assert.equal(suggestSelection(makeResource(1037), { limit: 'auto' }).recommended, 52)
    assert.equal(suggestSelection(makeResource(602), { limit: 'auto' }).recommended, 30)
    assert.match(long.reason, /2500 词/)
    assert.match(long.reason, /每 20 词 1 项/)
  })

  it('nudges the count with the known-word ratio when data exists', () => {
    const base = suggestSelection(makeResource(900), { limit: 'auto' })
    const low = suggestSelection(makeResource(900), { limit: 'auto', knownRatio: 0.05 })
    const high = suggestSelection(makeResource(900), { limit: 'auto', knownRatio: 0.9 })
    assert.equal(base.recommended, 45)
    assert.equal(low.recommended, 44)
    assert.equal(high.recommended, 46)
    assert.match(low.reason, /减少 1 项/)
    assert.match(high.reason, /增加 1 项/)
  })

  it('applies pack feedback to the automatic count', () => {
    const base = suggestSelection(makeResource(900), { limit: 'auto' })
    const more = suggestSelection(makeResource(900), { limit: 'auto', selectionBias: 3 })
    const less = suggestSelection(makeResource(900), { limit: 'auto', selectionBias: -3 })
    assert.equal(base.recommended, 45)
    assert.equal(more.recommended, 48)
    assert.equal(less.recommended, 42)
    assert.match(more.reason, /增加 3 项/)
    assert.match(less.reason, /减少 3 项/)

    const extreme = suggestSelection(makeResource(900), { limit: 'auto', selectionBias: 99 })
    assert.equal(extreme.recommended, 50)
  })

  it('splits tiers by the items actually returned, not the recommendation', () => {
    const recommendation = {
      mode: 'auto' as const,
      recommended: 48,
      core: 48,
      bonus: 0,
      wordCount: 954,
      cefr: 'C1',
      reason: 'test',
    }
    const analysis = {
      items: Array.from({ length: 10 }, (_, index) => ({ id: String(index) })),
    } as unknown as Parameters<typeof applySelectionTiers>[0]
    const result = applySelectionTiers(analysis, recommendation)
    assert.equal(result.core, 7)
    assert.equal(result.bonus, 3)
    assert.equal(analysis.items[6]?.tier, 'core')
    assert.equal(analysis.items[7]?.tier, 'bonus')
    assert.equal(analysis.items[9]?.tier, 'bonus')
    assert.equal(analysis.items[0]?.tier, 'core')

    const empty = applySelectionTiers({ items: [] } as unknown as Parameters<typeof applySelectionTiers>[0], recommendation)
    assert.equal(empty.core, 0)
    assert.equal(empty.bonus, 0)
  })
})
