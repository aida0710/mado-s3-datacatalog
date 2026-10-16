import { useRef } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { fmtDateTimeWithSeconds } from '../lib/format'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
import { displayedTokenPermissions } from '../../api/shared/access-token-permissions'
import { translateInternalPermission } from '../i18n/translateInternalPermission'
import type { AccessToken } from '../types/accessTokens'

const statusLabels = { active: 'accessTokens.active', disabled: 'accessTokens.disabled', expired: 'accessTokens.expired' } as const
const statusClasses = { active: 'status-finished', disabled: 'status-queued', expired: 'status-attention' }

export function AccessTokenRow({ token, busy, onEdit, onRegenerate, onDelete, onToggle }: {
  token: AccessToken
  busy: boolean
  onEdit: () => void
  onRegenerate: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  useLocale()
  const actions = useRef<HTMLDetailsElement>(null)
  function selectAction(action: () => void) {
    if (actions.current) {
      actions.current.open = false
      actions.current.querySelector('summary')?.focus()
    }
    action()
  }
  return (
    <article className="access-token-row" aria-label={token.name}>
      <div className="access-token-identity">
        <h3>{token.name}</h3>
        {token.description && <p className="muted">{token.description}</p>}
        <code className="muted">{token.tokenPrefix}…</code>
      </div>
      <div className="access-token-grants">
        <div className="access-token-scope-list">
          {displayedTokenPermissions(token).map(permission => <span className="chip" key={permission}>{translateInternalPermission(permission)}</span>)}
        </div>
        {token.connections !== null && token.connections.length > 0 && <p className="muted">{translate('accessTokens.connections')}: {token.connections.includes('*')
          ? translate('accessTokens.allConnections') : token.connections.join(', ')}</p>}
        {token.namespaces.length > 0 && <p className="muted">{translate('accessTokens.namespaces')}: {token.namespaces.join(', ')}</p>}
        <p className="muted">{translate('accessTokens.lastUsed')}: {token.lastUsedAt ? fmtDateTimeWithSeconds(token.lastUsedAt) : translate('accessTokens.neverUsed')}</p>
        <p className="muted">{translate('accessTokens.expiresAt')}: {token.expiresAt ? fmtDateTimeWithSeconds(token.expiresAt) : translate('accessTokens.noExpiry')}</p>
      </div>
      <div className="access-token-controls">
        <span className={`status-badge ${statusClasses[token.status]}`}>{translate(statusLabels[token.status])}</span>
        <details ref={actions} className="access-token-actions">
          <summary aria-label={translate('accessTokens.actionsFor', { value0: token.name })}><MoreHorizontal size={18} aria-hidden="true" /></summary>
          <div className="popover access-token-menu">
            <button type="button" disabled={busy} onClick={() => selectAction(onEdit)}>{translate('common.edit')}</button>
            <button type="button" disabled={busy} onClick={() => selectAction(onRegenerate)}>{translate('accessTokens.regenerate')}</button>
            <button type="button" disabled={busy} onClick={() => selectAction(onToggle)}>{translate(token.status === 'disabled' ? 'accessTokens.enable' : 'accessTokens.disable')}</button>
            <button type="button" className="danger" disabled={busy} onClick={() => selectAction(onDelete)}>{translate('common.delete')}</button>
          </div>
        </details>
      </div>
    </article>
  )
}
