import type { ServiceKeyScope } from './auth-types.js'
import type { InternalApiPermission } from '../shared/access-token-permissions.js'

export interface AccessToken {
  id: string
  name: string
  description: string
  tokenPrefix: string
  scopes: ServiceKeyScope[]
  permissions: InternalApiPermission[]
  connections: string[]
  namespaces: string[]
  status: 'active' | 'disabled' | 'expired'
  createdAt: Date
  expiresAt: Date | null
  regeneratedAt: Date | null
  lastUsedAt: Date | null
  revision: number
}

/** 連携scopeは入力に含めない。権限から決まる。 */
export interface AccessTokenInput {
  name: string
  description: string
  permissions: InternalApiPermission[]
  connections: string[]
  namespaces: string[]
  expiresAt: Date | null
}

export interface AccessTokenPatch extends Partial<AccessTokenInput> {
  status?: 'active' | 'disabled'
}

export interface AccessTokenUpdate {
  accessToken: AccessToken
  changed: boolean
}

export interface AccessTokenNamespaces {
  namespaces: string[]
  sourceStatus: 'ready' | 'unavailable' | 'unconfigured' | 'partial'
}

export interface AccessTokenRow {
  id: string
  service_account_id: string
  name: string
  description: string
  token_prefix: string
  scopes: ServiceKeyScope[]
  permissions: InternalApiPermission[]
  connections: string[]
  namespaces: string[]
  created_at: Date
  expires_at: Date | null
  disabled_at: Date | null
  regenerated_at: Date | null
  last_used_at: Date | null
  revision: number
}
