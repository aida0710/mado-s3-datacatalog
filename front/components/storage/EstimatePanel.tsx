// 転送先ごとの費用・所要時間の比較
// (spec: 2026-08-22-transfer-estimate-design.md)。
//
// 走査済みディレクトリを、登録済みの各接続へ移したらどうなるかを並べる。
// 数字の出所は走査結果 (件数・合計サイズ) と接続の設定だけで、S3 は叩かない。
//
// 設計上の要点が 2 つある:
//
// - **所要時間はレンジで出す。** 単一の数字は外れたときに機能全体の信用を落とす。
// - **移動元から出す費用 (egress) を畳んだ行にも出す。** 移動先の月額だけを見て
//   決めると桁を間違える。AWS から 40TB 出すと、置き続けるより高くつくことがある。

import { localizeMessage } from '../../i18n/localizeMessage'
import { useLocale } from '../../i18n/useLocale'
import { translate } from '../../i18n/translate'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react'
import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react'
import { api } from '../../lib/api/client'
import type { TransferCandidate, TransferEstimate } from '../../lib/api/types'
import { PROVIDER_LABELS } from '../../i18n/connectionOptions'
import { fmtCacheAge, fmtDurationRange, fmtSize, fmtUsd } from '../../lib/format'

interface Props {
  connectionId: string
  bucket: string
  prefix: string
  /** 未走査だったときに内訳タブ (走査ボタンのある側) へ戻す。 */
  onNeedScan: () => void
}

/** 単価の更新ジョブを待つポーリング間隔と上限 (= 最長 60 秒待つ)。 */
const REFRESH_POLL_MS = 1000
const REFRESH_POLL_LIMIT = 60

type State =
  | { kind: 'loading' }
  | { kind: 'unscanned' }
  | { kind: 'error'; message: string }
  | { kind: 'data'; data: TransferEstimate }

/** 出典リンクの表示名。ホスト名だけだと同じドメインの別ページが区別できない
 *  (aws.amazon.com が 2 つ並ぶ) ので、パスまで出してスキームだけ落とす。 */
function sourceLabel(url: string): string {
  try {
    const u = new URL(url)
    return `${u.hostname}${u.pathname.replace(/\/$/, '')}`
  } catch {
    return url
  }
}

/** 内訳の 1 行。0 の項目も出す — 「かからない」ことが分かるのが大事。 */
function CostRow({ label, value, note }: { label: string; value: number; note?: string }) {
  useLocale()
  return (
    <div>
      <dt>{label}</dt>
      <dd className="mono">{fmtUsd(value)}</dd>
      <dd className="muted">{note}</dd>
    </div>
  )
}

function CandidateRow({ c, expanded, onToggle }: {
  c: TransferCandidate
  expanded: boolean
  onToggle: () => void
}) {
  useLocale()
  const detailId = useId()
  const label = c.storageClassLabel && c.provider === 'aws'
    ? `${c.name} · ${c.storageClassLabel}`
    : c.name
  // 行のどこを押しても開閉する。名前のボタンは自分で開閉するので、二重に数えない。
  const toggleFromRow = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as Element).closest('button, a')) return
    onToggle()
  }

  return (
    <>
      <tr className={expanded ? 'est-row selected' : 'est-row'} onClick={toggleFromRow}>
        <td>
          <div className="est-name">
            <button
              type="button"
              className="est-toggle"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-controls={detailId}
            >
              {expanded
                ? <ChevronDown size={14} aria-hidden="true" />
                : <ChevronRight size={14} aria-hidden="true" />}
              <span className="est-toggle-label">
                <span>{label}</span>
                {c.sameConnection && <span className="status-badge status-queued">{translate("estimatePanel.currentLocation")}</span>}
              </span>
            </button>
            {/* 警告は件数だけを名前の横に出し、全文は開いた行で読む。 */}
            {c.warnings.length > 0 && (
              <span className="est-warn" role="img" aria-label={translate("estimatePanel.warnings", { value0: c.warnings.length })}>
                <TriangleAlert size={13} aria-hidden="true" />
                {c.warnings.length}
              </span>
            )}
          </div>
        </td>
        <td className="numeric mono">
          {fmtDurationRange(c.durationSec.optimistic, c.durationSec.pessimistic)}
        </td>
        <td className="numeric mono">{fmtUsd(c.upfront.total)}</td>
        <td className="numeric mono">{fmtUsd(c.monthlyUsd)}</td>
      </tr>

      {expanded && (
        <tr id={detailId} className="est-detail">
          <td colSpan={4}>
            <dl className="est-costs">
              <CostRow
                label={translate("estimatePanel.sourceEgress")}
                value={c.upfront.egress}
                note={c.sameConnection ? translate("estimatePanel.noNetworkTransferWithinTheSameConnection") : undefined}
              />
              <CostRow label={translate("estimatePanel.retrieval")} value={c.upfront.retrieval} />
              <CostRow label={translate("estimatePanel.getRequests")} value={c.upfront.getRequests} />
              <CostRow
                label={translate("estimatePanel.putRequests")}
                value={c.upfront.putRequests}
                note={translate("estimatePanel.requests", { value0: c.putRequestCount.toLocaleString() })}
              />
              <CostRow
                label={translate("estimatePanel.monthlyCost")}
                value={c.monthlyUsd}
                note={translate("estimatePanel.billable", { value0: fmtSize(c.billableBytes) })}
              />
            </dl>

            {c.warnings.length > 0 && (
              <ul className="est-warns">
                {c.warnings.map(w => (
                  <li key={w.kind}>
                    <TriangleAlert size={14} aria-hidden="true" />
                    <span>{localizeMessage(w.message)}</span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export function EstimatePanel({ connectionId, bucket, prefix, onNeedScan }: Props) {
  useLocale()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [openId, setOpenId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  /** 単価を更新したあと見積もりを取り直すためのトリガ。 */
  const [reloadKey, setReloadKey] = useState(0)

  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  useEffect(() => {
    let cancelled = false
    // ここで setState({ kind: 'loading' }) はしない。effect 本体での同期
    // setState は cascading render になる (react-hooks/set-state-in-effect)。
    // 初期値が loading であり、このパネルはタブを開くたびにマウントし直される
    // ので、props が変わって前の結果が残ることは無い。
    api.estimate(connectionId, bucket, prefix)
      .then(r => {
        if (cancelled) return
        setState(r ? { kind: 'data', data: r } : { kind: 'unscanned' })
      })
      .catch((e: Error) => {
        if (!cancelled) setState({ kind: 'error', message: e.message })
      })
    return () => { cancelled = true }
  }, [connectionId, bucket, prefix, reloadKey])

  // 単価の取得はジョブで走る (外部 HTTP がハングしてもこの画面を巻き込まない)。
  // 完了を待ってから見積もりを取り直す — 新しい単価で数字が変わるのを見せたいため。
  const refreshPricing = useCallback(async () => {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const { jobId } = await api.refreshPricing()
      for (let i = 0; i < REFRESH_POLL_LIMIT; i += 1) {
        await new Promise(r => setTimeout(r, REFRESH_POLL_MS))
        if (!alive.current) return
        const job = await api.getJob(jobId)
        if (job.status === 'done') {
          setReloadKey(k => k + 1)
          return
        }
        if (job.status === 'error') {
          // 外に出られない環境ではここに来る。同梱の単価で見積もりは続く。
          setRefreshError(job.error ?? translate("estimatePanel.couldNotRetrievePricing"))
          return
        }
        if (job.status === 'canceled') return
      }
      setRefreshError(translate("estimatePanel.theUpdateIsTakingLongerThanExpectedReopen"))
    } catch (e) {
      setRefreshError((e as Error).message)
    } finally {
      if (alive.current) setRefreshing(false)
    }
  }, [])

  const toggle = useCallback((id: string) => {
    setOpenId(cur => (cur === id ? null : id))
  }, [])

  // 現在地を先頭に、あとは月額の安い順。同額なら初期費用で並べる。
  const rows = useMemo(() => {
    if (state.kind !== 'data') return []
    return [...state.data.candidates].sort((a, b) => {
      if (a.sameConnection !== b.sameConnection) return a.sameConnection ? -1 : 1
      if (a.monthlyUsd !== b.monthlyUsd) return a.monthlyUsd - b.monthlyUsd
      return a.upfront.total - b.upfront.total
    })
  }, [state])

  if (state.kind === 'loading') {
    return <p className="state-message">{translate("estimatePanel.estimating")}</p>
  }

  if (state.kind === 'unscanned') {
    return (
      <div className="state-message">
        {translate("estimatePanel.aDirectorySummaryIsRequiredForAnEstimate")}<button type="button" className="button small" onClick={onNeedScan}>{translate("common.scan")}</button>
      </div>
    )
  }

  if (state.kind === 'error') {
    return <p className="notice error">{localizeMessage(state.message)}</p>
  }

  const { source, scan, catalog } = state.data
  const avg = scan.objectCount > 0 ? scan.totalBytes / scan.objectCount : 0

  return (
    <div>
      <div className="est-summary">
        <span>
          <strong>{scan.objectCount.toLocaleString()}</strong> {" " + translate("common.items2", { count: scan.objectCount })}{' '}
          <strong>{fmtSize(scan.totalBytes)}</strong>
          <span className="muted">{translate('estimatePanel.average', { value0: fmtSize(avg) })}</span>
        </span>
        <span className="muted">
          {translate("estimatePanel.source") + " "}{source.name}
          {source.provider !== 'aws' && translate('common.parenthetical', { value0: PROVIDER_LABELS[source.provider] })}
        </span>
      </div>

      <div className="table-scroll">
        <table className="est-table">
          <thead>
            <tr>
              <th scope="col">{translate("estimatePanel.destination")}</th>
              <th scope="col" className="numeric">{translate("estimatePanel.duration")}</th>
              <th scope="col" className="numeric">{translate("estimatePanel.initialCost")}</th>
              <th scope="col" className="numeric">{translate("estimatePanel.monthlyCost")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(c => (
              <CandidateRow
                key={c.connectionId}
                c={c}
                expanded={openId === c.connectionId}
                onToggle={() => toggle(c.connectionId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="est-foot">
        <span>
          {catalog.source === 'fetched' && catalog.fetchedAt
            ? translate("estimatePanel.pricingRetrievedOn", { value0: fmtCacheAge(new Date(catalog.fetchedAt)) })
            // 「取得できていない」と「無料」を取り違えさせない。
            : translate("estimatePanel.bundledPricingFromNotYetUpdated", { value0: catalog.asOf })}
        </span>
        <button type="button" className="button small" onClick={refreshPricing} disabled={refreshing}>
          {refreshing ? translate("common.updating") : translate("estimatePanel.updatePricing")}
        </button>
        {catalog.stale && !refreshing && !refreshError && (
          <strong>{translate("estimatePanel.pricingIsOutOfDate")}</strong>
        )}
        {refreshError && <span className="est-foot-error">{localizeMessage(refreshError)}</span>}
      </div>
      {/* 「単価を更新」で新しくなるのは AWS の単価だけ。最小保存期間や
          Wasabi は料金 API が無く手で持っているので、取得日とは別に
          確認日を出す — 取得日が新しい = 全部新しい、と読み違えさせない。 */}
      <details className="est-manual">
        <summary>
          <ChevronRight size={14} aria-hidden="true" />
          {translate("estimatePanel.manualPricesVerifiedOn", { value0: catalog.manualFacts.verifiedOn })}
        </summary>
        <ul>
          {catalog.manualFacts.notes.map(note => <li key={note}>{localizeMessage(note)}</li>)}
        </ul>
        <p className="est-manual-sources">
          {translate("estimatePanel.source2")}{' '}
          {catalog.manualFacts.sources.map(u => (
            <a key={u} href={u} target="_blank" rel="noreferrer noopener">{sourceLabel(u)}</a>
          ))}
        </p>
      </details>

      <p className="muted est-note">
        {translate("estimatePanel.durationIsEstimatedFromEachConnectionSBandwidth")}</p>
    </div>
  )
}
