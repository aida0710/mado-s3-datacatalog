import type { InternalApiPermission, ServiceKeyScope } from '../../api/shared/access-token-permissions'
export type { InternalApiPermission } from '../../api/shared/access-token-permissions'

export type AccessTokenScope = ServiceKeyScope

import type { AccessToken } from '../../api/shared/schemas/access-tokens'
export type { AccessToken }

export interface AccessTokenInput {
  name: string
  description: string
  permissions: InternalApiPermission[]
  connections: string[]
  namespaces: string[]
  expiresAt?: string | null
}

export interface AccessTokenSecret {
  label: string
  value: string
}

export type AccessTokenDialog = { type: 'create' }
  | { type: 'edit' | 'regenerate' | 'delete'; token: AccessToken }
