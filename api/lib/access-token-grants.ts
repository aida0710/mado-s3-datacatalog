import { z } from 'zod'
import { CONNECTION_PERMISSIONS, INTERNAL_API_PERMISSIONS } from '../shared/access-token-permissions.js'

// Bound each grant list's stored size; 128 entries is far beyond any real token.
const RESOURCE_GRANT_LIMIT = 128
// Allow external connection identifiers while bounding each grant's stored size.
const CONNECTION_ID_MAX_LENGTH = 128
// DataLineage namespaces are URIs; bound them like the namespace catalog does.
export const NAMESPACE_MAX_LENGTH = 512

export const internalPermissions = z.array(z.enum(INTERNAL_API_PERMISSIONS)).min(1).max(INTERNAL_API_PERMISSIONS.length)
  .refine(values => new Set(values).size === values.length)
export const tokenConnections = z.array(z.string().trim().min(1).max(CONNECTION_ID_MAX_LENGTH)).max(RESOURCE_GRANT_LIMIT)
  .transform(values => [...new Set(values)])
  .refine(values => !values.includes('*') || values.length === 1)
export const tokenNamespaces = z.array(z.string().trim().min(1).max(NAMESPACE_MAX_LENGTH)).max(RESOURCE_GRANT_LIMIT)
  .transform(values => [...new Set(values)])

/** What a token may do and on which namespaces and connections; integration scopes derive from it. */
export const accessTokenGrants = z.object({
  permissions: internalPermissions,
  namespaces: tokenNamespaces.default([]),
  connections: tokenConnections.default([]),
}).refine(grants => {
  const lineage = grants.permissions.some(permission => permission.startsWith('lineage:'))
  return lineage ? grants.namespaces.length > 0 : grants.namespaces.length === 0
}).refine(grants => !grants.permissions.some(permission => CONNECTION_PERMISSIONS.includes(permission))
  || grants.connections.length > 0)
