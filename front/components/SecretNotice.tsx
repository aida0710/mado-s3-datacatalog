import { useEffect, useRef } from 'react'
import { Copy } from 'lucide-react'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

/** Keep one-time credentials in memory only; closing this notice removes the value. */
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
        <button type="button" className="button small" onClick={() => void navigator.clipboard.writeText(secret.value)}>
          <Copy size={14} aria-hidden="true" />{translate('adminPage.copy')}
        </button>
        <button type="button" className="button small" onClick={onClose}>{translate('common.close')}</button>
      </span>
    </div>
  )
}
