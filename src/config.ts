import fs from 'node:fs'
import path from 'node:path'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

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

export const rootDataDir = path.resolve(process.env.LEARN_DATA_DIR ?? path.join(projectRoot, 'data'))
export const rootPacksDir = path.resolve(process.env.LEARN_PACKS_DIR ?? path.join(projectRoot, 'packs'))

export interface LlmRuntime {
  provider: LlmProviderId
  apiKey: string
  baseUrl: string
  model: string
  keySource: 'stored' | 'env' | 'none'
}

export interface TtsRuntime {
  provider: TtsProviderId
  apiKey: string
  baseUrl: string
  model: string
  voice: string
  instructions: string
  keySource: 'stored' | 'env' | 'none'
}

/**
 * One isolated data root: its own store, packs, caches, model key and voice
 * settings. Visitors on the public deployment each get their own workspace.
 */
export interface Workspace {
  id: string
  dataDir: string
  packsDir: string
  /** True for the shared demo that unclaimed visitors read. */
  readOnly: boolean
  level: string
  llm: LlmRuntime
  tts: TtsRuntime
}

const DEFAULT_TTS_PROVIDER: TtsProviderId = 'local'
const defaultPreset = ttsProviderPreset(DEFAULT_TTS_PROVIDER)
const defaultInstructions =
  'Read like a thoughtful magazine narrator: warm, unhurried, with natural pauses and a slight lift at commas.'

/**
 * Provider keys are the one thing worth protecting here: a public deployment
 * holds keys for strangers. Derive an AES key from LEARN_SECRET and encrypt the
 * `apiKey` field at rest.
 */
const secretKey = ((): Buffer | null => {
  const raw = process.env.LEARN_SECRET?.trim() ?? ''
  return raw.length >= 16 ? createHash('sha256').update(raw).digest() : null
})()

export function encryptionEnabled(): boolean {
  return secretKey !== null
}

function encryptSecret(plain: string): string {
  if (!secretKey || !plain) return plain
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', secretKey, iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return `enc:v1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')}`
}

function decryptSecret(value: string): string {
  if (!value.startsWith('enc:v1:')) return value
  if (!secretKey) return ''
  try {
    const raw = Buffer.from(value.slice('enc:v1:'.length), 'base64')
    const decipher = createDecipheriv('aes-256-gcm', secretKey, raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
  } catch {
    // A key from another LEARN_SECRET is unusable; treat it as unset.
    return ''
  }
}

interface StoredLlmSettings {
  provider?: LlmProviderId
  apiKey?: string
  baseUrl?: string
  model?: string
}

interface StoredTtsSettings {
  provider?: string
  apiKey?: string
  baseUrl?: string
  model?: string
  voice?: string
  instructions?: string
}

function readJsonFile<T>(file: string): T | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as T
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

function envTtsKeyFor(provider: TtsProviderId): string {
  const keys: Record<TtsProviderId, string[]> = {
    local: [],
    edge: [],
    bailian: ['DASHSCOPE_TTS_API_KEY', 'DASHSCOPE_API_KEY'],
    glm: ['GLM_TTS_API_KEY', 'GLM_API_KEY', 'ZHIPUAI_API_KEY'],
    gemini: ['GEMINI_TTS_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    minimax: ['MINIMAX_TTS_API_KEY', 'MINIMAX_API_KEY'],
    elevenlabs: ['ELEVENLABS_API_KEY'],
    openai: ['OPENAI_TTS_API_KEY', 'OPENAI_API_KEY'],
    custom: ['OPENAI_TTS_API_KEY', 'OPENAI_API_KEY'],
  }
  for (const key of keys[provider] ?? []) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return ''
}

function detectEnvTtsProvider(): TtsProviderId {
  if (process.env.LEARN_TTS_PROVIDER) return normalizeTtsProvider(process.env.LEARN_TTS_PROVIDER)
  // Keep local speech as the default: only an explicit TTS key opts into a provider.
  return process.env.OPENAI_TTS_API_KEY?.trim() ? 'openai' : DEFAULT_TTS_PROVIDER
}

function resolveLlm(dataDir: string): LlmRuntime {
  const stored = readJsonFile<StoredLlmSettings>(path.join(dataDir, 'llm.json'))
  const envProvider = detectEnvProvider()
  const provider: LlmProviderId =
    stored?.provider && isLlmProvider(stored.provider) ? stored.provider : envProvider
  const preset = providerPreset(provider)
  const storedKey = decryptSecret(stored?.apiKey?.trim() ?? '')
  const apiKey = storedKey || envKeyFor(provider)
  return {
    provider,
    apiKey,
    baseUrl: (
      stored?.baseUrl?.trim() ||
      process.env.LEARN_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      preset.baseUrl
    ).replace(/\/+$/, ''),
    model: stored?.model?.trim() || process.env.LEARN_MODEL || process.env.OPENAI_MODEL || preset.model,
    keySource: storedKey ? 'stored' : apiKey ? 'env' : 'none',
  }
}

function resolveTts(dataDir: string): TtsRuntime {
  const stored = readJsonFile<StoredTtsSettings>(path.join(dataDir, 'tts.json'))
  const envTtsProvider = detectEnvTtsProvider()
  const provider: TtsProviderId = stored?.provider
    ? normalizeTtsProvider(stored.provider)
    : envTtsProvider
  const envTtsKey = envTtsKeyFor(provider)
  const preset = ttsProviderPreset(provider)
  const openAiTtsEnv = provider === 'openai' || provider === 'custom'
  const storedKey = decryptSecret(stored?.apiKey?.trim() ?? '')
  return {
    provider,
    apiKey: storedKey || envTtsKey,
    baseUrl: (
      stored?.baseUrl?.trim() ||
      (openAiTtsEnv ? process.env.OPENAI_TTS_BASE_URL : '') ||
      preset.baseUrl
    ).replace(/\/+$/, ''),
    model:
      stored?.model?.trim() || (openAiTtsEnv ? process.env.OPENAI_TTS_MODEL : '') || preset.model,
    voice:
      stored?.voice?.trim() ||
      (openAiTtsEnv ? process.env.OPENAI_TTS_VOICE : '') ||
      preset.voice,
    instructions:
      stored?.instructions?.trim() ||
      (openAiTtsEnv ? process.env.OPENAI_TTS_INSTRUCTIONS : '') ||
      (preset.instructions ? defaultInstructions : ''),
    keySource: storedKey ? 'stored' : envTtsKey ? 'env' : 'none',
  }
}

export function createWorkspace(options: {
  id: string
  dataDir: string
  packsDir: string
  readOnly?: boolean
  level?: string
}): Workspace {
  return {
    id: options.id,
    dataDir: options.dataDir,
    packsDir: options.packsDir,
    readOnly: options.readOnly === true,
    level: (options.level ?? process.env.LEARN_LEVEL ?? 'B2').toUpperCase(),
    llm: resolveLlm(options.dataDir),
    tts: resolveTts(options.dataDir),
  }
}

const rootWorkspace = createWorkspace({ id: 'local', dataDir: rootDataDir, packsDir: rootPacksDir })

/**
 * The active workspace travels with the async call chain, so one process can
 * serve many isolated visitors without threading a context through every
 * helper. Code outside any request (CLI, tests) keeps using the root workspace.
 */
const workspaceStorage = new AsyncLocalStorage<Workspace>()

export function currentWorkspace(): Workspace {
  return workspaceStorage.getStore() ?? rootWorkspace
}

/** The shared root workspace: the only one a local single-user install uses. */
export function rootWorkspaceRef(): Workspace {
  return rootWorkspace
}

export function runInWorkspace<T>(workspace: Workspace, fn: () => T): T {
  return workspaceStorage.run(workspace, fn)
}

export const config = {
  get dataDir(): string {
    return currentWorkspace().dataDir
  },
  get packsDir(): string {
    return currentWorkspace().packsDir
  },
  get level(): string {
    return currentWorkspace().level
  },
  set level(value: string) {
    currentWorkspace().level = value
  },
  /** Interface the review server binds to. Keep loopback by default. */
  host: process.env.LEARN_HOST?.trim() || '127.0.0.1',
  /** Optional public hostname when the app sits behind a trusted reverse proxy. */
  publicHost: process.env.LEARN_PUBLIC_HOST?.trim().toLowerCase() || '',
  get llm(): LlmRuntime {
    return currentWorkspace().llm
  },
  set llm(value: LlmRuntime) {
    currentWorkspace().llm = value
  },
  get tts(): TtsRuntime {
    return currentWorkspace().tts
  },
  set tts(value: TtsRuntime) {
    currentWorkspace().tts = value
  },
  ttsVoice: process.env.LEARN_TTS_VOICE ?? '',
}

/**
 * Public mode gives every browser its own workspace. It is enabled explicitly
 * so local single-user installs keep writing to their original data/ and packs/.
 */
export function publicModeEnabled(): boolean {
  return config.publicHost.length > 0
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

function writeSettingsFile(file: string, payload: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), { mode: 0o600 })
  fs.chmodSync(file, 0o600)
}

/** Store a user-supplied key locally; the key is never returned by the API. */
export function saveLlmSettings(input: LlmSettingsInput): LlmStatus {
  const workspace = currentWorkspace()
  if (workspace.readOnly) throw new Error('演示空间是只读的，请先创建自己的空间。')
  const provider = normalizeLlmProvider(input.provider)
  if (!provider) throw new Error('未知的模型服务商。')
  const preset = providerPreset(provider)
  const sameProvider = config.llm.provider === provider
  const providedKey = input.apiKey?.trim() ?? ''
  const storedKey =
    providedKey || (sameProvider && config.llm.keySource === 'stored' ? config.llm.apiKey.trim() : '')
  const effectiveKey = storedKey || (sameProvider ? config.llm.apiKey.trim() : '')
  if (!effectiveKey) throw new Error('请填写 API Key。')
  const baseUrl = (input.baseUrl?.trim() || preset.baseUrl).replace(/\/+$/, '')
  const model = input.model?.trim() || preset.model
  writeSettingsFile(path.join(workspace.dataDir, 'llm.json'), {
    provider,
    ...(storedKey ? { apiKey: encryptSecret(storedKey) } : {}),
    baseUrl,
    model,
  })
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
  const workspace = currentWorkspace()
  if (workspace.readOnly) throw new Error('演示空间是只读的，请先创建自己的空间。')
  const settingsFile = path.join(workspace.dataDir, 'tts.json')
  if (input.clear === true) {
    fs.rmSync(settingsFile, { force: true })
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
    writeSettingsFile(settingsFile, {
      provider,
      ...(storedKey ? { apiKey: encryptSecret(storedKey) } : {}),
      baseUrl: '',
      model: '',
      voice,
      instructions: '',
    })
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
  const sameProvider = config.tts.provider === provider
  const apiKey = providedKey || (sameProvider ? config.tts.apiKey.trim() : '')
  if (!apiKey) throw new Error('请填写神经语音的 API Key。')
  const baseUrl = (input.baseUrl?.trim() || preset.baseUrl).replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error('Base URL 需要以 http:// 或 https:// 开头。')
  const model = input.model?.trim() || preset.model
  const voice = input.voice?.trim() || preset.voice
  const instructions = preset.instructions
    ? input.instructions?.trim() ?? config.tts.instructions
    : ''
  const payload = { provider, apiKey, baseUrl, model, voice, instructions }
  writeSettingsFile(settingsFile, { ...payload, apiKey: encryptSecret(apiKey) })
  config.tts = { ...payload, keySource: 'stored' }
  return ttsStatus()
}

export const ttsProviderOptions = TTS_PROVIDERS

export const llmProviderOptions = LLM_PROVIDERS

export function storePath(): string {
  return path.join(config.dataDir, 'store.json')
}
