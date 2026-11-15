import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

import { FeedbackBoard } from '../src/community/feedback.js'

let dir = ''

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-feedback-'))
})

after(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

const file = (): string => path.join(dir, 'feedback.json')

describe('feedback board', () => {
  it('stores an item and votes for it automatically', async () => {
    const board = new FeedbackBoard(file())
    const added = await board.add('visitor-a', { kind: 'idea', body: '想要按章节导出' })
    assert.equal(added.ok, true)

    const list = await board.list('visitor-a')
    assert.equal(list.items.length, 1)
    assert.equal(list.items[0]!.votes, 1)
    assert.equal(list.items[0]!.voted, true)
    assert.equal(list.counts.open, 1)
    // The public shape must not leak voter identities.
    assert.equal('voters' in list.items[0]!, false)
  })

  it('toggles a vote and keeps counts consistent', async () => {
    const board = new FeedbackBoard(file())
    const added = await board.add('visitor-a', { kind: 'bug', body: '导入某个网页时正文没抓全' })
    assert.ok(added.ok)
    const id = added.ok ? added.item.id : ''

    const off = await board.vote(id, 'visitor-a')
    assert.deepEqual(off, { ok: true, votes: 0, voted: false })
    const on = await board.vote(id, 'visitor-a')
    assert.deepEqual(on, { ok: true, votes: 1, voted: true })

    const other = await board.vote(id, 'visitor-b')
    assert.equal(other.votes, 2)
    const list = await board.list('visitor-b')
    assert.equal(list.items[0]!.votes, 2)
    assert.equal(list.items[0]!.voted, true)
  })

  it('validates and rate limits submissions', async () => {
    const board = new FeedbackBoard(path.join(dir, 'limited.json'))
    const short = await board.add('spammer', { kind: 'idea', body: ' hi ' })
    assert.equal(short.ok, false)

    for (let i = 0; i < 5; i += 1) {
      const result = await board.add('spammer', { kind: 'idea', body: `第 ${i} 条意见内容` })
      assert.equal(result.ok, true)
    }
    const blocked = await board.add('spammer', { kind: 'idea', body: '第六条应该被拦下' })
    assert.equal(blocked.ok, false)
  })

  it('lets the owner move status and keeps it on disk', async () => {
    const board = new FeedbackBoard(path.join(dir, 'status.json'))
    const added = await board.add('visitor-a', { kind: 'idea', body: '希望支持深色导出' })
    assert.ok(added.ok)
    const id = added.ok ? added.item.id : ''

    assert.equal(await board.setStatus(id, 'planned', '下个版本做'), true)
    assert.equal(await board.setStatus('missing', 'fixed'), false)

    const reopened = new FeedbackBoard(path.join(dir, 'status.json'))
    const list = await reopened.list('visitor-a')
    assert.equal(list.items[0]!.status, 'planned')
    assert.equal(list.items[0]!.reply, '下个版本做')
    assert.equal(list.counts.planned, 1)
  })

  it('lets the owner remove an item', async () => {
    const board = new FeedbackBoard(path.join(dir, 'remove.json'))
    const added = await board.add('visitor-a', { kind: 'idea', body: '这条会被删掉' })
    assert.ok(added.ok)
    const id = added.ok ? added.item.id : ''
    assert.equal(await board.remove(id), true)
    assert.equal(await board.remove(id), false)
    assert.equal((await board.list('visitor-a')).items.length, 0)
  })

  it('sees changes made by another process', async () => {
    const file = path.join(dir, 'outside.json')
    const board = new FeedbackBoard(file)
    const added = await board.add('visitor-a', { kind: 'idea', body: '外部修改应该生效' })
    assert.ok(added.ok)
    const id = added.ok ? added.item.id : ''
    assert.equal((await board.list('visitor-a')).items[0]!.status, 'open')

    // Simulate the CLI editing the same file from another process.
    const other = new FeedbackBoard(file)
    await other.setStatus(id, 'fixed', '已经修复了')

    const list = await board.list('visitor-a')
    assert.equal(list.items[0]!.status, 'fixed')
    assert.equal(list.items[0]!.reply, '已经修复了')
  })

  it('finds an item by id prefix for the CLI', async () => {
    const board = new FeedbackBoard(path.join(dir, 'find.json'))
    const added = await board.add('visitor-a', { kind: 'idea', body: '支持导出 zip' })
    assert.ok(added.ok)
    const id = added.ok ? added.item.id : ''
    const found = await board.find(id.slice(0, 4))
    assert.equal(found?.id, id)
  })
})
