import fs from 'node:fs'
import path from 'node:path'

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

const openAiKey = process.env.LEARN_API_KEY ?? process.env.OPENAI_API_KEY ?? ''
const deepseekKey = process.env.DEEPSEEK_API_KEY ?? ''
const useDeepseekFallback = !openAiKey && Boolean(deepseekKey)

export const config = {
  dataDir: path.resolve(process.env.LEARN_DATA_DIR ?? path.join(projectRoot, 'data')),
  packsDir: path.resolve(process.env.LEARN_PACKS_DIR ?? path.join(projectRoot, 'packs')),
  level: (process.env.LEARN_LEVEL ?? 'B2').toUpperCase(),
  llm: {
    apiKey: openAiKey || deepseekKey,
    baseUrl: (
      process.env.LEARN_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      (useDeepseekFallback ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1')
    ).replace(/\/+$/, ''),
    model:
      process.env.LEARN_MODEL ??
      process.env.OPENAI_MODEL ??
      (useDeepseekFallback ? 'deepseek-chat' : 'gpt-4o-mini'),
  },
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

export const storePath = path.join(config.dataDir, 'store.json')
