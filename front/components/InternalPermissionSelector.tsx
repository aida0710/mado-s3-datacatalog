import { useState } from 'react'
import { INTERNAL_API_PERMISSION_GROUPS } from '../../api/shared/access-token-permissions'
import type { InternalApiPermissionGroup, InternalApiPermission } from '../../api/shared/access-token-permissions'
import { internalPermissionAction, internalPermissionActionLabels, internalPermissionGroupLabels } from '../i18n/internalPermissionOptions'
import { translate } from '../i18n/translate'
import { useLocale } from '../i18n/useLocale'
import { ACCESS_TOKEN_PRESETS, type AccessTokenPreset } from '../lib/accessTokenPresets'

export function InternalPermissionSelector({ selected, onToggle, onPreset, disabled }: {
  selected: InternalApiPermission[]
  onToggle: (permission: InternalApiPermission) => void
  onPreset: (preset: AccessTokenPreset) => void
  disabled: boolean
}) {
  useLocale()
  const [query, setQuery] = useState('')
  const groups = (Object.keys(INTERNAL_API_PERMISSION_GROUPS) as InternalApiPermissionGroup[])
    .filter(group => `${translate(internalPermissionGroupLabels[group])} ${INTERNAL_API_PERMISSION_GROUPS[group].join(' ')}`
      .toLowerCase().includes(query.trim().toLowerCase()))
  return <fieldset className="internal-permissions" disabled={disabled}>
    <legend>{translate('accessTokens.permissions')}</legend>
    <p className="muted">{translate('tokenPermissions.help')}</p>
    <div className="internal-permissions__presets" role="group" aria-label={translate('tokenPermissions.presets')}>
      {ACCESS_TOKEN_PRESETS.map(preset => <button key={preset} className="button small" type="button"
        onClick={() => onPreset(preset)}>{translate(`tokenPermissions.preset.${preset}`)}</button>)}
    </div>
    <label className="field"><span>{translate('tokenPermissions.search')}</span>
      <input type="search" value={query} onChange={event => setQuery(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }} />
    </label>
    <div className="internal-permissions__rows">
      {groups.map(group => <div className="internal-permissions__row" key={group} role="group"
        aria-label={translate(internalPermissionGroupLabels[group])}>
        <strong>{translate(internalPermissionGroupLabels[group])}</strong>
        <div>{INTERNAL_API_PERMISSION_GROUPS[group].map(permission => <label key={permission}>
          <input type="checkbox" checked={selected.includes(permission)} onChange={() => onToggle(permission)} />
          <span>{translate(internalPermissionActionLabels[internalPermissionAction(permission)])}</span>
        </label>)}</div>
      </div>)}
      {groups.length === 0 && <p className="muted">{translate('tokenPermissions.noMatches')}</p>}
    </div>
    {selected.includes('users:manage') && <p className="muted">{translate('accessTokens.usersManageHelp')}</p>}
  </fieldset>
}
