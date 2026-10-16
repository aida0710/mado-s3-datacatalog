import { z } from 'zod'
import type { VersionGraphNode, VersionLineageGraph } from '../shared/lineage-types.js'
import { LineageNamespaceError, type NamespaceLineagePolicy } from './namespace-lineage-policy.js'

// Keep authorization fan-out bounded even when a Registry returns an oversized graph.
const MAX_AUTHORIZED_GRAPH_NODES = 500
// Registry lookups use a small batch instead of hundreds of simultaneous HTTP requests.
const GRAPH_AUTHORIZATION_BATCH_SIZE = 8

export async function filterVersionGraphByNamespace(graph: VersionLineageGraph, policy: NamespaceLineagePolicy): Promise<VersionLineageGraph> {
  const root = await policy.version(graph.rootVersionId)
  const candidates = graph.nodes.slice(0, MAX_AUTHORIZED_GRAPH_NODES)
  const visible: VersionGraphNode[] = []
  for (let start = 0; start < candidates.length; start += GRAPH_AUTHORIZATION_BATCH_SIZE) {
    const batch = await Promise.all(candidates.slice(start, start + GRAPH_AUTHORIZATION_BATCH_SIZE).map(async node => {
      if (node.kind === 'source') return null
      // Graph IDs are opaque. Only explicit canonical IDs may be used for authorization.
      const id = z.uuid().safeParse(node.data.id)
      if (!id.success) return null
      try {
        const detail = node.kind === 'version' ? await policy.version(id.data) : await policy.run(id.data)
        return { id: node.id, kind: node.kind, label: node.kind === 'version' ? ('version' in detail ? detail.version : node.label)
          : ('jobName' in detail ? detail.jobName : node.label), data: { ...detail } }
      } catch (error) {
        if (error instanceof LineageNamespaceError) return null
        throw error
      }
    }))
    for (const node of batch) {
      if (node) visible.push(node)
    }
  }
  const ids = new Set(visible.map(node => node.id))
  const sources = candidates.filter(node => node.kind === 'source' && graph.edges.some(edge =>
    (edge.source === node.id && ids.has(edge.target)) || (edge.target === node.id && ids.has(edge.source))))
  visible.push(...sources)
  for (const source of sources) ids.add(source.id)
  if (!visible.some(node => node.kind === 'version' && node.data.id === root.id)) {
    visible.push({ id: graph.rootVersionId, kind: 'version', label: root.version, data: { ...root } })
    ids.add(graph.rootVersionId)
  }
  return { rootVersionId: graph.rootVersionId, direction: graph.direction, nodes: visible,
    edges: graph.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target))
      .map(({ id, source, target, kind }) => ({ id, source, target, kind })),
    truncated: graph.truncated || visible.length !== graph.nodes.length }
}
