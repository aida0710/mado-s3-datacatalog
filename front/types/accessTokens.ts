import type { InternalApiPermission, ServiceKeyScope } from '../../api/shared/access-token-permissions'
export type { InternalApiPermission } from '../../api/shared/access-token-permissions'

export type AccessTokenScope = ServiceKeyScope

export interface AccessToken {
  id: string
  name: string
  description: string
  tokenPrefix: string
  scopes: AccessTokenScope[]
  permissions: InternalApiPermission[]
  connections: string[] | null
  namespaces: string[]
  status: 'active' | 'disabled' | 'expired'
  createdAt: string
  expiresAt: string | null
  regeneratedAt: string | null
  lastUsedAt: string | null
  revision: number
}

export interface AccessTokenInput {
  name: string
  description: string
  scopes?: AccessTokenScope[]
  permissions?: InternalApiPermission[]
  connections?: string[] | null
  namespaces: string[]
  expiresAt?: string | null
}

export interface AccessTokenSecret {
  label: string
  value: string
}

export type AccessTokenDialog = { type: 'create' }
  | { type: 'edit' | 'regenerate' | 'delete'; token: AccessToken }
