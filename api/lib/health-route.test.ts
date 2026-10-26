import { Hono } from 'hono'
import type { Pool } from 'pg'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HEALTH_QUERY_TIMEOUT_MS, mountHealthRoute } from './health-route.js'

function appWith(query: () => Promise<unknown>): Hono {
  const app = new Hono()
  mountHealthRoute(app, { query } as unknown as Pool)
  return app
}

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /healthz', () => {
  it('DB に届くと 200 と {"status":"ok"} を返す', async () => {
    const query = vi.fn(async () => ({ rows: [] }))
    const response = await appWith(query).request('/healthz')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(query).toHaveBeenCalledWith('SELECT 1')
  })

  it('DB に届かないと 503 と database_unavailable を返す', async () => {
    const response = await appWith(async () => { throw new Error('connect ECONNREFUSED') }).request('/healthz')
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'database is unavailable', code: 'database_unavailable' })
  })

  it('DBが接続を受けたまま応答しないときも、待ち続けずに期限で503を返す', async () => {
    vi.useFakeTimers()
    const pending = appWith(() => new Promise(() => {})).request('/healthz')
    await vi.advanceTimersByTimeAsync(HEALTH_QUERY_TIMEOUT_MS)
    const response = await pending
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'database is unavailable', code: 'database_unavailable' })
  })
})
