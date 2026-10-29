import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { config } from '../config.js'
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

async function synthesize(text: string, output: string): Promise<void> {
  await fs.mkdir(path.dirname(output), { recursive: true })
  const args = ['-o', output, '--data-format=aac']
  if (config.ttsVoice) args.push('-v', config.ttsVoice)
  args.push(plainText(text).slice(0, 12_000))
  await execFileAsync('say', args, { timeout: 180_000, maxBuffer: 1024 * 1024 })
}

export async function generatePackAudio(pack: LearningPack, dir: string): Promise<PackAudio> {
  const result: PackAudio = { items: {} }
  if (!(await isSayAvailable())) return result

  const audioDir = path.join(dir, 'audio')

  await synthesize(`${pack.title}. ${pack.summary}`, path.join(audioDir, 'summary.m4a'))
  result.summary = 'audio/summary.m4a'

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
