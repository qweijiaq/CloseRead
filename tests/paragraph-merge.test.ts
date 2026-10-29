import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeSourceParagraphs, shouldMergeFragment } from '../src/pack/paragraph-merge.js'

describe('layout paragraph merging', () => {
  it('merges a standalone quote and attribution into the previous paragraph', () => {
    const previous =
      'But it is getting harder for Netflix to stand out, and its response to the new competition looks increasingly haphazard.'
    assert.equal(shouldMergeFragment(previous, '"It\'s YouTube panic," says Mr Harrington of Enders.'), true)
  })

  it('merges a short standalone topic sentence into the next paragraph', () => {
    assert.equal(
      shouldMergeFragment(
        'Lacklustre content is not the only reason for investors’ disgruntlement.',
        'During the past year Netflix tried and failed to acquire the studios.',
      ),
      true,
    )
  })

  it('merges a contrastive short paragraph back into the previous one', () => {
    assert.equal(
      shouldMergeFragment(
        'Given the scale of the crisis, you might think they would marshal their resources at home.',
        'Instead, they are tussling for influence farther afield.',
      ),
      true,
    )
  })

  it('joins a quote after a colon', () => {
    assert.equal(
      shouldMergeFragment('As Maria Rua Agouti puts it:', '"People watch YouTube but they pay for Netflix."'),
      true,
    )
  })

  it('joins a lower-case continuation and leaves headings alone', () => {
    assert.equal(shouldMergeFragment('The company said', 'it would cut costs.'), true)
    assert.equal(shouldMergeFragment('Some paragraph.', 'BUSINESS'), false)
  })

  it('keeps a title block separate from the first paragraph', () => {
    const text = [
      'Is Netflix losing the plot?',
      '',
      'Last week Netflix unleashed a round of bloodletting in Hollywood.',
    ].join('\n')
    const normalized = normalizeSourceParagraphs(text, 'Is Netflix losing the plot?')
    assert.equal(normalized.split(/\n{2,}/).length, 2)
    assert.ok(normalized.startsWith('Is Netflix losing the plot?\n\nLast week'))
  })

  it('normalizes source blocks before the reading pass', () => {
    const source = [
      'Like other streaming services, Netflix is reacting. But it is getting harder to stand out.',
      '',
      '"It\'s YouTube panic," says Mr Harrington of Enders.',
      '',
      'For all that, Netflix has one strength.',
    ].join('\n')
    const normalized = normalizeSourceParagraphs(source)
    assert.ok(normalized.includes('looks increasingly haphazard.') === false)
    assert.ok(normalized.includes('getting harder to stand out. "It\'s YouTube panic,"'))
    assert.equal(normalized.split(/\n{2,}/).length, 2)
  })
})
