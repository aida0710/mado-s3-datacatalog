import { Hono } from 'hono'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { closePools, createPools } from '../db.js'
import { createUserStore } from '../lib/auth-user-store.js'
import { createServiceKeyAuthenticator } from '../lib/service-key-authenticator.js'
import { AccessTokenActorInactiveError, AccessTokenPermissionsError, createAccessTokenStore } from '../lib/access-token-store.js'
import { createInternalTokenAuthenticator } from '../lib/internal-token-authenticator.js'
import { requireInternalApiAuthentication } from '../lib/internal-api-auth.js'
import { requireInternalApiPermission } from '../lib/internal-api-permission-policy.js'
import { createAuditWriter } from '../lib/audit.js'
import { auditActivity } from '../lib/audit-activity.js'
import { requireConnectionAccess } from '../lib/connection-access.js'
import { INTERNAL_API_PERMISSIONS } from '../shared/access-token-permissions.js'
import type { AccessTokenInput } from '../lib/access-token-types.js'
import { mountAccessTokenRoutes } from './access-tokens.js'
import { mountNotesRoutes } from './notes.js'
import { mountAdminUsersRoutes } from './admin-users.js'
import { mountAuditRoutes } from './audit.js'

const database = process.env.MDC_TEST_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith('_test')) throw new Error('An explicit isolated test database is required')
const pools = createPools({ rw: database, ro: database.replace('dashboard_rw', 'dashboard_ro') })
const users = createUserStore(pools.rw)
const authenticateServiceKey = createServiceKeyAuthenticator(pools.rw)
const tokens = createAccessTokenStore(pools.rw)
const audit = createAuditWriter(pools.rw)
const authenticate = createInternalTokenAuthenticator({ pool: pools.rw, authenticate: authenticateServiceKey })
const SELECTED = 'selected01'
const OUTSIDE = 'outside001'
let app: Hono
let adminId: string

beforeEach(async () => {
  await pools.rw.query('TRUNCATE audit_events, service_accounts, auth_users, storage_connections, notes CASCADE')
  adminId = (await users.createUser({ displayName: 'Admin', email: 'admin@example.test', roles: ['admin'] })).id
  for (const id of [SELECTED, OUTSIDE]) await pools.rw.query(`INSERT INTO storage_connections
    (id,name,endpoint,access_key_id_enc,secret_access_key_enc,access_key_id_masked)
    VALUES ($1,$1,'https://example.test','fixture','fixture','masked')`, [id])
  app = new Hono()
  app.use('*', requireInternalApiAuthentication({ authenticateToken: authenticate,
    sessions: { authenticateSession: async () => null }, cookieName: 'session', idleSeconds: 300 }))
  app.use('*', auditActivity(audit))
  app.use('*', requireInternalApiPermission())
  app.use('/storage/:connectionId/*', requireConnectionAccess(pools.ro))
  app.get('/storage/:connectionId/buckets', c => c.json([{ name: 'fixture-bucket' }]))
  mountNotesRoutes(app, { pools })
  mountAuditRoutes(app, { pool: pools.ro })
  mountAccessTokenRoutes(app, { store: tokens, audit,
    namespaceCatalog: { listNamespaces: async () => ({ namespaces: ['music', 'speech'], sourceStatus: 'ready' }) } })
  mountAdminUsersRoutes(app, { users, credentials: { resetLocalPassword: vi.fn() }, audit, ssoRoleMapping: {} })
})
afterAll(() => closePools(pools))

function issue(grants: Partial<AccessTokenInput> = {}) {
  return tokens.createToken({ name: 'Automation', description: '', namespaces: [], permissions: ['notes:read'],
    connections: [], expiresAt: null, ...grants, createdBy: adminId })
}
function request(token: string, path: string, method = 'GET', body?: unknown) {
  return app.request(path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}

describe('内部APIのアクセストークン', () => {
  it('内部APIの権限と接続の表は、公開OpenLineageとworkerのDBロールから読めない', async () => {
    const privileges = await pools.rw.query(`SELECT
      has_table_privilege('mado_lineage','service_account_key_permissions','SELECT') AS public_read,
      has_table_privilege('mado_worker','service_account_key_connections','SELECT') AS worker_read,
      has_table_privilege('dashboard_ro','service_account_key_permissions','INSERT') AS reader_write`)
    expect(privileges.rows[0]).toEqual({ public_read: false, worker_read: false, reader_write: false })
  })

  it('機能の選択だけで従来APIも許可し、送信を外せば同じトークンの送信権限を失効する', async () => {
    const manager = await issue({ permissions: [...INTERNAL_API_PERMISSIONS], connections: ['*'], namespaces: ['*'] })
    const created = await request(manager.token, '/access-tokens', 'POST', {
      name: 'ML Tracking', permissions: ['lineage:read', 'lineage:send', 'capacity:read'],
      namespaces: ['speech'], connections: [SELECTED],
    })
    expect(created.status).toBe(201)
    const issued = await created.json() as { accessToken: { id: string }; token: string }
    expect(await authenticate(issued.token)).toMatchObject({
      permissions: ['capacity:read', 'lineage:read', 'lineage:send'],
      scopes: ['lineage:read', 'lineage:write', 'metrics:read'], connections: [SELECTED],
    })
    const changed = await request(manager.token, `/access-tokens/${issued.accessToken.id}`, 'PATCH', {
      expectedRevision: 1, permissions: ['lineage:read'],
    })
    expect(changed.status).toBe(200)
    expect(await authenticateServiceKey(issued.token)).toMatchObject({ scopes: ['lineage:read'] })
  })

  it('閲覧と編集を別々に許可し、編集者と監査にトークンの主体を残す', async () => {
    const writer = await issue({ permissions: ['notes:write'] })
    expect((await request(writer.token, '/notes/home')).status).toBe(403)
    expect((await request(writer.token, '/notes/home', 'PUT', { body: 'Saved by automation', editor: 'Pretend user' })).status).toBe(400)
    expect((await request(writer.token, '/notes/home', 'PUT', { body: 'Saved by automation' })).status).toBe(200)
    const note = await pools.rw.query('SELECT last_editor,last_editor_user_id FROM notes WHERE slug=$1', ['home'])
    expect(note.rows[0]).toEqual({ last_editor: 'Automation', last_editor_user_id: null })
    const recorded = await pools.rw.query("SELECT actor_type,actor_user_id,actor_service_account_id,details FROM audit_events WHERE action='note.update' AND outcome='success'")
    expect(recorded.rows[0]).toMatchObject({ actor_type: 'service_account', actor_user_id: null,
      actor_service_account_id: (await authenticate(writer.token))!.serviceAccountId, details: { keyId: writer.accessToken.id } })
    expect(JSON.stringify(recorded.rows)).not.toContain(writer.token)
    const reader = await issue({ permissions: ['notes:read', 'audit:read'] })
    const events = await (await request(reader.token, '/audit-events')).json() as { events: Array<{ actor_label: string }> }
    expect(events.events[0].actor_label).toBe('Automation')
    expect((await request(reader.token, '/notes/home')).status).toBe(200)
    expect((await request(reader.token, '/notes/home', 'PUT', { body: 'Denied' })).status).toBe(403)
  })

  it('権限の変更・無効化・再発行を既存の値へ直ちに反映する', async () => {
    const issued = await issue()
    const id = issued.accessToken.id
    expect((await request(issued.token, '/notes/home')).status).toBe(200)
    await tokens.updateToken({ id, expectedRevision: 1, patch: { permissions: ['notes:write'] } })
    expect((await request(issued.token, '/notes/home')).status).toBe(403)
    expect((await request(issued.token, '/notes/home', 'PUT', { body: 'Changed permissions' })).status).toBe(200)
    await tokens.updateToken({ id, expectedRevision: 2, patch: { status: 'disabled' } })
    expect((await request(issued.token, '/notes/home')).status).toBe(401)
    await tokens.updateToken({ id, expectedRevision: 3, patch: { status: 'active' } })
    const regenerated = await tokens.regenerateToken({ id, expectedRevision: 4 })
    expect(await authenticate(issued.token)).toBeNull()
    expect(await authenticate(regenerated!.token)).toMatchObject({ permissions: ['notes:write'], connections: [] })
  })

  it('再発行と認証が重なっても、以前の値で新しい権限を使わせない', async () => {
    const issued = await issue()
    const racing = createInternalTokenAuthenticator({ pool: pools.rw, authenticate: async value => {
      const principal = await authenticateServiceKey(value)
      await tokens.regenerateToken({ id: issued.accessToken.id, expectedRevision: 1 })
      return principal
    } })
    expect(await racing(issued.token)).toBeNull()
  })

  it('公開された接続も選択範囲の外なら404にし、管理権限でも迂回させない', async () => {
    const issued = await issue({ permissions: ['storage:read', 'connections:manage'], connections: [SELECTED] })
    expect((await request(issued.token, `/storage/${SELECTED}/buckets`)).status).toBe(200)
    expect((await request(issued.token, `/storage/${OUTSIDE}/buckets`)).status).toBe(404)
  })

  it('存在しない接続・操作なし・対象なしのトークンは保存しない', async () => {
    await expect(issue({ permissions: ['storage:read'], connections: [OUTSIDE + '-missing'] })).rejects.toThrow()
    await expect(issue({ permissions: [] })).rejects.toThrow()
    await expect(issue({ permissions: ['storage:read'], connections: [] })).rejects.toThrow()
    await expect(issue({ permissions: ['lineage:read'], namespaces: [] })).rejects.toThrow()
    expect(await tokens.listTokens()).toEqual([])
  })

  it('管理トークンが自分より強い権限・Namespace・接続を委譲できない', async () => {
    const manager = await issue({ permissions: ['service_accounts:manage', 'notes:read', 'storage:read', 'lineage:read'],
      connections: [SELECTED], namespaces: ['speech'] })
    const body = { name: 'Child', permissions: ['notes:read'], connections: [], namespaces: [] }
    expect((await request(manager.token, '/access-tokens', 'POST', body)).status).toBe(201)
    for (const grants of [
      { permissions: ['notes:write'] },
      { permissions: ['lineage:read'], namespaces: ['other'] },
      { permissions: ['storage:read'], connections: [OUTSIDE] },
      { permissions: ['lineage:read'], namespaces: ['speech'], connections: ['*'] },
      { permissions: ['capacity:read'], connections: ['*'] },
    ]) expect((await request(manager.token, '/access-tokens', 'POST', { ...body, ...grants })).status).toBe(403)
    expect((await request(manager.token, `/access-tokens/${manager.accessToken.id}`, 'PATCH', {
      expectedRevision: 1, permissions: ['notes:write'],
    })).status).toBe(403)
  })

  it('接続を持たない管理トークンは、DataLineageの接続制限も子へ広げられない', async () => {
    const manager = await issue({ permissions: ['service_accounts:manage', 'lineage:read'],
      namespaces: ['speech'], connections: [] })
    const body = { name: 'Child', permissions: ['lineage:read'], namespaces: ['speech'] }
    expect((await request(manager.token, '/access-tokens', 'POST', { ...body, connections: ['*'] })).status).toBe(403)
    expect((await request(manager.token, '/access-tokens', 'POST', { ...body, connections: [SELECTED] })).status).toBe(403)
    expect((await request(manager.token, '/access-tokens', 'POST', { ...body, connections: [] })).status).toBe(201)
  })

  it('許可した接続が削除されても対象を広げず、メタデータは編集できる', async () => {
    const issued = await issue({ permissions: ['storage:read'], connections: [SELECTED] })
    await pools.rw.query('DELETE FROM storage_connections WHERE id=$1', [SELECTED])
    const changed = await tokens.updateToken({ id: issued.accessToken.id, expectedRevision: 1,
      patch: { name: 'Renamed', permissions: ['storage:read'], connections: [SELECTED] } })
    expect(changed!.accessToken.connections).toEqual([SELECTED])
    expect(await authenticate(issued.token)).toMatchObject({ tokenName: 'Renamed', connections: [SELECTED] })
  })

  it('強い既存トークンの再発行・有効化・削除を拒否し、権限表に無いAPIはトークンに開かない', async () => {
    const manager = await issue({ permissions: ['service_accounts:manage', 'notes:read'] })
    const stronger = await issue({ permissions: ['notes:write'] })
    const path = `/access-tokens/${stronger.accessToken.id}`
    expect((await request(manager.token, `${path}/regenerate`, 'POST', { expectedRevision: 1 })).status).toBe(403)
    expect((await request(manager.token, path, 'PATCH', { expectedRevision: 1, status: 'active' })).status).toBe(403)
    expect((await request(manager.token, `${path}?expectedRevision=1`, 'DELETE')).status).toBe(403)
    expect((await request(manager.token, '/service-accounts', 'POST', { name: 'Bypass' })).status).toBe(403)
    expect(await authenticate(stronger.token)).not.toBeNull()
  })

  it('管理トークンは自分の有効期限より長く残るトークンを作れず、期限より短ければ作れる', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    const manager = await issue({ permissions: ['service_accounts:manage', 'notes:read'], expiresAt })
    const body = { name: 'Child', permissions: ['notes:read'], connections: [], namespaces: [] }
    const at = (offset: number) => new Date(expiresAt.getTime() + offset).toISOString()
    expect((await request(manager.token, '/access-tokens', 'POST', body)).status).toBe(403)
    expect((await request(manager.token, '/access-tokens', 'POST', { ...body, expiresAt: at(1000) })).status).toBe(403)
    expect((await request(manager.token, '/access-tokens', 'POST', { ...body, expiresAt: at(-1000) })).status).toBe(201)
    const permanent = await issue({ permissions: ['notes:read'] })
    expect((await request(manager.token, `/access-tokens/${permanent.accessToken.id}?expectedRevision=1`, 'DELETE')).status).toBe(403)
    expect(await authenticate(permanent.token)).not.toBeNull()
  })

  it('権限の外にあるトークンへの操作は、revisionが古くても競合ではなく403にする', async () => {
    const manager = await issue({ permissions: ['service_accounts:manage', 'notes:read'] })
    const stronger = await issue({ permissions: ['notes:write'] })
    const response = await request(manager.token, `/access-tokens/${stronger.accessToken.id}`, 'PATCH', { expectedRevision: 99, name: 'Probe' })
    expect(response.status).toBe(403)
  })

  it('連携scopeは権限から決まり、scopesを送る変更は受け付けない', async () => {
    const manager = await issue({ permissions: [...INTERNAL_API_PERMISSIONS], connections: ['*'], namespaces: ['*'] })
    const issued = await issue({ permissions: ['lineage:read'], namespaces: ['speech'] })
    const response = await request(manager.token, `/access-tokens/${issued.accessToken.id}`, 'PATCH',
      { expectedRevision: 1, scopes: ['lineage:write'] })
    expect(response.status).toBe(400)
    expect(await authenticate(issued.token)).toMatchObject({ scopes: ['lineage:read'], permissions: ['lineage:read'] })
    await expect(tokens.updateToken({ id: issued.accessToken.id, expectedRevision: 1, patch: { permissions: [] } }))
      .rejects.toBeInstanceOf(AccessTokenPermissionsError)
  })

  it('呼び出し元のトークンが途中で無効になると、作成も削除も確定しない', async () => {
    const manager = await issue({ permissions: ['service_accounts:manage', 'notes:read'] })
    const target = await issue({ name: 'Target', permissions: ['notes:read'] })
    await tokens.updateToken({ id: manager.accessToken.id, expectedRevision: 1, patch: { status: 'disabled' } })
    const guard = { actorKeyId: manager.accessToken.id }
    await expect(tokens.deleteToken({ id: target.accessToken.id, expectedRevision: 1 }, guard))
      .rejects.toBeInstanceOf(AccessTokenActorInactiveError)
    await expect(tokens.createToken({ name: 'Child', description: '', permissions: ['notes:read'],
      connections: [], namespaces: [], expiresAt: null, createdBy: null }, guard)).rejects.toBeInstanceOf(AccessTokenActorInactiveError)
    expect(await authenticate(target.token)).not.toBeNull()
    expect((await tokens.listTokens()).map(token => token.name)).not.toContain('Child')
  })

  it('管理トークンの一覧には、自分が管理できるトークンと許可されたNamespaceだけを出す', async () => {
    const manager = await issue({ permissions: ['service_accounts:read', 'lineage:read'], namespaces: ['speech'], connections: [] })
    const weaker = await issue({ name: 'Weaker', permissions: ['lineage:read'], namespaces: ['speech'] })
    const stronger = await issue({ name: 'Stronger', permissions: ['lineage:read'], namespaces: ['music'] })
    const listed = await (await request(manager.token, '/access-tokens')).json() as { tokens: Array<{ id: string }> }
    const ids = listed.tokens.map(token => token.id)
    expect(ids).toEqual(expect.arrayContaining([manager.accessToken.id, weaker.accessToken.id]))
    expect(ids).not.toContain(stronger.accessToken.id)
    expect(await (await request(manager.token, '/access-tokens/namespaces')).json())
      .toEqual({ namespaces: ['speech'], sourceStatus: 'ready' })
  })

  it('ユーザー管理には、全権限に加えて全接続・全Namespaceを持つトークンを要求する', async () => {
    const body = { username: 'scoped-admin-user', displayName: 'Created by token', roles: ['viewer'] }
    const everything = { permissions: [...INTERNAL_API_PERMISSIONS] }
    const limitedConnections = await issue({ ...everything, connections: [SELECTED], namespaces: ['*'] })
    expect((await request(limitedConnections.token, '/users', 'POST', body)).status).toBe(403)
    const limitedNamespaces = await issue({ ...everything, connections: ['*'], namespaces: ['speech'] })
    expect((await request(limitedNamespaces.token, '/users', 'POST', body)).status).toBe(403)
  })

  it('限定トークンではユーザー管理から権限を昇格できず、全権限の管理者なら作成できる', async () => {
    const limited = await issue({ permissions: ['users:manage'] })
    const body = { username: 'automated-user', displayName: 'Created by token', roles: ['viewer'] }
    expect((await request(limited.token, '/users', 'POST', body)).status).toBe(403)
    const administrator = await issue({ permissions: [...INTERNAL_API_PERMISSIONS], connections: ['*'], namespaces: ['*'] })
    expect((await request(administrator.token, '/users', 'POST', body)).status).toBe(201)
    expect((await request(administrator.token, '/users')).status).toBe(200)
  })
})
