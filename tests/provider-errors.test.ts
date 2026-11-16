import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { describeLlmFailure } from '../src/analyze/index.js'
import { normalizeBaseUrl } from '../src/config.js'

describe('provider diagnostics', () => {
  it('names the likely cause instead of dumping the provider error', () => {
    assert.match(describeLlmFailure('LLM request failed (401): invalid key'), /Key 无效/)
    assert.match(describeLlmFailure('LLM request failed (404): model not found'), /Base URL 或模型名/)
    assert.match(describeLlmFailure('LLM request failed (429): rate limit'), /限流或额度/)
    assert.match(describeLlmFailure('The operation was aborted due to timeout'), /超时/)
    assert.match(describeLlmFailure('LLM reply was cut off by the output limit.'), /截断/)
    assert.equal(describeLlmFailure('something odd'), '模型调用失败')
  })

  it('strips the endpoint people paste into Base URL', () => {
    assert.equal(normalizeBaseUrl('https://api.openai.com/v1/'), 'https://api.openai.com/v1')
    assert.equal(normalizeBaseUrl('https://gateway.example/v1/chat/completions'), 'https://gateway.example/v1')
    assert.equal(normalizeBaseUrl('https://gateway.example/v1/completions'), 'https://gateway.example/v1')
    assert.equal(normalizeBaseUrl('https://gateway.example'), 'https://gateway.example')
  })
})
