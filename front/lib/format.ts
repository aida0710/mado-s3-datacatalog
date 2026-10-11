// 複数コンポーネントで共有する表示フォーマッター。

import { getIntlLocale, getLocale } from '../i18n/locale'
import { translate } from '../i18n/translate'
export function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(1)} GB`
  // 配下の集計で TB / PB 規模を扱う (dataset は 774 TB)。GB 頭打ちだと
  // 「793,530.4 GB」になって桁が読めない。
  if (n < 1024 ** 5) return `${(n / 1024 ** 4).toFixed(1)} TB`
  return `${(n / 1024 ** 5).toFixed(1)} PB`
}

// 容量メトリクスの値。fmtSize と違い 2 進接頭辞 (KiB) で、桁区切りを付ける。
// 走査が数えた正確なバイト数を、グラフの軸と同じ単位で読めるようにするため。
export function fmtCapacityBytes(bytes: number, maximumFractionDigits = 2): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** unit).toLocaleString(getIntlLocale(), { maximumFractionDigits })} ${units[unit]}`
}

// 前回の計測からの増減。「+1.5 GiB (+3.2%)」。前回が 0 バイトなら率は出さない。
export function fmtCapacityDelta({ current, previous }: { current: number; previous: number }): string {
  const delta = current - previous
  const sign = delta >= 0 ? '+' : '−'
  const rate = previous > 0 ? delta / previous * 100 : null
  const rateText = rate == null ? '' : ` (${rate >= 0 ? '+' : ''}${rate.toFixed(1)}%)`
  return `${sign}${fmtCapacityBytes(Math.abs(delta))}${rateText}`
}

// 見積もりの金額 (spec: 2026-08-22-transfer-estimate-design.md)。
//
// 桁を合わせるのが目的の数字なので、大きい額ほど小数を落とす。
// $1,043.27 の下 2 桁には意味が無く、むしろ精度があるように見えてしまう。
export function fmtUsd(n: number): string {
  if (n === 0) return '$0'
  if (n < 0.01) return '<$0.01'
  if (n < 100) return `$${n.toFixed(2)}`
  return `$${Math.round(n).toLocaleString()}`
}

/** 所要時間の単位。上振れ側の大きさで決め、両端で単位を揃える。 */
function durationUnit(sec: number): { div: number; message: 'format.seconds' | 'format.minutes' | 'format.hours' | 'format.days' } {
  if (sec < 90) return { div: 1, message: 'format.seconds' }
  if (sec < 90 * 60) return { div: 60, message: 'format.minutes' }
  if (sec < 48 * 3600) return { div: 3600, message: 'format.hours' }
  return { div: 86400, message: 'format.days' }
}

function fmtDurationNum(v: number): string {
  return v < 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v))
}

// 所要時間はレンジで出す。単一の数字は外れたときに機能全体の信用を落とすので、
// 楽観と悲観の幅をそのまま見せる。両端が同じ表示に丸まったら 1 つだけ出す。
export function fmtDurationRange(optimisticSec: number, pessimisticSec: number): string {
  const { div, message } = durationUnit(Math.max(optimisticSec, pessimisticSec))
  const a = fmtDurationNum(optimisticSec / div)
  const b = fmtDurationNum(pessimisticSec / div)
  if (a === b) return `${a} ${translate(message, { count: Number(a) })}`
  const separator = getLocale() === 'en' ? '–' : '〜'
  return `${a}${separator}${b} ${translate(message)}`
}

// プレビュー対象を人が読める 1 本の文字列にする。tar 内エントリは
// 「アーカイブ名 › エントリ名」、単体ファイルは key そのもの。
// 画面上は basename しか出さない (幅が足りない) ので、これは title 属性と
// クリップボードにだけ載る「省略しないフルパス」の唯一の出所。
export function fullEntryLabel(key: string, entryPath?: string): string {
  return entryPath != null ? `${key} › ${entryPath}` : key
}

// パスの末尾 (ファイル名)。区切りが無ければ入力そのもの。
export function basename(path: string): string {
  return path.split('/').pop() || path
}

/** 年月日と時分の絶対表示 (2026/09/18 03:40)。履歴一覧のように「いつ」を正確に示す場所で使う。
 *  ISO 文字列が解釈できなければそのまま返す。 */
export function fmtDateTime(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return typeof value === 'string' ? value : ''
  return d.toLocaleString(getIntlLocale(), {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const RELATIVE_MESSAGES = {
  second: 'relativeTime.secondsAgo',
  minute: 'format.minutesAgo',
  hour: 'format.hoursAgo',
  day: 'format.daysAgo',
} as const

function formatTimeAgo(amount: number, unit: keyof typeof RELATIVE_MESSAGES): string {
  if (getLocale() === 'en') {
    return new Intl.RelativeTimeFormat(getIntlLocale(), { numeric: 'always' }).format(-amount, unit)
  }
  return translate(RELATIVE_MESSAGES[unit], { value0: amount })
}

export function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return formatTimeAgo(s, 'second')
  const m = Math.floor(s / 60)
  if (m < 60) return formatTimeAgo(m, 'minute')
  const h = Math.floor(m / 60)
  if (h < 24) return formatTimeAgo(h, 'hour')
  const d = Math.floor(h / 24)
  return formatTimeAgo(d, 'day')
}

// 一覧ヘッダ上の CacheBanner 用。「2026/08/18 16:14(2時間前)」のように
// 絶対時刻と相対時刻を併記する。絶対時刻だけだと「古いのか」が瞬時に分からず、
// 相対時刻だけだと正確な時点が分からないので両方出す。
//
// now を引数に取るのはテストのため。呼び出し側は省略してよい。
export interface CacheAgeOptions {
  /** 日付を省いて狭い場所に収める。同日なら HH:mm、日跨ぎなら MM/DD HH:mm。 */
  compact?: boolean
}

export function fmtCacheAge(d: Date, now: Date = new Date(), opts: CacheAgeOptions = {}): string {
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  // compact でも日を跨いだら日付を出す。時刻だけでは「昨日の 22:13」と
  // 区別が付かず、古いデータを新しいと誤読させてしまう。
  const abs = opts.compact
    ? (sameDay
        ? d.toLocaleTimeString(getIntlLocale(), { hour: '2-digit', minute: '2-digit', hour12: false })
        : d.toLocaleString(getIntlLocale(), {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
          }))
    : fmtDateTime(d)

  const min = Math.floor((now.getTime() - d.getTime()) / 60_000)
  const rel =
    min < 1  ? translate("format.justNow")
    : min < 60 ? formatTimeAgo(min, 'minute')
    : min < 60 * 24 ? formatTimeAgo(Math.floor(min / 60), 'hour')
    : formatTimeAgo(Math.floor(min / (60 * 24)), 'day')
  return translate('format.timeWithRelative', { value0: abs, value1: rel })
}


// .json (単一ドキュメント) だけプリティプリントする。.jsonl / .ndjson は
// 1 行 1 JSON 値の形式なのでそのまま返す。整形できない (不正な JSON) ときも
// そのまま返し、プレビューが空にならないようにする。
//
// これは表示上の整形であって、プレビューの描画先を決める分岐ではない
// (種別は中身のスニッフで決める。front/lib/textSniff.ts を参照)。
export function prettyPrintJson(name: string, text: string): string {
  const lower = name.toLowerCase()
  // .jsonl / .ndjson は末尾 5 文字が "jsonl" で ".json" と一致しないため、
  // .json だけを見る 1 条件で両方とも自然に弾ける (2 つめの endsWith('.jsonl') は不要)。
  if (!lower.endsWith('.json')) return text
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}
