import { getIntlLocale } from '../../i18n/locale'
import { useLocale } from '../../i18n/useLocale'
import { translate } from '../../i18n/translate'
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import type { CapacityPoint } from '../../lib/api/types'
import { capacityChartData, type CapacityChartPoint } from '../../lib/capacityChart'
import { fmtCapacityBytes } from '../../lib/format'
import { useDocumentTheme } from '../../lib/useDocumentTheme'

// 軸と tooltip は幅が狭いので、表や見出しより 1 桁少なく丸める。
const CHART_FRACTION_DIGITS = 1

// recharts は色を SVG の属性に書くので、CSS の変数がテーマで切り替わっても自分では
// 追従しない。描くたびに今のテーマの値を読み、テーマが変わったら描き直す。
// 値を読めない環境 (テスト) では変数の参照のまま渡す。
function readChartColors() {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string) => style.getPropertyValue(name).trim() || `var(${name})`
  return {
    grid: read('--border'),
    axis: read('--border-strong'),
    tick: read('--muted'),
    line: read('--accent'),
    limit: read('--error'),
    latest: read('--border-strong'),
    background: read('--background'),
  }
}

function CapacityTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ payload?: CapacityChartPoint }>
  label?: number | string
}) {
  useLocale()
  const point = payload?.[0]?.payload
  if (!active || !point || point.totalBytes == null) return null
  return (
    <div className="capacity-tooltip">
      <p className="muted">{new Date(Number(label)).toLocaleString(getIntlLocale())}</p>
      <p className="capacity-tooltip-value">{fmtCapacityBytes(point.totalBytes, CHART_FRACTION_DIGITS)}</p>
      <p className="muted">{point.objectCount?.toLocaleString(getIntlLocale())} {" " + translate("capacityHistoryChart.objects", { count: point.objectCount ?? 0 })}</p>
    </div>
  )
}

/** バケット、またはバケット直下のディレクトリの容量推移。label は読み上げと表の見出しに使う。 */
export default function CapacityHistoryChart({ points, intervalSeconds, capacityBytes, label }: {
  points: CapacityPoint[]
  intervalSeconds: number
  capacityBytes: number | null
  label: string
}) {
  useLocale()
  // テーマが切り替わったら描き直す (下で色を読み直す)。
  useDocumentTheme()
  const colors = readChartColors()
  const data = capacityChartData(points, intervalSeconds)
  const latest = points.at(-1)?.totalBytes
  return (
    <div>
      <div className="capacity-chart-plot" role="img" aria-label={translate("capacityHistoryChart.capacityHistoryOf", { value0: label })}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 2, left: 2 }} accessibilityLayer>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis
              dataKey="collectedAt"
              type="number" scale="time" domain={['dataMin', 'dataMax']}
              tickFormatter={value => new Date(Number(value)).toLocaleDateString(getIntlLocale(), { month: 'numeric', day: 'numeric' })}
              tick={{ fontSize: 11, fill: colors.tick }}
              axisLine={{ stroke: colors.axis }} tickLine={false}
            />
            <YAxis
              tickFormatter={value => fmtCapacityBytes(Number(value), CHART_FRACTION_DIGITS)}
              width={70} tick={{ fontSize: 10, fill: colors.tick }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={<CapacityTooltip />} cursor={{ stroke: colors.axis }} />
            {capacityBytes !== null
              ? <ReferenceLine y={capacityBytes} stroke={colors.limit} strokeDasharray="4 4" label={translate("capacityHistoryChart.limit")} />
              : latest !== undefined && <ReferenceLine y={latest} stroke={colors.latest} strokeDasharray="3 4" />}
            <Line
              type="linear" dataKey="totalBytes" name={translate("common.capacity")} connectNulls={false} isAnimationActive={false}
              stroke={colors.line} strokeWidth={1.75} dot={false}
              activeDot={{ r: 3.5, fill: colors.line, stroke: colors.background }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{translate("capacityHistoryChart.capacityHistory", { value0: label })}</caption>
        <thead><tr><th>{translate("capacityHistoryChart.retrievedAt")}</th><th>{translate("common.capacity")}</th><th>{translate("common.objectCount")}</th></tr></thead>
        <tbody>{points.map(point => (
          <tr key={point.collectedAt}>
            <td>{new Date(point.collectedAt).toLocaleString(getIntlLocale())}</td>
            <td>{fmtCapacityBytes(point.totalBytes, CHART_FRACTION_DIGITS)}</td>
            <td>{point.objectCount.toLocaleString(getIntlLocale())}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}
