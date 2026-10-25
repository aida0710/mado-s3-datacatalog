// 容量メトリクス画面のバケットに付く、バケット直下のディレクトリ別の内訳。
//
// 値はバケット全体と同じ完全走査で数えたもの (サイズ上位の直下ディレクトリだけ)。
// 推移グラフは行を開いたときだけ取得する。1 バケットに数十行あり、全部の履歴を
// 一覧と一緒に返すと応答が大きくなりすぎるため。

import { lazy, Suspense, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api/client'
import type { CapacityPoint, CapacityPrefixSummary } from '../../lib/api/types'
import { fmtSize, fmtCapacityDelta, fmtCount } from '../../lib/format'
import { storageDirectoryHref } from '../../lib/route'
import { localizeMessage } from '../../i18n/localizeMessage'
import { useLocale } from '../../i18n/useLocale'
import { translate } from '../../i18n/translate'

const CapacityHistoryChart = lazy(() => import('./CapacityHistoryChart'))

/** 最初に見せる行数。容量の大きい順なので、上位だけで大半の容量を占めることが多い。 */
const INITIAL_VISIBLE_PREFIXES = 5
/** 表の列の数。開いた行の推移はこの幅いっぱいに出す。 */
const COLUMN_COUNT = 5

// 共通の表。自動の列幅 (table-layout: auto) なので、狭い画面で列を隠しても
// 隠した列の幅は残らない。640px 未満は割合とオブジェクト数、900px 未満は前回からを
// 隠し、名前と容量を残す (storage.css の .capacity-col-*)。

interface Props {
  connectionId: string
  bucket: string
  /** 内訳と同じ計測でのバケット全体の値。内訳に入らなかった残りを出すのに使う。 */
  bucketTotalBytes: number
  bucketObjectCount: number
  prefixes: CapacityPrefixSummary[]
  days: number
  intervalSeconds: number
}

export function BucketPrefixCapacity({
  connectionId, bucket, bucketTotalBytes, bucketObjectCount, prefixes, days, intervalSeconds,
}: Props) {
  useLocale()
  const [showAll, setShowAll] = useState(false)
  const [openPrefix, setOpenPrefix] = useState<string | null>(null)

  if (prefixes.length === 0) {
    return (
      <p className="muted capacity-prefixes-empty">
        {translate('bucketPrefixCapacity.noBreakdownByImmediateSubdirectoryIsAvailableThere')}</p>
    )
  }

  const visible = showAll ? prefixes : prefixes.slice(0, INITIAL_VISIBLE_PREFIXES)
  const hiddenCount = prefixes.length - visible.length
  const restBytes = bucketTotalBytes - prefixes.reduce((sum, prefix) => sum + prefix.totalBytes, 0)
  const restObjects = bucketObjectCount - prefixes.reduce((sum, prefix) => sum + prefix.objectCount, 0)

  return (
    <section className="capacity-prefixes" aria-label={translate('bucketPrefixCapacity.capacityByImmediateSubdirectoryOf', { value0: bucket })}>
      <div className="capacity-prefixes-heading">
        <h4>{translate('bucketPrefixCapacity.immediateSubdirectories')}</h4>
        <p className="muted">{translate('bucketPrefixCapacity.largestDirectories', { value0: fmtCount(prefixes.length) })}</p>
      </div>
      <div className="table-scroll">
        <table aria-label={translate('bucketPrefixCapacity.immediateSubdirectoriesOf', { value0: bucket })}>
          <thead>
            <tr>
              <th scope="col">{translate('common.directory')}</th>
              <th scope="col" className="numeric">{translate('common.capacity')}</th>
              <th scope="col" className="capacity-col-share">{translate('bucketPrefixCapacity.share')}</th>
              <th scope="col" className="numeric capacity-col-delta">{translate('common.changeSincePrevious')}</th>
              <th scope="col" className="numeric capacity-col-objects">{translate('common.objectCount')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(prefix => (
              <PrefixRow
                key={prefix.prefix}
                connectionId={connectionId}
                bucket={bucket}
                prefix={prefix}
                share={bucketTotalBytes > 0 ? prefix.totalBytes / bucketTotalBytes : 0}
                open={openPrefix === prefix.prefix}
                onToggle={() => setOpenPrefix(current => current === prefix.prefix ? null : prefix.prefix)}
                days={days}
                intervalSeconds={intervalSeconds}
              />
            ))}
            {hiddenCount === 0 && restBytes > 0 && (
              <tr>
                <td className="muted capacity-rest-name">{translate('bucketPrefixCapacity.rootFilesAndOtherDirectories')}</td>
                <td className="numeric mono nowrap">{fmtSize(restBytes)}</td>
                <td className="capacity-col-share">
                  <ShareBar share={bucketTotalBytes > 0 ? restBytes / bucketTotalBytes : 0} />
                </td>
                <td className="numeric mono capacity-col-delta">—</td>
                <td className="numeric mono capacity-col-objects">{fmtCount(Math.max(0, restObjects))}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {prefixes.length > INITIAL_VISIBLE_PREFIXES && (
        <button type="button" className="button small capacity-prefixes-more" onClick={() => setShowAll(value => !value)}>
          {showAll ? translate('bucketPrefixCapacity.showOnlyTheTop', { value0: INITIAL_VISIBLE_PREFIXES }) : translate('bucketPrefixCapacity.showMore', { value0: fmtCount(hiddenCount) })}
        </button>
      )}
    </section>
  )
}

function PrefixRow({ connectionId, bucket, prefix, share, open, onToggle, days, intervalSeconds }: {
  connectionId: string
  bucket: string
  prefix: CapacityPrefixSummary
  share: number
  open: boolean
  onToggle: () => void
  days: number
  intervalSeconds: number
}) {
  useLocale()
  const trendId = useId()
  return (
    <>
      <tr className={open ? 'selected' : undefined}>
        <td>
          <span className="capacity-prefix-name">
            <button
              type="button"
              className="capacity-prefix-toggle"
              aria-expanded={open}
              aria-controls={trendId}
              title={translate('bucketPrefixCapacity.showHistory')}
              onClick={onToggle}
            >
              {open
                ? <ChevronDown size={14} aria-hidden="true" />
                : <ChevronRight size={14} aria-hidden="true" />}
              <span className="mono">{prefix.prefix}</span>
            </button>
            <Link
              className="capacity-open-link"
              to={storageDirectoryHref(connectionId, bucket, prefix.prefix)}
              aria-label={translate('common.openPath', { value0: prefix.prefix })}
            >
              {translate('common.open')}<ArrowRight size={12} aria-hidden="true" />
            </Link>
          </span>
        </td>
        <td className="numeric mono nowrap">{fmtSize(prefix.totalBytes)}</td>
        <td className="capacity-col-share"><ShareBar share={share} /></td>
        <td className="numeric mono nowrap capacity-col-delta">
          {prefix.previous ? fmtCapacityDelta({ current: prefix.totalBytes, previous: prefix.previous.totalBytes }) : '—'}
        </td>
        <td className="numeric mono capacity-col-objects">{fmtCount(prefix.objectCount)}</td>
      </tr>
      {open && (
        <tr id={trendId} className="capacity-trend-row">
          <td colSpan={COLUMN_COUNT}>
            <PrefixTrend
              connectionId={connectionId} bucket={bucket} prefix={prefix.prefix}
              days={days} intervalSeconds={intervalSeconds}
            />
          </td>
        </tr>
      )}
    </>
  )
}

function ShareBar({ share }: { share: number }) {
  useLocale()
  const percent = Math.min(100, Math.max(0, share * 100))
  return (
    <span className="capacity-share">
      <span className="storage-meter" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </span>
      <span className="mono">{percent.toFixed(1)}%</span>
    </span>
  )
}

function PrefixTrend({ connectionId, bucket, prefix, days, intervalSeconds }: {
  connectionId: string
  bucket: string
  prefix: string
  days: number
  intervalSeconds: number
}) {
  useLocale()
  const [points, setPoints] = useState<CapacityPoint[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.capacityPrefixHistory({ connectionId, bucket, prefix, days })
      .then(result => { if (active) { setPoints(result.points); setError(null) } })
      .catch(cause => { if (active) setError((cause as Error).message) })
    return () => { active = false }
  }, [connectionId, bucket, prefix, days])

  if (error) return <p className="notice error">{localizeMessage(error)}</p>
  if (!points) return <p className="capacity-chart-placeholder">{translate('bucketPrefixCapacity.loadingHistory')}</p>
  if (points.length < 2) {
    return <p className="capacity-chart-empty">{translate('common.aGraphIsAvailableAfterTwoMeasurements')}</p>
  }
  return (
    <Suspense fallback={<p className="capacity-chart-placeholder">{translate('common.loadingGraph')}</p>}>
      <CapacityHistoryChart points={points} intervalSeconds={intervalSeconds} capacityBytes={null} label={`${bucket}/${prefix}`} />
    </Suspense>
  )
}
