import { useState } from 'react'
import { accessTokensApi } from './api/accessTokens'
import { useRetryableLoad } from './useRetryableLoad'
import type { AccessToken, AccessTokenDialog, AccessTokenInput, AccessTokenSecret } from '../types/accessTokens'

export function useAccessTokens() {
  const { state, retry } = useRetryableLoad(accessTokensApi.list)
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
    retry()
  }
  async function regenerate(token: AccessToken) {
    showSecret(await accessTokensApi.regenerate(token))
    setDialog(null)
    retry()
  }
  async function deleteToken(token: AccessToken) {
    await accessTokensApi.delete(token)
    setSecret(null)
    setDialog(null)
    retry()
  }
  async function toggleStatus(token: AccessToken) {
    setPendingId(token.id)
    setError(null)
    try {
      await accessTokensApi.update(token, { status: token.status === 'disabled' ? 'active' : 'disabled' })
      retry()
    } catch (failure) { setError((failure as Error).message) }
    finally { setPendingId(null) }
  }
  return { state, reload: retry, dialog, setDialog, secret, clearSecret: () => setSecret(null),
    error, pendingId, save, regenerate, deleteToken, toggleStatus }
}
