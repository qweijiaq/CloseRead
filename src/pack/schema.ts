import { z } from 'zod'

export const buildMetadataSchema = z.object({
  inputHash: z.string().min(1),
  mode: z.enum(['heuristic', 'llm']),
  provider: z.string().min(1),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  generatedAt: z.string().min(1),
  warnings: z.array(z.string()),
})

export const readingParagraphSchema = z.object({
  index: z.number().int().min(0),
  original: z.string().min(1),
  translation: z.string().optional(),
  itemIds: z.array(z.string()),
  page: z.number().int().min(1).optional(),
  timestamp: z.string().optional(),
  customSentences: z.array(z.string()).optional(),
  note: z.record(z.unknown()).optional(),
})

const exercisesSchema = z.object({
  cloze: z.array(z.record(z.unknown())),
  comprehension: z.array(z.record(z.unknown())),
  discussion: z.array(z.record(z.unknown())),
})

/**
 * A light structural guard for stored items. Item payloads evolve often, so
 * this validates the fields the reader and reviewer dereference, not every
 * optional enrichment field.
 */
const packItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['word_sense', 'collocation', 'pattern', 'sentence']),
    lemma: z.string().min(1),
    sense: z.string(),
    definition: z.string(),
    contexts: z.array(
      z
        .object({
          resourceId: z.string(),
          resourceTitle: z.string(),
          segmentIndex: z.number().int(),
          sentence: z.string(),
        })
        .passthrough(),
    ),
    collocations: z.array(z.string()).optional(),
    examples: z
      .array(
        z
          .object({
            text: z.string(),
            origin: z.enum(['source', 'dictionary', 'generated']),
          })
          .passthrough(),
      )
      .optional(),
    relations: z
      .object({
        synonyms: z.array(z.string()).optional(),
        antonyms: z.array(z.string()).optional(),
        confusables: z.array(z.string()).optional(),
        wordFamily: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough()

/** Structural guard for a pack file. Items are validated separately when generated. */
export const packSchema = z
  .object({
    id: z.string().min(1),
    resourceId: z.string().min(1),
    title: z.string().min(1),
    source: z.string(),
    mode: z.enum(['heuristic', 'llm']),
    generatedAt: z.string().min(1),
    summary: z.string(),
    difficulty: z.object({ cefr: z.string(), reason: z.string() }),
    stats: z.object({
      wordCount: z.number().int().min(0),
      itemCount: z.number().int().min(0),
      readingMinutes: z.number().int().min(0),
    }),
    items: z.array(packItemSchema),
    exercises: exercisesSchema,
    reading: z.array(readingParagraphSchema).optional(),
    build: buildMetadataSchema.optional(),
  })
  .passthrough()

export type PackSchema = z.infer<typeof packSchema>
