// Permission IDs are shared by the API contract and the token editor.
// Existing integration scopes stay independent from internal API permissions.
export const SERVICE_KEY_SCOPES = ['lineage:write', 'lineage:read', 'metrics:read'] as const
export type ServiceKeyScope = typeof SERVICE_KEY_SCOPES[number]

export const INTERNAL_API_PERMISSION_GROUPS = {
  storage: ['storage:read'],
  connections: ['connections:read', 'connections:manage', 'connections:delete'],
  readmes: ['readmes:read', 'readmes:write'],
  notes: ['notes:read', 'notes:write'],
  tags: ['tags:read', 'tags:write', 'tags:delete'],
  favorites: ['favorites:read', 'favorites:write', 'favorites:delete'],
  lineage: ['lineage:read', 'lineage:curate'],
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

export const CONNECTION_PERMISSIONS: readonly InternalApiPermission[] = [
  'storage:read', 'connections:read', 'connections:manage', 'connections:delete',
  'readmes:read', 'readmes:write', 'favorites:read', 'favorites:write', 'favorites:delete',
  'tags:read', 'tags:write', 'tags:delete',
  'jobs:read', 'jobs:operate', 'capacity:read', 'capacity:operate', 'pricing:read',
]

export function isInternalApiPermission(value: string): value is InternalApiPermission {
  return INTERNAL_API_PERMISSIONS.includes(value as InternalApiPermission)
}
