import type { RequestPrincipal } from './auth-types.js'
import { hasPermission } from './auth-types.js'
import { canDelegateToken } from './access-token-authority.js'
import type { AccessToken, AccessTokenInput, AccessTokenPatch } from './access-token-types.js'
import type { AccessTokenStore, AccessTokenWriteGuard } from './access-token-store.js'
import { principalUserId } from './principal-actor.js'

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
    const requested = grants.connections
    if (!requested.length) return
    const visible = await deps.visibleConnections?.(principal)
    if (visible === undefined || (visible !== null && requested.some(id => !visible.has(id)))) {
      throw new AccessTokenAuthorityError()
    }
  }

  /** Authorization runs on the row the store has locked, so a concurrent change cannot slip past it. */
  function writeGuard(principal: RequestPrincipal, grantsAfterWrite?: (current: AccessToken) => AccessTokenInput): AccessTokenWriteGuard {
    return {
      actorKeyId: principal.kind === 'service_account' ? principal.keyId : undefined,
      async authorize(current) {
        await authorize(principal, current)
        if (grantsAfterWrite) await authorize(principal, grantsAfterWrite(current))
      },
    }
  }

  return {
    async createToken(principal: RequestPrincipal, input: AccessTokenInput) {
      await authorize(principal, input)
      return deps.store.createToken({ ...input, createdBy: principalUserId(principal) }, writeGuard(principal))
    },
    updateToken(principal: RequestPrincipal, input: { id: string; expectedRevision: number; patch: AccessTokenPatch }) {
      const guard = writeGuard(principal, current => ({ ...current, ...input.patch }))
      return deps.store.updateToken(input, guard)
    },
    regenerateToken(principal: RequestPrincipal, input: { id: string; expectedRevision: number }) {
      return deps.store.regenerateToken(input, writeGuard(principal))
    },
    deleteToken(principal: RequestPrincipal, input: { id: string; expectedRevision: number }) {
      return deps.store.deleteToken(input, writeGuard(principal))
    },
  }
}
