import { useState } from 'react'
import { useQuery } from '@mado/design-system/react'
import { accessTokensApi } from './api/accessTokens'
import type { AccessToken, AccessTokenDialog, AccessTokenInput, AccessTokenSecret } from '../types/accessTokens'

export function useAccessTokens() {
  const tokens = useQuery({ key: 'access-tokens', load: () => accessTokensApi.list() })
  const reload = tokens.reload
  const [dialog, setDialog] = useState<AccessTokenDialog | null>(null)
  const [secret, setSecret] = useState<AccessTokenSecret | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  function showSecret(issued: { accessToken: AccessToken; token: string }) {
    setSecret({ label: issued.accessToken.name, value: issued.token })
  }
  async function save(input: AccessTokenInput) {
    if (dialog?.type === 'edit') await accessTokensApi.update(dialog.token, input)
    else showSecret(await accessTokensApi.create(input))
    setDialog(null)
    reload()
  }
  async function regenerate(token: AccessToken) {
    showSecret(await accessTokensApi.regenerate(token))
    setDialog(null)
    reload()
  }
  async function deleteToken(token: AccessToken) {
    await accessTokensApi.delete(token)
    setSecret(null)
    setDialog(null)
    reload()
  }
  async function toggleStatus(token: AccessToken) {
    setPendingId(token.id)
    setError(null)
    try {
      await accessTokensApi.update(token, { status: token.status === 'disabled' ? 'active' : 'disabled' })
      reload()
    } catch (failure) { setError((failure as Error).message) }
    finally { setPendingId(null) }
  }
  return { tokens, reload, dialog, setDialog, secret, clearSecret: () => setSecret(null),
    error, pendingId, save, regenerate, deleteToken, toggleStatus }
}
