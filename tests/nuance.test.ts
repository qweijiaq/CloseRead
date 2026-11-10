import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

import type { LearningItem } from '../src/types.js'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-nuance-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

let mode: 'valid' | 'bad' = 'valid'
let requests = 0
let server: http.Server

function send(response: http.ServerResponse, payload: unknown): void {
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }))
}

before(async () => {
  server = http.createServer((request, response) => {
    requests += 1
    request.resume()
    if (mode === 'bad') {
      send(response, {
        scenario: 'A short scene that is long enough to pass validation.',
        options: ['Only one option.', 'Only two options.'],
        answer: 0,
        explanation: 'This payload is incomplete.',
      })
      return
    }
    send(response, {
      scenario: 'At a team meeting, everyone is trying to follow a long presentation.',
      options: [
        'Her attention drifted away from the lecture.',
        'She paid attention on the lecture.',
        'The attention of the room was paid by her.',
      ],
      answer: 0,
      explanation: '第一句搭配自然；第二句介词错误；第三句结构不自然。',
    })
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

function makeItem(id: string): LearningItem {
  const now = new Date().toISOString()
  return {
    id,
    type: 'word_sense',
    lemma: 'attention',
    sense: 'focus',
    definition: 'the act of focusing on something',
    contexts: [{ resourceId: 'r', resourceTitle: 'Test', segmentIndex: 0, sentence: 'Attention is scarce.' }],
    collocations: ['pay attention to'],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Test',
    createdAt: now,
    updatedAt: now,
  }
}

describe('AI nuance quiz', () => {
  it('generates and caches a three-option usage puzzle', async () => {
    const { generateNuanceQuiz } = await import('../src/analyze/nuance.js')
    const item = makeItem('nuance-valid')
    requests = 0
    mode = 'valid'
    const quiz = await generateNuanceQuiz(item)
    assert.equal(quiz.lemma, 'attention')
    assert.equal(quiz.options.length, 3)
    assert.ok(quiz.answer >= 0 && quiz.answer < 3)
    assert.ok(quiz.options.every((option) => option.includes('attention')))
    assert.match(quiz.explanation, /第一句/)
    assert.equal(requests, 1)

    const cached = await generateNuanceQuiz(item)
    assert.deepEqual(cached, quiz)
    assert.equal(requests, 1)
  })

  it('rejects malformed model output', async () => {
    const { generateNuanceQuiz } = await import('../src/analyze/nuance.js')
    mode = 'bad'
    requests = 0
    await assert.rejects(() => generateNuanceQuiz(makeItem('nuance-bad')))
    assert.equal(requests, 1)
  })
})
