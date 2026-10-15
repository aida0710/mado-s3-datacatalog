import { Dialog } from './Dialog'
import { NamespaceSelector } from './NamespaceSelector'
import { InternalPermissionSelector } from './InternalPermissionSelector'
import { TokenConnectionSelector } from './TokenConnectionSelector'
import { useAccessTokenForm } from '../lib/useAccessTokenForm'
import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
import { accessTokenScopeLabels } from '../i18n/accessTokenOptions'
import type { AccessToken, AccessTokenInput, AccessTokenScope } from '../types/accessTokens'

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
    <Dialog titleId="access-token-form-title" title={translate(token ? 'accessTokens.edit' : 'accessTokens.create')} size="wide"
      onClose={onCancel} dismissible={!form.busy}
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
        <fieldset className="access-token-permissions" disabled={form.busy}>
          <legend>{translate('accessTokens.integrations')}</legend>
          {(Object.keys(accessTokenScopeLabels) as AccessTokenScope[]).map(scope => <label key={scope}>
            <input type="checkbox" checked={form.scopes.includes(scope)} onChange={() => form.toggleScope(scope)} />
            <span>{translate(accessTokenScopeLabels[scope])}</span>
          </label>)}
          {form.scopes.includes('lineage:read') && <p className="muted">{translate('accessTokens.readHelp')}</p>}
          {form.scopes.includes('metrics:read') && <p className="muted">{translate('accessTokens.metricsHelp')}</p>}
        </fieldset>
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
