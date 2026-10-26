import { jsonRequestInit } from '@mado/design-system/http'
import { PasswordResetResult, UserList, UserResponse } from '../../../api/shared/schemas/users'
import { OkResult } from './types'
import { API_BASE, requestApi } from './http'

const USERS_PATH = `${API_BASE}/users`
const userPath = (id: string) => `${USERS_PATH}/${encodeURIComponent(id)}`

export interface UserCreateInput {
  username: string
  email: string | null
  displayName: string
  password: string
  roles: string[]
}

export interface UserUpdateInput {
  username: string
  displayName: string
  status: 'active' | 'disabled'
}

// ユーザー管理（Settings > Access > Users）。管理者だけが開くので、キャッシュは持たない。
export const usersClient = {
  users: () => requestApi(USERS_PATH, UserList),

  createUser: (input: UserCreateInput) => requestApi(USERS_PATH, UserResponse, jsonRequestInit('POST', input)),

  updateUser: (id: string, input: UserUpdateInput) => requestApi(userPath(id), UserResponse, jsonRequestInit('PATCH', input)),

  updateUserRoles: (id: string, roles: string[]) =>
    requestApi(`${userPath(id)}/roles`, UserResponse, jsonRequestInit('PUT', { roles })),

  /** パスワードを指定せずに再発行し、作った一時パスワードを受け取る。 */
  resetUserPassword: (id: string) =>
    requestApi(`${userPath(id)}/reset-password`, PasswordResetResult, jsonRequestInit('POST', {})),

  deleteUser: (id: string) => requestApi(userPath(id), OkResult, jsonRequestInit('DELETE')),
}
