import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

import type { LearningItem, LearningPack } from '../src/types.js'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-lab-gen-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

let requests = 0
let server: http.Server

function send(response: http.ServerResponse, payload: unknown): void {
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }))
}

async function readBody(request: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

before(async () => {
  server = http.createServer(async (request, response) => {
    requests += 1
    const raw = await readBody(request)
    let system = ''
    try {
      const body = JSON.parse(raw) as { messages?: Array<{ role: string; content: string }> }
      system = body.messages?.find((message) => message.role === 'system')?.content ?? ''
    } catch {
      // Fall through with an empty system prompt.
    }
    if (system.includes('effective in plain Chinese')) {
      send(response, { commentary: '短句有节奏。', translation: '值得记住的一句。', tags: ['节奏'] })
    } else if (system.includes('English register coach')) {
      send(response, { model: 'Short version.', feedback: '更短，更直接。', notes: ['删掉客套话'], score: 4 })
    } else if (system.includes('solo English podcast')) {
      send(response, {
        title: 'The Attention Briefing',
        script: 'A short spoken briefing about attention and its cost. It ends with one practical takeaway.',
        segments: [{ heading: 'Hook', text: 'Attention is scarce.' }, { heading: 'Point', text: 'Platforms sell access.' }],
        questions: [{ question: 'What is scarce?', answer: 'Attention.' }],
      })
    } else if (system.includes('podcast between two hosts')) {
      send(response, {
        title: 'Two Hosts on Attention',
        turns: [
          { speaker: 'A', text: 'Attention is the product here.' },
          { speaker: 'B', text: 'But the user is also paying with time.' },
          { speaker: 'A', text: 'That is the hidden price.' },
          { speaker: 'B', text: 'So what should we do?' },
          { speaker: 'A', text: 'Notice the friction.' },
          { speaker: 'B', text: 'And choose it deliberately.' },
        ],
        questions: [{ question: 'What is the hidden price?', answer: 'Time.' }],
      })
    } else if (system.includes('personal English examples')) {
      send(response, {
        examples: [
          { en: 'I need to pay attention to the meeting.', zh: '我需要专心开会。' },
          { en: 'Her attention drifted during the call.', zh: '她打电话时走神了。' },
          { en: 'This app fights for your attention.', zh: '这个应用在争夺你的注意力。' },
        ],
        note: '把 attention 放进具体场景。',
      })
    } else if (system.includes('critical-reading coach')) {
      send(response, {
        claim: 'Attention is a commodity.',
        evidence: [
          { text: 'Platforms sell access to attention.', paragraph: 0 },
          { text: 'Attention cannot be stored for later.', paragraph: 0 },
        ],
        assumptions: ['Attention can be owned.'],
        counterpoints: ['Users still choose what to read.'],
      })
    } else if (system.includes('30-second vertical news short')) {
      send(response, {
        title: 'Attention in 30 Seconds',
        scenes: [
          { caption: 'The hidden price', narration: 'Your attention is being sold.', seconds: 7 },
          { caption: 'The trade', narration: 'Platforms sell access to your time.', seconds: 8 },
          { caption: 'The choice', narration: 'Friction can turn impulse into a decision.', seconds: 9 },
        ],
        hashtags: ['attention', 'reading'],
      })
    } else if (system.includes('listening game')) {
      send(response, {
        title: 'Price Watch',
        lines: [
          'They raised prices by 20 percent.',
          'The company reported steady growth.',
          'Readers spent more time on the app.',
          'The change starts next month.',
        ],
        errorLine: 0,
        wrong: '20 percent',
        correct: '12 percent',
        options: ['12 percent', '20 percent', '200 percent'],
        explanation: '听清数字，20 和 12 很容易混。',
      })
    } else if (system.includes('mini-drama')) {
      send(response, {
        title: 'The Pitch',
        setting: 'A small office meeting.',
        roles: ['Maya', 'Leo'],
        lines: [
          { role: 'Maya', text: 'We need to protect attention.', translation: '我们需要保护注意力。' },
          { role: 'Leo', text: 'But growth depends on it.', translation: '但增长依赖它。' },
          { role: 'Maya', text: 'Then growth has a cost.', translation: '那增长就有代价。' },
          { role: 'Leo', text: 'Let us measure it.', translation: '让我们衡量它。' },
          { role: 'Maya', text: 'Start with a small test.', translation: '先做个小测试。' },
          { role: 'Leo', text: 'Agreed.', translation: '同意。' },
        ],
      })
    } else if (system.includes('vocabulary dungeon')) {
      send(response, {
        rooms: [
          { name: 'The Gate', enemy: 'Clutter', intro: 'A fog of noise.' },
          { name: 'The Hall', enemy: 'Echo', intro: 'Words repeat.' },
          { name: 'The Vault', enemy: 'Gatekeeper', intro: 'The last door.' },
        ],
        boss: { name: 'The Gatekeeper', intro: 'It asks for one clear meaning.' },
        victory: 'The words are yours.',
      })
    } else if (system.includes('vocabulary pet')) {
      send(response, { line: '再复习三个词，我就长大了。' })
    } else if (system.includes('listening coach')) {
      send(response, { hint: '注意 percent 前面的数字。', focus: '数字' })
    } else if (system.includes('encouraging English writing coach')) {
      send(response, {
        feedback: '整体自然，有一个词有点硬塞。',
        natural: ['attention'],
        awkward: [{ word: 'commodity', why: '在这里像名词堆砌。' }],
        rewrite: 'I paid attention to the meeting and saved time.',
      })
    } else {
      send(response, { error: 'unknown prompt' })
    }
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

function makeItem(): LearningItem {
  const now = new Date().toISOString()
  return {
    id: 'lab-item',
    type: 'word_sense',
    lemma: 'attention',
    sense: 'focus',
    definition: 'the act of focusing',
    definitionZh: '注意力',
    contexts: [{ resourceId: 'r', resourceTitle: 'Test', segmentIndex: 0, sentence: 'Attention is scarce.' }],
    collocations: ['pay attention'],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Test',
    createdAt: now,
    updatedAt: now,
  }
}

function makePack(): LearningPack {
  const now = new Date().toISOString()
  return {
    id: 'pack-lab',
    resourceId: 'r',
    title: 'The Attention Test',
    source: 'test',
    mode: 'heuristic',
    generatedAt: now,
    summary: 'A short article about attention.',
    difficulty: { cefr: 'B2', reason: 'test' },
    stats: { wordCount: 40, itemCount: 1, readingMinutes: 1 },
    items: [makeItem()],
    exercises: { cloze: [], comprehension: [], discussion: [] },
    reading: [{ index: 0, original: 'Attention is scarce. Platforms sell access to it.', translation: '注意力是稀缺的。', itemIds: ['lab-item'] }],
  }
}

describe('lab AI generators', () => {
  it('generates all mission payloads and caches repeats', async () => {
    const {
      generateAdventureFeedback,
      generateArgumentMap,
      generateDictationHint,
      generateDubbing,
      generateDungeonFlavor,
      generateLifeExamples,
      generateNewsShort,
      generatePetLine,
      generatePodcast,
      generateQuoteInsight,
      generateRegisterRemix,
      generateSubtitleHunter,
    } = await import('../src/lab/generators.js')

    const pack = makePack()
    const item = makeItem()
    assert.match((await generateQuoteInsight('Attention is scarce.', 'Test')).commentary, /节奏/)
    assert.equal((await generateRegisterRemix(pack, 0, 'tweet')).score, 4)
    assert.equal((await generatePodcast(pack, 'solo')).mode, 'solo')
    const duo = await generatePodcast(pack, 'duo')
    assert.equal(duo.turns?.length, 6)
    assert.equal((await generateLifeExamples(item, '工作')).examples.length, 3)
    assert.match((await generateArgumentMap(pack)).claim, /commodity/i)
    assert.equal((await generateNewsShort(pack)).scenes.length, 3)
    const subtitle = await generateSubtitleHunter(pack)
    assert.match(subtitle.script, /12 percent/)
    assert.equal((await generateDubbing(pack)).roles.length, 2)
    assert.equal((await generateDungeonFlavor(['attention', 'commodity', 'friction'])).rooms.length, 3)
    assert.match(await generatePetLine({ stage: 'seed', streak: 1, reviews: 2, known: 1 }), /复习/)
    assert.equal((await generateAdventureFeedback(['attention'], 'I paid attention to the meeting.')).natural[0], 'attention')
    assert.equal((await generateDictationHint('They raised prices.', 'They raised price.')).focus, '数字')

    const before = requests
    await generateQuoteInsight('Attention is scarce.', 'Test')
    assert.equal(requests, before)
  })

  it('serves lab generation and quote commentary over HTTP', async () => {
    const { writePack } = await import('../src/pack/build.js')
    const { Store } = await import('../src/store/store.js')
    const { storePath } = await import('../src/config.js')
    const { startReviewServer } = await import('../src/review/server.js')
    const resource = {
      id: 'lab-resource',
      title: 'The Attention Test',
      kind: 'text' as const,
      source: 'test',
      text: 'Attention is scarce. Platforms sell access to it.',
      wordCount: 9,
      segments: [{ index: 0, text: 'Attention is scarce. Platforms sell access to it.' }],
      metadata: {},
      createdAt: new Date().toISOString(),
    }
    const result = await writePack(resource, {
      analysis: {
        summary: 'A short article about attention.',
        difficulty: { cefr: 'B2', reason: 'test' },
        items: [],
        exercises: { cloze: [], comprehension: [], discussion: [] },
        notes: [],
        reading: [{ index: 0, original: resource.text, translation: '注意力是稀缺的。', itemIds: [] }],
      },
      mode: 'heuristic',
      notes: [],
      selection: { mode: 'auto', recommended: 0, core: 0, bonus: 0, wordCount: 9, cefr: 'B2', reason: 'test' },
    }, { outDir: path.join(temp, 'packs', resource.id), audio: false })
    const store = await Store.open(storePath())
    await store.addResource(resource)
    await store.addPack(result.record)
    const now = new Date().toISOString()
    await store.upsertItems([{
      id: 'lab-attention',
      type: 'word_sense',
      lemma: 'attention',
      sense: 'focus',
      definition: 'the act of focusing',
      definitionZh: '注意力',
      contexts: [{ resourceId: resource.id, resourceTitle: resource.title, segmentIndex: 0, sentence: 'Attention is scarce.' }],
      collocations: [],
      examples: [],
      relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
      tags: [],
      sourceRef: resource.title,
      createdAt: now,
      updatedAt: now,
    }])
    const server = await startReviewServer({ port: 0 })
    try {
      const status = (await fetch(`${server.url}/api/lab?scope=all`).then((response) => response.json())) as {
        pack: { id: string }
        status: { llm: boolean }
      }
      assert.equal(status.pack.id, 'all')
      assert.equal(status.status.llm, true)

      const podcast = await fetch(`${server.url}/api/lab/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ feature: 'podcast', scope: 'all' }),
      }).then((response) => response.json()) as { podcast: { title: string } }
      assert.equal(podcast.podcast.title, 'The Attention Briefing')

      const quote = await fetch(`${server.url}/api/lab/quotes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'Attention is scarce.', sourceTitle: 'Test' }),
      }).then((response) => response.json()) as { quote: { id: string } }
      const commentary = await fetch(`${server.url}/api/lab/quotes/${quote.quote.id}/commentary`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }).then((response) => response.json()) as { quote: { commentary: string; translation?: string } }
      assert.match(commentary.quote.commentary, /节奏/)
      assert.equal(commentary.quote.translation, '值得记住的一句。')
    } finally {
      await server.close()
    }
  })
})
