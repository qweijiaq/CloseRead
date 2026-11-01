import fs from 'node:fs'
import path from 'node:path'

import { TTS_PROVIDERS, normalizeTtsProvider, ttsProviderPreset } from './audio/providers.js'
import type { TtsProviderId } from './audio/providers.js'
import { LLM_PROVIDERS, isLlmProvider, normalizeLlmProvider, providerPreset } from './llm/providers.js'
import type { LlmProviderId } from './llm/providers.js'

export const projectRoot = path.resolve(import.meta.dirname, '..')

try {
  process.loadEnvFile(path.join(projectRoot, '.env'))
} catch {
  // .env is optional.
}

// Optional: load keys from another local env file without copying them into this repo.
const extraEnvFile = process.env.LEARN_ENV_FILE
if (extraEnvFile) {
  try {
    process.loadEnvFile(path.resolve(extraEnvFile))
  } catch {
    // The extra env file is optional too.
  }
}

const dataDir = path.resolve(process.env.LEARN_DATA_DIR ?? path.join(projectRoot, 'data'))
const packsDir = path.resolve(process.env.LEARN_PACKS_DIR ?? path.join(projectRoot, 'packs'))
const llmSettingsPath = path.join(dataDir, 'llm.json')
const ttsSettingsPath = path.join(dataDir, 'tts.json')

interface StoredLlmSettings {
  provider?: LlmProviderId
  apiKey?: string
  baseUrl?: string
  model?: string
}

function readStoredLlm(): StoredLlmSettings | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(llmSettingsPath, 'utf8')) as StoredLlmSettings
    return parsed && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

function detectEnvProvider(): LlmProviderId {
  if (process.env.LEARN_PROVIDER) {
    const explicit = normalizeLlmProvider(process.env.LEARN_PROVIDER)
    if (explicit) return explicit
  }
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek'
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return 'google'
  if (process.env.DASHSCOPE_API_KEY) return 'alibaba'
  if (process.env.XAI_API_KEY) return 'xai'
  if (process.env.GLM_API_KEY || process.env.ZHIPUAI_API_KEY) return 'glm'
  if (process.env.MOONSHOT_API_KEY) return 'moonshot'
  return 'openai'
}

function envKeyFor(provider: LlmProviderId): string {
  for (const key of providerPreset(provider).keyEnv) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return ''
}

const stored = readStoredLlm()
const envProvider = detectEnvProvider()
const provider: LlmProviderId = stored?.provider && isLlmProvider(stored.provider)
  ? stored.provider
  : envProvider
const preset = providerPreset(provider)
const storedKey = stored?.apiKey?.trim() ?? ''
const apiKey = storedKey || envKeyFor(provider)
const keySource: 'stored' | 'env' | 'none' = storedKey ? 'stored' : apiKey ? 'env' : 'none'

const llm = {
  provider,
  apiKey,
  baseUrl: (
    stored?.baseUrl?.trim() ||
    process.env.LEARN_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    preset.baseUrl
  ).replace(/\/+$/, ''),
  model: stored?.model?.trim() || process.env.LEARN_MODEL || process.env.OPENAI_MODEL || preset.model,
  keySource,
}

interface StoredTtsSettings {
  provider?: string
  apiKey?: string
  baseUrl?: string
  model?: string
  voice?: string
  instructions?: string
}

function readStoredTts(): StoredTtsSettings | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(ttsSettingsPath, 'utf8')) as StoredTtsSettings
    return parsed && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

const storedTts = readStoredTts()
const storedTtsKey = storedTts?.apiKey?.trim() ?? ''
const envTtsKey = process.env.OPENAI_TTS_API_KEY?.trim() ?? ''
const DEFAULT_TTS_PROVIDER: TtsProviderId = 'local'
const envTtsProvider = process.env.LEARN_TTS_PROVIDER
  ? normalizeTtsProvider(process.env.LEARN_TTS_PROVIDER)
  : envTtsKey
    ? 'openai'
    : DEFAULT_TTS_PROVIDER
const defaultPreset = ttsProviderPreset(DEFAULT_TTS_PROVIDER)
const effectivePreset = ttsProviderPreset(
  storedTts?.provider ? normalizeTtsProvider(storedTts.provider) : envTtsProvider,
)
const defaultInstructions =
  'Read like a thoughtful magazine narrator: warm, unhurried, with natural pauses and a slight lift at commas.'
const tts = {
  provider: storedTts?.provider ? normalizeTtsProvider(storedTts.provider) : envTtsProvider,
  apiKey: storedTtsKey || envTtsKey,
  baseUrl: (storedTts?.baseUrl?.trim() || process.env.OPENAI_TTS_BASE_URL || effectivePreset.baseUrl).replace(/\/+$/, ''),
  model: storedTts?.model?.trim() || process.env.OPENAI_TTS_MODEL || effectivePreset.model,
  voice: storedTts?.voice?.trim() || process.env.OPENAI_TTS_VOICE || effectivePreset.voice,
  instructions:
    storedTts?.instructions?.trim() ||
    process.env.OPENAI_TTS_INSTRUCTIONS ||
    (effectivePreset.instructions ? defaultInstructions : ''),
  keySource: (storedTtsKey ? 'stored' : envTtsKey ? 'env' : 'none') as 'stored' | 'env' | 'none',
}

export const config = {
  dataDir,
  packsDir,
  level: (process.env.LEARN_LEVEL ?? 'B2').toUpperCase(),
  llm,
  tts,
  ttsVoice: process.env.LEARN_TTS_VOICE ?? '',
}

export function ensureDirs(): void {
  for (const dir of [
    config.dataDir,
    config.packsDir,
    path.join(config.dataDir, 'resources'),
    path.join(config.dataDir, 'cache', 'dictionary'),
    path.join(config.dataDir, 'cache', 'translations'),
  ]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function hasLlm(): boolean {
  return config.llm.apiKey.trim().length > 0
}

export interface LlmStatus {
  configured: boolean
  provider: LlmProviderId
  label: string
  model: string
  baseUrl: string
  keySource: 'stored' | 'env' | 'none'
}

export function llmStatus(): LlmStatus {
  const preset = providerPreset(config.llm.provider)
  return {
    configured: hasLlm(),
    provider: config.llm.provider,
    label: preset.label,
    model: config.llm.model,
    baseUrl: config.llm.baseUrl,
    keySource: config.llm.keySource,
  }
}

export interface LlmSettingsInput {
  provider: string
  apiKey?: string
  baseUrl?: string
  model?: string
}

/** Store a user-supplied key locally; the key is never returned by the API. */
export function saveLlmSettings(input: LlmSettingsInput): LlmStatus {
  const provider = normalizeLlmProvider(input.provider)
  if (!provider) throw new Error('未知的模型服务商。')
  const preset = providerPreset(provider)
  const sameProvider = config.llm.provider === provider
  const providedKey = input.apiKey?.trim() ?? ''
  const storedKey = providedKey || (sameProvider && config.llm.keySource === 'stored' ? config.llm.apiKey.trim() : '')
  const effectiveKey = storedKey || (sameProvider ? config.llm.apiKey.trim() : '')
  if (!effectiveKey) throw new Error('请填写 API Key。')
  const baseUrl = (input.baseUrl?.trim() || preset.baseUrl).replace(/\/+$/, '')
  const model = input.model?.trim() || preset.model
  const payload = {
    provider,
    ...(storedKey ? { apiKey: storedKey } : {}),
    baseUrl,
    model,
  }
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(llmSettingsPath, JSON.stringify(payload, null, 2), { mode: 0o600 })
  config.llm = {
    provider,
    apiKey: effectiveKey,
    baseUrl,
    model,
    keySource: storedKey ? 'stored' : sameProvider ? config.llm.keySource : 'none',
  }
  return llmStatus()
}

export interface TtsStatus {
  configured: boolean
  provider: TtsProviderId
  providerLabel: string
  supportsInstructions: boolean
  voices: string[]
  hint: string
  baseUrl: string
  model: string
  voice: string
  instructions: string
  keySource: 'stored' | 'env' | 'none'
}

export function ttsStatus(): TtsStatus {
  const preset = ttsProviderPreset(config.tts.provider)
  return {
    configured: config.tts.provider === 'edge' || config.tts.apiKey.trim().length > 0,
    provider: config.tts.provider,
    providerLabel: preset.label,
    supportsInstructions: preset.instructions,
    voices: preset.voices,
    hint: preset.hint,
    baseUrl: config.tts.baseUrl,
    model: config.tts.model,
    voice: config.tts.voice,
    instructions: config.tts.instructions,
    keySource: config.tts.keySource,
  }
}

export function hasNeuralTts(): boolean {
  return config.tts.provider === 'edge' || (config.tts.provider !== 'local' && config.tts.apiKey.trim().length > 0)
}

export interface TtsSettingsInput {
  provider?: string
  apiKey?: string
  baseUrl?: string
  model?: string
  voice?: string
  instructions?: string
  clear?: boolean
}

/** Store a user-supplied neural TTS key locally; the key is never returned. */
export function saveTtsSettings(input: TtsSettingsInput): TtsStatus {
  if (input.clear === true) {
    fs.rmSync(ttsSettingsPath, { force: true })
    config.tts = {
      provider: DEFAULT_TTS_PROVIDER,
      apiKey: '',
      baseUrl: defaultPreset.baseUrl,
      model: defaultPreset.model,
      voice: defaultPreset.voice,
      instructions: defaultPreset.instructions ? defaultInstructions : '',
      keySource: 'none',
    }
    return ttsStatus()
  }
  const provider = normalizeTtsProvider(input.provider ?? config.tts.provider)
  const preset = ttsProviderPreset(provider)
  if (provider === 'local' || provider === 'edge') {
    const voice = input.voice?.trim() || preset.voice || config.tts.voice
    const storedKey = config.tts.keySource === 'stored' ? config.tts.apiKey.trim() : ''
    const payload = {
      provider,
      ...(storedKey ? { apiKey: storedKey } : {}),
      baseUrl: '',
      model: '',
      voice,
      instructions: '',
    }
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(ttsSettingsPath, JSON.stringify(payload, null, 2), { mode: 0o600 })
    fs.chmodSync(ttsSettingsPath, 0o600)
    config.tts = {
      ...config.tts,
      provider,
      baseUrl: '',
      model: '',
      voice,
      instructions: '',
      keySource: storedKey ? 'stored' : config.tts.keySource === 'env' ? 'env' : 'none',
    }
    return ttsStatus()
  }
  const providedKey = input.apiKey?.trim() ?? ''
  const apiKey = providedKey || config.tts.apiKey.trim()
  if (!apiKey) throw new Error('请填写神经语音的 API Key。')
  const baseUrl = (input.baseUrl?.trim() || preset.baseUrl).replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error('Base URL 需要以 http:// 或 https:// 开头。')
  const model = input.model?.trim() || preset.model
  const voice = input.voice?.trim() || preset.voice
  const instructions = preset.instructions
    ? input.instructions?.trim() ?? config.tts.instructions
    : ''
  const payload = { provider, apiKey, baseUrl, model, voice, instructions }
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(ttsSettingsPath, JSON.stringify(payload, null, 2), { mode: 0o600 })
  fs.chmodSync(ttsSettingsPath, 0o600)
  config.tts = { ...payload, keySource: 'stored' }
  return ttsStatus()
}

export const ttsProviderOptions = TTS_PROVIDERS

export const llmProviderOptions = LLM_PROVIDERS
export const storePath = path.join(config.dataDir, 'store.json')
