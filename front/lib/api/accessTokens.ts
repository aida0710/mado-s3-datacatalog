import { z } from 'zod'
import { API_BASE, fetchApi, errorFromResponse } from './http'
import type { AccessToken, AccessTokenInput } from '../../types/accessTokens'
import { INTERNAL_API_PERMISSIONS, SERVICE_KEY_SCOPES } from '../../../api/shared/access-token-permissions'

const accessTokenSchema = z.object({
  id: z.string(), name: z.string(), description: z.string(), tokenPrefix: z.string(),
  scopes: z.array(z.enum(SERVICE_KEY_SCOPES)),
  permissions: z.array(z.enum(INTERNAL_API_PERMISSIONS)),
  connections: z.array(z.string()),
  namespaces: z.array(z.string()), status: z.enum(['active', 'disabled', 'expired']),
  createdAt: z.string(), expiresAt: z.string().nullable(), regeneratedAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(), revision: z.number().int().positive(),
})
const issuedTokenSchema = z.object({ accessToken: accessTokenSchema, token: z.string() })
const changedTokenSchema = z.object({ accessToken: accessTokenSchema })

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
  namespaces: () => requestToken({ path: '/namespaces', schema: z.object({
    namespaces: z.array(z.string()), sourceStatus: z.enum(['ready', 'unavailable', 'unconfigured', 'partial']),
  }) }),
  list: async (): Promise<AccessToken[]> => (await requestToken({ schema: z.object({ tokens: z.array(accessTokenSchema) }) })).tokens,
  create: (body: AccessTokenInput) => requestToken({ method: 'POST', body, schema: issuedTokenSchema }),
  update: (token: AccessToken, body: Partial<AccessTokenInput> & { status?: 'active' | 'disabled' }) => requestToken({
    path: `/${encodeURIComponent(token.id)}`, method: 'PATCH',
    body: { ...body, expectedRevision: token.revision }, schema: changedTokenSchema,
  }),
  regenerate: (token: AccessToken) => requestToken({
    path: `/${encodeURIComponent(token.id)}/regenerate`, method: 'POST',
    body: { expectedRevision: token.revision }, schema: issuedTokenSchema,
  }),
  delete: (token: AccessToken) => requestToken({
    path: `/${encodeURIComponent(token.id)}?expectedRevision=${token.revision}`, method: 'DELETE', schema: changedTokenSchema,
  }),
}
