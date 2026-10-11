// 一覧のキャッシュの帯の右端に出す、配下の集計の要約。
//
// もとは Σ ボタンだったが、押すまで何も分からなかった。4 分かけて数えた
// 結果がボタンの向こうに隠れているのはもったいないので、走査済みなら
// 数字をその場に出す。未走査のときだけ誘い文句になる。

import { fmtCount, fmtSize } from '../../lib/format'
import type { ScanResult } from '../../lib/api/types'
import { useLocale } from '../../i18n/useLocale'
import { translate } from '../../i18n/translate'

interface Props {
  /** 最後に成功した走査の結果。null = まだ走査していない。 */
  result: ScanResult | null
  /** 実行中の走査があるか。リロードしても worker 側で走り続けるので、
   *  ここで拾って「走査中」を出す。 */
  running?: boolean
  /** 内訳ダイアログを開く。 */
  onOpen: () => void
}

export function ScanSummary({ result, running, onOpen }: Props) {
  useLocale()
  // 走査中は前回の結果より現在の状態を優先して伝える。
  if (running) {
    return (
      <button type="button" className="link-button" onClick={onOpen}>
        {translate('scanSummary.scanningDirectory')}</button>
    )
  }

  if (!result) {
    return (
      <button type="button" className="link-button" onClick={onOpen}>
        {translate('scanSummary.summarizeDirectory')}</button>
    )
  }

  return (
    <span className="scan-summary">
      {translate('scanSummary.directoryContents')}{' '}
      <strong className="mono">{fmtCount(result.objectCount)}</strong> {translate('common.items2', { count: result.objectCount })}{' '}
      <strong className="mono">{fmtSize(result.totalBytes)}</strong>
      {result.partial && (
        <span
          className="scan-summary-partial"
          title={translate('scanSummary.anErrorOccurredDuringTheScanTheSummary')}
          aria-label={translate('scanSummary.partialSummary')}
        >
          *
        </span>
      )}
      <button type="button" className="link-button" onClick={onOpen}>{translate('common.breakdown')}</button>
    </span>
  )
}
