import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-ai-clean-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

let mode: 'normal' | 'over-remove' = 'normal'
let server: http.Server

function send(response: http.ServerResponse, remove: number[]): void {
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ remove, reason: 'test' }) } }],
    }),
  )
}

before(async () => {
  server = http.createServer(async (request, response) => {
    for await (const _chunk of request) {
      // Drain the request body before replying.
    }
    if (mode === 'over-remove') send(response, [0, 1, 2, 3, 4, 5])
    else send(response, [2, 4])
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  process.env.LEARN_PROVIDER = 'openai'
  process.env.LEARN_API_KEY = 'test-key'
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.LEARN_BASE_URL = `http://127.0.0.1:${port}/v1`
  process.env.LEARN_MODEL = 'test-model'
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await fs.rm(temp, { recursive: true, force: true })
})

const article = `The Quiet Cost of Attention

Attention is the raw material of the attention economy. It is scarce, and it cannot be stored.

Subscribe to our newsletter for more stories like this.

Platforms sell access to the people whose attention they have collected.

Share this article with a friend.

Friction can turn an impulse into a decision. That is why some products charge for use.`

describe('AI article cleanup', () => {
  it('removes only the blocks the model flags', async () => {
    const { cleanArticleWithAi } = await import('../src/ingest/ai-clean.js')
    mode = 'normal'
    const cleaned = await cleanArticleWithAi(article, 'The Quiet Cost of Attention')
    assert.equal(cleaned.removed, 2)
    assert.match(cleaned.text, /Attention is the raw material/)
    assert.match(cleaned.text, /Friction can turn an impulse/)
    assert.doesNotMatch(cleaned.text, /Subscribe to our newsletter/)
    assert.doesNotMatch(cleaned.text, /Share this article/)
  })

  it('keeps the original when the model wants to remove too much', async () => {
    const { cleanArticleWithAi } = await import('../src/ingest/ai-clean.js')
    mode = 'over-remove'
    const cleaned = await cleanArticleWithAi(article, 'The Quiet Cost of Attention')
    assert.equal(cleaned.skipped, true)
    assert.equal(cleaned.removed, 0)
    assert.equal(cleaned.text, article)
  })

  it('applies cleanup during text ingestion and records metadata', async () => {
    const { ingestText } = await import('../src/ingest/index.js')
    mode = 'normal'
    const resource = await ingestText(article, { title: 'Cleaned article', aiClean: true })
    assert.match(resource.text, /Attention is the raw material/)
    assert.doesNotMatch(resource.text, /Subscribe to our newsletter/)
    assert.equal(resource.metadata.aiClean, 1)
    assert.equal(resource.metadata.aiRemoved, 2)
    assert.ok(resource.segments.length > 0)
  })
})
