import { useState } from 'react'
import { accessTokenFormInput, localDateTimeInput } from './accessTokenForm'
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
  const [expiry, setExpiry] = useState(localDateTimeInput(input.token?.expiresAt ?? null))
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
    const sameExpiry = input.token !== null && expiry === localDateTimeInput(input.token.expiresAt)
    if (expiry && !sameExpiry && (!Number.isFinite(new Date(expiry).getTime()) || new Date(expiry).getTime() <= Date.now())) {
      setError(translate('accessTokens.futureExpiry')); return
    }
    setBusy(true)
    try {
      await input.onSave(accessTokenFormInput({ name, description, permissions, connections, namespaces, expiry, previous: input.token }))
    } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  return { name, setName, description, setDescription, permissions, togglePermission, applyPreset,
    connections, setConnections, showsConnections, namespaces, setNamespaces,
    expiry, setExpiry, includesLineage, busy, error, save }
}
