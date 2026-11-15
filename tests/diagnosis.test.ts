import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DIAGNOSIS_WORDS,
  computeDiagnosisLevel,
  sampleDiagnosisWords,
} from '../src/review/diagnosis.js'
import type { DiagnosisWord } from '../src/review/diagnosis.js'

function band(
  level: 'B1' | 'B2' | 'C1' | 'C2',
  count = 6,
  words: DiagnosisWord[] = DIAGNOSIS_WORDS,
): DiagnosisWord[] {
  return words.filter((word) => word.level === level).slice(0, count)
}

function lemmas(words: DiagnosisWord[]): string[] {
  return words.map((word) => word.lemma)
}

function seeded(seed: number): (max: number) => number {
  let state = seed
  return (max: number) => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state % max
  }
}

describe('diagnosis', () => {
  it('has a unique pool with enough words in each band', () => {
    assert.equal(DIAGNOSIS_WORDS.length % 4, 0)
    const lemmasAll = DIAGNOSIS_WORDS.map((word) => word.lemma)
    assert.equal(new Set(lemmasAll).size, lemmasAll.length)
    for (const level of ['B1', 'B2', 'C1', 'C2'] as const) {
      assert.ok(DIAGNOSIS_WORDS.filter((word) => word.level === level).length >= 12)
    }
    assert.ok(DIAGNOSIS_WORDS.every((word) => word.gloss.length > 0))
  })

  it('samples six fresh words per band and varies between sessions', () => {
    const first = sampleDiagnosisWords(6, seeded(7))
    const second = sampleDiagnosisWords(6, seeded(99))
    assert.equal(first.length, 24)
    assert.equal(new Set(first.map((word) => word.lemma)).size, 24)
    for (const level of ['B1', 'B2', 'C1', 'C2'] as const) {
      assert.equal(first.filter((word) => word.level === level).length, 6)
    }
    assert.notDeepEqual(lemmas(first).sort(), lemmas(second).sort())
  })

  it('requires lower bands before promoting a level', () => {
    const sample = [
      ...band('B1'),
      ...band('B2'),
      ...band('C1'),
      ...band('C2'),
    ]
    assert.equal(computeDiagnosisLevel([], sample), 'B1')
    assert.equal(computeDiagnosisLevel(lemmas(band('B1', 4, sample)), sample), 'B1')
    assert.equal(computeDiagnosisLevel(lemmas([...band('B1', 4, sample), ...band('B2', 4, sample)]), sample), 'B2')
    assert.equal(
      computeDiagnosisLevel(
        lemmas([...band('B1', 4, sample), ...band('B2', 4, sample), ...band('C1', 4, sample)]),
        sample,
      ),
      'C1',
    )
    assert.equal(
      computeDiagnosisLevel(
        lemmas([
          ...band('B1', 4, sample),
          ...band('B2', 4, sample),
          ...band('C1', 4, sample),
          ...band('C2', 4, sample),
        ]),
        sample,
      ),
      'C2',
    )
    // B1 is not passed, so a strong B2 showing does not skip it.
    assert.equal(
      computeDiagnosisLevel(lemmas([...band('B1', 3, sample), ...band('B2', 6, sample)]), sample),
      'B1',
    )
  })
})
