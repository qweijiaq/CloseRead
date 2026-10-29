import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { groupsFromIds, planExportPages, validatePagePlan } from '../src/pack/page-plan.js'
import { intensiveReadingMinutes } from '../src/pack/reading-time.js'

const blocks = [
  { id: 'cover', label: '封面', kind: 'cover', height: 900 },
  { id: 'guide', label: '导读', kind: 'section', height: 1800 },
  { id: 'reading-heading', label: '逐段精读', kind: 'heading', height: 120 },
  { id: 'para-01', label: '第 01 段', kind: 'paragraph', height: 2400 },
  { id: 'para-02', label: '第 02 段', kind: 'paragraph', height: 2300 },
  { id: 'sentence-heading', label: '句子卡', kind: 'heading', height: 120 },
  { id: 'sentence-1', label: '句子卡 1', kind: 'sentence', height: 1000 },
]

describe('export page plan', () => {
  it('packs blocks under the height cap without splitting one', () => {
    const groups = planExportPages(blocks, 5000)
    assert.ok(groups.length >= 2)
    const ids = groups.flatMap((group) => group.blocks.map((block) => block.id))
    assert.deepEqual(ids, blocks.map((block) => block.id))
    for (const group of groups) {
      if (group.blocks.length > 1) assert.ok(group.height <= 5000)
    }
  })

  it('does not leave a section heading at the bottom of a page', () => {
    const groups = planExportPages(blocks, 5000)
    for (let index = 0; index < groups.length - 1; index++) {
      const group = groups[index]!
      assert.notEqual(group.blocks[group.blocks.length - 1]?.kind, 'heading')
    }
  })

  it('validates AI plans and reconstructs groups', () => {
    const pages = [['cover', 'guide'], ['reading-heading', 'para-01'], ['para-02', 'sentence-heading', 'sentence-1']]
    assert.equal(validatePagePlan(blocks, pages, 5000), true)
    const groups = groupsFromIds(blocks, pages)
    assert.deepEqual(groups.map((group) => group.blocks.length), [2, 2, 3])

    assert.equal(validatePagePlan(blocks, [['cover', 'guide'], ['para-01']], 5000), false)
    assert.equal(validatePagePlan(blocks, [['guide', 'cover'], ['reading-heading', 'para-01'], ['para-02', 'sentence-heading', 'sentence-1']], 5000), false)
    assert.equal(validatePagePlan(blocks, [['cover', 'guide'], ['reading-heading'], ['para-01', 'para-02', 'sentence-heading', 'sentence-1']], 5000), false)
  })
})

describe('intensive reading time', () => {
  it('uses close-reading speed instead of skimming speed', () => {
    const minutes = intensiveReadingMinutes({ wordCount: 1037, paragraphs: 15, items: 16 })
    assert.ok(minutes >= 25 && minutes <= 40, `unexpected estimate: ${minutes}`)
  })

  it('still gives a short article a realistic lower bound', () => {
    assert.ok(intensiveReadingMinutes({ wordCount: 200, paragraphs: 2, items: 3 }) >= 5)
  })
})
