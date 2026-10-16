import type { InternalApiPermissionGroup, InternalApiPermission } from '../../api/shared/access-token-permissions'

export const internalPermissionGroupLabels = {
  storage: 'tokenPermissions.group.storage', connections: 'tokenPermissions.group.connections',
  readmes: 'tokenPermissions.group.readmes', notes: 'tokenPermissions.group.notes',
  tags: 'tokenPermissions.group.tags', favorites: 'tokenPermissions.group.favorites',
  lineage: 'tokenPermissions.group.lineage', jobs: 'tokenPermissions.group.jobs',
  capacity: 'tokenPermissions.group.capacity', pricing: 'tokenPermissions.group.pricing',
  settings: 'tokenPermissions.group.settings', users: 'tokenPermissions.group.users',
  accessTokens: 'tokenPermissions.group.accessTokens', audit: 'tokenPermissions.group.audit',
} as const satisfies Record<InternalApiPermissionGroup, string>

export const internalPermissionActionLabels = {
  read: 'tokenPermissions.action.read', write: 'tokenPermissions.action.write',
  delete: 'tokenPermissions.action.delete', manage: 'tokenPermissions.action.manage',
  curate: 'tokenPermissions.action.curate', operate: 'tokenPermissions.action.operate',
  refresh: 'tokenPermissions.action.refresh',
  send: 'tokenPermissions.action.send',
} as const

export function internalPermissionAction(permission: InternalApiPermission) {
  return permission.split(':')[1] as keyof typeof internalPermissionActionLabels
}
