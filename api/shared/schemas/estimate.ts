// 移送の見積もりの応答: 候補ごとの費用・所要時間・注意と、使った単価カタログ。
import { z } from 'zod'
import { Provider, StorageClassKey } from './connections.js'

// ── 転送見積もり (spec: 2026-08-22-transfer-estimate-design.md) ──

// 見積もりの注意。画面は code で訳し、横の値を文に入れる (front/i18n/noticeMessages.ts)。
// API と画面は同じ版で配るので、code を足すときは両方を一緒に直す。
export const EstimateWarning = z.discriminatedUnion('code', [
  z.object({ code: z.literal('ratesUnavailable'), region: z.string().nullable() }),
  z.object({ code: z.literal('minDuration'), days: z.number() }),
  z.object({ code: z.literal('retrievalCost'), usdPerGb: z.number() }),
  z.object({ code: z.literal('archiveRetrievalTime') }),
  z.object({ code: z.literal('sourceArchiveRestore') }),
  z.object({ code: z.literal('wasabiPolicy') }),
  z.object({ code: z.literal('proxyRate') }),
  z.object({ code: z.literal('manualRate') }),
  z.object({ code: z.literal('smallObjects'), averageObjectBytes: z.number(), minimumBillableBytes: z.number() }),
  z.object({
    code: z.literal('objectOverhead'), overheadBytesPerObject: z.number(), objectCount: z.number(),
    overheadBytes: z.number(), percentOfBillable: z.number(),
  }),
  z.object({ code: z.literal('capacity'), capacityBytes: z.number(), requiredBytes: z.number() }),
])
export type EstimateWarning = z.infer<typeof EstimateWarning>

export const ManualFactNote = z.enum(['awsMinimumRetention', 'awsMinimumBillableSize', 'deepArchiveStorageRate', 'wasabiManualRates'])
export type ManualFactNote = z.infer<typeof ManualFactNote>

export const TransferCandidate = z.object({
  connectionId: z.string(),
  name: z.string(),
  provider: Provider,
  storageClass: StorageClassKey.nullable(),
  storageClassLabel: z.string().nullable(),
  /** 移動元と同じ接続 (= ストレージクラスの変更)。回線も egress も要らない。 */
  sameConnection: z.boolean(),
  durationSec: z.object({ optimistic: z.number(), pessimistic: z.number() }),
  upfront: z.object({
    egress: z.number(),
    retrieval: z.number(),
    getRequests: z.number(),
    putRequests: z.number(),
    total: z.number(),
  }),
  monthlyUsd: z.number(),
  billableBytes: z.number(),
  putRequestCount: z.number(),
  avgObjectBytes: z.number(),
  warnings: z.array(EstimateWarning),
})
export type TransferCandidate = z.infer<typeof TransferCandidate>

export const TransferEstimate = z.object({
  source: z.object({
    connectionId: z.string(),
    name: z.string(),
    provider: Provider,
    storageClass: StorageClassKey.nullable(),
    storageClassLabel: z.string().nullable(),
  }),
  scan: z.object({
    objectCount: z.number(),
    totalBytes: z.number(),
    scannedAt: z.string().nullable(),
  }),
  catalog: z.object({
    asOf: z.string(),
    awsPublishedAt: z.string().nullable(),
    /** 'bundled' = まだ取得できていない (同梱の値で計算している)。
     *  費用 0 が「無料」なのか「単価を引けていない」のかを区別するために要る。 */
    source: z.enum(['bundled', 'fetched']),
    /** 単価を取得した日時 (ISO)。同梱を使っているときは null。 */
    fetchedAt: z.string().nullable(),
    /** 取得から時間が経ちすぎている。更新を促すために出す。 */
    stale: z.boolean(),
    /** 料金 API から取れず手で持っている値。**更新しても変わらない部分**。 */
    manualFacts: z.object({
      verifiedOn: z.string(),
      notes: z.array(ManualFactNote),
      sources: z.array(z.string()),
    }),
  }),
  candidates: z.array(TransferCandidate),
})
export type TransferEstimate = z.infer<typeof TransferEstimate>

/** いま見積もりに使っている単価カタログの出所と、更新のジョブの状態。 */
export const PricingStatus = z.object({
  asOf: z.string(),
  awsPublishedAt: z.string().nullable(),
  source: z.enum(['bundled', 'fetched']),
  fetchedAt: z.string().nullable(),
  stale: z.boolean(),
  /** app_settings の pricing_refresh_days。これより古いと見積もりを開いたときに取り直す。 */
  refreshDays: z.number(),
  regions: z.array(z.string()),
  /** 実行中か、最後に成功した更新のジョブ。 */
  job: z.object({ id: z.number(), status: z.string(), progress: z.unknown() }).nullable(),
  /** 直近の更新が失敗していればその理由。 */
  lastError: z.string().nullable(),
})
