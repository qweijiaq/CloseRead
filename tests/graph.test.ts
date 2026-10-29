import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildWordGraph } from '../src/graph/build.js'
import type { StoredItem } from '../src/types.js'

function makeItem(lemma: string, overrides: Partial<StoredItem> = {}): StoredItem {
  const now = new Date().toISOString()
  return {
    id: `id-${lemma}`,
    type: 'word_sense',
    lemma,
    sense: `sense of ${lemma}`,
    definition: `definition of ${lemma}`,
    contexts: [],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'test',
    createdAt: now,
    updatedAt: now,
    review: {
      due: now,
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      fsrsState: 0,
    },
    favorite: false,
    status: 'active',
    ...overrides,
  }
}

describe('word graph', () => {
  const focus = makeItem('focus', {
    relations: { synonyms: ['attention'], antonyms: [], confusables: [], wordFamily: [] },
    wordFormation: {
      roots: [{ form: 'spect', meaning: '看', examples: [] }],
      prefixes: [],
      suffixes: [],
    },
  })
  const attention = makeItem('attention', {
    relations: { synonyms: [], antonyms: ['distraction'], confusables: [], wordFamily: [] },
  })
  const distraction = makeItem('distraction', {
    wordFormation: {
      roots: [{ form: 'spect', meaning: '看', examples: [] }],
      prefixes: [],
      suffixes: [],
    },
  })

  it('connects direct synonyms and antonyms with signed weights', () => {
    const graph = buildWordGraph([focus, attention, distraction], { threshold: 1.5 })
    assert.equal(graph.nodes.length, 3)
    const synonym = graph.edges.find(
      (edge) =>
        (edge.source === focus.id && edge.target === attention.id) ||
        (edge.source === attention.id && edge.target === focus.id),
    )
    assert.equal(synonym?.positive, true)
    assert.equal(synonym?.type, 'synonym')

    const antonym = graph.edges.find(
      (edge) =>
        (edge.source === attention.id && edge.target === distraction.id) ||
        (edge.source === distraction.id && edge.target === attention.id),
    )
    assert.equal(antonym?.positive, false)
    assert.equal(antonym?.type, 'antonym')
  })

  it('connects words that share a root and honours the threshold', () => {
    const graph = buildWordGraph([focus, attention, distraction], { threshold: 1.5 })
    const rootEdge = graph.edges.find(
      (edge) =>
        (edge.source === focus.id && edge.target === distraction.id) ||
        (edge.source === distraction.id && edge.target === focus.id),
    )
    assert.equal(rootEdge?.type, 'root')
    assert.equal(rootEdge?.positive, true)

    const stricter = buildWordGraph([focus, attention, distraction], { threshold: 2 })
    assert.ok(!stricter.edges.some((edge) => edge.type === 'root'))
  })

  it('can omit negative edges and reports isolated nodes', () => {
    const graph = buildWordGraph([focus, attention, distraction], { threshold: 1.5, includeNegative: false })
    assert.ok(graph.edges.every((edge) => edge.positive))
    const isolated = makeItem('lonely')
    const withIsolated = buildWordGraph([focus, attention, distraction, isolated], { threshold: 1.5 })
    assert.equal(withIsolated.isolated, 1)
  })

  it('creates ghost nodes for relations outside the library', () => {
    const withGhost = buildWordGraph([focus, attention, distraction], { threshold: 1.5, includeGhosts: true })
    const withoutGhost = buildWordGraph([focus, attention, distraction], { threshold: 1.5, includeGhosts: false })
    assert.equal(withGhost.nodes.length, withoutGhost.nodes.length)

    const target = makeItem('focus', {
      relations: { synonyms: ['unlearned-word'], antonyms: [], confusables: [], wordFamily: [] },
    })
    const ghostGraph = buildWordGraph([target], { threshold: 1.5, includeGhosts: true })
    const ghost = ghostGraph.nodes.find((node) => node.lemma === 'unlearned-word')
    assert.equal(ghost?.ghost, true)
    assert.ok(ghostGraph.edges.some((edge) => edge.target === ghost?.id || edge.source === ghost?.id))
    assert.equal(buildWordGraph([target], { threshold: 1.5, includeGhosts: false }).nodes.length, 1)
  })

  it('can add context edges and morphology families', () => {
    const contextA = makeItem('alpha', {
      contexts: [{ resourceId: 'same-article', resourceTitle: 'A', segmentIndex: 0, sentence: 'Alpha.' }],
    })
    const contextB = makeItem('beta', {
      contexts: [{ resourceId: 'same-article', resourceTitle: 'A', segmentIndex: 1, sentence: 'Beta.' }],
    })
    const contextGraph = buildWordGraph([contextA, contextB], { threshold: 1.5, includeContext: true })
    assert.ok(contextGraph.edges.some((edge) => edge.type === 'context'))

    const familyGraph = buildWordGraph([focus, distraction], { threshold: 1.5, includeGhosts: false })
    assert.ok(familyGraph.families.some((family) => family.form === 'spect' && family.wordIds.length === 2))
  })
})
