import { isUnauthorizedError, jsonRequestInit } from '@mado/design-system/http'
import { AuthConfig, AuthUserResponse, LogoutResult } from '../../../api/shared/schemas/auth'
import { OkResult } from './types'
import { requestApi, requestAuthApi } from './http'

export interface ProfileInput {
  displayName: string
  username: string
  signatureName: string
}

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
}

// ログインと自分のアカウント（/api/auth）。ログイン・sessionの確認・ログアウトは401を自分で扱うので
// requestAuthApi、ログインした後の変更はsessionの後ろにあるのでrequestApiを使う。
export const authClient = {
  config: () => requestAuthApi('/api/auth/config', AuthConfig),

  /** 今のsessionのUser。sessionが無い・切れていればnull。 */
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
