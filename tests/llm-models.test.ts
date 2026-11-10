import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { modelIdsFromResponse } from '../src/llm/models.js'

describe('provider model discovery', () => {
  it('reads OpenAI and Anthropic data arrays', () => {
    assert.deepEqual(
      modelIdsFromResponse({ data: [{ id: 'gpt-a' }, { id: 'gpt-b' }, { id: 'gpt-a' }] }),
      ['gpt-a', 'gpt-b'],
    )
    assert.deepEqual(modelIdsFromResponse({ models: [{ name: 'claude-a' }] }), ['claude-a'])
    assert.deepEqual(modelIdsFromResponse({ models: [{ name: 'models/gemini-a' }] }), ['gemini-a'])
  })

  it('accepts plain arrays and model_ids, and ignores invalid entries', () => {
    assert.deepEqual(modelIdsFromResponse(['b', 'a', 'b', null, 3]), ['a', 'b'])
    assert.deepEqual(modelIdsFromResponse({ model_ids: ['m1', { model: 'm2' }] }), ['m1', 'm2'])
    assert.deepEqual(modelIdsFromResponse({ data: [{}] }), [])
  })
})
