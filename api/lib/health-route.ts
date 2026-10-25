import type { Hono } from 'hono'
import type { Pool } from 'pg'
import { apiError } from './api-error.js'

/** `GET /healthz` の成功時の本文。mado ML Tracking と同じ形。 */
export const HEALTHY_BODY = { status: 'ok' } as const

/**
 * コンテナのヘルスチェックが叩く `GET /healthz` を付ける。
 * プロセスが応答できても DB に届かなければ仕事ができないので、DB への問い合わせまで確かめる。
 */
export function mountHealthRoute(app: Hono, pool: Pool): void {
  app.get('/healthz', async c => {
    try {
      await pool.query('SELECT 1')
    } catch {
      return c.json(apiError('database_unavailable', 'database is unavailable'), 503)
    }
    return c.json(HEALTHY_BODY)
  })
}
