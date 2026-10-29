import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { detectBodyLead, extractStandfirst, splitDatedBody } from '../src/analyze/reading-frontmatter.js'
import type { LearningPack } from '../src/types.js'

const source = `China | Stressed universities

China's universities are rich. But they're getting squeezed Researchers can't escape a bleak economy Oct 22nd 2026 In its competition with China, America sometimes commits self-sabotage.

Under Donald Trump, cuts in federal support for universities have been particularly damaging.`

const title = 'China’s universities are rich. But they’re getting squeezed'

function makePack(lead: string, paragraph: string): LearningPack {
  return {
    id: 'pack-head',
    resourceId: 'r',
    title,
    source: 'sample',
    mode: 'llm',
    generatedAt: new Date().toISOString(),
    summary: 'Summary',
    difficulty: { cefr: 'C1', reason: 'test' },
    stats: { wordCount: 100, itemCount: 0, readingMinutes: 1 },
    items: [],
    exercises: { cloze: [], comprehension: [], discussion: [] },
    sourceText: source,
    frontMatter: {
      title,
      lead,
      itemIds: [],
    },
    reading: [{ index: 0, original: paragraph, translation: '译文', itemIds: [] }],
  }
}

describe('article head extraction', () => {
  it('takes the deck before the date, never the first body sentence', () => {
    assert.equal(extractStandfirst(source, title), "Researchers can't escape a bleak economy")
  })

  it('splits a body sentence glued to the dated header', () => {
    const split = splitDatedBody(source, title)
    assert.ok(split.includes("2026\n\nIn its competition with China, America sometimes commits self-sabotage."))
    assert.ok(!split.includes('2026 In its competition'))
    assert.ok(split.includes('self-sabotage. Under Donald Trump'))
  })

  it('does not invent a standfirst when the source has no dated deck', () => {
    const plain = 'Chinese universities are rich.\n\nIn its competition with China, America sometimes commits self-sabotage.'
    assert.equal(extractStandfirst(plain, title), undefined)
    assert.equal(splitDatedBody(plain, title), plain)
  })

  it('detects a stored body sentence that was promoted to lead', () => {
    const pack = makePack('In its competition with China, America sometimes commits self-sabotage.', 'Under Donald Trump, cuts happened.')
    assert.equal(
      detectBodyLead(pack),
      'In its competition with China, America sometimes commits self-sabotage.',
    )
    const fixed = makePack('Researchers can not escape a bleak economy', 'In its competition with China, America sometimes commits self-sabotage. Under Donald Trump, cuts happened.')
    assert.equal(detectBodyLead(fixed), undefined)
  })
})
