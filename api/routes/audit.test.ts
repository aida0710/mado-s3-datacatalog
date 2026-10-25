import { Hono } from 'hono'
import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { setSessionPrincipal } from '../lib/rbac.js'
import { encodePageCursor } from '../lib/page-cursor.js'
import { mountAuditRoutes, ROUTINE_AUDIT_ACTIONS } from './audit.js'

const admin = {
  id: '00000000-0000-4000-8000-000000000001', username: 'admin', email: null,
  displayName: 'Admin', signatureName: 'Admin', status: 'active' as const,
  roles: ['admin'], permissions: ['audit:read'], mustChangePassword: false,
}

function appWith(query: ReturnType<typeof vi.fn>): Hono {
  const app = new Hono()
  app.use('*', async (c, next) => {
    setSessionPrincipal(c, { kind: 'user', sessionId: 'session', user: admin })
    await next()
  })
  mountAuditRoutes(app, { pool: { query } as unknown as Pool })
  return app
}

describe('監査ログ route', () => {
  it('通常一覧を成功した変更だけへ限定する', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] })
    const app = appWith(query)

    const response = await app.request('/audit-events?limit=30')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ events: [], nextCursor: null })

    const [sql, values] = query.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('NOT (e.action = ANY($1::text[]))')
    expect(sql).toContain("e.outcome = 'success'")
    expect(values).toEqual([[...ROUTINE_AUDIT_ACTIONS], 31])
  })

  it('続きがあれば最後の行より古いものを指す cursor を返し、その cursor で次を読む', async () => {
    const rows = [{ id: '30' }, { id: '29' }, { id: '28' }]
    const query = vi.fn().mockResolvedValueOnce({ rows }).mockResolvedValueOnce({ rows: [] })
    const app = appWith(query)

    const first = await (await app.request('/audit-events?limit=2')).json() as { events: unknown[]; nextCursor: string }
    expect(first.events).toEqual(rows.slice(0, 2))
    expect(first.nextCursor).toBe(encodePageCursor({ beforeId: 29 }))

    await app.request(`/audit-events?limit=2&cursor=${first.nextCursor}`)
    const [sql, values] = query.mock.calls[1] as [string, unknown[]]
    expect(sql).toContain('e.id < $2')
    expect(values).toEqual([[...ROUTINE_AUDIT_ACTIONS], 29, 3])
  })

  it('読めない cursor は 400 invalid_cursor', async () => {
    const query = vi.fn()
    const response = await appWith(query).request('/audit-events?cursor=not-a-cursor')
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'invalid_cursor' })
    expect(query).not.toHaveBeenCalled()
  })

  it('成功以外のoutcome filterを受け付けない', async () => {
    const query = vi.fn()
    const app = appWith(query)
    expect((await app.request('/audit-events?outcome=failure')).status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })
})
