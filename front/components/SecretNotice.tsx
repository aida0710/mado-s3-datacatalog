import { useEffect, useRef } from 'react'
import { CopyButton } from './CopyButton'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

/** 一度だけ表示する認証情報。値はメモリにだけ持ち、この通知を閉じると消える。 */
export function SecretNotice({ secret, note, onClose }: {
  secret: { label: string; value: string }
  note: string
  onClose: () => void
}) {
  useLocale()
  const notice = useRef<HTMLDivElement>(null)
  useEffect(() => { notice.current?.scrollIntoView?.({ block: 'nearest' }) }, [secret.value])
  return (
    <div ref={notice} className="secret-notice" role="status">
      <strong>{secret.label} — {note}</strong>
      <code>{secret.value}</code>
      <span className="secret-notice__actions">
        <CopyButton value={secret.value} label={translate('adminPage.copy')} />
        <button type="button" className="button small" onClick={onClose}>{translate('common.close')}</button>
      </span>
    </div>
  )
}
