import type { InternalApiPermission } from '../shared/access-token-permissions.js'
import { userHasPermission } from './user-permissions.js'
export { SERVICE_KEY_SCOPES } from '../shared/access-token-permissions.js'
export type { ServiceKeyScope } from '../shared/access-token-permissions.js'

export type UserStatus = 'active' | 'disabled'

export interface AuthUser {
  id: string
  username: string | null
  email: string | null
  displayName: string
  signatureName: string
  status: UserStatus
  roles: string[]
  permissions: string[]
  mustChangePassword: boolean
  authMethods: Array<'local' | 'sso'>
}

export interface SessionPrincipal {
  kind: 'user'
  sessionId: string
  user: AuthUser
}

export interface ServicePrincipal {
  kind: 'service_account'
  serviceAccountId: string
  serviceAccountName: string
  keyId: string
  keyName: string
  scopes: string[]
  namespaces: string[]
  expiresAt: Date | null
}

export interface AccessTokenPrincipal extends ServicePrincipal {
  permissions: InternalApiPermission[]
  /** トークンが使える接続ID。['*']は全接続。 */
  connections: string[]
  tokenName: string
}

export type RequestPrincipal = SessionPrincipal | AccessTokenPrincipal

export interface RequestMetadata {
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

// HTTPS のときだけ __Host- を付ける。__Host- の cookie は Secure が必須で、HTTP では送られないため。
export function sessionCookieName(secure: boolean): string {
  return secure ? '__Host-mado_session' : 'mado_session'
}

/** SSO の login を開始した browser と callback を結ぶ cookie。 */
export function oidcTransactionCookieName(secure: boolean): string {
  return secure ? '__Host-mado_oidc_tx' : 'mado_oidc_tx'
}

export function hasPermission(principal: RequestPrincipal, permission: string): boolean {
  return principal.kind === 'user'
    ? userHasPermission(principal.user.permissions, permission)
    : principal.permissions.includes(permission as InternalApiPermission)
}
