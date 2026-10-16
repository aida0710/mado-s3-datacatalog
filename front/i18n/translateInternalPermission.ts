import type { InternalApiPermission, InternalApiPermissionGroup } from '../../api/shared/access-token-permissions'
import { internalPermissionAction, internalPermissionActionLabels, internalPermissionGroupLabels } from './internalPermissionOptions'
import { translate } from './translate'

export function translateInternalPermission(permission: InternalApiPermission): string {
  const resource = permission.split(':')[0]
  const group: InternalApiPermissionGroup = resource === 'service_accounts' ? 'accessTokens' : resource as InternalApiPermissionGroup
  return `${translate(internalPermissionGroupLabels[group])}: ${translate(internalPermissionActionLabels[internalPermissionAction(permission)])}`
}
