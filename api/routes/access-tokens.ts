import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { z } from 'zod'
import type { AuditWriter } from '../lib/audit.js'
import { markAuditChangeCommitted, markAuditNoChange, writeDedicatedAudit } from '../lib/audit-activity.js'
import { getRequestPrincipal, requirePermission } from '../lib/rbac.js'
import { requestMetadata } from '../lib/request-metadata.js'
import { AccessTokenActorInactiveError, AccessTokenConflictError, AccessTokenPermissionsError, type AccessTokenStore } from '../lib/access-token-store.js'
import type { AccessToken } from '../lib/access-token-types.js'
import type { AccessTokenNamespaceCatalog } from '../lib/access-token-namespaces.js'
import { accessTokenGrants, internalPermissions, tokenConnections, tokenNamespaces } from '../lib/access-token-grants.js'
import { createAccessTokenManagement, AccessTokenAuthorityError } from '../lib/access-token-management.js'
import { UnknownTokenConnectionError } from '../lib/internal-token-grants.js'
import { principalActor } from '../lib/principal-actor.js'
import { canDelegateToken } from '../lib/access-token-authority.js'
import type { RequestPrincipal } from '../lib/auth-types.js'
import { apiError } from '../lib/api-error.js'

// 既存のservice accountの契約にある、メタデータの上限を保つ。
const TOKEN_NAME_MAX_LENGTH = 128
const TOKEN_DESCRIPTION_MAX_LENGTH = 2048
const Metadata = z.object({
  name: z.string().trim().min(1).max(TOKEN_NAME_MAX_LENGTH),
  description: z.string().trim().max(TOKEN_DESCRIPTION_MAX_LENGTH),
  expiresAt: z.iso.datetime().nullable().optional(),
})
export const AccessTokenCreateBody = accessTokenGrants.safeExtend({ ...Metadata.shape, description: Metadata.shape.description.default('') }).strict()
export const ExpectedRevision = z.object({ expectedRevision: z.number().int().positive() })
export const AccessTokenPatchBody = Metadata.partial().extend({
  namespaces: tokenNamespaces.optional(),
  permissions: internalPermissions.optional(),
  connections: tokenConnections.optional(),
  status: z.enum(['active', 'disabled']).optional(),
  ...ExpectedRevision.shape,
}).strict()

function futureExpiry(expiresAt: string | null | undefined): boolean {
  return !expiresAt || new Date(expiresAt).getTime() > Date.now()
}

const validateTokenId: MiddlewareHandler = async (context, next) => {
  if (!z.uuid().safeParse(context.req.param('id')).success) return context.json(apiError('invalid_request', 'invalid token id'), 400)
  await next()
}

export function mountAccessTokenRoutes(app: Hono, deps: {
  store: AccessTokenStore
  audit: AuditWriter
  namespaceCatalog: AccessTokenNamespaceCatalog
  visibleConnections?(principal: RequestPrincipal): Promise<ReadonlySet<string> | null>
}): void {
  const routes = new Hono()
  const management = createAccessTokenManagement(deps)
  routes.use('*', async (c, next) => {
    const permitted = requirePermission(c.req.method === 'GET' || c.req.method === 'HEAD' ? 'service_accounts:read' : 'service_accounts:manage')
    c.header('Cache-Control', 'no-store')
    return permitted(c, next)
  })

  async function mutate(c: Context, input: {
    action: string
    execute: () => Promise<{ accessToken: AccessToken; token?: string; changed?: boolean } | null>
    created?: boolean
  }) {
    try {
      const mutation = await input.execute()
      if (!mutation) return c.json(apiError('not_found', 'access token not found'), 404)
      if (mutation.changed === false) {
        markAuditNoChange(c)
        return c.json({ accessToken: mutation.accessToken })
      }
      markAuditChangeCommitted(c)
      await writeDedicatedAudit(c, deps.audit, {
        actor: principalActor(getRequestPrincipal(c)!),
        action: input.action, outcome: 'success', resourceType: 'access_token', resourceId: mutation.accessToken.id,
        details: { target: { displayName: mutation.accessToken.name }, scopes: mutation.accessToken.scopes,
          namespaces: mutation.accessToken.namespaces, permissions: mutation.accessToken.permissions,
          connections: mutation.accessToken.connections, revision: mutation.accessToken.revision },
        ...requestMetadata(c),
      })
      return c.json({ accessToken: mutation.accessToken, ...(mutation.token ? { token: mutation.token } : {}) }, input.created ? 201 : 200)
    } catch (error) {
      if (error instanceof AccessTokenAuthorityError) return c.json(apiError('token_authority_exceeded', error.message), 403)
      if (error instanceof AccessTokenActorInactiveError) return c.json(apiError('token_actor_inactive', error.message), 401)
      if (error instanceof UnknownTokenConnectionError) return c.json(apiError('unknown_connection', error.message), 400)
      if (error instanceof AccessTokenConflictError) return c.json(apiError('token_conflict', error.message), 409)
      if (error instanceof AccessTokenPermissionsError) return c.json(apiError('invalid_token_permissions', error.message), 400)
      throw error
    }
  }

  // トークンには自分が管理できるトークンだけを見せ、もっと強い許可があることを一覧から明かさない。
  routes.get('/', async c => {
    const principal = getRequestPrincipal(c)!
    const tokens = await deps.store.listTokens()
    return c.json({ tokens: principal.kind === 'user' ? tokens : tokens.filter(token => canDelegateToken(principal, token)) })
  })
  routes.get('/namespaces', async c => {
    const principal = getRequestPrincipal(c)!
    const catalog = await deps.namespaceCatalog.listNamespaces()
    if (principal.kind === 'user' || principal.namespaces.includes('*')) return c.json(catalog)
    return c.json({ ...catalog, namespaces: catalog.namespaces.filter(namespace => principal.namespaces.includes(namespace)) })
  })
  routes.post('/', async c => {
    const parsed = AccessTokenCreateBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || !futureExpiry(parsed.data.expiresAt)) return c.json(apiError('invalid_request', 'invalid body'), 400)
    return mutate(c, {
      action: 'access_token.create', created: true,
      execute: () => management.createToken(getRequestPrincipal(c)!, { ...parsed.data,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null }),
    })
  })

  routes.use('/:id', validateTokenId)
  routes.use('/:id/*', validateTokenId)
  routes.patch('/:id', async c => {
    const parsed = AccessTokenPatchBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || !futureExpiry(parsed.data.expiresAt)) return c.json(apiError('invalid_request', 'invalid body'), 400)
    const { expectedRevision, expiresAt, ...fields } = parsed.data
    const action = fields.status === 'active' ? 'access_token.enable'
      : fields.status === 'disabled' ? 'access_token.disable' : 'access_token.update'
    return mutate(c, {
      action,
      execute: () => management.updateToken(getRequestPrincipal(c)!, { id: c.req.param('id'), expectedRevision,
        patch: { ...fields, ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}) } }),
    })
  })
  routes.post('/:id/regenerate', async c => {
    const parsed = ExpectedRevision.strict().safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json(apiError('invalid_request', 'invalid body'), 400)
    return mutate(c, { action: 'access_token.regenerate',
      execute: () => management.regenerateToken(getRequestPrincipal(c)!, { id: c.req.param('id'), ...parsed.data }) })
  })
  routes.delete('/:id', async c => {
    const parsed = z.coerce.number().int().positive().safeParse(c.req.query('expectedRevision'))
    if (!parsed.success) return c.json(apiError('invalid_request', 'invalid revision'), 400)
    return mutate(c, { action: 'access_token.delete', execute: async () => {
      const accessToken = await management.deleteToken(getRequestPrincipal(c)!, { id: c.req.param('id'), expectedRevision: parsed.data })
      return accessToken ? { accessToken } : null
    } })
  })

  app.route('/access-tokens', routes)
}
