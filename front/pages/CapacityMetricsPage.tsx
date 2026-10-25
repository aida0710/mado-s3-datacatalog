import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { api } from '../lib/api/client'
import type { CapacityBucketHistory, CapacityOverview, CapacityScanJob } from '../lib/api/types'
import { useAuth } from '../lib/auth-context'
import { useConnection } from '../lib/connectionContext'
import { fmtSize, fmtCapacityDelta, fmtCount, fmtDateTimeWithSeconds } from '../lib/format'
import { storageDirectoryHref } from '../lib/route'
import { ViewBreadcrumb } from '../components/ViewBreadcrumb'
import { BucketPrefixCapacity } from '../components/storage/BucketPrefixCapacity'
import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

const CapacityHistoryChart = lazy(() => import('../components/storage/CapacityHistoryChart'))
const DAYS = [7, 30, 90, 400] as const

export default function CapacityMetricsPage({ connectionId }: { connectionId: string }) {
  useLocale()
  const [params, setParams] = useSearchParams()
  const parsedDays = Number(params.get('days'))
  const days = DAYS.includes(parsedDays as typeof DAYS[number]) ? parsedDays : 90
  const [overview, setOverview] = useState<CapacityOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const auth = useAuth()
  const connection = useConnection()
  const canManage = auth.user?.permissions.includes('connections:manage') ?? false

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setOverview(await api.capacityOverview(connectionId, days))
      setError(null)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setLoading(false)
    }
  }, [connectionId, days])

  useEffect(() => {
    let active = true
    api.capacityOverview(connectionId, days)
      .then(result => {
        if (!active) return
        setOverview(result)
        setError(null)
      })
      .catch(cause => { if (active) setError((cause as Error).message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [connectionId, days])

  const scanJobs = overview?.scan.jobs ?? []
  const scanActive = scanJobs.length > 0

  useEffect(() => {
    if (!scanActive) return
    let active = true
    let refreshing = false
    const timer = window.setInterval(() => {
      setClock(Date.now())
      if (refreshing) return
      refreshing = true
      api.capacityOverview(connectionId, days)
        .then(result => {
          if (!active) return
          setOverview(result)
          setError(null)
        })
        .catch(cause => { if (active) setError((cause as Error).message) })
        .finally(() => { refreshing = false })
    }, 2000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [connectionId, days, scanActive])

  const updateDays = (value: number) => {
    setLoading(true)
    setParams(previous => {
      const next = new URLSearchParams(previous)
      next.set('view', 'capacity')
      next.set('days', String(value))
      next.delete('bucket')
      return next
    })
  }

  const scanAll = async () => {
    setScanning(true)
    setNotice(null)
    try {
      const result = await api.startCapacityScan(connectionId)
      setNotice(translate('capacityMetricsPage.startedMeasuringBucketsResultsAppearAsEachMeasurement', { value0: fmtCount(result.jobs.length) }))
      setOverview(await api.capacityOverview(connectionId, days))
      setClock(Date.now())
      setError(null)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setScanning(false)
    }
  }

  const measured = overview?.buckets.flatMap(bucket => bucket.points.at(-1) ?? []) ?? []
  const totalBytes = measured.reduce((sum, point) => sum + point.totalBytes, 0)
  const totalObjects = measured.reduce((sum, point) => sum + point.objectCount, 0)
  const measuredCount = measured.length
  const bucketCount = overview?.buckets.length ?? 0
  const activeByBucket = new Map(scanJobs.map(job => [job.bucket, job]))
  const sortedBuckets = overview ? [...overview.buckets].sort(compareBucketCapacity) : []

  return (
    <section>
      <ViewBreadcrumb
        connectionId={connectionId}
        label={translate('capacityMetricsPage.bucketCapacityMetrics')}
        href={`/storage/${encodeURIComponent(connectionId)}/?view=capacity`}
        description={translate('capacityMetricsPage.displaysCompleteScanResultsForEveryBucketIn')}
      />

      {scanActive && <ScanActivity jobs={scanJobs} now={clock} />}

      {overview && (
        <dl className="capacity-summary">
          <Metric label={translate('capacityMetricsPage.totalBucketCapacity')} value={measuredCount ? fmtSize(totalBytes) : '—'} />
          <Metric label={translate('capacityMetricsPage.totalBucketObjectCount')} value={measuredCount ? fmtCount(totalObjects) : '—'} />
          <Metric label={translate('capacityMetricsPage.measurementCoverage')} value={translate('capacityMetricsPage.buckets', { value0: fmtCount(measuredCount), value1: fmtCount(bucketCount) })} />
        </dl>
      )}

      {/* 期間の切り替えと、計測の予定・今すぐ計測・表示の更新。一覧の上の帯と同じ形。
          見出しの右はどの Storage の画面でも同じ (接続先・コピー・上へ) にしておく。 */}
      <div className="capacity-toolbar">
        <div className="capacity-period" role="group" aria-label={translate('capacityMetricsPage.timeRange')}>
          {DAYS.map(value => (
            <button key={value} type="button" className="button small" aria-pressed={days === value} onClick={() => updateDays(value)}>
              {value === 400 ? translate('capacityMetricsPage.allTime') : translate('capacityMetricsPage.days', { value0: value })}
            </button>
          ))}
        </div>
        <div className="capacity-toolbar-end">
          {overview && (
            <p className="muted">
              {overview.tracking.enabled
                ? translate('capacityMetricsPage.measureAllBucketsEveryHours', { value0: Math.round(overview.tracking.intervalSeconds / 3600) })
                : translate('capacityMetricsPage.periodicMeasurementsStopped')}
              {canManage && <> · <Link to={`/settings/connections/${encodeURIComponent(connectionId)}`}>{translate('capacityMetricsPage.connectionSettings')}</Link></>}
            </p>
          )}
          {canManage && (
            <button
              type="button"
              className="button small"
              disabled={scanning || scanActive || !connection.scanEnabled || connection.capacityMetricsEnabled === false}
              onClick={() => void scanAll()}
            >
              {scanning ? translate('capacityMetricsPage.starting') : scanActive ? translate('capacityMetricsPage.measuring') : translate('capacityMetricsPage.measureAllBucketsNow')}
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            disabled={loading}
            onClick={() => void refresh()}
            aria-label={translate('capacityMetricsPage.refreshView')}
            title={translate('capacityMetricsPage.refreshView')}
          >
            <RefreshCw size={16} aria-hidden="true" className={loading ? 'spin' : undefined} />
          </button>
        </div>
      </div>

      {notice && <p className="notice">{localizeMessage(notice)}</p>}
      {error && <p className="notice error">{localizeMessage(error)}</p>}
      {loading && !overview && <p className="state-message">{translate('common.loading')}</p>}
      {!loading && overview?.buckets.length === 0 && <p className="state-message">{translate('common.noBucketsFound')}</p>}

      {overview && (
        <div className="capacity-buckets" aria-busy={loading}>
          {sortedBuckets.map(bucket => (
            <BucketMetrics
              key={bucket.bucket}
              connectionId={connectionId}
              history={bucket}
              days={days}
              intervalSeconds={overview.tracking.intervalSeconds}
              scanJob={activeByBucket.get(bucket.bucket)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function compareBucketCapacity(a: CapacityBucketHistory, b: CapacityBucketHistory): number {
  const aBytes = a.points.at(-1)?.totalBytes ?? null
  const bBytes = b.points.at(-1)?.totalBytes ?? null
  if (aBytes === null && bBytes !== null) return 1
  if (aBytes !== null && bBytes === null) return -1
  if (aBytes !== null && bBytes !== null && aBytes !== bBytes) return aBytes < bBytes ? 1 : -1
  return a.bucket.localeCompare(b.bucket)
}

// 経過時間は「何分目」で出す (始まった直後が 1 分目)。
const MILLISECONDS_PER_MINUTE = 60_000

function currentMinute(startedAt: string, now: number): string {
  const elapsed = Math.max(0, now - new Date(startedAt).getTime())
  return translate('capacityMetricsPage.currentMinute', { value0: Math.floor(elapsed / MILLISECONDS_PER_MINUTE) + 1 })
}

function ScanActivity({ jobs, now }: { jobs: CapacityScanJob[]; now: number }) {
  useLocale()
  const running = jobs.find(job => job.status === 'running')
  const queuedCount = jobs.filter(job => job.status === 'queued').length
  if (!running) {
    return (
      <div className="notice capacity-activity" role="status" aria-live="polite">
        <span className="storage-pulse-dot" aria-hidden="true" />
        <div>
          <p className="capacity-activity-title">{translate('capacityMetricsPage.waitingForMeasurementToStart')}</p>
          <p className="muted">{translate('capacityMetricsPage.bucketsQueued', { value0: fmtCount(queuedCount) })}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="notice capacity-activity" role="status" aria-live="polite">
      <span className="storage-pulse-dot" aria-hidden="true" />
      <div>
        <p className="capacity-activity-title" title={running.bucket}>{translate('capacityMetricsPage.scanning', { value0: running.bucket })}</p>
        <p className="muted mono">
          {translate('capacityMetricsPage.scanProgress', {
            value0: currentMinute(running.startedAt ?? running.createdAt, now),
            value1: fmtCount(running.objectCount),
            value2: fmtCount(queuedCount),
          })}
        </p>
      </div>
    </div>
  )
}

function BucketMetrics({ connectionId, history, days, intervalSeconds, scanJob }: {
  connectionId: string
  history: CapacityBucketHistory
  days: number
  intervalSeconds: number
  scanJob?: CapacityScanJob
}) {
  useLocale()
  const latest = history.points.at(-1)
  const previous = history.points.at(-2)
  return (
    <article className="capacity-bucket">
      <div className="capacity-bucket-heading">
        <h3 title={history.bucket}>{history.bucket}</h3>
        <div className="capacity-bucket-actions">
          {scanJob && (
            <span className={`status-badge ${scanJob.status === 'running' ? 'status-running' : 'status-queued'}`}>
              {scanJob.status === 'running' ? translate('capacityMetricsPage.scanningItems', { value0: fmtCount(scanJob.objectCount) }) : translate('capacityMetricsPage.waitingForMeasurement')}
            </span>
          )}
          <Link className="capacity-open-link" to={storageDirectoryHref(connectionId, history.bucket, '')}>
            {translate('common.open')}<ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <dl className="capacity-metrics">
        <CompactMetric label={translate('capacityMetricsPage.currentCapacity')} value={latest ? fmtSize(latest.totalBytes) : '—'} />
        <CompactMetric label={translate('common.changeSincePrevious')} value={latest && previous ? fmtCapacityDelta({ current: latest.totalBytes, previous: previous.totalBytes }) : '—'} />
        <CompactMetric label={translate('common.objectCount')} value={latest ? fmtCount(latest.objectCount) : '—'} />
        <CompactMetric label={translate('capacityMetricsPage.lastRetrieved')} value={latest ? fmtDateTimeWithSeconds(latest.collectedAt) : '—'} />
      </dl>
      {history.lastError && !scanJob && <p className="notice error">{localizeMessage(history.lastError)}</p>}
      <div className="capacity-chart">
        {history.points.length >= 2 ? (
          <Suspense fallback={<p className="capacity-chart-placeholder">{translate('common.loadingGraph')}</p>}>
            <CapacityHistoryChart points={history.points} intervalSeconds={intervalSeconds} capacityBytes={null} label={history.bucket} />
          </Suspense>
        ) : (
          <p className="capacity-chart-empty">{translate('common.aGraphIsAvailableAfterTwoMeasurements')}</p>
        )}
      </div>
      {latest && (
        <BucketPrefixCapacity
          connectionId={connectionId}
          bucket={history.bucket}
          bucketTotalBytes={latest.totalBytes}
          bucketObjectCount={latest.objectCount}
          prefixes={history.prefixes}
          days={days}
          intervalSeconds={intervalSeconds}
        />
      )}
    </article>
  )
}

/** 見出しの下の合計。数字は h2 程度の大きさで出す。 */
function Metric({ label, value }: { label: string; value: string }) {
  useLocale()
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/** バケットごとの値。幅が狭いときは 1 行に収まらない分を省略し、title で全部を見せる。 */
function CompactMetric({ label, value }: { label: string; value: string }) {
  useLocale()
  return (
    <div>
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  )
}
