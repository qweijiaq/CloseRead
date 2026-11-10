import path from 'node:path'

import { config } from '../config.js'
import { generateSentenceAudio } from '../audio/tts.js'

export interface LabSpeech {
  url: string
  text: string
}

/** Cache mission audio under data/lab; the server serves it from /lab/audio/. */
export async function labSpeech(text: string): Promise<LabSpeech> {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) throw new Error('没有可朗读的文本。')
  const result = await generateSentenceAudio(trimmed, path.join(config.dataDir, 'lab'))
  if (!result) throw new Error('当前没有可用的语音引擎。')
  return {
    url: `/lab/audio/${result.path.replace(/^audio\//, '')}`,
    text: trimmed,
  }
}
