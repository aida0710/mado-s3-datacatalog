// プレビューできないファイルの案内。ドロワー / ピンカード / tar エントリモーダルの
// 3 箇所で同じ文言を出すため共有する。どこでもダウンロードのボタンはこの上の帯にある。
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
export function UnsupportedPreview() {
  useLocale()
  return (
    <p className="muted">
      {translate('unsupportedPreview.thisFileTypeCannotBePreviewedUseThe')}</p>
  )
}
