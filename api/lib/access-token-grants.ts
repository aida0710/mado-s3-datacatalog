import { z } from 'zod'
import { CONNECTION_PERMISSIONS, INTERNAL_API_PERMISSIONS } from '../shared/access-token-permissions.js'
import { SERVICE_KEY_SCOPES } from './auth-types.js'
import { serviceKeyPermissions } from './service-key-permissions.js'

// Match the maximum list length already used by namespace grants.
const RESOURCE_GRANT_LIMIT = 128
// Allow external connection identifiers while bounding each grant's stored size.
const CONNECTION_ID_MAX_LENGTH = 128
export const internalPermissions = z.array(z.enum(INTERNAL_API_PERMISSIONS)).max(INTERNAL_API_PERMISSIONS.length)
  .refine(values => new Set(values).size === values.length)
export const tokenConnections = z.array(z.string().trim().min(1).max(CONNECTION_ID_MAX_LENGTH)).max(RESOURCE_GRANT_LIMIT)
  .transform(values => [...new Set(values)])
  .refine(values => !values.includes('*') || values.length === 1)

export const accessTokenGrants = z.object({
  scopes: z.array(z.enum(SERVICE_KEY_SCOPES)).max(SERVICE_KEY_SCOPES.length)
    .refine(values => new Set(values).size === values.length).default([]),
  permissions: internalPermissions.default([]),
  namespaces: serviceKeyPermissions.shape.namespaces,
  connections: tokenConnections.nullable().default(null),
}).refine(grants => grants.scopes.length + grants.permissions.length > 0)
  .refine(grants => {
    const lineage = grants.scopes.some(scope => scope.startsWith('lineage:'))
      || grants.permissions.some(permission => permission.startsWith('lineage:'))
    return lineage ? grants.namespaces.length > 0 : grants.namespaces.length === 0
  })
  .refine(grants => !grants.permissions.some(permission => CONNECTION_PERMISSIONS.includes(permission))
    || (grants.connections !== null && grants.connections.length > 0))
  .refine(grants => !grants.scopes.includes('metrics:read') || grants.connections === null || grants.connections.length > 0)
