import { RegistryClientError, type RegistryClient } from './registry-client.js'
import type { DatasetDetail, DatasetVersionDetail, RegistryDatasetSummary } from '../shared/lineage-types.js'
import { namespaceAllowed } from './namespace-allowlist.js'

export type ServiceLineageRegistry = Pick<RegistryClient, 'searchDatasets' | 'getDataset' | 'getVersion'>

export class ServiceLineageAccessError extends Error {
  constructor() {
    super('Namespace is outside this Service Account key')
    this.name = 'ServiceLineageAccessError'
  }
}

function requireMatchingIdentity(actual: string | null, expected: string): void {
  if (actual?.toLowerCase() !== expected.toLowerCase()) {
    throw new RegistryClientError('Registry returned a different identity', 502, 'invalid_response')
  }
}

function summarizeDataset(dataset: RegistryDatasetSummary) {
  return {
    datasetId: dataset.datasetId,
    namespace: dataset.namespace,
    name: dataset.name,
    displayName: dataset.displayName,
    description: dataset.description,
    mediaType: dataset.mediaType,
    currentVersionId: dataset.currentVersionId,
    versionCount: dataset.versionCount,
  }
}

function summarizeVersion(version: DatasetVersionDetail) {
  // The integration receives version identity and storage URIs, never connection credentials or arbitrary metadata.
  return {
    id: version.id,
    datasetId: version.datasetId,
    version: version.version,
    contentHash: version.contentHash,
    manifestUri: version.manifestUri,
    manifestHash: version.manifestHash,
    schemaUri: version.schemaUri,
    createdAt: version.createdAt,
    locations: version.locations.map(location => ({
      id: location.id,
      uri: location.uri,
      storageKind: location.storageKind,
      status: location.status,
      isPrimary: location.isPrimary,
    })),
  }
}

export function createServiceLineageRead(registry: ServiceLineageRegistry) {
  async function authorizedDataset(id: string, namespaces: readonly string[]): Promise<DatasetDetail> {
    const dataset = await registry.getDataset(id)
    requireMatchingIdentity(dataset.datasetId, id)
    if (!namespaceAllowed(dataset.namespace, namespaces)) throw new ServiceLineageAccessError()
    return dataset
  }

  return {
    async catalog(query: { q: string; namespace?: string; limit: number; offset: number }, namespaces: readonly string[]) {
      if (!query.namespace && !namespaces.includes('*')) throw new ServiceLineageAccessError()
      if (query.namespace && !namespaceAllowed(query.namespace, namespaces)) throw new ServiceLineageAccessError()
      const catalog = await registry.searchDatasets(query)
      // Validate upstream filtering too: a Registry implementation must not broaden the key's allow list.
      const containsDisallowedDataset = catalog.results.some(dataset =>
        !namespaceAllowed(dataset.namespace, namespaces) ||
        (query.namespace && dataset.namespace !== query.namespace),
      )
      if (containsDisallowedDataset) throw new ServiceLineageAccessError()
      return { results: catalog.results.map(summarizeDataset), totalCount: catalog.totalCount }
    },

    async dataset(id: string, namespaces: readonly string[]) {
      const dataset = await authorizedDataset(id, namespaces)
      for (const version of dataset.versions) requireMatchingIdentity(version.datasetId, id)
      return {
        ...summarizeDataset(dataset),
        createdAt: dataset.createdAt,
        versions: dataset.versions.map(summarizeVersion),
      }
    },

    async version(id: string, namespaces: readonly string[]) {
      const version = await registry.getVersion(id)
      requireMatchingIdentity(version.id, id)
      const dataset = await authorizedDataset(version.datasetId, namespaces)
      return { ...summarizeVersion(version), namespace: dataset.namespace, name: dataset.name }
    },
  }
}
