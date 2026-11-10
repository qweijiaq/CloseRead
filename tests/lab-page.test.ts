import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'node:test'

import { renderLabApp } from '../src/review/lab.js'

describe('lab page', () => {
  it('serves the shell, styles and all mission ids', async () => {
    const html = renderLabApp()
    assert.match(html, /lab\.css/)
    assert.match(html, /lab\.js/)
    assert.match(html, /把学过的词，练成三种能力/)
    assert.match(html, /id="lab-scope"/)
    assert.match(html, /data-cselect/)
    assert.doesNotMatch(html, /<select/)
    const script = await fs.readFile(path.join(process.cwd(), 'src', 'review', 'lab.js'), 'utf8')
    assert.doesNotThrow(() => new Function(script))
    for (const id of ['dictation', 'shadowing', 'life']) {
      assert.match(script, new RegExp(`id: '${id}'`))
    }
    assert.doesNotMatch(script, /id: 'quote'/)
    assert.match(script, /function openFeature/)
    assert.match(script, /function startRecording/)
  })
})
