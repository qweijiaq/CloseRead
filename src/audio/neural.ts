import fs from 'node:fs/promises'
import path from 'node:path'

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

import { config } from '../config.js'
import type { TtsProviderId } from './providers.js'

const SAMPLE_RATE = 24_000

/** Split long text at sentence or word boundaries under the TTS input limit. */
export function splitSpeechChunks(text: string, maxChars = 3200): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  const sentences = cleaned.split(/(?<=[.!?]["'”’)\]]*)\s+/)
  const chunks: string[] = []
  let current = ''
  const push = () => {
    const value = current.trim()
    if (value) chunks.push(value)
    current = ''
  }
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      push()
      const words = sentence.split(' ')
      let line = ''
      for (const word of words) {
        const next = line ? `${line} ${word}` : word
        if (next.length > maxChars && line) {
          chunks.push(line)
          line = word
        } else {
          line = next
        }
      }
      current = line
      continue
    }
    if (current.length + sentence.length + 1 > maxChars) push()
    current = current ? `${current} ${sentence}` : sentence
  }
  push()
  return chunks
}

/** Wrap raw 16-bit mono PCM in a WAV container. */
export function wavFromPcm(pcm: Buffer, sampleRate = SAMPLE_RATE): Buffer {
  const data = pcm.length % 2 === 0 ? pcm : pcm.subarray(0, pcm.length - 1)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

interface SpeechPart {
  pcm: Buffer
  sampleRate: number
}

interface WavData {
  pcm: Buffer
  sampleRate: number
}

/** Extract 16-bit mono PCM from a RIFF/WAVE file, when the provider returns WAV. */
export function pcmFromWav(buffer: Buffer): WavData | undefined {
  if (buffer.length < 44 || buffer.subarray(0, 4).toString() !== 'RIFF' || buffer.subarray(8, 12).toString() !== 'WAVE') {
    return undefined
  }
  let offset = 12
  let sampleRate = SAMPLE_RATE
  let pcm: Buffer | undefined
  while (offset + 8 <= buffer.length) {
    const id = buffer.subarray(offset, offset + 4).toString()
    const size = buffer.readUInt32LE(offset + 4)
    const start = offset + 8
    if (id === 'fmt ' && start + 16 <= buffer.length) {
      sampleRate = buffer.readUInt32LE(start + 4)
    }
    if (id === 'data') {
      pcm = buffer.subarray(start, Math.min(start + size, buffer.length))
      break
    }
    offset = start + size + (size % 2)
  }
  return pcm ? { pcm, sampleRate } : undefined
}

function audioPart(bytes: Buffer, fallbackRate: number): SpeechPart {
  const wav = pcmFromWav(bytes)
  return wav ?? { pcm: bytes, sampleRate: fallbackRate }
}

function speechEndpoint(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return /\/audio\/speech$/i.test(base) ? base : `${base}/audio/speech`
}

function providerChunkLimit(provider: TtsProviderId): number {
  if (provider === 'edge') return 6000
  if (provider === 'bailian') return 580
  if (provider === 'glm') return 900
  if (provider === 'gemini') return 2500
  if (provider === 'minimax') return 3000
  if (provider === 'elevenlabs') return 3000
  return 3200
}

async function readError(response: Response): Promise<string> {
  const detail = await response.text()
  return detail.slice(0, 400)
}

async function openAiPart(text: string, signal?: AbortSignal): Promise<SpeechPart> {
  const timeout = AbortSignal.timeout(180_000)
  const body: Record<string, unknown> = {
    model: config.tts.model,
    voice: config.tts.voice,
    input: text,
    response_format: 'pcm',
  }
  if (config.tts.instructions) body.instructions = config.tts.instructions
  const send = (payload: Record<string, unknown>) =>
    fetch(speechEndpoint(config.tts.baseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.tts.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    })
  let response = await send(body)
  if (!response.ok && (response.status === 400 || response.status === 422) && config.tts.instructions) {
    // Some OpenAI-compatible servers do not understand the newer instructions field.
    const retry = { ...body }
    delete retry.instructions
    response = await send(retry)
  }
  if (!response.ok) throw new Error(`神经语音请求失败 (${response.status}): ${await readError(response)}`)
  return audioPart(Buffer.from(await response.arrayBuffer()), SAMPLE_RATE)
}

function bailianEndpoint(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return /\/generation$/i.test(base) ? base : `${base}/services/aigc/multimodal-generation/generation`
}

async function bailianPart(text: string, signal?: AbortSignal): Promise<SpeechPart> {
  const timeout = AbortSignal.timeout(180_000)
  const send = (input: Record<string, unknown>) =>
    fetch(bailianEndpoint(config.tts.baseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.tts.apiKey}`,
      },
      body: JSON.stringify({ model: config.tts.model, input }),
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    })
  let response = await send({ text, voice: config.tts.voice, language_type: 'English' })
  if (!response.ok && (response.status === 400 || response.status === 422)) {
    // Older Qwen-TTS snapshots do not accept language_type.
    response = await send({ text, voice: config.tts.voice })
  }
  if (!response.ok) throw new Error(`百炼语音请求失败 (${response.status}): ${await readError(response)}`)
  const data = (await response.json()) as {
    status_code?: number
    code?: string
    message?: string
    output?: { audio?: { data?: string; url?: string } }
  }
  if (data.status_code && data.status_code !== 200) {
    throw new Error(`百炼语音失败 (${data.status_code}): ${data.message ?? data.code ?? ''}`)
  }
  const audio = data.output?.audio
  const encoded = audio?.data?.trim()
  if (encoded) return audioPart(Buffer.from(encoded, 'base64'), SAMPLE_RATE)
  const url = audio?.url?.trim()
  if (!url) throw new Error('百炼语音没有返回音频。')
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
  const download = await fetch(href, { signal: signal ? AbortSignal.any([timeout, signal]) : timeout })
  if (!download.ok) throw new Error(`百炼音频下载失败 (${download.status}): ${await readError(download)}`)
  return audioPart(Buffer.from(await download.arrayBuffer()), SAMPLE_RATE)
}

async function glmPart(text: string, signal?: AbortSignal): Promise<SpeechPart> {
  const timeout = AbortSignal.timeout(180_000)
  const response = await fetch(speechEndpoint(config.tts.baseUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.tts.apiKey}`,
    },
    body: JSON.stringify({
      model: config.tts.model,
      input: text,
      voice: config.tts.voice,
      response_format: 'pcm',
      encode_format: 'base64',
    }),
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
  })
  if (!response.ok) throw new Error(`GLM 语音请求失败 (${response.status}): ${await readError(response)}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.startsWith('audio/')) {
    return audioPart(Buffer.from(await response.arrayBuffer()), SAMPLE_RATE)
  }
  const raw = await response.text()
  const chunks: string[] = []
  let sampleRate = SAMPLE_RATE
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const data = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string; return_sample_rate?: number } }>
      }
      const delta = data.choices?.[0]?.delta
      if (delta?.content) chunks.push(delta.content)
      if (delta?.return_sample_rate) sampleRate = delta.return_sample_rate
    } catch {
      // Ignore malformed SSE keep-alive lines.
    }
  }
  if (!chunks.length) {
    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>
      data?: { audio?: string }
      return_sample_rate?: number
    }
    const content = data.choices?.[0]?.message?.content ?? data.data?.audio
    if (content) chunks.push(content)
    if (data.return_sample_rate) sampleRate = data.return_sample_rate
  }
  if (!chunks.length) throw new Error('GLM 语音没有返回音频。')
  return audioPart(Buffer.from(chunks.join(''), 'base64'), sampleRate)
}

async function geminiPart(text: string, signal?: AbortSignal): Promise<SpeechPart> {
  const timeout = AbortSignal.timeout(180_000)
  const prompt = config.tts.instructions ? `${config.tts.instructions}\n\nText to read:\n${text}` : text
  const url = `${config.tts.baseUrl.replace(/\/+$/, '')}/models/${encodeURIComponent(config.tts.model)}:generateContent`
  const generationConfig: Record<string, unknown> = {
    responseModalities: ['AUDIO'],
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: config.tts.voice } },
    },
  }
  const send = (configWithFormat: Record<string, unknown>) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': config.tts.apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: configWithFormat,
      }),
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    })
  let response = await send({ ...generationConfig, responseFormat: 'AUDIO_WAV' })
  if (!response.ok && (response.status === 400 || response.status === 422)) {
    response = await send(generationConfig)
  }
  if (!response.ok) throw new Error(`Gemini 语音请求失败 (${response.status}): ${await readError(response)}`)
  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string }
          inline_data?: { data?: string; mime_type?: string }
        }>
      }
    }>
  }
  const part = data.candidates?.[0]?.content?.parts?.find((entry) => entry.inlineData?.data || entry.inline_data?.data)
  const encoded = part?.inlineData?.data ?? part?.inline_data?.data
  if (!encoded) throw new Error('Gemini 语音没有返回音频。')
  return audioPart(Buffer.from(encoded, 'base64'), SAMPLE_RATE)
}

async function minimaxPart(text: string, signal?: AbortSignal): Promise<SpeechPart> {
  const timeout = AbortSignal.timeout(180_000)
  const base = config.tts.baseUrl.replace(/\/+$/, '')
  const url = /\/t2a_v2$/i.test(base) ? base : `${base}/t2a_v2`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.tts.apiKey}`,
    },
    body: JSON.stringify({
      model: config.tts.model,
      text,
      stream: false,
      voice_setting: { voice_id: config.tts.voice, speed: 1, vol: 1, pitch: 0 },
      audio_setting: { sample_rate: 32_000, bitrate: 128_000, format: 'wav', channel: 1 },
    }),
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
  })
  if (!response.ok) throw new Error(`MiniMax 语音请求失败 (${response.status}): ${await readError(response)}`)
  const data = (await response.json()) as {
    data?: { audio?: string | null }
    base_resp?: { status_code?: number; status_msg?: string }
  }
  if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax 语音失败：${data.base_resp.status_msg ?? data.base_resp.status_code}`)
  }
  if (!data.data?.audio) throw new Error('MiniMax 语音没有返回音频。')
  return audioPart(Buffer.from(data.data.audio, 'hex'), 32_000)
}

async function elevenLabsPart(text: string, signal?: AbortSignal): Promise<SpeechPart> {
  const timeout = AbortSignal.timeout(180_000)
  const base = config.tts.baseUrl.replace(/\/+$/, '')
  const url = `${base}/text-to-speech/${encodeURIComponent(config.tts.voice)}?output_format=pcm_24000`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'xi-api-key': config.tts.apiKey,
    },
    body: JSON.stringify({ text, model_id: config.tts.model }),
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
  })
  if (!response.ok) throw new Error(`ElevenLabs 语音请求失败 (${response.status}): ${await readError(response)}`)
  return audioPart(Buffer.from(await response.arrayBuffer()), SAMPLE_RATE)
}

async function edgeMp3(text: string): Promise<Buffer> {
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 10_000, synthesisTimeoutMs: 120_000 })
  try {
    await tts.setMetadata(config.tts.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const { audioStream } = await tts.toStream(text)
    const buffers = await new Promise<Buffer[]>((resolve, reject) => {
      const chunks: Buffer[] = []
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        resolve(chunks)
      }
      audioStream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
      audioStream.on('end', finish)
      audioStream.on('close', finish)
      audioStream.on('error', (error: Error) => {
        if (settled) return
        settled = true
        reject(error)
      })
    })
    if (!buffers.length) throw new Error('Edge 语音没有返回音频。')
    return Buffer.concat(buffers)
  } finally {
    tts.close()
  }
}

async function requestPart(provider: TtsProviderId, text: string, signal?: AbortSignal): Promise<SpeechPart> {
  if (provider === 'bailian') return bailianPart(text, signal)
  if (provider === 'glm') return glmPart(text, signal)
  if (provider === 'gemini') return geminiPart(text, signal)
  if (provider === 'minimax') return minimaxPart(text, signal)
  if (provider === 'elevenlabs') return elevenLabsPart(text, signal)
  return openAiPart(text, signal)
}

/** Request chunks in order, allowing a little parallelism for short-input providers. */
async function requestSpeechParts(
  chunks: string[],
  provider: TtsProviderId,
  signal?: AbortSignal,
): Promise<SpeechPart[]> {
  const results = new Array<SpeechPart>(chunks.length)
  const limit = provider === 'bailian' ? 2 : 1
  let cursor = 0
  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++
      if (index >= chunks.length) return
      results[index] = await requestPart(provider, chunks[index]!, signal)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, chunks.length) }, () => worker()))
  return results
}

/** Generate one WAV file through the configured neural speech provider. */
export async function generateNeuralSpeech(
  text: string,
  output: string,
  signal?: AbortSignal,
): Promise<void> {
  if (config.tts.provider !== 'edge' && !config.tts.apiKey.trim()) {
    throw new Error('神经语音尚未配置 API Key。')
  }
  const chunks = splitSpeechChunks(text, providerChunkLimit(config.tts.provider))
  if (!chunks.length) throw new Error('没有可朗读的文本。')
  if (config.tts.provider === 'edge') {
    const parts: Buffer[] = []
    for (const chunk of chunks) parts.push(await edgeMp3(chunk))
    await fs.mkdir(path.dirname(output), { recursive: true })
    const temp = `${output}.tmp`
    await fs.writeFile(temp, Buffer.concat(parts))
    await fs.rename(temp, output)
    return
  }
  const parts = await requestSpeechParts(chunks, config.tts.provider, signal)
  if (!parts.length) throw new Error('神经语音没有返回音频。')
  const sampleRate = parts[0]?.sampleRate ?? SAMPLE_RATE
  const pause = Buffer.alloc(Math.round(sampleRate * 2 * 0.2))
  const pcm: Buffer[] = []
  parts.forEach((part, index) => {
    pcm.push(part.pcm)
    if (index < parts.length - 1) pcm.push(pause)
  })
  const merged = Buffer.concat(pcm)
  if (!merged.length) throw new Error('神经语音没有返回音频。')
  await fs.mkdir(path.dirname(output), { recursive: true })
  const temp = `${output}.tmp`
  await fs.writeFile(temp, wavFromPcm(merged, sampleRate))
  await fs.rename(temp, output)
}
