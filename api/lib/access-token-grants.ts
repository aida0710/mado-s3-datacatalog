import { z } from 'zod'
import { CONNECTION_PERMISSIONS, INTERNAL_API_PERMISSIONS } from '../shared/access-token-permissions.js'

// 許可の一覧ごとに、保存する量を抑える。128件は実際のどのトークンよりもはるかに多い。
const RESOURCE_GRANT_LIMIT = 128
// 外部の接続IDも受け付けつつ、許可1件ごとに保存する量を抑える。
const CONNECTION_ID_MAX_LENGTH = 128
// DataLineageのNamespaceはURIなので、Namespaceの一覧と同じ上限で抑える。
export const NAMESPACE_MAX_LENGTH = 512

export const internalPermissions = z.array(z.enum(INTERNAL_API_PERMISSIONS)).min(1).max(INTERNAL_API_PERMISSIONS.length)
  .refine(values => new Set(values).size === values.length)
export const tokenConnections = z.array(z.string().trim().min(1).max(CONNECTION_ID_MAX_LENGTH)).max(RESOURCE_GRANT_LIMIT)
  .transform(values => [...new Set(values)])
  .refine(values => !values.includes('*') || values.length === 1)
export const tokenNamespaces = z.array(z.string().trim().min(1).max(NAMESPACE_MAX_LENGTH)).max(RESOURCE_GRANT_LIMIT)
  .transform(values => [...new Set(values)])

/** トークンができる操作と、その対象のNamespace・接続。連携scopeはここから決まる。 */
export const accessTokenGrants = z.object({
  permissions: internalPermissions,
  namespaces: tokenNamespaces.default([]),
  connections: tokenConnections.default([]),
}).refine(grants => {
  const lineage = grants.permissions.some(permission => permission.startsWith('lineage:'))
  return lineage ? grants.namespaces.length > 0 : grants.namespaces.length === 0
}).refine(grants => !grants.permissions.some(permission => CONNECTION_PERMISSIONS.includes(permission))
  || grants.connections.length > 0)
