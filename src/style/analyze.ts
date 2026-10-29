import { z } from 'zod'

import { chatJson } from '../analyze/chat.js'
import { config, hasLlm } from '../config.js'
import { ingestSource } from '../ingest/index.js'
import type { Resource, Segment } from '../types.js'
import { saveStyleProfile, styleExists } from './profile.js'

const styleAnalysisSchema = z.object({
  title: z.string().min(1),
  style: z.string().min(1),
})

export interface AnalyzeStyleOptions {
  samples?: number
  force?: boolean
}

function pickSamples(resource: Resource, count: number): Segment[] {
  const useful = resource.segments.filter((segment) => segment.text.length >= 80)
  if (useful.length <= count) return useful

  const picked: Segment[] = []
  const step = Math.max(1, Math.floor(useful.length / count))
  for (let index = 0; index < useful.length && picked.length < count - 1; index += step) {
    picked.push(useful[index]!)
  }
  picked.push(useful[useful.length - 1]!)
  return picked
}

function sampleText(resource: Resource, samples: number): string {
  return pickSamples(resource, samples)
    .map((segment, index) => {
      const heading = segment.heading ? `## ${segment.heading}\n` : ''
      return `### Sample ${index + 1}\n${heading}${segment.text.slice(0, 4000)}`
    })
    .join('\n\n')
    .slice(0, 20_000)
}

function headingsOf(resource: Resource): string[] {
  return [...new Set(resource.segments.map((segment) => segment.heading).filter((heading): heading is string => Boolean(heading)))]
    .slice(0, 60)
}

function fallbackStyle(resource: Resource, samples: Segment[]): string {
  const average = Math.round(
    samples.reduce((sum, segment) => sum + segment.text.length, 0) / Math.max(1, samples.length),
  )
  return `# ${resource.title} 风格卡（自动结构摘要）

## 来源
- ${resource.source}
- ${resource.wordCount} 词，${resource.segments.length} 段

## 结构概览
${headingsOf(resource)
  .slice(0, 20)
  .map((heading) => `- ${heading}`)
  .join('\n')}

## 观察
- 抽样段落平均长度约 ${average} 字。
- 自动模式只提取了结构；语气、优势/风险和讲解模板需要配置 LLM 后重新分析，或手动补充。

## 待补充
- 一句话定位
- 读者与语气
- 标题模式
- 文章结构
- 词汇讲解模板
- 优势（值得保留）
- 风险/避免
`
}

export interface AnalyzeStyleResult {
  file: string
  title: string
  model?: string
  samples: number
  mode: 'llm' | 'fallback'
}

/** Read a reference book/article and distill its reusable writing style into styles/<name>.md. */
export async function analyzeStyle(
  name: string,
  source: string,
  options: AnalyzeStyleOptions = {},
): Promise<AnalyzeStyleResult> {
  if ((await styleExists(name)) && !options.force) {
    throw new Error(`Style profile already exists: ${name}. Use --force to overwrite.`)
  }

  const resource = await ingestSource(source)
  const samples = Math.max(2, Math.min(12, options.samples ?? 6))
  const sample = sampleText(resource, samples)

  if (!hasLlm()) {
    const guide = fallbackStyle(resource, pickSamples(resource, samples))
    const file = await saveStyleProfile(
      { name, title: resource.title, guide, source, samples },
      { force: options.force },
    )
    return { file, title: resource.title, samples, mode: 'fallback' }
  }

  const system = `You are an editorial analyst for Chinese English-learning content. Analyze the writing style of the provided samples and produce a reusable style guide in Markdown. Focus on repeatable craft, not the content. Do not copy long passages; paraphrase patterns.

The guide must contain these sections:
- 一句话定位
- 读者与语气
- 标题模式
- 文章结构
- 词汇讲解模板
- 语言细节
- 优势（值得保留）
- 风险/避免（不要照搬的坏习惯）
- 3-5 个可复用的句式或节奏模式（用自己的话描述，不长段引用）

Return JSON only: {"title":"...","style":"Markdown body"}`

  const user = `Source title: ${resource.title}
Source: ${source}
Word count: ${resource.wordCount}

Table of contents / headings:
${headingsOf(resource)
  .map((heading) => `- ${heading}`)
  .join('\n')}

Samples:
${sample}`

  const result = await chatJson(styleAnalysisSchema, system, user)
  const file = await saveStyleProfile(
    {
      name,
      title: result.title,
      guide: result.style,
      source,
      model: config.llm.model,
      samples,
    },
    { force: options.force },
  )
  return { file, title: result.title, model: config.llm.model, samples, mode: 'llm' }
}
