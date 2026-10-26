// ジョブ (走査・単価の更新) の応答: 進み具合と結果、投入の結果。
import { z } from 'zod'

// ── 走査ジョブ (spec: 2026-08-18-directory-scan-design.md) ──
export const ScanResult = z.object({
  objectCount: z.number(),
  totalBytes: z.number(),
  children: z.array(z.object({
    name: z.string(), objectCount: z.number(), totalBytes: z.number(),
  })),
  extensions: z.array(z.object({
    ext: z.string(), objectCount: z.number(), totalBytes: z.number(),
  })),
  partial: z.boolean(),
})
export type ScanResult = z.infer<typeof ScanResult>

// 進捗。総数が分からない処理があるので count と ratio の 2 形式を持つ。
// 走査は count (S3 に件数 API が無く、初回は分母が出せない)。
export const JobProgress = z.union([
  z.object({ kind: z.literal('count'), done: z.number(), label: z.string().optional() }),
  z.object({
    kind: z.literal('ratio'), done: z.number(), total: z.number(), label: z.string().optional(),
  }),
])

export const Job = z.object({
  id: z.number(),
  status: z.enum(['queued', 'running', 'done', 'error', 'canceled']),
  progress: JobProgress.nullable().optional(),
  result: z.unknown(),
  error: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
})
export type Job = z.infer<typeof Job>

/** ジョブ投入の応答。走査も単価更新も同じ形。 */
export const StartJobOk = z.object({ jobId: z.number() })
export const StartScanOk = StartJobOk
