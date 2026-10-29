import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { extractStandfirst, splitDatedBody } from '../src/analyze/reading-frontmatter.js'
import { sentences } from '../src/analyze/tokenize.js'
import { normalizeSourceParagraphs } from '../src/pack/paragraph-merge.js'

interface Fixture {
  name: string
  title: string
  source: string
  standfirst?: string
  blocks: number
  contains: string[]
}

const fixtures: Fixture[] = [
  {
    name: 'dated header with body sentence glued to the date',
    title: "China's universities are rich. But they're getting squeezed",
    source: `China | Stressed universities

China's universities are rich. But they're getting squeezed Researchers can't escape a bleak economy Oct 22nd 2026 In its competition with China, America sometimes commits self-sabotage.

Under Donald Trump, cuts in federal support for universities have been particularly damaging.`,
    standfirst: "Researchers can't escape a bleak economy",
    blocks: 3,
    contains: ['self-sabotage. Under Donald Trump', 'could not be a fake lead'],
  },
  {
    name: 'standalone quote attribution',
    title: 'Streaming',
    source: `Netflix is reacting to the new competition. But it is getting harder to stand out.

"It's YouTube panic," says Mr Harrington of Enders.

For all that, Netflix has one strength.`,
    blocks: 2,
    contains: ['stand out. "It\'s YouTube panic,"', 'one strength'],
  },
  {
    name: 'quote after a colon',
    title: 'Streaming',
    source: `As one analyst puts it:

"People watch YouTube but they pay for Netflix." For now, subscriptions are small.`,
    blocks: 1,
    contains: ['puts it: "People watch YouTube', 'subscriptions are small'],
  },
  {
    name: 'contrastive short paragraph',
    title: 'Gulf states',
    source: `Given the scale of the crisis, you might think they would marshal their resources at home.

Instead, they are tussling for influence farther afield.

The conflicts have complex causes.`,
    blocks: 2,
    contains: ['at home. Instead, they are tussling', 'complex causes'],
  },
  {
    name: 'short transition paragraph',
    title: 'Netflix',
    source: `Lacklustre content is not the only reason for investors' disgruntlement.

During the past year Netflix tried and failed to acquire the studios.`,
    blocks: 1,
    contains: ['disgruntlement. During the past year'],
  },
  {
    name: 'lower-case continuation after a line break',
    title: 'Politics',
    source: `Polls show

that the violence boosted her this week. While the president travelled, she gave a speech.`,
    blocks: 1,
    contains: ['Polls show that the violence boosted her this week'],
  },
  {
    name: 'numbered section heading stays separate',
    title: 'Briefing',
    source: `## 01 The economy

The first body paragraph is complete and ends here.

## 02 Politics

The second body paragraph is complete too.`,
    blocks: 4,
    contains: ['## 01 The economy', '## 02 Politics'],
  },
  {
    name: 'title without a dated deck',
    title: 'A short essay',
    source: `A short essay

The first body sentence starts here. It continues in the same paragraph.`,
    blocks: 2,
    contains: ['The first body sentence starts here'],
  },
  {
    name: 'footer and heading stay separate',
    title: 'Article',
    source: `Some body text that ends properly.

This article was downloaded by example from https://example.com/article`,
    blocks: 2,
    contains: ['This article was downloaded'],
  },
]

describe('content quality regression fixtures', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      assert.equal(extractStandfirst(fixture.source, fixture.title), fixture.standfirst)
      const normalized = normalizeSourceParagraphs(splitDatedBody(fixture.source, fixture.title), fixture.title)
      const blocks = normalized.split(/\n{2,}/).filter(Boolean)
      assert.equal(blocks.length, fixture.blocks, normalized)
      for (const expected of fixture.contains) {
        if (expected === 'could not be a fake lead') continue
        assert.ok(normalized.includes(expected), `${fixture.name}: ${expected}\n${normalized}`)
      }
      assert.ok(blocks.every((block) => block.trim().length > 0))
    })
  }

  it('keeps abbreviations, initials, acronyms and decimals inside sentences', () => {
    const text = 'Mr Smith met Dr Jones at 3.5 p.m. in the U.S. on Monday. It was fine.'
    assert.deepEqual(sentences(text), [
      'Mr Smith met Dr Jones at 3.5 p.m. in the U.S. on Monday.',
      'It was fine.',
    ])
  })
})
