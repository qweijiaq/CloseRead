import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-models-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

const { listProviderModels } = await import('../src/llm/models.js')
const { normalizeLlmProvider, providerExtraHeaders, providerPreset } = await import(
  '../src/llm/providers.js'
)

let server: http.Server
let base = ''

before(async () => {
  server = http.createServer((request, response) => {
    request.resume()
    if (request.url !== '/v1/models') {
      response.writeHead(404).end()
      return
    }
    const auth = request.headers.authorization ?? ''
    if (auth !== 'Bearer good-key') {
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: { code: 'invalid_api_key', message: 'api key not found' } }))
      return
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify({
        object: 'list',
        data: [{ id: 'zeta-model' }, { id: 'alpha-model' }, { id: 'models/beta-model' }],
      }),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await fs.rm(temp, { recursive: true, force: true })
})

describe('model catalogue refresh', () => {
  it('uses the key and base URL from the form, not the saved settings', async () => {
    const models = await listProviderModels({
      provider: 'custom',
      apiKey: 'good-key',
      baseUrl: `${base}/v1`,
    })
    assert.deepEqual(models, ['alpha-model', 'beta-model', 'zeta-model'])
  })

  it('surfaces the provider error when the key is wrong', async () => {
    await assert.rejects(
      () => listProviderModels({ provider: 'custom', apiKey: 'bad-key', baseUrl: `${base}/v1` }),
      /401/,
    )
  })

  it('explains what is missing instead of failing silently', async () => {
    await assert.rejects(() => listProviderModels({ provider: 'custom', apiKey: '' }), /API Key/)
  })
})

describe('gateway providers', () => {
  it('accepts friendly aliases', () => {
    assert.equal(normalizeLlmProvider('zen'), 'opencode')
    assert.equal(normalizeLlmProvider('opencode-zen'), 'opencode')
    assert.equal(normalizeLlmProvider('go'), 'opencode-go')
    assert.equal(normalizeLlmProvider('OpenCodeGo'), 'opencode-go')
    assert.equal(normalizeLlmProvider('opendesign'), 'open-design')
    assert.equal(normalizeLlmProvider('open-design'), 'open-design')
  })

  it('ships a usable preset for each new provider', () => {
    for (const id of ['opencode', 'opencode-go', 'open-design'] as const) {
      const preset = providerPreset(id)
      assert.equal(preset.id, id)
      assert.match(preset.baseUrl, /^https:\/\//)
      assert.ok(preset.model.length > 0)
      assert.ok(preset.label.length > 0)
    }
  })

  it('sends a stable session header to the OpenCode gateways', () => {
    const first = providerExtraHeaders('opencode-go')
    const second = providerExtraHeaders('opencode-go')
    assert.match(first['x-opencode-session'] ?? '', /.+/)
    assert.equal(first['x-opencode-session'], second['x-opencode-session'])
    assert.deepEqual(providerExtraHeaders('opencode')['x-opencode-session']?.length, 36)
    assert.deepEqual(providerExtraHeaders('openai'), {})
    assert.deepEqual(providerExtraHeaders('open-design'), {})
  })
})
