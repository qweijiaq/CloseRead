import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { rawItemSchema, looseStringList } from '../src/analyze/item-schema.js'

const base = {
  lemma: 'attention',
  sense: 'notice paid to something',
  definition: 'the act of noticing something',
  contextSentence: 'Attention has quietly become the scarcest resource.',
}

describe('loose string lists', () => {
  it('accepts the object shapes models actually return', () => {
    const parsed = rawItemSchema.parse({
      ...base,
      wordFamily: [{ word: 'attentive' }, { text: 'attentively' }, 'attention span'],
    })
    assert.deepEqual(parsed.wordFamily, ['attentive', 'attentively', 'attention span'])
  })

  it('drops empty entries and keeps plain strings untouched', () => {
    const parsed = rawItemSchema.parse({
      ...base,
      synonyms: ['heed', '  ', { note: 'no recognised key' }, 42],
    })
    assert.deepEqual(parsed.synonyms, ['heed', '42'])
  })

  it('accepts a single string and defaults when the field is missing', () => {
    assert.deepEqual(rawItemSchema.parse(base).collocations, [])
    assert.deepEqual(rawItemSchema.parse({ ...base, examples: 'one example' }).examples, ['one example'])
  })

  it('exposes the same leniency through the standalone helper', () => {
    const schema = looseStringList()
    assert.deepEqual(schema.parse([{ phrase: 'pay attention' }]), ['pay attention'])
    assert.deepEqual(schema.parse(undefined), [])
  })
})
