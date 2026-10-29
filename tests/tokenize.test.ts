import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { completeSentence } from '../src/analyze/sentence-card.js'
import { sentences } from '../src/analyze/tokenize.js'

describe('sentence splitting', () => {
  it('keeps abbreviations and initials inside one sentence', () => {
    const parts = sentences(
      'Mr. Smith met J. K. Rowling in the U.S. They talked about the U.K. edition. Then they left.',
    )
    assert.equal(parts.length, 3)
    assert.match(parts[0]!, /Mr\. Smith met J\. K\. Rowling in the U\.S\./)
    assert.match(parts[1]!, /U\.K\. edition/)
  })

  it('does not split decimals or ellipses into fragments', () => {
    const parts = sentences('The rate was 3.5%. He paused... Then he continued.')
    assert.equal(parts.length, 3)
    assert.match(parts[0]!, /3\.5%/)
    assert.match(parts[1]!, /He paused/)
    assert.match(parts[2]!, /Then he continued/)
  })

  it('expands a phrase to the complete sentence and restores terminal punctuation', () => {
    assert.equal(
      completeSentence('tussling for influence', 'They are tussling for influence farther afield. Next sentence.'),
      'They are tussling for influence farther afield.',
    )
    assert.equal(completeSentence('a complete clause'), 'a complete clause.')
  })

  it('keeps closing quotes with the sentence', () => {
    const parts = sentences('He said, "Go." She left. "Why?" he asked.')
    assert.equal(parts.length, 3)
    assert.equal(parts[0], 'He said, "Go."')
    assert.equal(parts[1], 'She left.')
  })
})
