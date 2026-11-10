/**
 * Rebuilding a pack should not delete a card that already belongs to the
 * learner's library. Only orphaned items that were never persisted are safe to
 * remove automatically.
 */
export function selectRemovableItems(input: {
  previousItemIds: string[]
  keepIds: Set<string>
  existingIds: Set<string>
  resourceId: string
  contextsOf: (itemId: string) => Array<{ resourceId: string }> | undefined
}): string[] {
  return input.previousItemIds.filter((itemId) => {
    if (input.keepIds.has(itemId)) return false
    if (input.existingIds.has(itemId)) return false
    const contexts = input.contextsOf(itemId)
    return Boolean(contexts && contexts.every((context) => context.resourceId === input.resourceId))
  })
}
