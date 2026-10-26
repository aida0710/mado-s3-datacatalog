// 容量メトリクスの応答: バケットごとの計測の履歴、直下のディレクトリの内訳、計測の開始。
import { z } from 'zod'

export const CapacityTracking = z.object({
  enabled: z.boolean(),
  intervalSeconds: z.number().int(),
  nextRunAt: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  lastStatus: z.enum(['waiting', 'queued', 'error', 'paused']),
  lastError: z.string().nullable(),
  consecutiveFailures: z.number().int().nonnegative(),
})
export const CapacityPoint = z.object({
  totalBytes: z.number().nonnegative(),
  objectCount: z.number().int().nonnegative(),
  collectedAt: z.string(),
})
/** バケット直下のディレクトリ1つぶんの、期間内で最新の計測値。 */
export const CapacityPrefixSummary = z.object({
  prefix: z.string(),
  totalBytes: z.number().nonnegative(),
  objectCount: z.number().int().nonnegative(),
  /** 1つ前の計測での値。前回は上位に入っていなかった、または内訳の無い計測ならnull。 */
  previous: z.object({
    totalBytes: z.number().nonnegative(),
    objectCount: z.number().int().nonnegative(),
  }).nullable(),
})
export const CapacityBucketHistory = z.object({
  bucket: z.string(),
  lastSuccessAt: z.string().nullable(),
  lastStatus: z.enum(['waiting', 'queued', 'success', 'partial', 'error', 'paused']).nullable(),
  lastError: z.string().nullable(),
  points: z.array(CapacityPoint),
  /** 直下のディレクトリ別の内訳。容量の降順。 */
  prefixes: z.array(CapacityPrefixSummary),
})
export const CapacityScanJob = z.object({
  jobId: z.number().int(),
  bucket: z.string(),
  status: z.enum(['queued', 'running']),
  objectCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
})
export const CapacityOverview = z.object({
  connectionId: z.string(),
  days: z.number().int(),
  capacityBytes: z.number().positive().nullable(),
  tracking: CapacityTracking,
  scan: z.object({ jobs: z.array(CapacityScanJob) }),
  buckets: z.array(CapacityBucketHistory),
})
export type CapacityOverview = z.infer<typeof CapacityOverview>
export type CapacityBucketHistory = z.infer<typeof CapacityBucketHistory>
export type CapacityPoint = z.infer<typeof CapacityPoint>
export type CapacityPrefixSummary = z.infer<typeof CapacityPrefixSummary>
export const CapacityPrefixHistory = z.object({ points: z.array(CapacityPoint) })
export type CapacityScanJob = z.infer<typeof CapacityScanJob>
export const CapacityScanResponse = z.object({
  jobs: z.array(z.object({ bucket: z.string(), jobId: z.number().int() })),
})
