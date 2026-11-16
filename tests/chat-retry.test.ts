import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

import { z } from 'zod'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-chat-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

type Mode = 'retry-500' | 'empty-then-valid' | 'invalid-then-valid' | 'unauthorized' | 'drop-then-valid' | 'token-cap'

let mode: Mode = 'retry-500'
let requests = 0
let server: http.Server
let base = ''

function send(response: http.ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(payload))
}

before(async () => {
  server = http.createServer((request, response) => {
    requests += 1
    request.resume()
    if (mode === 'unauthorized') {
      send(response, 401, { error: 'invalid key' })
      return
    }
    if (mode === 'token-cap' && requests === 1) {
      send(response, 400, { error: 'max_tokens is too large: 8000 > 4096' })
      return
    }
    if (mode === 'drop-then-valid' && requests === 1) {
      // A gateway that times out or closes the socket mid-request.
      request.socket.destroy()
      return
    }
    if (mode === 'retry-500' && requests <= 2) {
      send(response, 500, { error: 'temporary' })
      return
    }
    if (mode === 'empty-then-valid' && requests === 1) {
      send(response, 200, { choices: [{ message: { content: '' } }] })
      return
    }
    if (mode === 'invalid-then-valid' && requests === 1) {
      send(response, 200, { choices: [{ message: { content: '{"ok" "yes",}' } }] })
      return
    }
    send(response, 200, { choices: [{ message: { content: '{"ok":true}' } }] })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  base = `http://127.0.0.1:${port}/v1`

  process.env.LEARN_PROVIDER = 'openai'
  process.env.LEARN_API_KEY = 'test-key'
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.LEARN_BASE_URL = base
  process.env.LEARN_MODEL = 'test-model'
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await fs.rm(temp, { recursive: true, force: true })
})

const schema = z.object({ ok: z.boolean() })

describe('LLM retry', () => {
  it('retries 5xx responses with backoff', async () => {
    const { chatJson } = await import('../src/analyze/chat.js')
    mode = 'retry-500'
    requests = 0
    const result = await chatJson(schema, 'system', 'user')
    assert.deepEqual(result, { ok: true })
    assert.equal(requests, 3)
  })

  it('retries an empty 200 response', async () => {
    const { chatJson } = await import('../src/analyze/chat.js')
    mode = 'empty-then-valid'
    requests = 0
    const result = await chatJson(schema, 'system', 'user')
    assert.deepEqual(result, { ok: true })
    assert.equal(requests, 2)
  })

  it('repairs trailing commas, fences and raw newlines', async () => {
    const { parseJson } = await import('../src/analyze/chat.js')
    assert.deepEqual(parseJson('```json\n{"ok":true,}\n```'), { ok: true })
    assert.deepEqual(parseJson('Here is the JSON: {"ok":true}'), { ok: true })
    assert.deepEqual(parseJson('{"ok":true,"note":"line\nbreak",}'), { ok: true, note: 'line\nbreak' })
  })

  it('escapes unescaped quotes inside string values', async () => {
    const { parseJson } = await import('../src/analyze/chat.js')
    assert.deepEqual(parseJson('{"summaryZh":"文章称"Netflix"正在失去剧情","titleZh":"x"}'), {
      summaryZh: '文章称"Netflix"正在失去剧情',
      titleZh: 'x',
    })
    assert.deepEqual(parseJson('{"a":"one","b":"他说："走吧"","c":1}'), {
      a: 'one',
      b: '他说："走吧"',
      c: 1,
    })
  })

  it('retries once when the reply is not valid JSON', async () => {
    const { chatJson } = await import('../src/analyze/chat.js')
    mode = 'invalid-then-valid'
    requests = 0
    const result = await chatJson(schema, 'system', 'user')
    assert.deepEqual(result, { ok: true })
    assert.equal(requests, 2)
  })

  it('retries a dropped connection instead of losing the chunk', async () => {
    const { chatJson } = await import('../src/analyze/chat.js')
    mode = 'drop-then-valid'
    requests = 0
    const result = await chatJson(schema, 'system', 'user')
    assert.deepEqual(result, { ok: true })
    assert.equal(requests, 2)
  })

  it('lowers max_tokens when the provider caps it', async () => {
    const { chatJson } = await import('../src/analyze/chat.js')
    mode = 'token-cap'
    requests = 0
    const result = await chatJson(schema, 'system', 'user', { maxTokens: 8000 })
    assert.deepEqual(result, { ok: true })
    assert.equal(requests, 2)
  })

  it('does not retry authentication failures', async () => {
    const { chatJson } = await import('../src/analyze/chat.js')
    mode = 'unauthorized'
    requests = 0
    await assert.rejects(() => chatJson(schema, 'system', 'user'), /401/)
    assert.equal(requests, 1)
  })
})
