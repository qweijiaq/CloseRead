import { config } from '../config.js'
import { providerPreset } from './providers.js'

/** Extract model ids from the common /models response shapes. */
export function modelIdsFromResponse(value: unknown): string[] {
  const found: string[] = []
  const push = (entry: unknown) => {
    if (typeof entry === 'string') {
      const id = entry.trim().replace(/^models\//, '')
      if (id) found.push(id)
      return
    }
    if (!entry || typeof entry !== 'object') return
    const record = entry as Record<string, unknown>
    const id = record.id ?? record.name ?? record.model
    if (typeof id === 'string' && id.trim()) found.push(id.trim().replace(/^models\//, ''))
  }
  if (Array.isArray(value)) {
    value.forEach(push)
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (Array.isArray(record.data)) record.data.forEach(push)
    else if (Array.isArray(record.models)) record.models.forEach(push)
    else if (Array.isArray(record.model_ids)) record.model_ids.forEach(push)
  }
  return [...new Set(found)].sort((a, b) => a.localeCompare(b))
}

/** Ask the configured provider for its current model catalogue. */
export async function listProviderModels(): Promise<string[]> {
  if (!config.llm.apiKey.trim()) throw new Error('还没有配置模型 API Key。')
  const preset = providerPreset(config.llm.provider)
  const base = config.llm.baseUrl.replace(/\/+$/, '')
  const url = `${base}/models`
  const headers: Record<string, string> = { accept: 'application/json' }
  if (preset.api === 'anthropic') {
    headers['x-api-key'] = config.llm.apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else {
    headers.authorization = `Bearer ${config.llm.apiKey}`
  }
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`模型列表请求失败 (${response.status}): ${detail.slice(0, 300)}`)
  }
  const data = (await response.json()) as unknown
  const models = modelIdsFromResponse(data)
  if (models.length === 0) throw new Error('服务商没有返回可用的模型列表。')
  return models.slice(0, 300)
}
