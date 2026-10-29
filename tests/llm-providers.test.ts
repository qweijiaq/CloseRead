import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LLM_PROVIDERS, isLlmProvider, normalizeLlmProvider, providerPreset } from '../src/llm/providers.js'

describe('LLM provider presets', () => {
  it('lists the supported providers with usable defaults', () => {
    const ids = LLM_PROVIDERS.map((provider) => provider.id)
    assert.deepEqual(ids, ['anthropic', 'openai', 'deepseek', 'google', 'alibaba', 'xai', 'glm', 'moonshot', 'custom'])
    for (const provider of LLM_PROVIDERS) {
      assert.ok(provider.baseUrl.startsWith('https://'))
      assert.ok(provider.model.length > 0)
      assert.ok(provider.label.length > 0)
    }
  })

  it('recognizes valid provider ids and falls back safely', () => {
    assert.equal(isLlmProvider('deepseek'), true)
    assert.equal(isLlmProvider('unknown'), false)
    assert.equal(providerPreset('glm').model, 'glm-5.3-flash')
    assert.equal(providerPreset('unknown').id, 'anthropic')
    assert.equal(normalizeLlmProvider('zhipu'), 'glm')
    assert.equal(normalizeLlmProvider('qwen'), 'alibaba')
    assert.equal(normalizeLlmProvider('claude'), 'anthropic')
  })
})
