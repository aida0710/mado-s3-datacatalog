import { INTERNAL_API_PERMISSIONS } from '../../api/shared/access-token-permissions'
import type { InternalApiPermission } from '../types/accessTokens'

export const ACCESS_TOKEN_PRESETS = ['none', 'readOnly', 'all', 'mlTracking', 'capacity'] as const
export type AccessTokenPreset = typeof ACCESS_TOKEN_PRESETS[number]

export function accessTokenPreset(preset: AccessTokenPreset): InternalApiPermission[] {
  switch (preset) {
    case 'none': return []
    case 'readOnly': return INTERNAL_API_PERMISSIONS.filter(permission => permission.endsWith(':read'))
    case 'all': return [...INTERNAL_API_PERMISSIONS]
    case 'mlTracking': return ['lineage:read', 'lineage:send']
    case 'capacity': return ['connections:read', 'capacity:read']
  }
}
