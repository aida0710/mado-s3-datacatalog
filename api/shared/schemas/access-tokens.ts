// アクセストークンの管理 API の応答: トークンの情報、発行・再発行の結果、Namespace の候補。
import { z } from 'zod'
import { INTERNAL_API_PERMISSIONS, SERVICE_KEY_SCOPES } from '../access-token-permissions.js'

export const AccessToken = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  /** 値の前の部分 (mado_dc_<16桁>)。一覧にも出る公開の識別子で、再発行しても変わらない。 */
  tokenPrefix: z.string(),
  /** 連携 API (/api/mado/、OpenLineage) が確かめる scope。permissions から決まる。 */
  scopes: z.array(z.enum(SERVICE_KEY_SCOPES)),
  permissions: z.array(z.enum(INTERNAL_API_PERMISSIONS)),
  /** 許可する接続の ID。全接続は ["*"]。 */
  connections: z.array(z.string()),
  namespaces: z.array(z.string()),
  status: z.enum(['active', 'disabled', 'expired']),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  regeneratedAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  revision: z.number().int().positive(),
})
export type AccessToken = z.infer<typeof AccessToken>

export const AccessTokenList = z.object({ tokens: z.array(AccessToken) })

/** 作成・再発行の応答。秘密の値 token はこの応答にだけ含める。 */
export const IssuedAccessToken = z.object({ accessToken: AccessToken, token: z.string() })

/** 変更・削除の応答。 */
export const ChangedAccessToken = z.object({ accessToken: AccessToken })

export const AccessTokenNamespaces = z.object({
  namespaces: z.array(z.string()),
  /** 取得元の状態。取得元が止まっていても、取れた名前と既存トークンの名前は返す。 */
  sourceStatus: z.enum(['ready', 'unavailable', 'unconfigured', 'partial']),
})
