import { z } from 'zod'
import { SERVICE_KEY_SCOPES } from './auth-types.js'

// Bound request size while preserving the existing namespace contract.
const NAMESPACE_MAX_LENGTH = 512
const NAMESPACE_MAX_COUNT = 128
export const serviceKeyPermissions = z.object({
  scopes: z.array(z.enum(SERVICE_KEY_SCOPES)).min(1).max(SERVICE_KEY_SCOPES.length)
    .refine(scopes => new Set(scopes).size === scopes.length),
  namespaces: z.array(z.string().trim().min(1).max(NAMESPACE_MAX_LENGTH)).max(NAMESPACE_MAX_COUNT)
    .transform(namespaces => [...new Set(namespaces)]).default([]),
}).refine(permissions => {
  const includesLineage = permissions.scopes.some(scope => scope === 'lineage:read' || scope === 'lineage:write')
  return includesLineage ? permissions.namespaces.length > 0 : permissions.namespaces.length === 0
})
