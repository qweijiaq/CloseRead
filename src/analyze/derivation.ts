import { z } from 'zod'

import { chatJson } from './chat.js'
import { hasLlm } from '../config.js'
import type { DerivationGraph, DerivationNode, LearningItem } from '../types.js'

const graphSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        word: z.string().min(1),
        meaningZh: z.string().nullable().optional(),
        kind: z
          .enum(['center', 'root', 'prefix', 'suffix', 'derivative', 'related'])
          .default('derivative'),
      }),
    )
    .default([]),
  edges: z
    .array(
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        label: z.string().nullable().optional(),
      }),
    )
    .default([]),
})

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Build a compact derivation/family graph around one word with the LLM. */
export async function generateDerivationGraph(item: LearningItem): Promise<DerivationGraph> {
  if (!hasLlm()) throw new Error('生成派生图需要配置 LLM。')
  const result = await chatJson(
    graphSchema,
    `You are building a compact word-family/derivation graph for a Chinese learner.
Center the graph on the given word. Include its base/root word, useful prefixes and suffixes, and 3-8 genuinely related derived words (e.g. inflame ← flame, inflammation, inflammatory).
Each node has:
- id: a short stable id (lowercase word, or root:/prefix:/suffix: plus the form)
- word: the word or affix as displayed
- meaningZh: concise Chinese meaning
- kind: center | root | prefix | suffix | derivative | related
Each edge has from, to (node ids) and a short label such as "前缀 in-" / "后缀 -tion" / "派生".
Rules: real relationships only; no obscure words; max 14 nodes; the center node must use the given word; return JSON only:
{"nodes":[{"id":"inflame","word":"inflame","meaningZh":"使燃烧；激化","kind":"center"}],"edges":[{"from":"flame","to":"inflame","label":"前缀 in-"}]}`,
    `Word: ${item.lemma}
Sense: ${item.sense}
Definition: ${item.definition}
Existing word family: ${item.relations.wordFamily.join(', ') || '(none)'}
Existing roots/affixes: ${[
      ...(item.wordFormation?.roots ?? []).map((part) => `root ${part.form}`),
      ...(item.wordFormation?.prefixes ?? []).map((part) => `prefix ${part.form}`),
      ...(item.wordFormation?.suffixes ?? []).map((part) => `suffix ${part.form}`),
    ].join(', ') || '(none)'}

Return one compact graph.`,
    { maxTokens: 2200 },
  )

  const nodes: DerivationNode[] = []
  const seen = new Set<string>()
  for (const node of result.nodes ?? []) {
    const id = normalize(node.id)
    const word = normalize(node.word)
    if (!id || !word || seen.has(id)) continue
    seen.add(id)
    nodes.push({
      id,
      word,
      ...(node.meaningZh?.trim() ? { meaningZh: normalize(node.meaningZh) } : {}),
      kind: node.kind ?? 'derivative',
    })
  }
  const lemma = item.lemma.toLowerCase()
  if (!nodes.some((node) => node.kind === 'center' || node.word.toLowerCase() === lemma)) {
    nodes.unshift({
      id: lemma.replace(/\s+/g, '-'),
      word: item.lemma,
      meaningZh: item.definitionZh,
      kind: 'center',
    })
  } else {
    for (const node of nodes) {
      if (node.kind === 'center' || node.word.toLowerCase() === lemma) {
        node.kind = 'center'
        node.word = item.lemma
      }
    }
  }
  const ids = new Set(nodes.map((node) => node.id))
  const edges = (result.edges ?? [])
    .map((edge) => ({
      from: normalize(edge.from),
      to: normalize(edge.to),
      ...(edge.label?.trim() ? { label: normalize(edge.label) } : {}),
    }))
    .filter((edge) => edge.from !== edge.to && ids.has(edge.from) && ids.has(edge.to))
  return { nodes, edges }
}
