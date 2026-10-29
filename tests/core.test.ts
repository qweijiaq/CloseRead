import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { itemId } from '../src/analyze/item-id.js'
import { estimateDifficulty, extractCandidates } from '../src/analyze/tokenize.js'
import { parseTranscript } from '../src/ingest/segment.js'
import { renderAnkiCsv } from '../src/pack/anki.js'
import { newReviewState, rateReview } from '../src/review/scheduler.js'
import type { LearningItem, LearningPack } from '../src/types.js'

function makeItem(overrides: Partial<LearningItem> = {}): LearningItem {
  const now = new Date().toISOString()
  return {
    id: 'abc',
    type: 'word_sense',
    lemma: 'attention',
    sense: 'notice or interest',
    pos: 'noun',
    definition: 'the act of noticing something',
    contexts: [
      {
        resourceId: 'r',
        resourceTitle: 'Resource',
        segmentIndex: 0,
        sentence: 'Attention is scarce.',
      },
    ],
    collocations: ['pay attention'],
    examples: [{ text: 'Pay attention.', origin: 'generated' }],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Resource',
    createdAt: now,
    updatedAt: now,
    ...overrides,
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
    items: [makeItem({ definition: 'noticing, "attention",\nand focus' })],
    exercises: { cloze: [], comprehension: [], discussion: [] },
  }
}

describe('candidate extraction', () => {
  it('selects content words and skips function words', () => {
    const text =
      'The attention economy turns curiosity into a commodity. Scarcity makes deliberate thought difficult, and fragmentation undermines autonomy.'
    const lemmas = extractCandidates(text, 10).map((candidate) => candidate.lemma)

    assert.ok(lemmas.includes('attention'))
    assert.ok(lemmas.includes('economy'))
    assert.ok(lemmas.includes('commodity'))
    assert.ok(lemmas.includes('scarcity'))
    assert.ok(lemmas.includes('deliberate'))
    assert.ok(lemmas.includes('fragmentation'))
    assert.ok(lemmas.includes('undermine'))
    assert.ok(!lemmas.includes('the'))
    assert.ok(!lemmas.includes('make'))
  })

  it('estimates a CEFR band', () => {
    const difficulty = estimateDifficulty('The attention economy turns curiosity into a commodity. Scarcity matters.')
    assert.ok(['A2', 'B1', 'B2', 'C1', 'C2'].includes(difficulty.cefr))
  })
})

describe('transcript parsing', () => {
  it('parses SRT cues into timestamped segments', () => {
    const raw =
      '1\n00:00:01,000 --> 00:00:04,000\nHello world.\n\n2\n00:00:05,000 --> 00:00:08,000\nThis is a test.'
    const result = parseTranscript(raw)
    assert.equal(result.segments.length, 2)
    assert.equal(result.segments[0]?.timestamp, '00:00:01')
    assert.match(result.text, /Hello world/)
  })
})

describe('item identity', () => {
  it('is case-insensitive and sense-aware', () => {
    assert.equal(itemId('Run', 'Manage a business'), itemId('run', 'manage a business'))
    assert.notEqual(itemId('run', 'manage a business'), itemId('run', 'move quickly'))
  })
})

describe('FSRS scheduling', () => {
  it('schedules a reviewed card into the future', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const review = newReviewState(now)
    const result = rateReview(review, 3, now)
    assert.ok(new Date(result.review.due).getTime() > now.getTime())
    assert.equal(result.review.reps, 1)
  })
})

describe('Anki export', () => {
  it('escapes quotes, commas and newlines', () => {
    const csv = renderAnkiCsv(makePack())
    assert.ok(csv.startsWith('﻿'))
    assert.ok(csv.includes('"noticing, ""attention"",<br>and focus"'))
  })
})
