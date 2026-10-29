import fs from 'node:fs/promises'
import path from 'node:path'

import { config } from '../config.js'
import type { AnalyzeOutcome } from '../analyze/index.js'
import type { LearningPack, PackAudio, PackRecord, Resource } from '../types.js'
import { generatePackAudio } from '../audio/tts.js'
import { renderAnkiCsv } from './anki.js'
import { intensiveReadingMinutes } from './reading-time.js'
import { renderHtml } from './html.js'
import { renderMarkdown } from './markdown.js'

export interface BuildOptions {
  includeSource?: boolean
  audio?: boolean
  outDir?: string
}

export interface BuildResult {
  pack: LearningPack
  dir: string
  files: string[]
  record: PackRecord
}

export async function writePack(
  resource: Resource,
  outcome: AnalyzeOutcome,
  options: BuildOptions = {},
): Promise<BuildResult> {
  const dir = options.outDir ?? path.join(config.packsDir, resource.id)
  await fs.mkdir(dir, { recursive: true })

  const pack: LearningPack = {
    id: `pack-${resource.id}`,
    resourceId: resource.id,
    title: resource.title,
    source: resource.source,
    mode: outcome.mode,
    generatedAt: new Date().toISOString(),
    summary: outcome.analysis.summary,
    difficulty: outcome.analysis.difficulty,
    frontMatter: outcome.analysis.frontMatter,
    stats: {
      wordCount: resource.wordCount,
      itemCount: outcome.analysis.items.length,
      readingMinutes: intensiveReadingMinutes({
        wordCount: resource.wordCount,
        paragraphs: outcome.analysis.reading?.length ?? 0,
        items: outcome.analysis.items.length,
      }),
    },
    items: outcome.analysis.items,
    exercises: outcome.analysis.exercises,
    sourceText: options.includeSource === false ? undefined : resource.text,
    reading: outcome.analysis.reading,
    styleName: outcome.styleName,
    editorial: outcome.analysis.editorial,
    selection: outcome.selection,
    ...(typeof resource.metadata.parentResourceId === 'string'
      ? { parentResourceId: resource.metadata.parentResourceId }
      : {}),
    ...(typeof resource.metadata.articleIndex === 'number'
      ? { articleIndex: resource.metadata.articleIndex }
      : {}),
  }

  const files: string[] = []
  const write = async (name: string, content: string): Promise<void> => {
    const filePath = path.join(dir, name)
    const temp = `${filePath}.tmp`
    await fs.writeFile(temp, content, 'utf8')
    await fs.rename(temp, filePath)
    files.push(filePath)
  }

  let audio: PackAudio = { items: {} }
  if (options.audio) {
    try {
      audio = await generatePackAudio(pack, dir)
    } catch (error) {
      outcome.notes.push(`Audio generation failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  pack.audio = audio

  await write('pack.json', JSON.stringify(pack, null, 2))
  await write('pack.md', renderMarkdown(pack))
  await write('anki.csv', renderAnkiCsv(pack))
  await write('index.html', renderHtml(pack, audio))

  if (outcome.notes.length) {
    await write('notes.md', outcome.notes.map((note) => `- ${note}`).join('\n'))
  }

  const record: PackRecord = {
    id: pack.id,
    resourceId: resource.id,
    dir,
    mode: pack.mode,
    itemCount: pack.items.length,
    createdAt: pack.generatedAt,
  }

  return { pack, dir, files, record }
}
