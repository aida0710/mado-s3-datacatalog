import type { Context, MiddlewareHandler, Next } from 'hono'
import type { Capability, ConnectionConfig } from '../storage.js'
import { apiError } from './api-error.js'

export type GetConnectionConfig = (connectionId: string) => Promise<ConnectionConfig>

/** 403 の英語の文に入れる操作の名前 (UI がボタンを隠していても、共有 URL を直に開いた人に理由が見えるように)。
 *  画面は文ではなく応答の `capability` から、自分の言語の名前を選ぶ。 */
export const CAPABILITY_LABELS: Record<Capability, string> = {
  list:             'Bucket and object listing',
  preview:          'File previews',
  download:         'File downloads',
  archive:          'Opening archives',
  audioInfo:        'Audio information',
  audioSpectrogram: 'Spectrograms',
  readmeRead:       'README reading',
  readmeWrite:      'README editing',
}

/**
 * `:connectionId` の接続で `cap` が有効かを確認する Hono ミドルウェア。
 *
 * ルート側のハンドラには一切手を入れず、lib/storage-capability-routes.ts の対応表で
 * パスごとに mount する — 「どのエンドポイントがどの権限に属するか」を 1 箇所で読めるようにするため。
 * mount はルート登録より **前** に行うこと (Hono は登録順に実行する)。
 *
 * 接続設定は storage factory のキャッシュ (S3Client と同じ 1 行) から読むので、
 * 1 リクエスト増えるごとの DB アクセスは発生しない。
 */
export function requireCapability(
  cap: Capability,
  getConnectionConfig: GetConnectionConfig,
): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const connectionId = c.req.param('connectionId')
    if (!connectionId) return c.json(apiError('invalid_request', 'connectionId required'), 400)

    let config: ConnectionConfig
    try {
      config = await getConnectionConfig(connectionId)
    } catch (e) {
      if (e instanceof Error && (e as { code?: string }).code === 'NOT_FOUND') {
        return c.json(apiError('not_found', 'connection not found'), 404)
      }
      throw e
    }

    if (!config.capabilities[cap]) {
      // 403: 認証の失敗 (401) ではなく「この接続では無効にされている」。
      return c.json(
        { ...apiError('capability_disabled', `"${CAPABILITY_LABELS[cap]}" is disabled for this connection`), capability: cap },
        403,
      )
    }
    await next()
  }
}
