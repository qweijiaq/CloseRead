import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { pcmFromWav, splitSpeechChunks, wavFromPcm } from '../src/audio/neural.js'
import { TTS_PROVIDERS, normalizeTtsProvider } from '../src/audio/providers.js'

describe('neural speech helpers', () => {
  it('splits long text into bounded chunks without losing words', () => {
    const sentence = 'This is a sentence with enough words to matter. '
    const text = sentence.repeat(300)
    const chunks = splitSpeechChunks(text, 500)
    assert.ok(chunks.length > 1)
    assert.ok(chunks.every((chunk) => chunk.length <= 500))
    assert.equal(chunks.join(' ').replace(/\s+/g, ' ').trim(), text.replace(/\s+/g, ' ').trim())
  })

  it('wraps PCM samples in a valid mono 24 kHz WAV header', () => {
    const pcm = Buffer.alloc(4800, 1)
    const wav = wavFromPcm(pcm)
    assert.equal(wav.subarray(0, 4).toString(), 'RIFF')
    assert.equal(wav.subarray(8, 12).toString(), 'WAVE')
    assert.equal(wav.subarray(36, 40).toString(), 'data')
    assert.equal(wav.readUInt32LE(24), 24_000)
    assert.equal(wav.readUInt16LE(22), 1)
    assert.equal(wav.readUInt16LE(34), 16)
    assert.equal(wav.readUInt32LE(40), pcm.length)
    assert.equal(wav.length, 44 + pcm.length)
    const parsed = pcmFromWav(wav)
    assert.equal(parsed?.sampleRate, 24_000)
    assert.deepEqual(parsed?.pcm, pcm)
  })

  it('exposes several TTS providers and normalizes unknown ids', () => {
    const ids = TTS_PROVIDERS.map((provider) => provider.id)
    assert.ok(ids.includes('local'))
    assert.ok(ids.includes('edge'))
    assert.ok(ids.includes('glm'))
    assert.ok(ids.includes('gemini'))
    assert.ok(ids.includes('minimax'))
    assert.ok(ids.includes('elevenlabs'))
    assert.ok(ids.includes('openai'))
    assert.equal(normalizeTtsProvider('unknown'), 'openai')
  })
})
