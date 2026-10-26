import { jsonRequestInit } from '@mado/design-system/http'
import { AuthConfig, AuthUserResponse, LogoutResult } from '../../../api/shared/schemas/auth'
import { OkResult } from './types'
import { isUnauthorizedError, requestApi, requestAuthApi } from './http'

export interface ProfileInput {
  displayName: string
  username: string
  signatureName: string
}

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
}

// ログインと自分のアカウント (/api/auth)。ログイン・session の確認・ログアウトは 401 を自分で扱うので
// requestAuthApi、ログインした後の変更は session の後ろにあるので requestApi を使う。
export const authClient = {
  config: () => requestAuthApi('/api/auth/config', AuthConfig),

  /** 今の session の User。session が無い・切れていれば null。 */
  currentUser: async () => {
    try {
      return (await requestAuthApi('/api/auth/me', AuthUserResponse)).user
    } catch (failure) {
      if (isUnauthorizedError(failure)) return null
      throw failure
    }
  },

  login: (identifier: string, password: string) =>
    requestAuthApi('/api/auth/local/login', AuthUserResponse, jsonRequestInit('POST', { identifier, password })),

  logout: () => requestAuthApi('/api/auth/logout', LogoutResult, jsonRequestInit('POST')),

  updateProfile: (input: ProfileInput) => requestApi('/api/auth/profile', AuthUserResponse, jsonRequestInit('PUT', input)),

  changePassword: (input: PasswordChangeInput) =>
    requestApi('/api/auth/change-password', OkResult, jsonRequestInit('POST', input)),
}
