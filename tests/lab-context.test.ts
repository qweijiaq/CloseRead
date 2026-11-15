import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-lab-context-'))
process.env.LEARN_DATA_DIR = temp
process.env.LEARN_PACKS_DIR = path.join(temp, 'packs')

const { storePath } = await import('../src/config.js')
const { Store } = await import('../src/store/store.js')
const { labPacks, loadLabPack, packPrompt } = await import('../src/lab/context.js')

function word(id: string, lemma: string, sentence: string, definitionZh: string) {
  const now = new Date().toISOString()
  return {
    id,
    type: 'word_sense' as const,
    lemma,
    sense: definitionZh,
    definition: definitionZh,
    definitionZh,
    contexts: sentence ? [{ resourceId: 'resource', resourceTitle: 'Article', segmentIndex: 0, sentence }] : [],
    collocations: [],
    examples: [],
    relations: { synonyms: [], antonyms: [], confusables: [], wordFamily: [] },
    tags: [],
    sourceRef: 'Article',
    createdAt: now,
    updatedAt: now,
  }
}

describe('vocabulary-based lab context', () => {
  after(async () => fs.rm(temp, { recursive: true, force: true }))

  it('builds scopes and prompts from learned words instead of packs', async () => {
    const store = await Store.open(storePath())
    await store.upsertItems([
      word('lab-1', 'attention', 'Attention is scarce on social platforms.', '注意力'),
      word('lab-2', 'resilience', 'Resilience helps teams recover from setbacks.', '韧性'),
      word('lab-3', 'orphan', '', '孤词'),
    ])

    const scopes = labPacks(store)
    assert.ok(scopes.some((scope) => scope.id === 'all' && scope.wordCount === 3))
    assert.ok(scopes.some((scope) => scope.id === 'new' && scope.wordCount === 3))

    const source = loadLabPack(store, 'all')
    assert.equal(source.pack.source, 'vocabulary')
    assert.equal(source.info.title, '全部学习词')
    assert.equal(source.words.length, 2)
    assert.ok(!source.words.some((item) => item.lemma === 'orphan'))
    assert.match(source.info.paragraphs[0]?.original ?? '', /Attention|Resilience/)
    assert.match(packPrompt(source.pack), /Vocabulary set:/)
    assert.match(packPrompt(source.pack), /attention/)
  })
})
