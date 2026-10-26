import { z } from 'zod'
import type { Capabilities, ListObjectsVersion, Provider, StorageClassKey } from '../../../api/shared/schemas/connections'

// 応答のスキーマは API と共有する (api/shared/schemas)。ここは画面だけが使う型と値。
export * from '../../../api/shared/schemas/storage'
export * from '../../../api/shared/schemas/capacity'
export * from '../../../api/shared/schemas/markdown-documents'
export * from '../../../api/shared/schemas/connections'
export * from '../../../api/shared/schemas/tags'
export * from '../../../api/shared/schemas/settings'
export * from '../../../api/shared/schemas/jobs'
export * from '../../../api/shared/schemas/estimate'
export * from '../../../api/shared/schemas/lineage'

export const TarPreview = z.object({
  entries: z.array(z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
  })),
  truncated: z.boolean(),
  hasMore: z.boolean(),
  offset: z.number(),
  limit: z.number(),
})

/** 全許可 — 新規接続の初期値であり、既定値そのもの
 *  (API 側も connection_settings に行が無ければ全許可を返す)。 */
export const ALL_CAPABILITIES_ON: Capabilities = {
  list: true, preview: true, download: true, archive: true,
  audioInfo: true, audioSpectrogram: true, readmeRead: true, readmeWrite: true,
}

// フォームが POST /api/internal/connections に送信するデータ。
// 全フィールド必須; シークレット/アクセスキーは平文で LAN 上の HTTP(S) で送信される。
export interface ConnectionCreateInput {
  name: string
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
  listObjectsVersion: ListObjectsVersion
  capabilities: Capabilities
  visibility?: { mode: 'public' | 'whitelist'; allowedUserIds: string[] }
}

// PUT /api/internal/connections/:id — 部分更新。認証情報フィールドを省略すると既存の値が保持される。
// capabilities も差分 — 変えたキーだけ送る。
export interface ConnectionUpdateInput {
  name?: string
  endpoint?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  forcePathStyle?: boolean
  listObjectsVersion?: ListObjectsVersion
  capabilities?: Partial<Capabilities>
  visibility?: { mode?: 'public' | 'whitelist'; allowedUserIds?: string[] }
  scanEnabled?: boolean
  scanPageSize?: 100 | 250 | 500 | 1000
  capacityMetricsEnabled?: boolean
  listCacheTtlSec?: number
  capacityTracking?: { enabled: boolean; intervalSeconds: number }
  /** 見積もり設定の差分。**null = 既定に戻す** (設定行を消す)、
   *  未指定 = 触らない。プロバイダの既定が「エンドポイントから推定」なので
   *  この区別が要る。 */
  pricing?: ConnectionPricingInput
}

export interface ConnectionPricingInput {
  provider?: Provider | null
  region?: string | null
  storageClass?: StorageClassKey | null
  readMbps?: number | null
  writeMbps?: number | null
  parallelism?: number | null
  requestOverheadMs?: number | null
  instability?: number | null
  capacityBytes?: number | null
  storagePerGbMonth?: number | null
  egressPerGb?: number | null
  putPer1000?: number | null
  getPer1000?: number | null
}

export interface TagCreateInput { name: string; color: string }
export interface TagUpdateInput { name?: string; color?: string }

export interface ManualStorageLocationInput {
  connectionId: string
  bucket: string
  key: string
  status: 'available' | 'archived' | 'missing' | 'deleted' | 'unknown'
  isPrimary: boolean
}

export interface ManualDatasetRegistrationInput {
  datasetId?: string
  dataset?: {
    datasetKey: string
    namespace: string
    name: string
    displayName?: string
    aliases: string[]
    description?: string
    mediaType?: string
    owner?: string
  }
  version: {
    version: string
    contentHash?: string
    manifestUri?: string
    manifestHash?: string
    schemaUri?: string
  }
  location?: ManualStorageLocationInput
  source?: {
    sourceKey: string
    kind: 'purchased' | 'crawled' | 'provided' | 'generated' | 'database' | 'other'
    name: string
    uri?: string
    vendor?: string
    product?: string
    licenseRef?: string
    contractRef?: string
  }
  processing?: {
    transformation: ManualTransformationInput
    inputVersionIds: string[]
    jobNamespace: string
    jobName: string
    gitSha?: string
    containerDigest?: string
    configUri?: string
    configHash?: string
    executionTimeStatus: 'known' | 'unknown'
    occurredAt?: string
  }
  evidenceRefs: string[]
}

export interface LineageDatasetUpdateInput {
  displayName?: string | null
  aliases?: string[]
  description?: string | null
  mediaType?: string | null
  owner?: string | null
}

export interface ManualTransformationInput {
  transformationKey: string
  name: string
  description?: string
  codeRepository?: string
  defaultCodeRef?: string
}

export interface ManualLineageRegistrationInput {
  transformation: ManualTransformationInput
  inputVersionIds: string[]
  outputVersionIds: string[]
  jobNamespace: string
  jobName: string
  gitSha?: string
  containerDigest?: string
  configUri?: string
  configHash?: string
  executionTimeStatus: 'known' | 'unknown'
  occurredAt?: string
  evidenceRefs: string[]
}
