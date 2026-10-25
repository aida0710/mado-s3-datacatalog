// 転送の費用・所要時間の見積もり (spec: 2026-08-22-transfer-estimate-design.md)。
//
// S3 も DB もカタログも知らない純ロジック。単価の解決は pricing.ts が済ませて
// EffectiveRates として渡してくる (scan.ts が S3 を知らないのと同じ方針)。
//
// 出す数字の精度について: 目的は**桁と大小関係を合わせる**ことであって、
// 請求書を再現することではない。無料枠・Savings Plans・既存の月間使用量との
// 合算は考慮しない。所要時間を単一の数字ではなくレンジで出すのも同じ理由で、
// 単一の数字は外れたときに機能全体の信用を落とす。

import { GIB, type ConnectionProfile, type EffectiveRates } from './pricing.js'
import type { Tier } from './pricing-types.js'

/** マルチパートの既定分割サイズ。rclone / s5cmd の実運用値に寄せた 64MiB。 */
export const DEFAULT_PART_SIZE_BYTES = 64 * 1024 * 1024

/** Intelligent-Tiering の監視料が掛かる下限 (128KB)。これ未満は対象外。 */
const MONITORING_MIN_BYTES = 128 * 1024

/** 帯域の単位。1 MB/s = 10^6 バイト毎秒 (ネットワーク機器の表記に合わせる)。
 *  課金側の GB が 2^30 なのと食い違うが、どちらも各分野の慣習どおり。 */
const BYTES_PER_MB = 1_000_000

/** オブジェクトごとの加算がこの割合を超えたら警告する。 */
const OVERHEAD_WARN_RATIO = 0.1

export interface ScanInput {
  objectCount: number
  totalBytes: number
}

export interface Endpoint {
  profile: ConnectionProfile
  rates: EffectiveRates
}

/** 見積もりの注意。画面は code で訳し、横の値を文に入れる (front/i18n/noticeMessages.ts)。値は書式を付けない数のまま渡す。 */
export type EstimateWarning =
  /** 移動先のリージョンの単価がカタログに無い。region は接続にリージョンが無ければ null。 */
  | { code: 'ratesUnavailable'; region: string | null }
  | { code: 'minDuration'; days: number }
  | { code: 'retrievalCost'; usdPerGb: number }
  | { code: 'archiveRetrievalTime' }
  | { code: 'sourceArchiveRestore' }
  | { code: 'wasabiPolicy' }
  | { code: 'proxyRate' }
  | { code: 'manualRate' }
  | { code: 'smallObjects'; averageObjectBytes: number; minimumBillableBytes: number }
  | { code: 'objectOverhead'; overheadBytesPerObject: number; objectCount: number; overheadBytes: number; percentOfBillable: number }
  | { code: 'capacity'; capacityBytes: number; requiredBytes: number }

export interface UpfrontCost {
  /** 移動元から出す費用。同一接続内のコピーでは発生しない。 */
  egress: number
  /** 移動元が IA / Glacier 系のときの取り出し費用。 */
  retrieval: number
  getRequests: number
  putRequests: number
  total: number
}

export interface TransferEstimate {
  connectionId: string
  name: string
  provider: ConnectionProfile['provider']
  storageClass: ConnectionProfile['storageClass']
  storageClassLabel: string | null
  /** 移動元と同じ接続か (= ストレージクラスの変更)。 */
  sameConnection: boolean
  durationSec: { optimistic: number; pessimistic: number }
  upfront: UpfrontCost
  monthlyUsd: number
  /** 最小課金サイズを適用した後の課金対象バイト。 */
  billableBytes: number
  putRequestCount: number
  avgObjectBytes: number
  warnings: EstimateWarning[]
}

/** 累進課金の積分。`upToGb: null` が最終段。
 *
 *  最終段が上限付きで終わっている (カタログが壊れている) 場合は、
 *  最後の単価で延長する。0 として落とすと静かに過小評価になるため。 */
export function tieredCost(gb: number, tiers: readonly Tier[]): number {
  if (gb <= 0 || tiers.length === 0) return 0
  let remaining = gb
  let lower = 0
  let total = 0
  for (const t of tiers) {
    const upper = t.upToGb ?? Infinity
    const span = Math.min(remaining, upper - lower)
    if (span > 0) {
      total += span * t.usd
      remaining -= span
    }
    lower = upper
    if (remaining <= 0) return total
  }
  return total + remaining * tiers[tiers.length - 1].usd
}

/** 転送に必要な PUT 系リクエスト数。
 *
 *  平均サイズが分割サイズを超えると 1 オブジェクトが複数リクエストになる:
 *  CreateMultipartUpload + N×UploadPart + CompleteMultipartUpload。
 *  平均 295MB のデータセットでは 1 オブジェクトあたり 7 リクエストになり、
 *  PUT が $0.065/1000 の Deep Archive では効いてくる。 */
export function putRequestCount(
  objectCount: number,
  avgObjectBytes: number,
  partSizeBytes: number,
): number {
  if (objectCount <= 0) return 0
  const parts = Math.max(1, Math.ceil(avgObjectBytes / partSizeBytes))
  return parts > 1 ? objectCount * (parts + 2) : objectCount
}

function buildWarnings({ source, destination, scan, avgObjectBytes, billableBytes }: {
  source: Endpoint
  destination: Endpoint
  scan: ScanInput
  avgObjectBytes: number
  billableBytes: number
}): EstimateWarning[] {
  const out: EstimateWarning[] = []
  const cls = destination.profile.storageClass

  if (!destination.rates.ratesResolved) out.push({ code: 'ratesUnavailable', region: destination.profile.region })

  if (destination.rates.minDurationDays > 0) out.push({ code: 'minDuration', days: destination.rates.minDurationDays })

  if (destination.rates.retrievalPerGb > 0) out.push({ code: 'retrievalCost', usdPerGb: destination.rates.retrievalPerGb })

  // Glacier Instant Retrieval は即時なので時間の警告は要らない。
  if (cls === 'GLACIER' || cls === 'DEEP_ARCHIVE') out.push({ code: 'archiveRetrievalTime' })

  if (source.profile.storageClass === 'GLACIER' || source.profile.storageClass === 'DEEP_ARCHIVE') {
    out.push({ code: 'sourceArchiveRestore' })
  }

  if (destination.profile.provider === 'wasabi') out.push({ code: 'wasabiPolicy' })

  if (destination.rates.storageRateSource === 'proxy') out.push({ code: 'proxyRate' })

  // 「単価を更新」を押しても変わらない値であることを、行を開けば分かるようにする。
  if (destination.rates.storageRateSource === 'manual') out.push({ code: 'manualRate' })

  if (destination.rates.minBillableBytes > 0 && avgObjectBytes < destination.rates.minBillableBytes) {
    out.push({ code: 'smallObjects', averageObjectBytes: avgObjectBytes, minimumBillableBytes: destination.rates.minBillableBytes })
  }

  // 最小課金サイズ (IA 系の 128KB) とは別に、Glacier 系はオブジェクトごとに
  // 40KB が**加算**される。最小課金サイズと違って大きいオブジェクトにも乗るので、
  // 小さいものを大量に置くとここが効く。
  const overheadBytes = scan.objectCount * destination.rates.perObjectOverheadBytes
  if (overheadBytes > scan.totalBytes * OVERHEAD_WARN_RATIO) {
    out.push({
      code: 'objectOverhead',
      overheadBytesPerObject: destination.rates.perObjectOverheadBytes,
      objectCount: scan.objectCount,
      overheadBytes,
      percentOfBillable: Math.round((overheadBytes / (scan.totalBytes + overheadBytes)) * 100),
    })
  }

  const cap = destination.profile.capacityBytes
  if (cap !== null && billableBytes > cap) out.push({ code: 'capacity', capacityBytes: cap, requiredBytes: billableBytes })

  return out
}

export interface EstimateInput {
  scan: ScanInput
  source: Endpoint
  destination: Endpoint
  partSizeBytes?: number
}

export function estimateTransfer(input: EstimateInput): TransferEstimate {
  const { scan, source, destination } = input
  const partSize = input.partSizeBytes ?? DEFAULT_PART_SIZE_BYTES
  const sameConnection = source.profile.connectionId === destination.profile.connectionId

  const avgObjectBytes = scan.objectCount > 0 ? scan.totalBytes / scan.objectCount : 0
  const puts = putRequestCount(scan.objectCount, avgObjectBytes, partSize)

  // ── 所要時間 ──
  // 帯域律速とオブジェクト律速の大きい方。並列転送では両者が同時に進むので、
  // 和ではなく max が実態に近い。平均サイズが小さいほど後者が支配的になり、
  // 帯域だけから出した見積もりは桁で外れる。
  const parallelism = Math.max(1, Math.min(source.profile.parallelism, destination.profile.parallelism))
  const overheadSec = Math.max(source.profile.requestOverheadMs, destination.profile.requestOverheadMs) / 1000
  const tRequests = (scan.objectCount * overheadSec) / parallelism
  // 同一接続内のクラス変更はサーバ側の COPY で済み、データは回線を通らない。
  const tBandwidth = sameConnection
    ? 0
    : scan.totalBytes / (Math.min(source.profile.readMbps, destination.profile.writeMbps) * BYTES_PER_MB)
  const optimistic = Math.max(tBandwidth, tRequests)
  const instability = Math.max(source.profile.instability, destination.profile.instability)

  // ── 初期費用 ──
  const gb = scan.totalBytes / GIB
  const egress = sameConnection
    ? 0
    : tieredCost(Math.max(0, gb - source.rates.egressFreeGb), source.rates.egressTiers)
  const retrieval = gb * source.rates.retrievalPerGb
  // GET はマルチパートで分割されうるが、単価が PUT より桁で安く、
  // 総額への寄与が誤差なので 1 オブジェクト 1 リクエストとして数える。
  const getRequests = (scan.objectCount * source.rates.getPer1000) / 1000
  const putRequests = (puts * destination.rates.putPer1000) / 1000

  // ── 月額 ──
  // 最小課金サイズは平均で近似する。走査は合計と個数しか持たないため
  // (分布が偏っていると過小評価になる。ヒストグラムは後続の課題)。
  //
  // 加算 (Glacier 系の 40KB) は最小課金サイズとは別枠。片方は「これ未満は
  // このサイズとして課金」、もう片方は「どのサイズにも上乗せ」で、両方効く。
  const billableBytes = scan.objectCount
    * (Math.max(avgObjectBytes, destination.rates.minBillableBytes) + destination.rates.perObjectOverheadBytes)
  const monitoring = avgObjectBytes >= MONITORING_MIN_BYTES
    ? scan.objectCount * destination.rates.monitoringPerObjectMonth
    : 0
  const monthlyUsd = tieredCost(billableBytes / GIB, destination.rates.storageTiers) + monitoring

  return {
    connectionId: destination.profile.connectionId,
    name: destination.profile.name,
    provider: destination.profile.provider,
    storageClass: destination.profile.storageClass,
    storageClassLabel: destination.rates.storageClassLabel,
    sameConnection,
    durationSec: { optimistic, pessimistic: optimistic * (1 + instability) },
    upfront: {
      egress,
      retrieval,
      getRequests,
      putRequests,
      total: egress + retrieval + getRequests + putRequests,
    },
    monthlyUsd,
    billableBytes,
    putRequestCount: puts,
    avgObjectBytes,
    warnings: buildWarnings({ source, destination, scan, avgObjectBytes, billableBytes }),
  }
}
