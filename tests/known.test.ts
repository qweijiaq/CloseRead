import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { knownRatioInText, promptKnownLemmas } from '../src/analyze/known.js'

describe('known word tuning', () => {
  it('measures a per-article known ratio with simple inflections', () => {
    const ratio = knownRatioInText('Attention economy. Attention is scarce, and focusing is hard.', [
      'attention',
      'focus',
    ])
    assert.ok(ratio > 0.3)
    assert.ok(ratio < 1)
  })

  it('returns zero without known words', () => {
    assert.equal(knownRatioInText('Attention is scarce.', []), 0)
  })

  it('deduplicates and caps the prompt exclusion list', () => {
    const list = promptKnownLemmas(['Attention', 'attention', 'focus'], 10)
    assert.deepEqual(list, ['attention', 'focus'])
    assert.equal(promptKnownLemmas(Array.from({ length: 20 }, (_, index) => `w${index}`), 5).length, 5)
  })
})
