import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { AccessTokenPrincipal, SessionPrincipal } from './auth-types.js'
import { requireInternalApiAuthentication } from './internal-api-auth.js'
import { requireInternalApiPermission } from './internal-api-permission-policy.js'
import { getRequestPrincipal, setRequestPrincipal } from './rbac.js'
import { requireSafeOrigin } from './originCheck.js'
import { canAccessConnection, requireConnectionAccess, visibleConnectionIds } from './connection-access.js'
import type { Pool } from 'pg'

const tokenPrincipal: AccessTokenPrincipal = {
  kind: 'service_account', serviceAccountId: 'owner', serviceAccountName: 'Integration', keyId: 'key', keyName: 'Reader',
  tokenName: 'Reader', expiresAt: null, scopes: [], namespaces: [], connections: ['selected'], permissions: ['notes:read'],
}
const session: SessionPrincipal = { kind: 'user', sessionId: 'session', user: {
  id: 'user', username: null, email: null, displayName: 'User', signatureName: 'User', status: 'active',
  roles: ['editor'], permissions: ['storage:read', 'content:write'], mustChangePassword: false, authMethods: ['sso'],
} }

function application(principal = tokenPrincipal) {
  const app = new Hono()
  const sessions = { authenticateSession: vi.fn().mockResolvedValue(session) }
  const authenticateToken = vi.fn().mockResolvedValue(principal)
  // Same order as internal.ts: a browser request is checked for Origin before its session is touched.
  const safeOrigin = requireSafeOrigin(['https://mado.example.test'])
  app.use('*', (c, next) => c.req.header('Authorization') !== undefined ? next() : safeOrigin(c, next))
  app.use('*', requireInternalApiAuthentication({ sessions, authenticateToken, cookieName: 'session', idleSeconds: 300 }))
  app.use('*', requireInternalApiPermission())
  app.get('/api/internal/notes/home', c => c.json({ kind: getRequestPrincipal(c)?.kind }))
  app.put('/api/internal/notes/home', c => c.text('saved'))
  app.post('/api/internal/lineage/curation/runs', c => c.text('registered'))
  app.post('/api/internal/future-feature', c => c.text('new endpoint'))
  app.post('/api/internal/tags', c => c.text('tag created'))
  app.put('/api/internal/storage/selected/tags', c => c.text('tagged'))
  return { app, sessions, authenticateToken }
}

describe('内部APIの認証と権限', () => {
  it('Bearerで読み取り、許可していない書き込みは拒否する', async () => {
    const { app, sessions } = application()
    const headers = { Authorization: 'Bearer valid-token' }
    expect(await (await app.request('/api/internal/notes/home', { headers })).json()).toEqual({ kind: 'service_account' })
    expect((await app.request('/api/internal/notes/home', { method: 'PUT', headers })).status).toBe(403)
    expect(sessions.authenticateSession).not.toHaveBeenCalled()
  })
  it.each(['Basic user', 'Bearer', ''])('Authorizationが不正ならCookieにフォールバックしない: %s', async authorization => {
    const { app, sessions } = application()
    expect((await app.request('/api/internal/notes/home', { headers: { Authorization: authorization, Cookie: 'session=valid' } })).status).toBe(401)
    expect(sessions.authenticateSession).not.toHaveBeenCalled()
  })
  it('無効なBearerと有効なCookieを同時に送っても拒否する', async () => {
    const { app, authenticateToken, sessions } = application()
    authenticateToken.mockResolvedValue(null)
    expect((await app.request('/api/internal/notes/home', { headers: { Authorization: 'Bearer revoked', Cookie: 'session=valid' } })).status).toBe(401)
    expect(sessions.authenticateSession).not.toHaveBeenCalled()
  })
  it('Bearerの書き込みはOrigin不要、Cookieの書き込みは同一Originを要求する', async () => {
    const { app } = application({ ...tokenPrincipal, permissions: ['notes:write'] })
    expect((await app.request('/api/internal/notes/home', { method: 'PUT', headers: { Authorization: 'Bearer valid' } })).status).toBe(200)
    expect((await app.request('/api/internal/notes/home', { method: 'PUT', headers: { Cookie: 'session=valid', Origin: 'https://other.test' } })).status).toBe(403)
    expect((await app.request('/api/internal/notes/home', { method: 'PUT', headers: { Cookie: 'session=valid', Origin: 'https://mado.example.test' } })).status).toBe(200)
  })
  it('別Originからの書き込みは、セッションを確かめる(延長する)前に拒否する', async () => {
    const { app, sessions } = application()
    expect((await app.request('/api/internal/notes/home', { method: 'PUT', headers: { Cookie: 'session=valid', Origin: 'https://other.test' } })).status).toBe(403)
    expect(sessions.authenticateSession).not.toHaveBeenCalled()
  })
  it('全接続に効くタグ定義の変更は全接続のトークンだけに許し、接続ごとのタグ付けは限定トークンにも許す', async () => {
    const headers = { Authorization: 'Bearer valid' }
    const limited = application({ ...tokenPrincipal, permissions: ['tags:write'] }).app
    expect((await limited.request('/api/internal/tags', { method: 'POST', headers })).status).toBe(403)
    expect((await limited.request('/api/internal/storage/selected/tags', { method: 'PUT', headers })).status).toBe(200)
    const unrestricted = application({ ...tokenPrincipal, permissions: ['tags:write'], connections: ['*'] }).app
    expect((await unrestricted.request('/api/internal/tags', { method: 'POST', headers })).status).toBe(200)
  })
  it('認証サービスの障害は503にし、権限表にないAPIはトークンに開放しない', async () => {
    const { app, authenticateToken } = application()
    const headers = { Authorization: 'Bearer valid' }
    expect((await app.request('/api/internal/future-feature', { method: 'POST', headers })).status).toBe(403)
    authenticateToken.mockRejectedValue(new Error('unavailable'))
    expect((await app.request('/api/internal/notes/home', { headers })).status).toBe(503)
  })
  it('ブラウザのDataLineage編集には従来どおり参照と編集の両方を要求する', async () => {
    const { app, sessions } = application()
    const user = { ...session.user, permissions: ['storage:read', 'lineage:curate'] }
    sessions.authenticateSession.mockResolvedValue({ ...session, user })
    const init = { method: 'POST', headers: { Cookie: 'session=valid', Origin: 'https://mado.example.test' } }
    expect((await app.request('/api/internal/lineage/curation/runs', init)).status).toBe(403)
    sessions.authenticateSession.mockResolvedValue({ ...session, user: { ...user, permissions: [...user.permissions, 'lineage:read'] } })
    expect((await app.request('/api/internal/lineage/curation/runs', init)).status).toBe(200)
  })
})

describe('トークンの接続制限', () => {
  it('接続管理権限があっても対象外の接続は公開設定を問わず拒否する', async () => {
    const app = new Hono()
    const pool = { query: vi.fn() } as unknown as Pool
    app.use('*', async (c, next) => { setRequestPrincipal(c, { ...tokenPrincipal, permissions: ['connections:manage'] }); await next() })
    app.use('/connections/:connectionId', requireConnectionAccess(pool))
    // Match the production handlers' parameter name as well as the middleware's.
    app.put('/connections/:id', async c => c.json({ visible: [...(await visibleConnectionIds(pool, c))!] }))
    expect((await app.request('/connections/outside', { method: 'PUT' })).status).toBe(404)
    expect(await (await app.request('/connections/selected', { method: 'PUT' })).json()).toEqual({ visible: ['selected'] })
    expect(pool.query).not.toHaveBeenCalled()
  })
  it('従来の未指定と新規の空選択では内部Storageを参照できない', async () => {
    for (const connections of [null, []]) {
      const app = new Hono()
      const pool = { query: vi.fn() } as unknown as Pool
      app.use('*', async (c, next) => { setRequestPrincipal(c, { ...tokenPrincipal, connections }); await next() })
      app.get('/', async c => c.json({ allowed: await canAccessConnection(pool, c, 'selected') }))
      expect(await (await app.request('/')).json()).toEqual({ allowed: false })
    }
  })
})
