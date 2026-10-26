// DataLineage の応答: Registry のデータセット、グラフ、詳細、保存場所の逆引き、手での登録の結果。
import { z } from 'zod'

// ── Dataset lineage (spec: 2026-08-26-auth-lineage-platform-design.md) ──
// API は React Flow に依存しない domain DTO を返す。キャンバス用の座標や
// node type への変換は front/lib/lineage だけで行う。
export const LineageProjection = z.enum(['logical', 'versions'])
export type LineageProjection = z.infer<typeof LineageProjection>

// Registry が Dataset / Source について返す共通の項目。一覧、Lineage ノード、詳細のどれも
// この形を土台にして、必要な項目だけを足す。
export const RegistryDatasetSummary = z.object({
  kind: z.enum(['dataset', 'source']),
  datasetId: z.string().nullable(),
  datasetKey: z.string().nullable(),
  namespace: z.string(),
  name: z.string(),
  displayName: z.string().nullable().default(null),
  aliases: z.array(z.string()).default([]),
  description: z.string().nullable(),
  mediaType: z.string().nullable(),
  owner: z.string().nullable(),
  currentVersionId: z.string().nullable(),
  versionCount: z.number().int().nonnegative(),
})
export type RegistryDatasetSummary = z.infer<typeof RegistryDatasetSummary>

export const DatasetCatalogResponse = z.object({
  results: z.array(RegistryDatasetSummary),
  totalCount: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
})

export const StorageLineageMatch = RegistryDatasetSummary.extend({
  versionId: z.string(),
  version: z.string(),
  versionCreatedAt: z.string(),
  locationId: z.string(),
  locationUri: z.string(),
  status: z.enum(['available', 'archived', 'missing', 'deleted', 'unknown']),
  isPrimary: z.boolean(),
  observedAt: z.string(),
  matchType: z.enum(['exact', 'prefix']),
})

export const StorageLineageResolution = z.object({
  storageSystemKey: z.string().nullable(),
  uri: z.string(),
  matches: z.array(StorageLineageMatch),
})
export type StorageLineageResolution = z.infer<typeof StorageLineageResolution>

export const ManualLineageMutationResult = z.record(z.string(), z.unknown())

export const LineageNodeKind = z.enum(['source', 'dataset', 'job', 'version', 'run', 'location'])
export type LineageNodeKind = z.infer<typeof LineageNodeKind>

export const LineageNodeSummary = z.object({
  id: z.string(),
  kind: LineageNodeKind,
  label: z.string(),
  namespace: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  summary: z.record(z.string(), z.unknown()).optional().default({}),
  data: z.record(z.string(), z.unknown()).optional().default({}),
  updatedAt: z.string().nullable().optional(),
  completeness: z.enum(['complete', 'partial', 'unregistered']).optional(),
  registry: RegistryDatasetSummary.nullable().optional(),
  latestRun: z.object({
    id: z.string().nullable(),
    state: z.string().nullable(),
    startedAt: z.string().nullable(),
    endedAt: z.string().nullable(),
  }).nullable().optional(),
})
export type LineageNodeSummary = z.infer<typeof LineageNodeSummary>

export const LineageEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  kind: z.string(),
})
export type LineageEdge = z.infer<typeof LineageEdge>

export const LineageWarning = z.discriminatedUnion('code', [
  z.object({ code: z.literal('marquezProjectionUnavailable') }),
  z.object({ code: z.literal('registryEnrichmentUnavailable') }),
  z.object({ code: z.literal('malformedMarquezNode'), nodeId: z.string() }),
  z.object({ code: z.literal('registrySearchUnavailable') }),
  z.object({ code: z.literal('marquezSearchUnavailable') }),
])
export type LineageWarning = z.infer<typeof LineageWarning>

export const LineageProjectionStatus = z.object({
  state: z.string(),
  pendingEvents: z.number().int().nonnegative().nullable().optional().default(0),
  oldestPendingAt: z.string().nullable().optional(),
  /** 反映状態を取れなかった理由。画面は code で訳す。 */
  code: z.enum(['registryProjectionUnavailable', 'marquezProjectionUnavailable']).optional(),
  /** Dataset Registry が返した説明。外部の文なのでそのまま出す。 */
  message: z.string().optional(),
})
export type LineageProjectionStatus = z.infer<typeof LineageProjectionStatus>

export const LineageGraph = z.object({
  root: z.object({
    kind: z.enum(['dataset', 'job']),
    namespace: z.string(),
    name: z.string(),
    nodeId: z.string(),
  }).optional(),
  rootVersionId: z.string().optional(),
  nodes: z.array(LineageNodeSummary),
  edges: z.array(LineageEdge),
  projection: LineageProjectionStatus.optional(),
  generatedAt: z.string().optional(),
  truncated: z.boolean().optional().default(false),
  warnings: z.array(LineageWarning).optional().default([]),
})
export type LineageGraph = z.infer<typeof LineageGraph>

export const LineageStorageLocationDetail = z.object({
  id: z.string(),
  uri: z.string(),
  storageKind: z.string(),
  storageSystemKey: z.string().nullable(),
  region: z.string().nullable(),
  bucket: z.string().nullable(),
  status: z.enum(['available', 'archived', 'missing', 'deleted', 'unknown']),
  isPrimary: z.boolean(),
  observedAt: z.string(),
  madoConnectionId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
})
export type LineageStorageLocationDetail = z.infer<typeof LineageStorageLocationDetail>

export const DatasetVersionDetail = z.object({
  id: z.string(),
  datasetId: z.string(),
  version: z.string(),
  contentHash: z.string().nullable(),
  manifestUri: z.string().nullable(),
  manifestHash: z.string().nullable(),
  schemaUri: z.string().nullable(),
  createdAt: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  locations: z.array(LineageStorageLocationDetail),
})
export type DatasetVersionDetail = z.infer<typeof DatasetVersionDetail>

export const DatasetDetail = RegistryDatasetSummary.extend({
  createdAt: z.string(),
  versions: z.array(DatasetVersionDetail),
})
export type DatasetDetail = z.infer<typeof DatasetDetail>

export const LineageRunDatasetRef = z.object({
  versionId: z.string(),
  version: z.string(),
  namespace: z.string(),
  name: z.string(),
  primaryUri: z.string().nullable(),
  storageKind: z.string().nullable(),
})

export const LineageRunDetail = z.object({
  id: z.string(),
  runKey: z.string(),
  jobNamespace: z.string(),
  jobName: z.string(),
  status: z.enum(['RUNNING', 'COMPLETE', 'FAIL', 'ABORT']),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  gitSha: z.string().nullable(),
  containerDigest: z.string().nullable(),
  configUri: z.string().nullable(),
  configHash: z.string().nullable(),
  modelRefs: z.array(z.record(z.string(), z.unknown())),
  runtime: z.record(z.string(), z.unknown()),
  metrics: z.record(z.string(), z.unknown()),
  errorMessage: z.string().nullable(),
  inputs: z.array(LineageRunDatasetRef),
  outputs: z.array(LineageRunDatasetRef),
  sources: z.array(z.record(z.string(), z.unknown())),
})
export type LineageRunDetail = z.infer<typeof LineageRunDetail>

export const LineageSearchResult = z.object({
  id: z.string(),
  kind: LineageNodeKind,
  namespace: z.string(),
  name: z.string(),
  label: z.string(),
  displayName: z.string().nullable(),
  description: z.string().nullable(),
  mediaType: z.string().nullable(),
  owner: z.string().nullable(),
  currentVersionId: z.string().nullable(),
  versionCount: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
  datasetId: z.string().nullable(),
})

/** Registry と Marquez を合わせた検索。片方に届かなければ、もう片方の結果と警告を返す。 */
export const LineageSearchResponse = z.object({
  results: z.array(LineageSearchResult),
  totalCount: z.number().int().nonnegative(),
  warnings: z.array(LineageWarning),
})

/** Marquez の job の実行の一覧。Marquez の応答をそのまま返す。 */
export const MarquezJobRuns = z.record(z.string(), z.unknown())
