// 接続 (S3 互換ストレージ) の応答: 設定、許可する操作、見積もりのプロファイル、公開範囲。
import { z } from 'zod'

// listObjectsVersion: 接続先 S3 サーバへの ListObjects API バージョン。
// 'v2' (既定): AWS / R2 / MinIO 等の正式な S3-compatible 実装向け。
// 'v1':        ListObjectsV2 を理解しない古い S3 互換実装、
//              V1 only のサーバ向け。V2 を理解しないため ?start-after= が
//              無視され、毎回先頭ページが返ってきてしまう。s3cmd は元々 V1
//              を使うので動く。
export const ListObjectsVersion = z.enum(['v1', 'v2'])
export type ListObjectsVersion = z.infer<typeof ListObjectsVersion>

// 接続ごとに許可する操作 (api/storage.ts の Capabilities と 1:1)。
//
// 認証の無いツールなのでアクセス制御ではなく **誤操作の防止**。Glacier Deep
// Archive のように GetObject 自体が失敗する / 復元課金が発生するバケットや、
// 書き戻したくない本番バケットを登録した接続で、危険な導線を閉じるためにある。
// UI で隠すのは導線を消すためで、実際の遮断は API 側 (403) が担う。
export const Capabilities = z.object({
  list: z.boolean(),
  preview: z.boolean(),
  download: z.boolean(),
  archive: z.boolean(),
  audioInfo: z.boolean(),
  audioSpectrogram: z.boolean(),
  readmeRead: z.boolean(),
  readmeWrite: z.boolean(),
})
export type Capabilities = z.infer<typeof Capabilities>
export type Capability = keyof Capabilities

// ── 転送見積もりのプロファイル (spec: 2026-08-22-transfer-estimate-design.md) ──

export const Provider = z.enum(['aws', 'wasabi', 'onprem', 'other'])
export type Provider = z.infer<typeof Provider>

export const StorageClassKey = z.enum([
  'STANDARD', 'INTELLIGENT_TIERING', 'STANDARD_IA', 'ONEZONE_IA',
  'GLACIER_IR', 'GLACIER', 'DEEP_ARCHIVE',
])
export type StorageClassKey = z.infer<typeof StorageClassKey>

/** 接続ごとの見積もり設定。値は「設定 + 推定 + 既定」を畳んだ実効値。 */
export const ConnectionPricing = z.object({
  provider: Provider,
  /** false = エンドポイントからの自動判定。 */
  providerExplicit: z.boolean(),
  region: z.string().nullable(),
  storageClass: StorageClassKey.nullable(),
  storageClassLabel: z.string().nullable(),
  /** false = 料金カタログに単価が無い。費用 0 は「無料」の意味ではない。 */
  ratesResolved: z.boolean(),
  readMbps: z.number(),
  writeMbps: z.number(),
  parallelism: z.number(),
  requestOverheadMs: z.number(),
  instability: z.number(),
  capacityBytes: z.number().nullable(),
  // 手動上書き。null = カタログに従う。
  storagePerGbMonth: z.number().nullable(),
  egressPerGb: z.number().nullable(),
  putPer1000: z.number().nullable(),
  getPer1000: z.number().nullable(),
  /** 上書き適用後の実効単価 (「今いくらで計算されるか」の表示用)。 */
  effective: z.object({
    storagePerGbMonth: z.number().nullable(),
    egressPerGb: z.number().nullable(),
    putPer1000: z.number(),
    getPer1000: z.number(),
    retrievalPerGb: z.number(),
    minDurationDays: z.number(),
    minBillableBytes: z.number(),
    /** オブジェクトごとに加算されるバイト数 (Glacier 系の 40KB)。 */
    perObjectOverheadBytes: z.number(),
    /** 単価の出所。'manual' は「単価を更新しても変わらない」。 */
    storageRateSource: z.enum(['api', 'proxy', 'manual', 'override', 'none']),
  }),
})
export type ConnectionPricing = z.infer<typeof ConnectionPricing>

export const ConnectionAccessUser = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  username: z.string().nullable(),
  email: z.string().nullable(),
  status: z.enum(['active', 'disabled']),
})
export type ConnectionAccessUser = z.infer<typeof ConnectionAccessUser>
export const ConnectionAccessUsers = z.object({ users: z.array(ConnectionAccessUser) })

export const ConnectionVisibility = z.object({
  mode: z.enum(['public', 'whitelist']),
  allowedUsers: z.array(ConnectionAccessUser),
})
export type ConnectionVisibility = z.infer<typeof ConnectionVisibility>

export const Connection = z.object({
  id: z.string(),
  name: z.string(),
  endpoint: z.string(),
  region: z.string(),
  accessKeyIdMasked: z.string(),
  forcePathStyle: z.boolean(),
  listObjectsVersion: ListObjectsVersion,
  capabilities: Capabilities,
  /** 配下の走査を許可するか。巨大バケットを抱える接続でのガード。 */
  scanEnabled: z.boolean(),
  /** storage.scanの1回あたり取得件数。 */
  scanPageSize: z.union([z.literal(100), z.literal(250), z.literal(500), z.literal(1000)]),
  /** bucket容量メトリクスの集計許可。 */
  capacityMetricsEnabled: z.boolean(),
  /** 一覧キャッシュの保持秒数。既定 86400 (24 時間)。 */
  listCacheTtlSec: z.number(),
  /** connection配下の全bucketへ適用する容量計測設定。 */
  capacityTracking: z.object({
    enabled: z.boolean(),
    intervalSeconds: z.number().int(),
  }),
  /** 転送見積もりに使うプロファイル。 */
  pricing: ConnectionPricing,
  createdAt: z.string(),
  updatedAt: z.string(),
  isDefault: z.boolean(),
  visibility: ConnectionVisibility,
})
export type Connection = z.infer<typeof Connection>

export const ConnectionList = z.array(Connection)
