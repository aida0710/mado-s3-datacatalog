import { useState } from 'react'
import { accessTokenFormInput, localDateTimeInput } from './accessTokenForm'
import { translate } from '../i18n/translate'
import type { AccessToken, AccessTokenInput, AccessTokenScope } from '../types/accessTokens'

export function useAccessTokenForm(input: { token: AccessToken | null; onSave: (input: AccessTokenInput) => Promise<void> }) {
  const [name, setName] = useState(input.token?.name ?? '')
  const [description, setDescription] = useState(input.token?.description ?? '')
  const [scopes, setScopes] = useState<AccessTokenScope[]>(input.token?.scopes ?? ['lineage:read', 'lineage:write'])
  const [namespaces, setNamespaces] = useState(input.token?.namespaces.join(', ') ?? '')
  const [expiry, setExpiry] = useState(localDateTimeInput(input.token?.expiresAt ?? null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const includesLineage = scopes.some(scope => scope.startsWith('lineage:'))
  function toggleScope(scope: AccessTokenScope) {
    setScopes(current => current.includes(scope) ? current.filter(selected => selected !== scope) : [...current, scope])
  }
  async function save() {
    setError(null)
    if (!name.trim()) { setError(translate('accessTokens.nameRequired')); return }
    if (!scopes.length) { setError(translate('accessTokens.choosePermission')); return }
    if (includesLineage && !namespaces.split(',').some(name => name.trim())) {
      setError(translate('accessTokens.namespacesRequired')); return
    }
    const sameExpiry = input.token !== null && expiry === localDateTimeInput(input.token.expiresAt)
    if (expiry && !sameExpiry && (!Number.isFinite(new Date(expiry).getTime()) || new Date(expiry).getTime() <= Date.now())) {
      setError(translate('accessTokens.futureExpiry')); return
    }
    setBusy(true)
    try {
      await input.onSave(accessTokenFormInput({ name, description, scopes, namespaces, expiry, previous: input.token }))
    } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  return { name, setName, description, setDescription, scopes, toggleScope, namespaces, setNamespaces,
    expiry, setExpiry, includesLineage, busy, error, save }
}
