import type { LearningItem, ReadingParagraph, Resource } from '../types.js'

/** Build a paragraph-by-paragraph reader from the source segments when the LLM is unavailable. */
export function fallbackReading(resource: Resource, items: LearningItem[]): ReadingParagraph[] {
  return resource.segments
    .filter((segment) => segment.text.length >= 20)
    .slice(0, 40)
    .map((segment, index) => ({
      index,
      original: segment.text,
      itemIds: items
        .filter((item) =>
          item.contexts.some(
            (context) =>
              (context.sentence && segment.text.includes(context.sentence)) || context.segmentIndex === segment.index,
          ),
        )
        .map((item) => item.id),
    }))
}

/** Keep the LLM's paragraph if it is grounded in the source; otherwise use the real segment. */
export function groundParagraph(resource: Resource, candidate: string, index: number): string {
  const normalizedSource = resource.text.replace(/\s+/g, ' ')
  const normalized = candidate.replace(/\s+/g, ' ').trim()
  if (normalized && normalizedSource.includes(normalized)) return candidate.trim()
  return resource.segments[index]?.text ?? candidate.trim()
}
