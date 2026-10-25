import type { LineageService } from './lineage-service.js'
import { LineageNamespaceError, type NamespaceLineagePolicy } from './namespace-lineage-policy.js'
import { filterVersionGraphByNamespace } from './namespace-version-graph.js'

export function createNamespaceLineageService(service: LineageService, policy: NamespaceLineagePolicy): LineageService {
  if (policy.unrestricted) return service
  return {
    async logicalGraph(query) {
      policy.requireNamespace(query.namespace)
      const graph = await service.logicalGraph(query)
      const nodes = graph.nodes.filter(node => policy.allowed(node.namespace)
        && (!node.registry || policy.allowed(node.registry.namespace)))
      const ids = new Set(nodes.map(node => node.id))
      return { ...graph, nodes, edges: graph.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)),
        // 形の壊れた項目の ID は、許可していない Namespace の名前を含みうるので出さない。
        warnings: graph.warnings.filter(warning => warning.code !== 'malformedMarquezNode') }
    },
    async versionGraph(query) {
      await policy.version(query.versionId)
      const graph = await service.versionGraph(query)
      if (graph.rootVersionId.toLowerCase() !== query.versionId.toLowerCase()) throw new LineageNamespaceError(404)
      return filterVersionGraphByNamespace(graph, policy)
    },
    async search(query) {
      if (!query.namespace) throw new LineageNamespaceError()
      policy.requireNamespace(query.namespace)
      const response = await service.search(query)
      if (response.results.some(item => item.namespace !== query.namespace)) throw new LineageNamespaceError()
      return response
    },
    async catalog(query) {
      if (!query.namespace) throw new LineageNamespaceError()
      policy.requireNamespace(query.namespace)
      const response = await service.catalog(query)
      if (response.results.some(item => item.namespace !== query.namespace)) throw new LineageNamespaceError()
      return response
    },
    async resolveLocation(query) {
      const response = await service.resolveLocation(query)
      return { ...response, matches: response.matches.filter(item => policy.allowed(item.namespace)) }
    },
    async dataset(id, connections) {
      await policy.dataset(id)
      const detail = await service.dataset(id, connections)
      if (detail.datasetId?.toLowerCase() !== id.toLowerCase() || !policy.allowed(detail.namespace)
        || detail.versions.some(version => version.datasetId.toLowerCase() !== id.toLowerCase())) throw new LineageNamespaceError(404)
      return detail
    },
    async version(id, connections) {
      const canonical = await policy.version(id)
      const detail = await service.version(id, connections)
      if (detail.id.toLowerCase() !== id.toLowerCase() || detail.datasetId !== canonical.datasetId) throw new LineageNamespaceError(404)
      return detail
    },
    async run(id) { return policy.run(id) },
    async jobRuns(namespace, name, limit) {
      policy.requireNamespace(namespace)
      const response = await service.jobRuns(namespace, name, limit)
      const runs = Array.isArray(response.runs) ? response.runs : []
      return { runs: runs.filter(run => hasAllowedNamespaces(run, policy)) }
    },
    projectionStatus: () => service.projectionStatus(),
  }
}

function hasAllowedNamespaces(value: unknown, policy: NamespaceLineagePolicy): boolean {
  if (!value || typeof value !== 'object') return true
  if (Array.isArray(value)) return value.every(item => hasAllowedNamespaces(item, policy))
  return Object.entries(value).every(([key, item]) => key === 'namespace'
    ? typeof item === 'string' && policy.allowed(item)
    : hasAllowedNamespaces(item, policy))
}
