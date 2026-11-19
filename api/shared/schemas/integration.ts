// 連携用の API (/api/mado/) の応答: トークン自身の許可範囲。
import { z } from 'zod'
import { SERVICE_KEY_SCOPES } from '../access-token-permissions.js'

export const IntegrationAccessToken = z.object({
  id: z.string(),
  name: z.string(),
  scopes: z.array(z.enum(SERVICE_KEY_SCOPES)),
  expiresAt: z.string().nullable(),
})
