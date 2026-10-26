import type { Hono } from 'hono'
import type { Pool } from 'pg'
import { apiError } from './api-error.js'

/** `GET /healthz` の成功時の本文。mado ML Tracking と同じ形。 */
export const HEALTHY_BODY = { status: 'ok' } as const

// DBが接続を受けたまま応答しない（止めた・固まった）ときも、待ち続けずに503を返す。
// composeのhealthcheckはscripts/healthcheck.tsが2秒で打ち切るので、それより短くして503の本文を返せるようにする。
export const HEALTH_QUERY_TIMEOUT_MS = 1_500

/**
 * コンテナのヘルスチェックが叩く `GET /healthz` を付ける。
 * プロセスが応答できても DB に届かなければ仕事ができないので、DB への問い合わせまで確かめる。
 */
export function mountHealthRoute(app: Hono, pool: Pool): void {
  app.get('/healthz', async c => {
    try {
      await queryWithin(pool, HEALTH_QUERY_TIMEOUT_MS)
    } catch {
      return c.json(apiError('database_unavailable', 'database is unavailable'), 503)
    }
    return c.json(HEALTHY_BODY)
  })
}

// 期限を過ぎても問い合わせ自体はpoolに残り、DBが戻れば終わって接続を返す。ここでは応答を待たないだけにする。
async function queryWithin(pool: Pool, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no response from the database within ${timeoutMs} ms`)), timeoutMs)
  })
  try {
    await Promise.race([pool.query('SELECT 1'), deadline])
  } finally {
    clearTimeout(timer)
  }
}
