import { jsonRequestInit } from '@mado/design-system/http'
import { Connection, ConnectionAccessUsers, ConnectionList, OkResult } from './types'
import type { ConnectionCreateInput, ConnectionUpdateInput } from './types'
import { API_BASE, requestApi } from './http'

const connectionPath = (id: string) => `${API_BASE}/connections/${encodeURIComponent(id)}`

// 接続 (S3 互換ストレージ) の登録。一覧はキャッシュ層を通さないので、
// 変更後は再取得するだけで最新が見える。
export const connectionsClient = {
  listConnections: () => requestApi(`${API_BASE}/connections`, ConnectionList),

  listConnectionAccessUsers: () =>
    requestApi(`${API_BASE}/connections/access-users`, ConnectionAccessUsers),

  createConnection: (input: ConnectionCreateInput) =>
    requestApi(`${API_BASE}/connections`, Connection, jsonRequestInit('POST', input)),

  updateConnection: (id: string, input: ConnectionUpdateInput) =>
    requestApi(connectionPath(id), Connection, jsonRequestInit('PUT', input)),

  deleteConnection: (id: string) =>
    requestApi(connectionPath(id), OkResult, jsonRequestInit('DELETE')),

  setDefaultConnection: async (id: string): Promise<void> => {
    await requestApi(`${connectionPath(id)}/default`, OkResult, jsonRequestInit('PUT'))
  },
}
