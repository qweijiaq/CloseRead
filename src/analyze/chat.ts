import { z } from 'zod'

import { config } from '../config.js'
import { providerExtraHeaders } from '../llm/providers.js'
import { recordUsage } from './usage.js'

/** Escape raw newlines/tabs that some models leave inside JSON strings. */
function escapeControlChars(text: string): string {
  let result = ''
  let inString = false
  let escaped = false
  for (const char of text) {
    if (escaped) {
      result += char
      escaped = false
      continue
    }
    if (char === '\\') {
      result += char
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      result += char
      continue
    }
    if (inString && char === '\n') result += '\\n'
    else if (inString && char === '\r') result += '\\r'
    else if (inString && char === '\t') result += '\\t'
    else result += char
  }
  return result
}

function repairJson(text: string): string {
  return escapeControlChars(text.replace(/,\s*([}\]])/g, '$1'))
}

/**
 * Escape unescaped ASCII quotes inside string values, guided by the position
 * reported by the failing JSON.parse. Models often quote a word directly,
 * e.g. `"他说"你好"了"`, which closes the string too early.
 */
function repairInnerQuotes(text: string): string | undefined {
  let current = text
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      JSON.parse(current)
      return current
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const match = /at position (\d+)/.exec(message)
      if (!match) return undefined
      let position = Number(match[1]) - 1
      while (position > 0 && /\s/.test(current[position]!)) position -= 1
      if (current[position] !== '"') return undefined
      current = `${current.slice(0, position)}\\"${current.slice(position + 1)}`
    }
  }
  return undefined
}

/** Extract the first JSON object from an LLM reply, including fenced blocks. */
export function parseJson(content: string): unknown {
  let text = content.trim().replace(/^\uFEFF/, '')
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(text)
  if (fenced) text = fenced[1]!.trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) text = text.slice(start, end + 1)
  try {
    return JSON.parse(text)
  } catch (error) {
    const repaired = repairJson(text)
    try {
      return JSON.parse(repaired)
    } catch {
      const fixed = repairInnerQuotes(repaired)
      if (fixed !== undefined) return JSON.parse(fixed)
      throw new Error(
        `LLM response was not valid JSON (${error instanceof Error ? error.message : String(error)}).`,
      )
    }
  }
}

const JSON_REPAIR_INSTRUCTION =
  'Your previous reply was not valid JSON. Reply again with the same content as one strict JSON object only. ' +
  'Escape every ASCII double quote inside string values as \\", or use Chinese quotation marks 「」 for quoted words. ' +
  'Include every comma between fields, remove trailing commas, and add no Markdown fences or prose.'

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529])

function retryDelay(attempt: number): number {
  return 400 * 2 ** attempt + Math.floor(Math.random() * 150)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function canRetry(status: number, attempt: number): boolean {
  return attempt < 2 && RETRYABLE_STATUS.has(status)
}

/** Providers behind a gateway can stall well past two minutes on long inputs. */
const LLM_TIMEOUT_MS = Math.max(30_000, Math.round(Number(process.env.LEARN_LLM_TIMEOUT_MS ?? 180_000) || 180_000))

async function request(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(LLM_TIMEOUT_MS)
  return fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.llm.apiKey}`,
      ...providerExtraHeaders(config.llm.provider),
    },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
  })
}

interface ChatMessage {
  role: string
  content: string
}

async function requestAnthropic(
  system: string,
  messages: ChatMessage[],
  options: ChatOptions,
): Promise<Response> {
  const timeout = AbortSignal.timeout(LLM_TIMEOUT_MS)
  return fetch(`${config.llm.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.llm.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.llm.model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.2,
      system,
      messages,
    }),
    signal: options.signal ? AbortSignal.any([timeout, options.signal]) : timeout,
  })
}

class InvalidJsonError extends Error {}

function parseWithSchema<T>(schema: z.ZodType<T>, content: string, label: string): T {
  let value: unknown
  try {
    value = parseJson(content)
  } catch (error) {
    throw new InvalidJsonError(error instanceof Error ? error.message : String(error))
  }
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`${label} returned an invalid shape: ${issues}`)
  }
  return parsed.data
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text?: unknown }).text ?? '')
        return ''
      })
      .join('')
  }
  return ''
}

/** Call an OpenAI-compatible chat endpoint and validate the JSON reply with zod. */
export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export async function chatJson<T>(
  schema: z.ZodType<T>,
  system: string,
  user: string,
  options: ChatOptions = {},
): Promise<T> {
  if (!config.llm.apiKey.trim()) throw new Error('No LLM API key configured.')

  if (config.llm.provider === 'anthropic') {
    const messages: ChatMessage[] = [{ role: 'user', content: user }]
    let repairLeft = 1
    let lastError: unknown
    for (let attempt = 0; attempt <= 2; attempt++) {
      if (attempt > 0) await sleep(retryDelay(attempt - 1))
      if (options.signal?.aborted) throw new Error('Request cancelled.')
      let response: Response
      try {
        response = await requestAnthropic(system, messages, options)
      } catch (error) {
        if (options.signal?.aborted) throw new Error('Request cancelled.')
        lastError = error
        if (attempt === 2) throw new Error(`LLM 请求超时或中断：${error instanceof Error ? error.message : String(error)}`)
        continue
      }
      if (response.ok) {
        const data = (await response.json()) as {
          content?: unknown
          stop_reason?: string
          usage?: { input_tokens?: number; output_tokens?: number }
        }
        recordUsage(config.llm.model, {
          prompt: data.usage?.input_tokens,
          completion: data.usage?.output_tokens,
        })
        if (data.stop_reason === 'max_tokens') {
          throw new Error('LLM reply was cut off by the output limit.')
        }
        const content = contentText(data.content)
        if (!content.trim()) {
          if (attempt === 2) throw new Error('Anthropic returned an empty response.')
          continue
        }
        try {
          return parseWithSchema(schema, content, 'Anthropic')
        } catch (error) {
          lastError = error
          if (options.signal?.aborted) throw error
          if (!(error instanceof InvalidJsonError) || repairLeft <= 0 || attempt === 2) break
          repairLeft -= 1
          messages.push({ role: 'assistant', content })
          messages.push({ role: 'user', content: JSON_REPAIR_INSTRUCTION })
          continue
        }
      }
      if (canRetry(response.status, attempt)) {
        await response.text().catch(() => {})
        continue
      }
      const detail = await response.text()
      throw new Error(`Anthropic request failed (${response.status}): ${detail.slice(0, 500)}`)
    }
    throw lastError ?? new Error('Anthropic returned an invalid response.')
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
  const body: Record<string, unknown> = {
    model: config.llm.model,
    temperature: options.temperature ?? 0.2,
    messages,
    response_format: { type: 'json_object' },
  }
  if (options.maxTokens) body.max_tokens = options.maxTokens

  let triedWithoutFormat = false
  let triedLowerTokens = false
  let repairLeft = 1
  let lastError: unknown
  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) await sleep(retryDelay(attempt - 1))
    if (options.signal?.aborted) throw new Error('Request cancelled.')
    let response: Response
    try {
      response = await request(body, options.signal)
    } catch (error) {
      // A timeout or dropped connection is worth another attempt; a user
      // cancellation is not.
      if (options.signal?.aborted) throw new Error('Request cancelled.')
      lastError = error
      if (attempt === 2) throw new Error(`LLM 请求超时或中断：${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    if (!response.ok && !triedWithoutFormat && (response.status === 400 || response.status === 422)) {
      const detail = await response.text().catch(() => '')
      triedWithoutFormat = true
      // Some providers cap output tokens well below what we asked for.
      if (!triedLowerTokens && body.max_tokens && /max_tokens|max_completion_tokens|too many tokens/i.test(detail)) {
        triedLowerTokens = true
        body.max_tokens = Math.max(1024, Math.floor(Number(body.max_tokens) / 2))
      } else {
        delete body.response_format
      }
      response = await request(body, options.signal)
    }
    if (response.ok) {
      const data = (await response.json()) as {
        choices?: Array<{
          message?: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown }
          finish_reason?: string
        }>
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      }
      recordUsage(config.llm.model, {
        prompt: data.usage?.prompt_tokens,
        completion: data.usage?.completion_tokens,
        total: data.usage?.total_tokens,
      })
      if (data.choices?.[0]?.finish_reason === 'length') {
        const message = data.choices?.[0]?.message
        const spentOnReasoning =
          contentText(message?.reasoning_content as never).trim() ||
          contentText(message?.reasoning as never).trim()
        throw new Error(
          spentOnReasoning
            ? 'LLM reply was cut off by the output limit（模型把额度花在推理上，JSON 还没写完）.'
            : 'LLM reply was cut off by the output limit.',
        )
      }
      const content = contentText(data.choices?.[0]?.message?.content)
      if (!content.trim()) {
        if (attempt === 2) throw new Error('LLM returned an empty response.')
        continue
      }
      try {
        return parseWithSchema(schema, content, 'LLM')
      } catch (error) {
        lastError = error
        if (options.signal?.aborted) throw error
        if (!(error instanceof InvalidJsonError) || repairLeft <= 0 || attempt === 2) break
        repairLeft -= 1
        messages.push({ role: 'assistant', content })
        messages.push({ role: 'user', content: JSON_REPAIR_INSTRUCTION })
        continue
      }
    }
    if (canRetry(response.status, attempt)) {
      await response.text().catch(() => {})
      continue
    }
    const detail = await response.text()
    throw new Error(`LLM request failed (${response.status}): ${detail.slice(0, 500)}`)
  }
  throw lastError ?? new Error('LLM returned an invalid response.')
}
