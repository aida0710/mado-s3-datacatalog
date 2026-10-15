import type { RequestPrincipal } from './auth-types.js'
import { hasPermission } from './auth-types.js'
import { canDelegateToken } from './access-token-authority.js'
import type { AccessToken, AccessTokenInput, AccessTokenPatch } from './access-token-types.js'
import type { AccessTokenStore } from './access-token-store.js'
import { principalUserId } from './principal-actor.js'
import { normalizePermissionScopes } from './access-token-grants.js'

export class AccessTokenAuthorityError extends Error {
  constructor() { super('token permissions or targets exceed the caller authority') }
}

export function createAccessTokenManagement(deps: {
  store: AccessTokenStore
  visibleConnections?(principal: RequestPrincipal): Promise<ReadonlySet<string> | null>
}) {
  async function authorize(principal: RequestPrincipal, grants: AccessTokenInput): Promise<void> {
    if (!canDelegateToken(principal, grants)) throw new AccessTokenAuthorityError()
    if (principal.kind !== 'user' || hasPermission(principal, 'connections:manage')) return
    const requested = grants.connections ?? []
    if (!requested.length) return
    const visible = await deps.visibleConnections?.(principal)
    if (visible === undefined || (visible !== null && requested.some(id => !visible.has(id)))) {
      throw new AccessTokenAuthorityError()
    }
  }

  async function manageable(principal: RequestPrincipal, id: string): Promise<AccessToken | null> {
    const token = await deps.store.getToken(id)
    if (token) await authorize(principal, token)
    return token
  }

  return {
    async createToken(principal: RequestPrincipal, input: AccessTokenInput) {
      const grants = normalizePermissionScopes(input)
      await authorize(principal, grants)
      return deps.store.createToken({ ...grants, createdBy: principalUserId(principal) })
    },
    async updateToken(principal: RequestPrincipal, input: { id: string; expectedRevision: number; patch: AccessTokenPatch }) {
      const current = await manageable(principal, input.id)
      if (!current) return null
      await authorize(principal, { ...current, ...normalizePermissionScopes(input.patch) })
      return deps.store.updateToken(input)
    },
    async regenerateToken(principal: RequestPrincipal, input: { id: string; expectedRevision: number }) {
      if (!await manageable(principal, input.id)) return null
      return deps.store.regenerateToken(input)
    },
    async deleteToken(principal: RequestPrincipal, input: { id: string; expectedRevision: number }) {
      if (!await manageable(principal, input.id)) return null
      return deps.store.deleteToken(input)
    },
  }
}
