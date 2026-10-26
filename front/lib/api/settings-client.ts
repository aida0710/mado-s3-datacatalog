import type { z } from 'zod'
import { jsonRequestInit } from '@mado/design-system/http'
import { AppSettings, OkResult } from './types'
import { API_BASE, requestApi } from './http'

// アプリ全体の設定。個別キーではなく全件を 1 回で取る (設定が増えても
// 画面表示時のラウンドトリップを増やさないため)。キャッシュは持たない —
// Settings で切り替えた結果が次の画面遷移で即反映されてほしいので。
export const settingsClient = {
  settings: (): Promise<z.infer<typeof AppSettings>> => requestApi(`${API_BASE}/settings`, AppSettings),

  putSetting: async (key: string, value: string): Promise<void> => {
    await requestApi(`${API_BASE}/settings/${encodeURIComponent(key)}`, OkResult, jsonRequestInit('PUT', { value }))
  },
}
