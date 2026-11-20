// 連携用の API (/api/mado/) の応答: トークン自身の許可範囲と、トークンに許可した接続。
import { z } from 'zod'
import { SERVICE_KEY_SCOPES } from '../access-token-permissions.js'
import { Provider } from './connections.js'

export const IntegrationAccessToken = z.object({
  id: z.string(),
  name: z.string(),
  scopes: z.array(z.enum(SERVICE_KEY_SCOPES)),
  expiresAt: z.string().nullable(),
})

export const IntegrationConnections = z.object({
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    /** ストレージの種類。接続の設定か、エンドポイントからの判定。 */
    provider: Provider,
  })),
})
