// 連携用の API (/api/mado/、OpenLineage) の応答: トークン自身の許可範囲、データセットの参照、イベントの受け付け。
// 連携先には接続の情報や任意の metadata を渡さないので、画面用の応答より項目が少ない。
import { z } from 'zod'
import { SERVICE_KEY_SCOPES } from '../access-token-permissions.js'

export const IntegrationAccessToken = z.object({
  id: z.string(),
  name: z.string(),
  scopes: z.array(z.enum(SERVICE_KEY_SCOPES)),
  /** 許可する Namespace。全 Namespace は ["*"]。 */
  namespaces: z.array(z.string()),
  expiresAt: z.string().nullable(),
})

export const IntegrationDatasetSummary = z.object({
  datasetId: z.string().nullable(),
  namespace: z.string(),
  name: z.string(),
  displayName: z.string().nullable(),
  description: z.string().nullable(),
  mediaType: z.string().nullable(),
  currentVersionId: z.string().nullable(),
  versionCount: z.number().int().nonnegative(),
})

export const IntegrationCatalog = z.object({
  results: z.array(IntegrationDatasetSummary),
  totalCount: z.number().int().nonnegative(),
})

export const IntegrationVersion = z.object({
  id: z.string(),
  datasetId: z.string(),
  version: z.string(),
  contentHash: z.string().nullable(),
  manifestUri: z.string().nullable(),
  manifestHash: z.string().nullable(),
  schemaUri: z.string().nullable(),
  createdAt: z.string(),
  locations: z.array(z.object({
    id: z.string(),
    uri: z.string(),
    storageKind: z.string(),
    status: z.enum(['available', 'archived', 'missing', 'deleted', 'unknown']),
    isPrimary: z.boolean(),
  })),
})

export const IntegrationDataset = IntegrationDatasetSummary.extend({
  createdAt: z.string(),
  versions: z.array(IntegrationVersion),
})

export const IntegrationVersionDetail = IntegrationVersion.extend({ namespace: z.string(), name: z.string() })

export const OpenLineageIngestResult = z.object({
  accepted: z.literal(true),
  /** 同じイベントを受け付け済みだった。 */
  duplicate: z.boolean(),
  eventId: z.string(),
  runId: z.string(),
  projection: z.enum(['pending', 'published']),
  warnings: z.array(z.string()),
})
