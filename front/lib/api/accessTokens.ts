import { jsonRequestInit } from '@mado/design-system/http'
import { API_BASE, requestApi } from './http'
import type { AccessToken, AccessTokenInput } from '../../types/accessTokens'
import {
  AccessTokenList, AccessTokenNamespaces, ChangedAccessToken, IssuedAccessToken,
} from '../../../api/shared/schemas/access-tokens'

const ACCESS_TOKENS_PATH = `${API_BASE}/access-tokens`
const tokenPath = (token: AccessToken) => `${ACCESS_TOKENS_PATH}/${encodeURIComponent(token.id)}`

export const accessTokensApi = {
  namespaces: () => requestApi(`${ACCESS_TOKENS_PATH}/namespaces`, AccessTokenNamespaces),
  list: async (): Promise<AccessToken[]> => (await requestApi(ACCESS_TOKENS_PATH, AccessTokenList)).tokens,
  create: (body: AccessTokenInput) => requestApi(ACCESS_TOKENS_PATH, IssuedAccessToken, jsonRequestInit('POST', body)),
  update: (token: AccessToken, body: Partial<AccessTokenInput> & { status?: 'active' | 'disabled' }) => requestApi(
    tokenPath(token), ChangedAccessToken, jsonRequestInit('PATCH', { ...body, expectedRevision: token.revision }),
  ),
  regenerate: (token: AccessToken) => requestApi(
    `${tokenPath(token)}/regenerate`, IssuedAccessToken, jsonRequestInit('POST', { expectedRevision: token.revision }),
  ),
  delete: (token: AccessToken) => requestApi(
    `${tokenPath(token)}?expectedRevision=${token.revision}`, ChangedAccessToken, jsonRequestInit('DELETE'),
  ),
}
