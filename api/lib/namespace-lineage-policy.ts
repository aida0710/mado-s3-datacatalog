import type { RegistryClient } from './registry-client.js'
import type { DatasetDetail, DatasetVersionDetail, LineageRunDetail } from '../shared/lineage-types.js'
import { namespaceAllowed } from './namespace-allowlist.js'

export class LineageNamespaceError extends Error {
  constructor(readonly status: 403 | 404 = 403) { super(status === 404 ? 'not found' : 'namespace is not allowed') }
}

export function createNamespaceLineagePolicy(registry: RegistryClient, namespaces: readonly string[]) {
  const datasets = new Map<string, Promise<DatasetDetail>>()
  const versions = new Map<string, Promise<DatasetVersionDetail>>()
  const runs = new Map<string, Promise<LineageRunDetail>>()
  const allowed = (namespace: string) => namespaceAllowed(namespace, namespaces)
  function requireNamespace(namespace: string): void {
    if (!allowed(namespace)) throw new LineageNamespaceError()
  }
  function dataset(id: string): Promise<DatasetDetail> {
    if (!datasets.has(id)) datasets.set(id, registry.getDataset(id).then(value => {
      if (value.datasetId?.toLowerCase() !== id.toLowerCase() || !allowed(value.namespace)
        || value.versions.some(version => version.datasetId.toLowerCase() !== id.toLowerCase())) throw new LineageNamespaceError(404)
      return value
    }))
    return datasets.get(id)!
  }
  function version(id: string): Promise<DatasetVersionDetail> {
    if (!versions.has(id)) versions.set(id, registry.getVersion(id).then(async value => {
      if (value.id.toLowerCase() !== id.toLowerCase()) throw new LineageNamespaceError(404)
      await dataset(value.datasetId)
      return value
    }))
    return versions.get(id)!
  }
  function run(id: string): Promise<LineageRunDetail> {
    if (!runs.has(id)) runs.set(id, registry.getRun(id).then(value => {
      if (value.id.toLowerCase() !== id.toLowerCase() || !allowed(value.jobNamespace)
        || [...value.inputs, ...value.outputs].some(item => !allowed(item.namespace))) throw new LineageNamespaceError(404)
      return value
    }))
    return runs.get(id)!
  }
  const unrestricted = namespaces.includes('*')
  async function authorizeDatasetRegistration(input: {
    dataset?: { namespace: string }
    datasetId?: string
    processing?: { jobNamespace: string; inputVersionIds: string[] }
  }): Promise<void> {
    if (unrestricted) return
    if (input.dataset) requireNamespace(input.dataset.namespace)
    if (input.datasetId) await dataset(input.datasetId)
    if (!input.processing) return
    requireNamespace(input.processing.jobNamespace)
    for (const id of input.processing.inputVersionIds) await version(id)
  }
  async function authorizeRunRegistration(input: {
    jobNamespace: string
    inputVersionIds: string[]
    outputVersionIds: string[]
  }): Promise<void> {
    if (unrestricted) return
    requireNamespace(input.jobNamespace)
    for (const id of [...input.inputVersionIds, ...input.outputVersionIds]) await version(id)
  }
  return { unrestricted, allowed, requireNamespace, dataset, version, run, authorizeDatasetRegistration, authorizeRunRegistration }
}

export type NamespaceLineagePolicy = ReturnType<typeof createNamespaceLineagePolicy>
