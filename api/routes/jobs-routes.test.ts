import { createTestAppWithPrincipal } from '../lib/test-fixtures/request-principal.js'
import { describe, expect, it, vi } from 'vitest'
import type { JobStore } from '../lib/jobs.js'
import type { ConnectionConfig } from '../storage.js'
import { mountJobRoutes } from './jobs.js'
import type { RequestPrincipal, AccessTokenPrincipal } from '../lib/auth-types.js'

function job(id: number, connectionId = 'restricted1') {
  return {
    id,
    kind: 'storage.scan',
    dedupKey: 'key',
    status: 'queued' as const,
    attempts: 0,
    payload: { connectionId },
    progress: null,
    result: null,
    error: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    heartbeatAt: null,
    cancelRequested: false,
  }
}

function fixture(canAccess: boolean, { listEnabled = true }: { listEnabled?: boolean } = {}) {
  const row = job(7)
  const store = {
    activeOrLatest: vi.fn().mockResolvedValue(row),
    get: vi.fn().mockResolvedValue(row),
    cancel: vi.fn().mockResolvedValue(true),
  } as unknown as JobStore
  const app = createTestAppWithPrincipal()
  mountJobRoutes(app, {
    store,
    canAccessConnection: vi.fn().mockResolvedValue(canAccess),
    getConnectionConfig: vi.fn().mockResolvedValue({ capabilities: { list: listEnabled } } as ConnectionConfig),
  })
  return { app, store }
}

describe('job routeの接続ホワイトリスト', () => {
  it('非許可のjobはlatestとID参照の両方で404にする', async () => {
    const { app } = fixture(false)
    expect((await app.request('/jobs/latest?kind=storage.scan&dedupKey=key')).status).toBe(404)
    expect((await app.request('/jobs/7')).status).toBe(404)
  })

  it('非許可のjobはキャンセルできない', async () => {
    const { app, store } = fixture(false)
    expect((await app.request('/jobs/7/cancel', { method: 'POST' })).status).toBe(404)
    expect(store.cancel).not.toHaveBeenCalled()
  })

  it('許可されたjobを参照すると内容が返る', async () => {
    const { app } = fixture(true)
    const res = await app.request('/jobs/7')
    expect(res.status).toBe(200)
    expect((await res.json() as { id: number }).id).toBe(7)
  })

  it('「一覧」を無効にした接続の走査結果は、サブディレクトリ名が入るので見せない', async () => {
    const { app } = fixture(true, { listEnabled: false })
    expect((await app.request('/jobs/latest?kind=storage.scan&dedupKey=key')).status).toBe(404)
    expect((await app.request('/jobs/7')).status).toBe(404)
  })
})

describe('接続を持たないjob', () => {
  const token: Omit<AccessTokenPrincipal, 'connections'> = { kind: 'service_account', serviceAccountId: 'owner', serviceAccountName: 'Integration', keyId: 'key',
    keyName: 'Operator', tokenName: 'Operator', expiresAt: null, scopes: [], namespaces: [],
    permissions: ['jobs:read', 'jobs:operate'] }

  function connectionlessFixture(principal: RequestPrincipal | null) {
    const row = { ...job(8), kind: 'pricing.refresh', payload: {} }
    const store = { get: vi.fn().mockResolvedValue(row), cancel: vi.fn().mockResolvedValue(true) } as unknown as JobStore
    const app = createTestAppWithPrincipal(principal)
    mountJobRoutes(app, { store, canAccessConnection: vi.fn().mockResolvedValue(true), getConnectionConfig: vi.fn() })
    return { app, store }
  }

  it('認証主体がなければジョブを参照もキャンセルもできない', async () => {
    const { app, store } = connectionlessFixture(null)
    expect((await app.request('/jobs/8')).status).toBe(404)
    expect((await app.request('/jobs/8/cancel', { method: 'POST' })).status).toBe(404)
    expect(store.cancel).not.toHaveBeenCalled()
  })

  it('接続を限定したトークンには見せず、キャンセルもさせない', async () => {
    const { app, store } = connectionlessFixture({ ...token, connections: ['selected'] })
    expect((await app.request('/jobs/8')).status).toBe(404)
    expect((await app.request('/jobs/8/cancel', { method: 'POST' })).status).toBe(404)
    expect(store.cancel).not.toHaveBeenCalled()
  })

  it('全接続のトークンならジョブを参照できる', async () => {
    expect((await connectionlessFixture({ ...token, connections: ['*'] }).app.request('/jobs/8')).status).toBe(200)
  })
})
