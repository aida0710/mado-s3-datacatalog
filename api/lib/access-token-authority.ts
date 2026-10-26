import type { AccessTokenInput } from './access-token-types.js'
import type { RequestPrincipal } from './auth-types.js'
import { hasPermission } from './auth-types.js'
import { INTERNAL_API_PERMISSIONS } from '../shared/access-token-permissions.js'

type TokenGrants = Pick<AccessTokenInput, 'permissions' | 'namespaces' | 'connections'> & { expiresAt?: Date | null }

function includesTargets(allowed: readonly string[], requested: readonly string[]): boolean {
  return allowed.includes('*') || requested.every(value => allowed.includes(value))
}

/** 有効期限も許可の一部。トークンは、自分より長く有効なトークンを作ったり管理したりしてはならない。 */
function endsWithin(allowed: Date | null, requested: Date | null | undefined): boolean {
  if (allowed === null) return true
  return requested != null && requested.getTime() <= allowed.getTime()
}

/**
 * 呼び出し元がこの権限と対象を与えてよいか。連携scopeは権限から決まるので、
 * 別に確かめる必要は無い。
 */
export function canDelegateToken(principal: RequestPrincipal, grants: TokenGrants): boolean {
  if (!grants.permissions.every(permission => hasPermission(principal, permission))) return false
  if (principal.kind === 'user') return !grants.connections.includes('*') || hasPermission(principal, 'connections:manage')
  // 権限が必要としない対象も確かめる。DataLineageは保存場所の逆引きに接続を使う。
  return includesTargets(principal.namespaces, grants.namespaces)
    && includesTargets(principal.connections, grants.connections)
    && endsWithin(principal.expiresAt, grants.expiresAt)
}

/** 1つの接続に結び付かない操作のため。トークンで使うには、全接続を持っている必要がある。 */
export function coversAllConnections(principal: RequestPrincipal): boolean {
  return principal.kind === 'user' || principal.connections.includes('*')
}

/**
 * ユーザー・ロール・パスワードの管理を許すと、制限したトークンから管理者のログインを作れてしまう。
 * そのため、すべての権限・接続・Namespaceを持つトークンにだけ許す。
 */
export function canAdministerUsers(principal: RequestPrincipal): boolean {
  if (principal.kind === 'user') return hasPermission(principal, 'users:manage')
  return INTERNAL_API_PERMISSIONS.every(permission => principal.permissions.includes(permission))
    && coversAllConnections(principal) && principal.namespaces.includes('*')
}
