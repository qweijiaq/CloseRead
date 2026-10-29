import type { StoredItem } from '../types.js'

export type WordGraphEdgeKind =
  | 'synonym'
  | 'antonym'
  | 'wordFamily'
  | 'confusable'
  | 'root'
  | 'context'

export interface WordGraphNode {
  id: string
  lemma: string
  sense: string
  definitionZh?: string
  pos?: string
  cefr?: string
  status: StoredItem['status'] | 'ghost'
  ghost?: boolean
  degree: number
  cluster?: number
}

export interface WordGraphEdge {
  source: string
  target: string
  type: WordGraphEdgeKind
  /** Absolute association strength. */
  weight: number
  /** Positive (similar/related) versus negative (opposite/confusable) association. */
  positive: boolean
  /** Human-readable provenance: relation type or the shared root/prefix/suffix. */
  via?: string
}

export interface WordGraphFamily {
  form: string
  kind: 'root' | 'prefix' | 'suffix'
  meaning?: string
  wordIds: string[]
}

export interface WordGraph {
  nodes: WordGraphNode[]
  edges: WordGraphEdge[]
  families: WordGraphFamily[]
  isolated: number
}

export interface WordGraphOptions {
  threshold?: number
  includeNegative?: boolean
  includeGhosts?: boolean
  includeContext?: boolean
  maxGhosts?: number
}

interface Pair {
  source: string
  target: string
  positive: number
  negative: number
  kinds: Map<WordGraphEdgeKind, number>
  via?: string
}

const RELATION_WEIGHTS: Array<{ field: keyof StoredItem['relations']; type: WordGraphEdgeKind; weight: number }> = [
  { field: 'synonyms', type: 'synonym', weight: 2 },
  { field: 'wordFamily', type: 'wordFamily', weight: 3 },
  { field: 'antonyms', type: 'antonym', weight: -2.5 },
  { field: 'confusables', type: 'confusable', weight: -1.5 },
]

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`
}

function ghostId(lemma: string): string {
  return `ghost:${lemma.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

function cleanRelationWord(value: string): string {
  return value
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[.;:,]+$/, '')
    .trim()
}

export function buildWordGraph(items: StoredItem[], options: WordGraphOptions = {}): WordGraph {
  const threshold = options.threshold ?? 1.5
  const includeNegative = options.includeNegative !== false
  const includeGhosts = options.includeGhosts !== false
  const includeContext = options.includeContext === true
  const maxGhosts = Math.max(0, options.maxGhosts ?? 120)

  const byLemma = new Map<string, StoredItem[]>()
  for (const item of items) {
    const key = item.lemma.toLowerCase()
    const list = byLemma.get(key) ?? []
    list.push(item)
    byLemma.set(key, list)
  }

  const ghostNodes = new Map<string, WordGraphNode>()
  const ensureGhost = (lemma: string): WordGraphNode => {
    const id = ghostId(lemma)
    const existing = ghostNodes.get(id)
    if (existing) return existing
    const node: WordGraphNode = {
      id,
      lemma,
      sense: '尚未学习',
      status: 'ghost',
      ghost: true,
      degree: 0,
    }
    ghostNodes.set(id, node)
    return node
  }

  const pairs = new Map<string, Pair>()
  const addPair = (
    source: string,
    target: string,
    kind: WordGraphEdgeKind,
    weight: number,
    via?: string,
  ) => {
    if (source === target) return
    const key = pairKey(source, target)
    const pair = pairs.get(key) ?? {
      source: source < target ? source : target,
      target: source < target ? target : source,
      positive: 0,
      negative: 0,
      kinds: new Map<WordGraphEdgeKind, number>(),
    }
    if (weight >= 0) pair.positive += weight
    else pair.negative += weight
    pair.kinds.set(kind, (pair.kinds.get(kind) ?? 0) + Math.abs(weight))
    if (via && !pair.via) pair.via = via
    pairs.set(key, pair)
  }

  for (const item of items) {
    for (const relation of RELATION_WEIGHTS) {
      for (const value of [...new Set(item.relations[relation.field] ?? [])]) {
        const clean = cleanRelationWord(value)
        if (!clean) continue
        const learned = byLemma.get(clean.toLowerCase()) ?? []
        if (learned.length > 0) {
          for (const target of learned) {
            addPair(item.id, target.id, relation.type, relation.weight, relation.type)
          }
        } else if (includeGhosts) {
          const ghost = ensureGhost(clean)
          addPair(item.id, ghost.id, relation.type, relation.weight, relation.type)
        }
      }
    }
  }

  // Words in the same article or pack are a soft thematic layer. It is off by
  // default because it can create a lot of low-value edges.
  if (includeContext) {
    const groups = new Map<string, StoredItem[]>()
    for (const item of items) {
      const seen = new Set<string>()
      for (const context of item.contexts) {
        if (seen.has(context.resourceId)) continue
        seen.add(context.resourceId)
        const group = groups.get(context.resourceId) ?? []
        group.push(item)
        groups.set(context.resourceId, group)
      }
    }
    for (const [resourceId, group] of groups) {
      if (group.length > 25) continue
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          addPair(group[i]!.id, group[j]!.id, 'context', 1.5, `same source: ${resourceId.slice(0, 12)}`)
        }
      }
    }
  }

  // Morphology creates another kind of association: words sharing a root,
  // prefix or suffix belong to the same word family even without a direct
  // synonym/antonym link.
  const formGroups = new Map<string, { kind: 'root' | 'prefix' | 'suffix'; meaning?: string; ids: Set<string> }>()
  for (const item of items) {
    const formation = item.wordFormation
    if (!formation) continue
    const forms: Array<{ kind: 'root' | 'prefix' | 'suffix'; form: string; meaning?: string }> = [
      ...(formation.roots ?? []).map((part) => ({ kind: 'root' as const, form: part.form, meaning: part.meaning })),
      ...(formation.prefixes ?? []).map((part) => ({ kind: 'prefix' as const, form: part.form, meaning: part.meaning })),
      ...(formation.suffixes ?? []).map((part) => ({ kind: 'suffix' as const, form: part.form, meaning: part.meaning })),
    ]
    for (const entry of forms) {
      const form = entry.form.toLowerCase().trim()
      if (form.length < 2) continue
      const key = `${entry.kind}:${form}`
      const group = formGroups.get(key) ?? { kind: entry.kind, meaning: entry.meaning, ids: new Set<string>() }
      group.ids.add(item.id)
      formGroups.set(key, group)
    }
  }
  for (const [key, group] of formGroups) {
    if (group.ids.size < 2 || group.ids.size > 16) continue
    const ids = [...group.ids]
    const form = key.slice(key.indexOf(':') + 1)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) addPair(ids[i]!, ids[j]!, 'root', 1.5, form)
    }
  }

  let edges: WordGraphEdge[] = []
  for (const pair of pairs.values()) {
    const total = pair.positive + pair.negative
    if (Math.abs(total) < threshold) continue
    if (!includeNegative && total < 0) continue
    let type: WordGraphEdgeKind = 'synonym'
    let best = 0
    for (const [kind, weight] of pair.kinds) {
      if (weight > best) {
        best = weight
        type = kind
      }
    }
    edges.push({
      source: pair.source,
      target: pair.target,
      type,
      weight: Math.abs(total),
      positive: total >= 0,
      via: pair.via,
    })
  }
  edges.sort((a, b) => b.weight - a.weight)

  if (ghostNodes.size > maxGhosts) {
    const weights = new Map<string, number>()
    for (const edge of edges) {
      for (const id of [edge.source, edge.target]) {
        if (ghostNodes.has(id)) weights.set(id, (weights.get(id) ?? 0) + edge.weight)
      }
    }
    const keep = new Set(
      [...ghostNodes.keys()]
        .sort((a, b) => (weights.get(b) ?? 0) - (weights.get(a) ?? 0))
        .slice(0, maxGhosts),
    )
    edges = edges.filter(
      (edge) =>
        (!ghostNodes.has(edge.source) || keep.has(edge.source)) &&
        (!ghostNodes.has(edge.target) || keep.has(edge.target)),
    )
    for (const id of ghostNodes.keys()) {
      if (!keep.has(id)) ghostNodes.delete(id)
    }
  }

  const degree = new Map<string, number>()
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  }

  const nodes: WordGraphNode[] = [
    ...items.map((item) => ({
      id: item.id,
      lemma: item.lemma,
      sense: item.sense,
      definitionZh: item.definitionZh,
      pos: item.pos,
      cefr: item.cefr,
      status: item.status,
      degree: degree.get(item.id) ?? 0,
    })),
    ...[...ghostNodes.values()]
      .filter((node) => (degree.get(node.id) ?? 0) > 0)
      .map((node) => ({ ...node, degree: degree.get(node.id) ?? 0 })),
  ]

  // Connected components are cheap and enough to give the UI meaningful
  // clusters without adding a graph library.
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    const value = parent.get(id) ?? id
    if (value === id) return id
    const root = find(value)
    parent.set(id, root)
    return root
  }
  for (const node of nodes) parent.set(node.id, node.id)
  for (const edge of edges) {
    const a = find(edge.source)
    const b = find(edge.target)
    if (a !== b) parent.set(a, b)
  }
  const clusterIndex = new Map<string, number>()
  for (const node of nodes) {
    const root = find(node.id)
    if (!clusterIndex.has(root)) clusterIndex.set(root, clusterIndex.size)
    node.cluster = clusterIndex.get(root)
  }

  const families: WordGraphFamily[] = [...formGroups.entries()]
    .map(([key, group]) => ({
      form: key.slice(key.indexOf(':') + 1),
      kind: group.kind,
      meaning: group.meaning,
      wordIds: [...group.ids],
    }))
    .filter((family) => family.wordIds.length >= 2 && family.wordIds.length <= 16)
    .sort((a, b) => b.wordIds.length - a.wordIds.length)
    .slice(0, 40)

  return {
    nodes,
    edges,
    families,
    isolated: nodes.filter((node) => node.degree === 0).length,
  }
}
