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
  const [namespaces, setNamespaces] = useState<string[]>(input.token?.namespaces ?? [])
  const [initialExpiry] = useState(() => initialTokenExpirySelection(input.token))
  const [expiry, setExpiry] = useState(initialExpiry)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const includesLineage = permissions.some(permission => permission.startsWith('lineage:'))
  const requiresConnections = permissions.some(permission => CONNECTION_PERMISSIONS.includes(permission))
  const showsConnections = requiresConnections || permissions.some(permission => permission.startsWith('lineage:'))
  function togglePermission(permission: InternalApiPermission) {
    setPermissions(current => current.includes(permission) ? current.filter(selected => selected !== permission) : [...current, permission])
  }
  function applyPreset(preset: AccessTokenPreset) {
    setPermissions(accessTokenPreset(preset))
    if (preset === 'all') { setNamespaces(['*']); setConnections(['*']) }
    if (preset === 'none') { setNamespaces([]); setConnections([]) }
  }
  async function save() {
    setError(null)
    if (!name.trim()) { setError(translate('accessTokens.nameRequired')); return }
    if (!permissions.length) { setError(translate('accessTokens.choosePermission')); return }
    if (requiresConnections && connections.length === 0) { setError(translate('accessTokens.connectionsRequired')); return }
    if (permissions.includes('users:manage') && !(INTERNAL_API_PERMISSIONS.every(permission => permissions.includes(permission))
      && connections.includes('*') && namespaces.includes('*'))) {
      setError(translate('accessTokens.usersManageHelp')); return
    }
    if (includesLineage && namespaces.length === 0) {
      setError(translate('accessTokens.namespacesRequired')); return
    }
    const keepsExpiry = input.token !== null && isSameTokenExpirySelection(expiry, initialExpiry)
    const expiresAt = keepsExpiry ? undefined : resolveTokenExpiryTimestamp(expiry)
    if (!keepsExpiry && expiresAt === undefined) {
      setError(translate(expiry.option === 'calendar' ? 'accessTokens.futureExpiry' : 'accessTokens.expiryInvalid')); return
    }
    setBusy(true)
    try {
      await input.onSave(accessTokenFormInput({ name, description, permissions, connections, namespaces, expiresAt }))
    } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  return { name, setName, description, setDescription, permissions, togglePermission, applyPreset,
    connections, setConnections, showsConnections, namespaces, setNamespaces,
    expiry, setExpiry, includesLineage, busy, error, save }
}
