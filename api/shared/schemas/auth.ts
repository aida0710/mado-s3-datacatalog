// ログインと自分のアカウントの応答: 使えるログインの方法、ログイン中のユーザー、ログアウトの結果。
import { z } from 'zod'

export const AuthConfig = z.object({
  localEnabled: z.boolean(),
  oidc: z.discriminatedUnion('enabled', [
    z.object({ enabled: z.literal(true), id: z.string(), label: z.string() }),
    z.object({ enabled: z.literal(false) }),
  ]),
})

export const AuthUser = z.object({
  id: z.string().uuid(),
  username: z.string().nullable(),
  email: z.string().nullable(),
  displayName: z.string(),
  /** Notes・README の編集者として残す名前。 */
  signatureName: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  /** 初回ログインやパスワードの再設定の後。変えるまで内部 API は 403 `password_change_required`。 */
  mustChangePassword: z.boolean(),
  authMethods: z.array(z.enum(['local', 'sso'])),
})

export const AuthUserResponse = z.object({ user: AuthUser })

export const LogoutResult = z.object({
  ok: z.literal(true),
  /** SSO でログインしていたとき、IdP 側もログアウトする URL。 */
  logoutUrl: z.string().nullable(),
  /** IdP のログアウトの URL を取れなかった。画面で伝えるために返す。 */
  idpLogoutUnavailable: z.boolean(),
})
