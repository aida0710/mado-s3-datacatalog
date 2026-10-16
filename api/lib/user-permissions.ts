import type { InternalApiPermission } from '../shared/access-token-permissions.js'

// Existing browser roles retain their behavior while tokens use individual grants.
const USER_PERMISSION_ALIASES: Partial<Record<InternalApiPermission, string>> = {
  'connections:read': 'storage:read', 'connections:delete': 'connections:manage',
  'readmes:read': 'storage:read', 'readmes:write': 'content:write',
  'notes:read': 'storage:read', 'notes:write': 'content:write',
  'tags:read': 'storage:read', 'tags:write': 'content:write', 'tags:delete': 'content:write',
  'favorites:read': 'storage:read', 'favorites:write': 'content:write', 'favorites:delete': 'content:write',
  'jobs:read': 'storage:read', 'capacity:read': 'storage:read', 'capacity:operate': 'connections:manage',
  'pricing:read': 'storage:read', 'pricing:refresh': 'jobs:operate',
  'settings:read': 'storage:read', 'users:read': 'users:manage',
  'service_accounts:read': 'service_accounts:manage',
  'lineage:send': 'lineage:curate',
}

export function userHasPermission(permissions: readonly string[], permission: string): boolean {
  return permissions.includes(permission)
    || permissions.includes(USER_PERMISSION_ALIASES[permission as InternalApiPermission] ?? permission)
}
