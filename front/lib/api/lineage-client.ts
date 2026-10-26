import {
  DatasetCatalogResponse,
  DatasetDetail,
  DatasetVersionDetail,
  LineageGraph,
  LineageRunDetail,
  ManualLineageMutationResult,
  StorageLineageResolution,
} from './types'
import type {
  LineageDatasetUpdateInput,
  LineageProjection,
  ManualDatasetRegistrationInput,
  ManualLineageRegistrationInput,
  ManualStorageLocationInput,
} from './types'
import { jsonRequestInit } from '@mado/design-system/http'
import { API_BASE, buildUrl, requestApi } from './http'

// Dataset lineage。Marquez / Registry の違いは API 側で吸収し、ブラウザは統一した
// domain graph だけを受け取る。React Flow 用の座標はここでは持たない。
export const lineageClient = {
  lineageGraph: (params: {
    mode: LineageProjection
    rootKind?: 'dataset' | 'job'
    namespace?: string
    name?: string
    versionId?: string
    depth?: number
  }) => requestApi(
    buildUrl(`${API_BASE}/lineage/graph`, {
      mode: params.mode,
      rootKind: params.rootKind,
      namespace: params.namespace,
      name: params.name,
      versionId: params.versionId,
      depth: params.depth == null ? undefined : String(params.depth),
    }),
    LineageGraph,
  ),

  lineageDataset: (datasetId: string) =>
    requestApi(`${API_BASE}/lineage/datasets/${encodeURIComponent(datasetId)}`, DatasetDetail),

  updateLineageDataset: (datasetId: string, input: LineageDatasetUpdateInput) =>
    requestApi(
      `${API_BASE}/lineage/curation/datasets/${encodeURIComponent(datasetId)}`,
      DatasetDetail,
      jsonRequestInit('PATCH', input),
    ),

  lineageVersion: (versionId: string) =>
    requestApi(`${API_BASE}/lineage/versions/${encodeURIComponent(versionId)}`, DatasetVersionDetail),

  lineageRun: (runId: string) =>
    requestApi(`${API_BASE}/lineage/runs/${encodeURIComponent(runId)}`, LineageRunDetail),

  /** cursor は前のページの応答の nextCursor。最初のページは省く。 */
  lineageCatalog: (params: { q?: string; namespace?: string; limit?: number; cursor?: string } = {}) =>
    requestApi(buildUrl(`${API_BASE}/lineage/catalog`, {
      q: params.q,
      namespace: params.namespace,
      limit: params.limit == null ? undefined : String(params.limit),
      cursor: params.cursor,
    }), DatasetCatalogResponse),

  lineageResolveLocation: (connectionId: string, bucket: string, key: string) =>
    requestApi(buildUrl(`${API_BASE}/lineage/resolve-location`, { connectionId, bucket, key }), StorageLineageResolution),

  registerManualDataset: (input: ManualDatasetRegistrationInput) =>
    requestApi(`${API_BASE}/lineage/curation/datasets`, ManualLineageMutationResult, jsonRequestInit('POST', input)),

  registerManualLocation: (input: {
    versionId: string
    location: ManualStorageLocationInput
    evidenceRefs: string[]
  }) => requestApi(`${API_BASE}/lineage/curation/locations`, ManualLineageMutationResult, jsonRequestInit('POST', input)),

  registerManualLineage: (input: ManualLineageRegistrationInput) =>
    requestApi(`${API_BASE}/lineage/curation/runs`, ManualLineageMutationResult, jsonRequestInit('POST', input)),
}
