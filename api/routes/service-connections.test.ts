import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { IntegrationConnection } from '../lib/integration-connections.js'
import { mountServiceConnectionsRoutes, type ServiceConnectionsPrincipal } from './service-connections.js'

const bearer = { Authorization: 'Bearer mado_dc_key.secret' }
const onprem: IntegrationConnection = { id: 'connection-a', name: 'onprem s3', provider: 'onprem' }

function appWith(principal: ServiceConnectionsPrincipal | null) {
  const app = new Hono()
  const list = vi.fn(async () => [onprem])
  mountServiceConnectionsRoutes(app, { authenticate: async () => principal, connections: { list } })
  return { app, list }
}

describe('連携先に見せる接続の一覧', () => {
  it('scopeを問わず、トークンに許可した接続のID・名前・種類だけを返し、cacheさせない', async () => {
    const { app } = appWith({ scopes: [], connections: ['*'] })
    const response = await app.request('/connections', { headers: bearer })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ items: [onprem] })
  })

  it('トークンに許可した接続だけを読み、全接続(*)だけを制限なしにする', async () => {
    for (const connections of [['*'], ['connection-a'], []]) {
      const { app, list } = appWith({ scopes: ['metrics:read'], connections })
      expect((await app.request('/connections', { headers: bearer })).status).toBe(200)
      expect(list).toHaveBeenLastCalledWith(connections.includes('*') ? null : new Set(connections))
    }
  })

  it('keyなしと、無効なkeyは401で拒否する', async () => {
    const valid = appWith({ scopes: [], connections: ['*'] })
    expect((await valid.app.request('/connections')).status).toBe(401)
    const invalid = appWith(null)
    expect((await invalid.app.request('/connections', { headers: bearer })).status).toBe(401)
    expect(invalid.list).not.toHaveBeenCalled()
  })
})
