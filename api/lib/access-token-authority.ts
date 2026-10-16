import type { AccessTokenInput } from './access-token-types.js'
import type { RequestPrincipal } from './auth-types.js'
import { hasPermission } from './auth-types.js'
import { INTERNAL_API_PERMISSIONS } from '../shared/access-token-permissions.js'

type TokenGrants = Pick<AccessTokenInput, 'permissions' | 'namespaces' | 'connections'> & { expiresAt?: Date | null }

function includesTargets(allowed: readonly string[], requested: readonly string[]): boolean {
  return allowed.includes('*') || requested.every(value => allowed.includes(value))
}

/** A lifetime is part of what was granted: a token must not create or manage one that outlives it. */
function endsWithin(allowed: Date | null, requested: Date | null | undefined): boolean {
  if (allowed === null) return true
  return requested != null && requested.getTime() <= allowed.getTime()
}

/**
 * Whether the principal may grant these permissions and targets. Integration scopes derive from the
 * permissions, so they need no check of their own.
 */
export function canDelegateToken(principal: RequestPrincipal, grants: TokenGrants): boolean {
  if (!grants.permissions.every(permission => hasPermission(principal, permission))) return false
  if (principal.kind === 'user') return !grants.connections.includes('*') || hasPermission(principal, 'connections:manage')
  // Even targets a permission does not need matter: DataLineage uses connections for location resolution.
  return includesTargets(principal.namespaces, grants.namespaces)
    && includesTargets(principal.connections, grants.connections)
    && endsWithin(principal.expiresAt, grants.expiresAt)
}

/** For work that is not tied to one connection: a token must hold every connection to reach it. */
export function coversAllConnections(principal: RequestPrincipal): boolean {
  return principal.kind === 'user' || principal.connections.includes('*')
}

/**
 * User/role/password administration can otherwise turn a limited token into an administrator login,
 * so only a token holding every permission, connection and namespace may use it.
 */
export function canAdministerUsers(principal: RequestPrincipal): boolean {
  if (principal.kind === 'user') return hasPermission(principal, 'users:manage')
  return INTERNAL_API_PERMISSIONS.every(permission => principal.permissions.includes(permission))
    && coversAllConnections(principal) && principal.namespaces.includes('*')
}
