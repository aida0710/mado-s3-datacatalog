import type { ServiceKeyScope } from './auth-types.js'

export interface AccessToken {
  id: string
  name: string
  description: string
  tokenPrefix: string
  scopes: ServiceKeyScope[]
  namespaces: string[]
  status: 'active' | 'disabled' | 'expired'
  createdAt: Date
  expiresAt: Date | null
  regeneratedAt: Date | null
  lastUsedAt: Date | null
  revision: number
}

export interface AccessTokenInput {
  name: string
  description: string
  scopes: ServiceKeyScope[]
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

export interface AccessTokenRow {
  id: string
  service_account_id: string
  account_status: 'active' | 'disabled'
  name: string
  description: string
  token_prefix: string
  scopes: ServiceKeyScope[]
  namespaces: string[]
  created_at: Date
  expires_at: Date | null
  disabled_at: Date | null
  regenerated_at: Date | null
  last_used_at: Date | null
  revision: number
}
