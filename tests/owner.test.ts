import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const tempData = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-owner-data-'))
const tempPacks = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-owner-packs-'))
process.env.LEARN_DATA_DIR = tempData
process.env.LEARN_PACKS_DIR = tempPacks
process.env.LEARN_RUN_DIR = path.join(tempData, 'run')
process.env.LEARN_PUBLIC_HOST = 'owner.example.com'
process.env.LEARN_OWNER_KEY = 'owner-key-for-tests-0123456789'

const { startReviewServer } = await import('../src/review/server.js')
const { ownerVisitorId, isOwnerVisitor } = await import('../src/review/visitors.js')

function cookieFrom(response: Response): string {
  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
}

describe('owner identity', () => {
  let server: Awaited<ReturnType<typeof startReviewServer>>
  let base = ''

  before(async () => {
    server = await startReviewServer({ port: 0 })
    base = server.url
  })

  after(async () => {
    await server.close()
    await fs.rm(tempData, { recursive: true, force: true })
    await fs.rm(tempPacks, { recursive: true, force: true })
  })

  it('derives an unguessable id from the owner key', () => {
    const id = ownerVisitorId()
    assert.match(id, /^owner-[A-Za-z0-9_-]{22}$/)
    assert.notEqual(id, 'owner-main')
    assert.equal(isOwnerVisitor(id), true)
    assert.equal(isOwnerVisitor('owner-main'), false)
    assert.equal(isOwnerVisitor('visitor-abc'), false)
  })

  it('hands the owner cookie to the owner link', async () => {
    const response = await fetch(`${base}/?owner=${process.env.LEARN_OWNER_KEY}`, { redirect: 'manual' })
    assert.equal(response.status, 302)
    const cookie = cookieFrom(response)
    assert.equal(cookie, `cr_visitor=${ownerVisitorId()}`)
  })

  it('rejects a forged owner cookie', async () => {
    const visitor = cookieFrom(await fetch(`${base}/api/summary`))
    const created = await fetch(`${base}/api/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base, cookie: visitor },
      body: JSON.stringify({ kind: 'idea', body: '这条用来测试权限' }),
    })
    assert.equal(created.status, 200)
    const item = (await created.json()) as { item: { id: string } }

    const forged = await fetch(`${base}/api/feedback/${item.item.id}/status`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        cookie: 'cr_visitor=owner-main',
      },
      body: JSON.stringify({ status: 'planned' }),
    })
    assert.equal(forged.status, 403)

    const del = await fetch(`${base}/api/feedback/${item.item.id}`, {
      method: 'DELETE',
      headers: { origin: base, cookie: 'cr_visitor=owner-main' },
    })
    assert.equal(del.status, 403)
  })

  it('lets the real owner change and delete feedback', async () => {
    const ownerCookie = ownerVisitorId()
    const item = (
      await fetch(`${base}/api/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base, cookie: 'cr_visitor=abcdefgh' },
        body: JSON.stringify({ kind: 'bug', body: '作者应该能处理这条' }),
      }).then((response) => response.json())
    ) as { item: { id: string } }

    const status = await fetch(`${base}/api/feedback/${item.item.id}/status`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: base,
        cookie: `cr_visitor=${ownerCookie}`,
      },
      body: JSON.stringify({ status: 'fixed' }),
    })
    assert.equal(status.status, 200)

    const list = (await fetch(`${base}/api/feedback`, {
      headers: { cookie: `cr_visitor=${ownerCookie}` },
    }).then((response) => response.json())) as { owner: boolean; items: Array<{ status: string }> }
    assert.equal(list.owner, true)
    assert.ok(list.items.some((entry) => entry.status === 'fixed'))

    const removed = await fetch(`${base}/api/feedback/${item.item.id}`, {
      method: 'DELETE',
      headers: { origin: base, cookie: `cr_visitor=${ownerCookie}` },
    })
    assert.equal(removed.status, 200)
  })
})
