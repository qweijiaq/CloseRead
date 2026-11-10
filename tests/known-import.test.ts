import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseKnownWords } from '../src/review/known-import.js'

describe('known-word import parsing', () => {
  it('accepts one word per line and strips numbering and punctuation', () => {
    assert.deepEqual(parseKnownWords('1. Attention\n- friction\n“deliberate”\n\nattention'), [
      'attention',
      'friction',
      'deliberate',
    ])
  })

  it('takes the first cell from CSV/TSV rows', () => {
    assert.deepEqual(parseKnownWords('word,definition\nattention,notice\nfriction\tresistance'), [
      'word',
      'attention',
      'friction',
    ])
  })

  it('splits a single comma-separated line', () => {
    assert.deepEqual(parseKnownWords('attention, friction；deliberate'), [
      'attention',
      'friction',
      'deliberate',
    ])
  })

  it('drops empty values and caps very long tokens', () => {
    assert.deepEqual(parseKnownWords(' , \n' + 'a'.repeat(81)), [])
  })
})
