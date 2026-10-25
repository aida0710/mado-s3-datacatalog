import { Dialog } from '@mado/design-system/react'
import { NamespaceSelector } from './NamespaceSelector'
import { InternalPermissionSelector } from './InternalPermissionSelector'
import { TokenConnectionSelector } from './TokenConnectionSelector'
import { useAccessTokenForm } from '../lib/useAccessTokenForm'
import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
import type { AccessToken, AccessTokenInput } from '../types/accessTokens'

// Match the access-token API's metadata limits before submitting the form.
const TOKEN_NAME_MAX_LENGTH = 128
const TOKEN_DESCRIPTION_MAX_LENGTH = 2048

export function AccessTokenFormDialog({ token, onSave, onCancel }: {
  token: AccessToken | null
  onSave: (input: AccessTokenInput) => Promise<void>
  onCancel: () => void
}) {
  useLocale()
  const form = useAccessTokenForm({ token, onSave })
  return (
    <Dialog title={translate(token ? 'accessTokens.edit' : 'accessTokens.create')} size="wide"
      onClose={onCancel} closeLabel={translate('common.close')} dismissible={!form.busy}
      footer={<>
        <button className="button" type="button" onClick={onCancel} disabled={form.busy}>{translate('common.cancel')}</button>
        <button className="button primary" type="submit" form="access-token-form" disabled={form.busy}>
          {translate(form.busy ? 'common.loading' : token ? 'common.save' : 'accessTokens.issue')}
        </button>
      </>}>
      <form id="access-token-form" className="dialog-body access-token-form" onSubmit={event => { event.preventDefault(); void form.save() }}>
        <label className="field"><span>{translate('common.name')}</span>
          <input value={form.name} onChange={event => form.setName(event.target.value)} required maxLength={TOKEN_NAME_MAX_LENGTH} disabled={form.busy} autoFocus />
        </label>
        <label className="field"><span>{translate('accessTokens.description')}</span>
          <input value={form.description} onChange={event => form.setDescription(event.target.value)} maxLength={TOKEN_DESCRIPTION_MAX_LENGTH} disabled={form.busy} />
        </label>
        <InternalPermissionSelector selected={form.permissions} onToggle={form.togglePermission} onPreset={form.applyPreset} disabled={form.busy} />
        {form.showsConnections && <TokenConnectionSelector selected={form.connections} onChange={form.setConnections} disabled={form.busy} />}
        {form.includesLineage && <NamespaceSelector selected={form.namespaces} onChange={form.setNamespaces} disabled={form.busy} />}
        <label className="field"><span>{translate('accessTokens.expiresAt')}</span>
          <input type="datetime-local" aria-label={translate('accessTokens.expiresAt')} aria-describedby="access-token-expiry-help" value={form.expiry} onChange={event => form.setExpiry(event.target.value)} disabled={form.busy} />
          <small id="access-token-expiry-help" className="muted">{translate('accessTokens.expiryHelp')}</small>
        </label>
        {form.error && <p className="notice error" role="alert">{localizeMessage(form.error)}</p>}
      </form>
    </Dialog>
  )
}
