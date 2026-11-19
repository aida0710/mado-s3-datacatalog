import { useState } from 'react'
import { resolveTokenExpiryTimestamp } from '@mado/design-system/token-expiry'
import { accessTokenFormInput, initialTokenExpirySelection, isSameTokenExpirySelection } from './accessTokenForm'
import { translate } from '../i18n/translate'
import { CONNECTION_PERMISSIONS, INTERNAL_API_PERMISSIONS } from '../../api/shared/access-token-permissions'
import { accessTokenPreset, type AccessTokenPreset } from './accessTokenPresets'
import type { AccessToken, AccessTokenInput, InternalApiPermission } from '../types/accessTokens'

export function useAccessTokenForm(input: { token: AccessToken | null; onSave: (input: AccessTokenInput) => Promise<void> }) {
  const [name, setName] = useState(input.token?.name ?? '')
  const [description, setDescription] = useState(input.token?.description ?? '')
  const [permissions, setPermissions] = useState<InternalApiPermission[]>(input.token?.permissions ?? [])
  const [connections, setConnections] = useState<string[]>(input.token?.connections ?? [])
  const [initialExpiry] = useState(() => initialTokenExpirySelection(input.token))
  const [expiry, setExpiry] = useState(initialExpiry)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requiresConnections = permissions.some(permission => CONNECTION_PERMISSIONS.includes(permission))
  function togglePermission(permission: InternalApiPermission) {
    setPermissions(current => current.includes(permission) ? current.filter(selected => selected !== permission) : [...current, permission])
  }
  function applyPreset(preset: AccessTokenPreset) {
    setPermissions(accessTokenPreset(preset))
    if (preset === 'all') setConnections(['*'])
    if (preset === 'none') setConnections([])
  }
  async function save() {
    setError(null)
    if (!name.trim()) { setError(translate('accessTokens.nameRequired')); return }
    if (!permissions.length) { setError(translate('accessTokens.choosePermission')); return }
    if (requiresConnections && connections.length === 0) { setError(translate('accessTokens.connectionsRequired')); return }
    if (permissions.includes('users:manage') && !(INTERNAL_API_PERMISSIONS.every(permission => permissions.includes(permission))
      && connections.includes('*'))) {
      setError(translate('accessTokens.usersManageHelp')); return
    }
    const keepsExpiry = input.token !== null && isSameTokenExpirySelection(expiry, initialExpiry)
    const expiresAt = keepsExpiry ? undefined : resolveTokenExpiryTimestamp(expiry)
    if (!keepsExpiry && expiresAt === undefined) {
      setError(translate(expiry.option === 'calendar' ? 'accessTokens.futureExpiry' : 'accessTokens.expiryInvalid')); return
    }
    setBusy(true)
    try {
      await input.onSave(accessTokenFormInput({ name, description, permissions, connections, expiresAt }))
    } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  return { name, setName, description, setDescription, permissions, togglePermission, applyPreset,
    connections, setConnections, requiresConnections,
    expiry, setExpiry, busy, error, save }
}
