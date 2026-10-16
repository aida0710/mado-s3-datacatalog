import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { canAccessConnection, connectionIdsForPrincipal, managesConnections } from './connection-access.js'
import { createTestAppWithPrincipal, testPrincipal } from './test-fixtures/request-principal.js'

describe('接続へのアクセス', () => {
  it('認証主体がなければ接続を管理・参照できない', async () => {
    const query = vi.fn()
    const pool = { query } as unknown as Pool
    const app = createTestAppWithPrincipal(null)
    app.get('/', async c => c.json({
      manages: managesConnections(c), canAccess: await canAccessConnection(pool, c, 'connection'),
      visible: [...(await connectionIdsForPrincipal(pool, null))!],
    }))
    expect(await (await app.request('/')).json()).toEqual({ manages: false, canAccess: false, visible: [] })
    expect(query).not.toHaveBeenCalled()
  })

  it('管理権限があってもトークンの接続指定を越えて参照できない', async () => {
    const pool = { query: vi.fn() } as unknown as Pool
    const principal = { ...testPrincipal(), connections: ['allowed'] }
    const app = createTestAppWithPrincipal(principal)
    app.get('/:id', async c => c.json({ canAccess: await canAccessConnection(pool, c, c.req.param('id')) }))
    expect(await (await app.request('/allowed')).json()).toEqual({ canAccess: true })
    expect(await (await app.request('/hidden')).json()).toEqual({ canAccess: false })
    expect(await connectionIdsForPrincipal(pool, principal)).toEqual(new Set(['allowed']))
  })
})
