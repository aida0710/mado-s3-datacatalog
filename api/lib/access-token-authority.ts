import type { AccessTokenInput } from './access-token-types.js'
import type { RequestPrincipal } from './auth-types.js'
import { hasPermission, SERVICE_KEY_SCOPES } from './auth-types.js'
import { INTERNAL_API_PERMISSIONS } from '../shared/access-token-permissions.js'

type TokenGrants = Pick<AccessTokenInput, 'scopes' | 'permissions' | 'namespaces' | 'connections'>
  & { expiresAt?: Date | null }
const USER_SCOPE_PERMISSION = { 'lineage:read': 'lineage:read', 'lineage:write': 'lineage:curate', 'metrics:read': 'storage:read' } as const

function includesTargets(allowed: readonly string[] | null, requested: readonly string[] | null): boolean {
  if (allowed === null || allowed.includes('*')) return true
  return requested !== null && requested.every(value => allowed.includes(value))
}

/** A lifetime is part of what was granted: a token must not create or manage one that outlives it. */
function endsWithin(allowed: Date | null, requested: Date | null | undefined): boolean {
  if (allowed === null) return true
  return requested != null && requested.getTime() <= allowed.getTime()
}

export function canDelegateToken(principal: RequestPrincipal, grants: TokenGrants): boolean {
  if (!(grants.permissions ?? []).every(permission => hasPermission(principal, permission))) return false
  if (principal.kind === 'user') {
    if (!grants.scopes.every(scope => hasPermission(principal, USER_SCOPE_PERMISSION[scope]))) return false
    const unrestrictedConnections = grants.connections?.includes('*')
      || (grants.connections == null && grants.scopes.includes('metrics:read'))
    return !unrestrictedConnections || hasPermission(principal, 'connections:manage')
  }
  // Even optional targets matter: DataLineage uses them for location resolution.
  // Only a legacy metrics grant may retain the old null = unrestricted semantics.
  const legacyMetrics = grants.connections == null && grants.scopes.includes('metrics:read')
  const requestedConnections = grants.connections ?? (legacyMetrics ? null : [])
  const allowedConnections = legacyMetrics ? principal.connections : principal.connections ?? []
  return grants.scopes.every(scope => principal.scopes.includes(scope))
    && includesTargets(principal.namespaces, grants.namespaces)
    && includesTargets(allowedConnections, requestedConnections)
    && endsWithin(principal.expiresAt, grants.expiresAt)
}

/** For work that is not tied to one connection: a token must hold every connection to reach it. */
export function coversAllConnections(principal: RequestPrincipal): boolean {
  return principal.kind === 'user' || principal.connections?.includes('*') === true
}

/**
 * User/role/password administration can otherwise turn a limited token into an administrator login,
 * so only a token holding every permission, connection and namespace may use it.
 */
export function canAdministerUsers(principal: RequestPrincipal): boolean {
  if (principal.kind === 'user') return hasPermission(principal, 'users:manage')
  return INTERNAL_API_PERMISSIONS.every(permission => principal.permissions.includes(permission))
    && SERVICE_KEY_SCOPES.every(scope => principal.scopes.includes(scope))
    && coversAllConnections(principal) && principal.namespaces.includes('*')
}
