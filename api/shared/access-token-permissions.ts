// Feature permissions are shared by the API contract and the token editor.
// Legacy scopes remain a storage/protocol detail for existing API clients.
export const SERVICE_KEY_SCOPES = ['lineage:write', 'lineage:read', 'metrics:read'] as const
export type ServiceKeyScope = typeof SERVICE_KEY_SCOPES[number]

export const INTERNAL_API_PERMISSION_GROUPS = {
  storage: ['storage:read'],
  connections: ['connections:read', 'connections:manage', 'connections:delete'],
  readmes: ['readmes:read', 'readmes:write'],
  notes: ['notes:read', 'notes:write'],
  tags: ['tags:read', 'tags:write', 'tags:delete'],
  favorites: ['favorites:read', 'favorites:write', 'favorites:delete'],
  lineage: ['lineage:read', 'lineage:send', 'lineage:curate'],
  jobs: ['jobs:read', 'jobs:operate'],
  capacity: ['capacity:read', 'capacity:operate'],
  pricing: ['pricing:read', 'pricing:refresh'],
  settings: ['settings:read', 'settings:manage'],
  users: ['users:read', 'users:manage'],
  accessTokens: ['service_accounts:read', 'service_accounts:manage'],
  audit: ['audit:read'],
} as const

export type InternalApiPermissionGroup = keyof typeof INTERNAL_API_PERMISSION_GROUPS
export type InternalApiPermission = typeof INTERNAL_API_PERMISSION_GROUPS[InternalApiPermissionGroup][number]
export const INTERNAL_API_PERMISSIONS = Object.values(INTERNAL_API_PERMISSION_GROUPS).flat() as InternalApiPermission[]

const LEGACY_SCOPE_PERMISSIONS = {
  'lineage:write': 'lineage:send',
  'lineage:read': 'lineage:read',
  'metrics:read': 'capacity:read',
} as const satisfies Record<ServiceKeyScope, InternalApiPermission>

export function serviceKeyScopesForPermissions(permissions: readonly InternalApiPermission[]): ServiceKeyScope[] {
  return SERVICE_KEY_SCOPES.filter(scope => permissions.includes(LEGACY_SCOPE_PERMISSIONS[scope]))
}

/** Project old grants for display only; saving metadata must not upgrade a legacy token. */
export function displayedTokenPermissions(grants: {
  permissions: readonly InternalApiPermission[]
  scopes: readonly ServiceKeyScope[]
}): InternalApiPermission[] {
  return [...new Set([...grants.permissions, ...grants.scopes.map(scope => LEGACY_SCOPE_PERMISSIONS[scope])])]
}

export const CONNECTION_PERMISSIONS: readonly InternalApiPermission[] = [
  'storage:read', 'connections:read', 'connections:manage', 'connections:delete',
  'readmes:read', 'readmes:write', 'favorites:read', 'favorites:write', 'favorites:delete',
  'tags:read', 'tags:write', 'tags:delete',
  'jobs:read', 'jobs:operate', 'capacity:read', 'capacity:operate', 'pricing:read',
]

export function isInternalApiPermission(value: string): value is InternalApiPermission {
  return INTERNAL_API_PERMISSIONS.includes(value as InternalApiPermission)
}
