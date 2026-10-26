// ユーザー管理の応答: ユーザーの一覧、変更の結果、パスワードの再設定。
import { z } from 'zod'
import { AuthUser } from './auth.js'

export const ManagedUser = AuthUser.extend({ status: z.enum(['active', 'disabled']) })

export const UserList = z.object({
  users: z.array(ManagedUser),
  /** SSO の group から role への対応 (OIDC_ROLE_MAPPING_JSON)。ログインごとに同期する。 */
  ssoRoleMapping: z.record(z.string(), z.enum(['viewer', 'curator', 'operator', 'admin'])),
})

export const UserResponse = z.object({ user: ManagedUser })

export const PasswordResetResult = z.object({
  ok: z.literal(true),
  /** パスワードを指定しなかったときだけ、作った一時パスワードを一度だけ返す。 */
  temporaryPassword: z.string().optional(),
})
