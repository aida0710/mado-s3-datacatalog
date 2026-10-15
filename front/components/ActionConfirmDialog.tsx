import { useState, type ReactNode } from 'react'
import { Dialog } from './Dialog'
import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

export function ActionConfirmDialog({ titleId, title, children, onConfirm, onCancel,
  confirmLabel, pendingLabel, tone = 'danger' }: {
  titleId: string
  title: string
  children: ReactNode
  onConfirm: () => Promise<void>
  onCancel: () => void
  confirmLabel: string
  pendingLabel: string
  tone?: 'danger' | 'primary'
}) {
  useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit() {
    setBusy(true)
    setError(null)
    try { await onConfirm() }
    catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <Dialog titleId={titleId} title={title} onClose={onCancel} dismissible={!busy} narrowLayout="sheet"
      footer={<>
        <button type="button" className="button" onClick={onCancel} disabled={busy}>{translate('common.cancel')}</button>
        <button type="button" className={`button ${tone}`} onClick={() => void submit()} disabled={busy}>
          {busy ? pendingLabel : confirmLabel}
        </button>
      </>}>
      <div className="dialog-body">
        <p className="delete-confirm__message">{children}</p>
        {error && <p className="notice error" aria-live="polite">{localizeMessage(error)}</p>}
      </div>
    </Dialog>
  )
}
