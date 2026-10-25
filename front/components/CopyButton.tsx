import { Check, Copy } from 'lucide-react'
import { useCopyFeedback } from '../lib/useCopyFeedback'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

/**
 * 値を丸ごとコピーするボタン (プレビューの本文、一度だけ表示するトークンなど)。押した後
 * COPY_FEEDBACK_MS の間だけ、名前の代わりに結果 (コピーしました / コピーできませんでした) を出す。
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  useLocale()
  const { copied, copy } = useCopyFeedback()
  return (
    <button type="button" className="button small" onClick={() => void copy(value)} title={label} aria-label={label}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied == null ? label : copied ? translate('common.copied') : translate('common.copyFailed')}
    </button>
  )
}
