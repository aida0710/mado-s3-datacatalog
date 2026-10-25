import { formatLocalDateTimeInput } from '@mado/design-system/datetime-input'
import { DEFAULT_TOKEN_EXPIRY_SELECTION, type TokenExpirySelection } from '@mado/design-system/token-expiry'
import type { AccessToken, AccessTokenInput, InternalApiPermission } from '../types/accessTokens'

/**
 * 期限の選択の最初の値。作成は既定 (90日)。編集は今の期限 (日時か無期限) から始め、選び直さなければ
 * 期限を送らない。日時の欄は分までなので、今の期限を選択のまま送ると秒が切り捨てられて変わるため。
 */
export function initialTokenExpirySelection(token: AccessToken | null): TokenExpirySelection {
  if (!token) return DEFAULT_TOKEN_EXPIRY_SELECTION
  if (!token.expiresAt) return { ...DEFAULT_TOKEN_EXPIRY_SELECTION, option: 'never' }
  return { ...DEFAULT_TOKEN_EXPIRY_SELECTION, option: 'calendar', dateTime: formatLocalDateTimeInput(new Date(token.expiresAt)) }
}

/** 期限の選択が最初の値のままか。カレンダーでは日時まで同じときだけ。 */
export function isSameTokenExpirySelection(current: TokenExpirySelection, initial: TokenExpirySelection): boolean {
  if (current.option !== initial.option) return false
  return current.option !== 'calendar' || current.dateTime === initial.dateTime
}

export function accessTokenFormInput(input: {
  name: string
  description: string
  permissions: InternalApiPermission[]
  connections: string[]
  namespaces: string[]
  /** 期限の日時 (ISO 8601)。null は無期限、undefined は今の期限のまま (送らない)。 */
  expiresAt: string | null | undefined
}): AccessTokenInput {
  const includesLineage = input.permissions.some(permission => permission.startsWith('lineage:'))
  const namespaces = includesLineage ? [...new Set(input.namespaces)] : []
  return {
    name: input.name.trim(), description: input.description.trim(),
    permissions: input.permissions,
    connections: input.connections.includes('*') ? ['*'] : input.connections,
    namespaces: namespaces.includes('*') ? ['*'] : namespaces,
    ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
  }
}
