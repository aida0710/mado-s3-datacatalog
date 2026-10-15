import { INTERNAL_API_PERMISSIONS, SERVICE_KEY_SCOPES } from '../../api/shared/access-token-permissions'
import type { AccessTokenScope, InternalApiPermission } from '../types/accessTokens'

export const ACCESS_TOKEN_PRESETS = ['none', 'readOnly', 'all', 'mlTracking', 'capacity'] as const
export type AccessTokenPreset = typeof ACCESS_TOKEN_PRESETS[number]

export function accessTokenPreset(preset: AccessTokenPreset): { permissions: InternalApiPermission[]; scopes: AccessTokenScope[] } {
  switch (preset) {
    case 'none': return { permissions: [], scopes: [] }
    case 'readOnly': return { permissions: INTERNAL_API_PERMISSIONS.filter(permission => permission.endsWith(':read')), scopes: [] }
    case 'all': return { permissions: [...INTERNAL_API_PERMISSIONS], scopes: [...SERVICE_KEY_SCOPES] }
    case 'mlTracking': return { permissions: [], scopes: ['lineage:read', 'lineage:write'] }
    case 'capacity': return { permissions: ['connections:read', 'capacity:read'], scopes: ['metrics:read'] }
  }
}
