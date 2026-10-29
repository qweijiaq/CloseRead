import fs from 'node:fs/promises'
import path from 'node:path'

import { projectRoot } from '../config.js'

export const stylesDir = path.join(projectRoot, 'styles')

export interface StyleProfile {
  name: string
  title: string
  guide: string
  path?: string
  source?: string
  model?: string
  createdAt?: string
  samples?: number
}

interface StyleMetadata {
  name?: string
  title?: string
  source?: string
  model?: string
  createdAt?: string
  samples?: number
}

function validateStyleName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Style name is required.')
  if (/[\\/]/.test(trimmed) || trimmed.includes('..')) throw new Error(`Invalid style name: ${name}`)
  return trimmed
}

async function readMetadata(file: string): Promise<StyleMetadata | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as StyleMetadata
  } catch {
    return null
  }
}

/**
 * Load a style guide by name from `styles/<name>.md`, or by an explicit path.
 * The guide is injected into LLM prompts and used by the template editorial.
 */
export async function loadStyleProfile(nameOrPath: string): Promise<StyleProfile> {
  const candidates = [
    path.resolve(nameOrPath),
    path.join(stylesDir, `${nameOrPath}.md`),
    path.join(stylesDir, nameOrPath),
  ]

  for (const file of candidates) {
    try {
      const guide = (await fs.readFile(file, 'utf8')).trim()
      if (!guide) continue
      const base = path.basename(file, path.extname(file))
      const metadata = await readMetadata(file.replace(/\.md$/i, '.json'))
      const title = metadata?.title || /^#\s+(.+)$/m.exec(guide)?.[1]?.trim() || base
      return {
        name: metadata?.name || base,
        title,
        guide,
        path: file,
        source: metadata?.source,
        model: metadata?.model,
        createdAt: metadata?.createdAt,
        samples: metadata?.samples,
      }
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(
    `Style profile not found: ${nameOrPath}. Tried ${candidates.join(', ')}. Add a Markdown file under styles/.`,
  )
}

export async function listStyleProfiles(): Promise<StyleProfile[]> {
  const entries = await fs.readdir(stylesDir).catch(() => [])
  const names = entries
    .filter((entry) => entry.toLowerCase().endsWith('.md') && entry.toLowerCase() !== 'readme.md')
    .map((entry) => entry.slice(0, -3))

  const profiles: StyleProfile[] = []
  for (const name of names) {
    try {
      profiles.push(await loadStyleProfile(name))
    } catch {
      // Skip a broken style file; one bad profile must not break the list.
    }
  }
  return profiles.sort((a, b) => a.name.localeCompare(b.name))
}

export async function styleExists(name: string): Promise<boolean> {
  try {
    await fs.access(path.join(stylesDir, `${validateStyleName(name)}.md`))
    return true
  } catch {
    return false
  }
}

export async function saveStyleProfile(
  profile: {
    name: string
    title: string
    guide: string
    source?: string
    model?: string
    samples?: number
  },
  options: { force?: boolean } = {},
): Promise<string> {
  const name = validateStyleName(profile.name)
  await fs.mkdir(stylesDir, { recursive: true })
  const file = path.join(stylesDir, `${name}.md`)
  const exists = await fs
    .access(file)
    .then(() => true)
    .catch(() => false)
  if (exists && !options.force) {
    throw new Error(`Style profile already exists: ${file}. Use --force to overwrite.`)
  }

  const body = profile.guide.trim()
  const guide = body.startsWith('#') ? body : `# ${profile.title}\n\n${body}`
  await fs.writeFile(file, `${guide}\n`, 'utf8')
  await fs.writeFile(
    file.replace(/\.md$/i, '.json'),
    JSON.stringify(
      {
        name,
        title: profile.title,
        source: profile.source,
        model: profile.model,
        samples: profile.samples,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  )
  return file
}

/** Use `LEARN_STYLE`, otherwise `styles/unified.md` when it exists. */
export async function resolveDefaultStyle(): Promise<StyleProfile | undefined> {
  const configured = process.env.LEARN_STYLE?.trim()
  if (configured === 'none' || configured === 'off') return undefined
  if (configured) return loadStyleProfile(configured)
  try {
    return await loadStyleProfile('unified')
  } catch {
    return undefined
  }
}

export function stylePromptBlock(style?: StyleProfile): string {
  if (!style) return ''
  return `\n\n## Writing style reference\n${style.guide}\n\nFollow this style for the Chinese explanations, examples, and the editorial. Keep the English source excerpts accurate.`
}

export function buildTemplateEditorial(
  title: string,
  source: string,
  summary: string,
  items: Array<{
    lemma: string
    ipa?: string
    definitionZh?: string
    sense: string
    contexts: Array<{ sentence: string; translation?: string }>
    collocations: string[]
    examples: Array<{ text: string; origin: string }>
  }>,
  style?: StyleProfile,
): string {
  const lines: string[] = []
  lines.push(`> 风格参考：${style?.title ?? '结构模板'}（启发式模式只能模仿结构，配置 LLM 后可生成完整风格文章）`)
  lines.push('')
  lines.push('## 先看原文')
  lines.push('')
  lines.push(summary)
  lines.push('')
  lines.push('## 逐词精讲')

  items.slice(0, 8).forEach((item, index) => {
    lines.push('')
    lines.push(`### ${String(index + 1).padStart(2, '0')} ${item.lemma}`)
    lines.push('')
    lines.push(`**${item.lemma}**${item.ipa ? ` ${item.ipa}` : ''}`)
    lines.push('')
    lines.push(`- 释义：${item.definitionZh ?? item.sense}`)
    const context = item.contexts[0]
    if (context) {
      lines.push(`- 语境：${context.sentence}`)
      if (context.translation) lines.push(`- 翻译：${context.translation}`)
    }
    if (item.collocations.length) lines.push(`- 搭配：${item.collocations.join(' / ')}`)
    const examples = item.examples.filter((example) => example.origin !== 'source').slice(0, 2)
    for (const example of examples) lines.push(`- 例句：${example.text}`)
  })

  lines.push('')
  lines.push('## 复盘总结')
  lines.push('')
  items.slice(0, 8).forEach((item, index) => {
    lines.push(`${index + 1}. **${item.lemma}** — ${item.definitionZh ?? item.sense}`)
  })
  lines.push('')
  lines.push(`> 来源：${source}`)
  return lines.join('\n')
}
