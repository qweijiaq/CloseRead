import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { config, hasNeuralTts } from '../config.js'
import { generateNeuralSpeech } from './neural.js'
import type { LearningPack, PackAudio } from '../types.js'

const execFileAsync = promisify(execFile)

export async function isSayAvailable(): Promise<boolean> {
  if (process.platform !== 'darwin') return false
  try {
    await execFileAsync('say', ['-v', '?'], { timeout: 5_000 })
    return true
  } catch {
    return false
  }
}

function plainText(value: string): string {
  return value
    .replace(/[*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

let voiceCache: { value: string | undefined; at: number } | undefined
let systemVoicesCache: { value: Array<{ name: string; lang: string; premium: boolean }>; at: number } | undefined

export interface SystemVoice {
  name: string
  lang: string
  premium: boolean
}

/** List installed English voices, preferring Premium/Enhanced entries. */
export async function listSystemVoices(force = false): Promise<SystemVoice[]> {
  if (!force && systemVoicesCache && Date.now() - systemVoicesCache.at < 60_000) {
    return systemVoicesCache.value
  }
  const voices: SystemVoice[] = []
  if (process.platform === 'darwin') {
    try {
      const { stdout } = await execFileAsync('say', ['-v', '?'], { timeout: 5_000, maxBuffer: 2 * 1024 * 1024 })
      for (const line of stdout.split('\n')) {
        const match = /^(.*?)\s{2,}([a-z]{2}_[A-Z]{2})\s+#/.exec(line)
        if (!match) continue
        const name = match[1]!.trim()
        const lang = match[2]!
        if (!lang.startsWith('en')) continue
        voices.push({ name, lang, premium: /premium|enhanced|高级|增强/i.test(name) })
      }
    } catch {
      // No local voices.
    }
  }
  systemVoicesCache = { value: voices, at: Date.now() }
  return voices
}

/** Pick a configured or installed Premium/Enhanced English voice. */
export async function getTtsVoice(force = false): Promise<string | undefined> {
  const forced = config.ttsVoice.trim()
  if (forced) return forced
  if (config.tts.provider === 'local' && config.tts.voice.trim()) return config.tts.voice.trim()
  if (!force && voiceCache && Date.now() - voiceCache.at < 60_000) return voiceCache.value
  const voices = await listSystemVoices(force)
  const premium = voices.filter((voice) => voice.premium)
  let value: string | undefined
  const preference = ['Ava', 'Zoe', 'Samantha', 'Daniel', 'Karen', 'Alex']
  for (const name of preference) {
    const found = premium.find((voice) => voice.name.toLowerCase().includes(name.toLowerCase()))
    if (found) {
      value = found.name
      break
    }
  }
  if (!value && premium[0]) value = premium[0].name
  voiceCache = { value, at: Date.now() }
  return value
}

async function synthesize(text: string, output: string, voice?: string): Promise<void> {
  await fs.mkdir(path.dirname(output), { recursive: true })
  // `say` reads long input from a file; passing the whole article as an argv
  // string can hit the platform argument limit and used to truncate long reads.
  const source = `${output}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.source.txt`
  await fs.writeFile(source, plainText(text).slice(0, 80_000), 'utf8')
  const args = ['-f', source, '-o', output, '--data-format=aac']
  const selected = voice ?? await getTtsVoice()
  if (selected) args.push('-v', selected)
  try {
    await execFileAsync('say', args, { timeout: 900_000, maxBuffer: 1024 * 1024 })
  } finally {
    await fs.rm(source, { force: true }).catch(() => {})
  }
}

function readingText(pack: LearningPack): string {
  return (pack.reading ?? [])
    .map((paragraph) => paragraph.original.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim() || (pack.sourceText ?? '').trim()
}

/** Identify the currently configured speech engine for cache invalidation. */
export async function speechFingerprint(): Promise<string> {
  if (config.tts.provider === 'edge') return `edge:${config.tts.voice}`
  if (hasNeuralTts()) {
    const tone = createHash('sha1').update(config.tts.instructions).digest('hex').slice(0, 8)
    return `neural:${config.tts.baseUrl}:${config.tts.model}:${config.tts.voice}:${tone}`
  }
  const voice = await getTtsVoice()
  return `say:${voice ?? 'system'}`
}

export interface SpeechFile {
  path: string
  fingerprint: string
}

/** Generate one speech file with the configured neural or local engine. */
export async function generateSpeechFile(
  text: string,
  dir: string,
  baseName: string,
): Promise<SpeechFile> {
  const trimmed = plainText(text)
  if (!trimmed) throw new Error('没有可朗读的文本。')
  const fingerprint = await speechFingerprint()
  if (hasNeuralTts()) {
    const relative = `${baseName}.${config.tts.provider === 'edge' ? 'mp3' : 'wav'}`
    await generateNeuralSpeech(trimmed, path.join(dir, relative))
    return { path: relative, fingerprint }
  }
  if (!(await isSayAvailable())) {
    throw new Error('当前系统没有本地语音，也没有配置神经语音。')
  }
  const voice = await getTtsVoice()
  const relative = `${baseName}.m4a`
  await synthesize(trimmed, path.join(dir, relative), voice)
  return { path: relative, fingerprint }
}

/** Read the whole article aloud into one cached file. */
export async function generateReadingAudio(
  pack: LearningPack,
  dir: string,
): Promise<SpeechFile | undefined> {
  const text = readingText(pack)
  if (!text) return undefined
  return generateSpeechFile(text, dir, 'audio/reading')
}

/** Generate and cache one sentence for the shadowing player. */
export async function generateSentenceAudio(
  text: string,
  dir: string,
): Promise<{ path: string; cached: boolean; fingerprint: string } | undefined> {
  const trimmed = plainText(text)
  if (!trimmed) return undefined
  const fingerprint = await speechFingerprint()
  const key = createHash('sha1').update(`${fingerprint}\n${trimmed}`).digest('hex').slice(0, 16)
  const relative = `audio/shadow/${key}.${hasNeuralTts() ? (config.tts.provider === 'edge' ? 'mp3' : 'wav') : 'm4a'}`
  const target = path.join(dir, relative)
  try {
    await fs.access(target)
    return { path: relative, cached: true, fingerprint }
  } catch {
    // Generate below.
  }
  const speech = await generateSpeechFile(trimmed, dir, `audio/shadow/${key}`)
  return { path: speech.path, cached: false, fingerprint: speech.fingerprint }
}

export async function generatePackAudio(pack: LearningPack, dir: string): Promise<PackAudio> {
  const result: PackAudio = { items: {} }
  const neural = hasNeuralTts()
  const say = await isSayAvailable()
  if (!neural && !say) return result
  const audioDir = path.join(dir, 'audio')

  if (say) {
    const voice = await getTtsVoice()
    if (voice) result.voice = voice
    await synthesize(`${pack.title}. ${pack.summary}`, path.join(audioDir, 'summary.m4a'), voice)
    result.summary = 'audio/summary.m4a'
  }

  const article = readingText(pack)
  if (article) {
    try {
      const speech = await generateSpeechFile(article, dir, 'audio/reading')
      result.reading = speech.path
      result.voice = speech.fingerprint
    } catch {
      // The item and word audio can still be useful when the long read fails.
    }
  }

  if (!say) return result

  const wordLines = pack.items
    .slice(0, 30)
    .map((item) => `${item.lemma}. ${item.definition}.`)
    .join(' ')
  if (wordLines) {
    await synthesize(wordLines, path.join(audioDir, 'words.m4a'))
    result.words = 'audio/words.m4a'
  }

  for (const item of pack.items.slice(0, 12)) {
    const example = item.examples.find((entry) => entry.origin !== 'source')?.text ?? item.contexts[0]?.sentence ?? ''
    const text = `${item.lemma}. ${item.definition}. ${example}`.trim()
    const file = path.join(audioDir, `item-${item.id}.m4a`)
    try {
      await synthesize(text, file)
      result.items[item.id] = `audio/item-${item.id}.m4a`
    } catch {
      // A single failed pronunciation should not fail the whole pack.
    }
  }

  return result
}
