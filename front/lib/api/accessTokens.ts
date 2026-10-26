import type { z } from 'zod'
import { API_BASE, fetchApi, errorFromResponse } from './http'
import type { AccessToken, AccessTokenInput } from '../../types/accessTokens'
import {
  AccessTokenList, AccessTokenNamespaces, ChangedAccessToken, IssuedAccessToken,
} from '../../../api/shared/schemas/access-tokens'

async function requestToken<T extends z.ZodType>(input: {
  path?: string
  method?: string
  body?: unknown
  schema: T
}): Promise<z.infer<T>> {
  const response = await fetchApi(`${API_BASE}/access-tokens${input.path ?? ''}`, {
    method: input.method ?? 'GET', headers: { 'Content-Type': 'application/json' },
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
  })
  if (!response.ok) throw await errorFromResponse(response)
  return input.schema.parse(await response.json())
}

export const accessTokensApi = {
  namespaces: () => requestToken({ path: '/namespaces', schema: AccessTokenNamespaces }),
  list: async (): Promise<AccessToken[]> => (await requestToken({ schema: AccessTokenList })).tokens,
  create: (body: AccessTokenInput) => requestToken({ method: 'POST', body, schema: IssuedAccessToken }),
  update: (token: AccessToken, body: Partial<AccessTokenInput> & { status?: 'active' | 'disabled' }) => requestToken({
    path: `/${encodeURIComponent(token.id)}`, method: 'PATCH',
    body: { ...body, expectedRevision: token.revision }, schema: ChangedAccessToken,
  }),
  regenerate: (token: AccessToken) => requestToken({
    path: `/${encodeURIComponent(token.id)}/regenerate`, method: 'POST',
    body: { expectedRevision: token.revision }, schema: IssuedAccessToken,
  }),
  delete: (token: AccessToken) => requestToken({
    path: `/${encodeURIComponent(token.id)}?expectedRevision=${token.revision}`, method: 'DELETE', schema: ChangedAccessToken,
  }),
}
