import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DIAGNOSIS_WORDS, computeDiagnosisLevel } from '../src/review/diagnosis.js'

function band(level: 'B1' | 'B2' | 'C1' | 'C2', count = 6): string[] {
  return DIAGNOSIS_WORDS.filter((word) => word.level === level)
    .slice(0, count)
    .map((word) => word.lemma)
}

describe('diagnosis', () => {
  it('has a unique word in each band', () => {
    assert.equal(DIAGNOSIS_WORDS.length % 4, 0)
    const lemmas = DIAGNOSIS_WORDS.map((word) => word.lemma)
    assert.equal(new Set(lemmas).size, lemmas.length)
    for (const level of ['B1', 'B2', 'C1', 'C2'] as const) {
      assert.equal(DIAGNOSIS_WORDS.filter((word) => word.level === level).length, 6)
    }
    assert.ok(DIAGNOSIS_WORDS.every((word) => word.gloss.length > 0))
  })

  it('requires lower bands before promoting a level', () => {
    assert.equal(computeDiagnosisLevel([]), 'B1')
    assert.equal(computeDiagnosisLevel(band('B1', 4)), 'B1')
    assert.equal(computeDiagnosisLevel([...band('B1', 4), ...band('B2', 4)]), 'B2')
    assert.equal(computeDiagnosisLevel([...band('B1', 4), ...band('B2', 4), ...band('C1', 4)]), 'C1')
    assert.equal(
      computeDiagnosisLevel([
        ...band('B1', 4),
        ...band('B2', 4),
        ...band('C1', 4),
        ...band('C2', 4),
      ]),
      'C2',
    )
    // B1 is not passed, so a strong B2 showing does not skip it.
    assert.equal(computeDiagnosisLevel([...band('B1', 3), ...band('B2', 6)]), 'B1')
  })
})
