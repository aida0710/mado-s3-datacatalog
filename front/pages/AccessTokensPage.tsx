import { Plus, RefreshCw } from 'lucide-react'
import { useAccessTokens } from '../lib/useAccessTokens'
import { AccessTokenRow } from '../components/AccessTokenRow'
import { AccessTokenFormDialog } from '../components/AccessTokenFormDialog'
import { ActionConfirmDialog } from '../components/ActionConfirmDialog'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { SecretNotice } from '../components/SecretNotice'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
import { localizeMessage } from '../i18n/localizeMessage'
import '../styles/accessTokens.css'

export default function AccessTokensPage() {
  useLocale()
  const manager = useAccessTokens()
  const dialog = manager.dialog
  return (
    <section className="access-tokens-page">
      <div className="admin-toolbar">
        <button type="button" className="button primary" onClick={() => manager.setDialog({ type: 'create' })}>
          <Plus size={16} aria-hidden="true" />{translate('accessTokens.create')}
        </button>
        <button type="button" className="button" onClick={manager.reload} aria-label={translate('accessTokens.reload')}>
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>
      {manager.secret && <SecretNotice secret={manager.secret} note={translate('accessTokens.secretOnce')} onClose={manager.clearSecret} />}
      {manager.error && <p className="notice error" role="alert">{localizeMessage(manager.error)}</p>}
      {manager.state.status === 'loading' && <p role="status">{translate('common.loading')}</p>}
      {manager.state.status === 'failed' && <p className="notice error" role="alert">{localizeMessage(manager.state.reason)}</p>}
      {manager.state.status === 'loaded' && <div className="access-token-list">
        {manager.state.value.length === 0 && <p className="muted">{translate('accessTokens.empty')}</p>}
        {manager.state.value.map(token => <AccessTokenRow key={token.id} token={token} busy={manager.pendingId !== null}
          onEdit={() => manager.setDialog({ type: 'edit', token })}
          onRegenerate={() => manager.setDialog({ type: 'regenerate', token })}
          onDelete={() => manager.setDialog({ type: 'delete', token })}
          onToggle={() => void manager.toggleStatus(token)} />)}
      </div>}
      {(dialog?.type === 'create' || dialog?.type === 'edit') && <AccessTokenFormDialog
        token={dialog.type === 'edit' ? dialog.token : null} onSave={manager.save} onCancel={() => manager.setDialog(null)} />}
      {dialog?.type === 'regenerate' && <ActionConfirmDialog title={translate('accessTokens.regenerate')}
        confirmLabel={translate('accessTokens.regenerate')} pendingLabel={translate('common.loading')}
        onConfirm={() => manager.regenerate(dialog.token)} onCancel={() => manager.setDialog(null)}>
        {translate('accessTokens.regenerateConfirmation', { value0: dialog.token.name })}
      </ActionConfirmDialog>}
      {dialog?.type === 'delete' && <DeleteConfirmDialog title={translate('accessTokens.delete')}
        onConfirm={() => manager.deleteToken(dialog.token)} onCancel={() => manager.setDialog(null)}>
        {translate('accessTokens.deleteConfirmation', { value0: dialog.token.name })}
      </DeleteConfirmDialog>}
    </section>
  )
}
