import { Hono } from 'hono'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { closePools, createPools } from '../db.js'
import { createUserStore } from '../lib/auth-user-store.js'
import { createServiceAccountStore } from '../lib/auth-api-keys.js'
import { createAccessTokenStore } from '../lib/access-token-store.js'
import * as keyRecords from '../lib/service-account-key-record.js'
import { createAuditWriter } from '../lib/audit.js'
import { setSessionPrincipal } from '../lib/rbac.js'
import { requireServiceKeyScope } from '../lib/service-key-auth.js'
import { mountAccessTokenRoutes } from './access-tokens.js'
import type { AccessToken } from '../lib/access-token-types.js'

const connection = process.env.DATABASE_URL_RW_TEST
// This suite resets auth tables; never fall back to another developer's database.
if (!connection || !new URL(connection).pathname.endsWith('_test')) {
  throw new Error('Set DATABASE_URL_RW_TEST explicitly to an isolated database ending in _test')
}
const pools = createPools({ rw: connection, ro: connection.replace('dashboard_rw', 'dashboard_ro') })
const users = createUserStore(pools.rw)
const credentials = createServiceAccountStore(pools.rw)
const tokens = createAccessTokenStore(pools.rw)
let application: Hono
let adminId: string

beforeEach(async () => {
  await pools.rw.query('TRUNCATE audit_events, service_accounts, auth_users CASCADE')
  const user = await users.createUser({ displayName: 'Admin', roles: ['admin'], email: 'admin@example.test' })
  adminId = user.id
  application = new Hono()
  application.use('*', async (context, next) => {
    setSessionPrincipal(context, { kind: 'user', sessionId: 'fixture', user })
    await next()
  })
  mountAccessTokenRoutes(application, { store: tokens, audit: createAuditWriter(pools.rw) })
  for (const scope of ['lineage:read', 'lineage:write', 'metrics:read'] as const) {
    application.get(`/probe/${scope}`, requireServiceKeyScope({
      authenticate: token => credentials.authenticate(token), scope,
    }), context => context.json({ ok: true }))
  }
})
afterAll(() => closePools(pools))

function request(input: { path?: string; method?: string; body?: unknown }) {
  return application.request(`/access-tokens${input.path ?? ''}`, {
    method: input.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
  })
}
async function issue(overrides: Record<string, unknown> = {}) {
  const response = await request({ method: 'POST', body: {
    name: 'ML Tracking', description: 'Training integration',
    scopes: ['lineage:read', 'lineage:write'], namespaces: ['speech'], ...overrides,
  } })
  expect(response.status).toBe(201)
  return response.json() as Promise<{ accessToken: AccessToken; token: string }>
}

describe('一階層のアクセストークン管理', () => {
  it('一度の発行で参照と送信を許可し、一覧と監査には秘密を含めない', async () => {
    const issued = await issue({ scopes: ['lineage:read', 'lineage:write', 'metrics:read'] })
    for (const scope of issued.accessToken.scopes) {
      expect((await application.request(`/probe/${scope}`, { headers: { authorization: `Bearer ${issued.token}` } })).status).toBe(200)
    }
    const list = await request({})
    expect(list.headers.get('Cache-Control')).toBe('no-store')
    const body = await list.json()
    expect(body).toMatchObject({ tokens: [{ id: issued.accessToken.id, name: 'ML Tracking', revision: 1 }] })
    expect(JSON.stringify(body)).not.toContain(issued.token)
    const stored = await pools.rw.query('SELECT secret_hash FROM service_account_keys WHERE id = $1', [issued.accessToken.id])
    expect(stored.rows[0].secret_hash).toHaveLength(32)
    const audit = await pools.rw.query('SELECT * FROM audit_events')
    expect(JSON.stringify(audit.rows)).not.toContain(issued.token)
    expect(audit.rows).toHaveLength(1)
  })

  it('既存の値と識別子を保ち、旧アカウントの複数キーをそれぞれ操作できる', async () => {
    const account = await credentials.createAccount({ name: 'legacy', description: 'Existing integration', createdBy: adminId })
    const first = await credentials.issueKey({ accountId: account.id, name: 'first', scopes: ['lineage:read'], namespaces: ['speech'], createdBy: adminId })
    const second = await credentials.issueKey({ accountId: account.id, name: 'second', scopes: ['lineage:write'], namespaces: ['speech'], createdBy: adminId })
    expect((await tokens.listTokens()).map(token => token.id).sort()).toEqual([first.id, second.id].sort())
    expect(await credentials.authenticate(first.token)).toMatchObject({ serviceAccountId: account.id, keyId: first.id })
    await credentials.updateAccount(account.id, { status: 'disabled' })
    const selected = (await tokens.listTokens()).find(token => token.id === first.id)!
    expect(selected.status).toBe('disabled')
    expect((await request({ path: `/${first.id}`, method: 'PATCH', body: { status: 'active', expectedRevision: selected.revision } })).status).toBe(200)
    expect(await credentials.authenticate(first.token)).not.toBeNull()
    expect(await credentials.authenticate(second.token)).toBeNull()
    expect((await tokens.listTokens()).find(token => token.id === second.id)?.status).toBe('disabled')
  })

  it('無効化は元に戻せ、削除すると認証と再発行ができず履歴は残る', async () => {
    const issued = await issue()
    const id = issued.accessToken.id
    expect((await request({ path: `/${id}`, method: 'PATCH', body: { status: 'disabled', expectedRevision: 1 } })).status).toBe(200)
    expect(await credentials.authenticate(issued.token)).toBeNull()
    expect((await request({ path: `/${id}`, method: 'PATCH', body: { status: 'active', expectedRevision: 2 } })).status).toBe(200)
    expect(await credentials.authenticate(issued.token)).not.toBeNull()
    expect((await request({ path: `/${id}?expectedRevision=3`, method: 'DELETE' })).status).toBe(200)
    expect(await credentials.authenticate(issued.token)).toBeNull()
    expect(await tokens.listTokens()).toEqual([])
    expect((await request({ path: `/${id}/regenerate`, method: 'POST', body: { expectedRevision: 4 } })).status).toBe(404)
    expect((await request({ path: `/${id}`, method: 'PATCH', body: { status: 'active', expectedRevision: 4 } })).status).toBe(404)
    expect((await pools.rw.query('SELECT id FROM service_account_keys WHERE id = $1', [id])).rowCount).toBe(1)
    expect((await pools.rw.query('SELECT action FROM audit_events WHERE resource_id = $1', [id])).rows.map(row => row.action))
      .toEqual(['access_token.create', 'access_token.disable', 'access_token.enable', 'access_token.delete'])
  })

  it('再発行は旧値を直ちに失効し、識別子と権限と無効状態を保つ', async () => {
    const issued = await issue()
    await request({ path: `/${issued.accessToken.id}`, method: 'PATCH', body: { status: 'disabled', expectedRevision: 1 } })
    const response = await request({ path: `/${issued.accessToken.id}/regenerate`, method: 'POST', body: { expectedRevision: 2 } })
    const regenerated = await response.json() as typeof issued
    expect(response.status).toBe(200)
    expect(regenerated.token).not.toBe(issued.token)
    expect(regenerated.accessToken).toMatchObject({ id: issued.accessToken.id, status: 'disabled', scopes: issued.accessToken.scopes, namespaces: ['speech'], revision: 3 })
    expect(regenerated.accessToken.regeneratedAt).not.toBeNull()
    await request({ path: `/${issued.accessToken.id}`, method: 'PATCH', body: { status: 'active', expectedRevision: 3 } })
    expect(await credentials.authenticate(issued.token)).toBeNull()
    expect(await credentials.authenticate(regenerated.token)).not.toBeNull()
    expect(JSON.stringify(await tokens.listTokens())).not.toContain(regenerated.token)
  })

  it('同じ表示からの再発行が競合すると一方だけが成功する', async () => {
    const issued = await issue()
    const responses = await Promise.all([1, 2].map(() => request({
      path: `/${issued.accessToken.id}/regenerate`, method: 'POST', body: { expectedRevision: 1 },
    })))
    expect(responses.map(response => response.status).sort()).toEqual([200, 409])
    const successful = await responses.find(response => response.status === 200)!.json() as typeof issued
    expect(await credentials.authenticate(successful.token)).not.toBeNull()
    expect(await credentials.authenticate(issued.token)).toBeNull()
    expect((await pools.rw.query("SELECT id FROM audit_events WHERE action = 'access_token.regenerate'")).rowCount).toBe(1)
  })

  it('権限を更新すると既存の値のまま許可が変わり、説明の省略では消えない', async () => {
    const issued = await issue()
    const response = await request({ path: `/${issued.accessToken.id}`, method: 'PATCH', body: {
      scopes: ['metrics:read'], namespaces: [], expectedRevision: 1,
    } })
    expect(response.status).toBe(200)
    expect(await credentials.authenticate(issued.token)).toMatchObject({ scopes: ['metrics:read'], namespaces: [] })
    const saved = (await response.json() as { accessToken: AccessToken }).accessToken
    expect(saved.description).toBe('Training integration')
    expect((await application.request('/probe/lineage:write', { headers: { authorization: `Bearer ${issued.token}` } })).status).toBe(403)
    expect((await request({ path: `/${issued.accessToken.id}`, method: 'PATCH', body: { status: 'disabled', expectedRevision: 1 } })).status).toBe(409)
    expect((await tokens.listTokens())[0].status).toBe('active')
  })

  it('許可対象のない来歴・用途のないキー・過去の期限は発行しない', async () => {
    for (const body of [
      { name: 'missing namespace', scopes: ['lineage:read'] },
      { name: 'no permissions', scopes: [], namespaces: [] },
      { name: 'metrics only', scopes: ['metrics:read'], namespaces: ['speech'] },
      { name: 'past', scopes: ['metrics:read'], expiresAt: '2000-01-01T00:00:00Z' },
    ]) expect((await request({ method: 'POST', body })).status).toBe(400)
    expect(await tokens.listTokens()).toEqual([])
    expect((await pools.rw.query('SELECT id FROM service_accounts')).rowCount).toBe(0)
  })

  it('管理権限のない利用者は一覧・発行・操作を行えない', async () => {
    const issued = await issue()
    const viewer = await users.createUser({ displayName: 'Viewer', roles: ['viewer'], email: 'viewer@example.test' })
    const limited = new Hono()
    limited.use('*', async (context, next) => {
      setSessionPrincipal(context, { kind: 'user', sessionId: 'fixture', user: viewer })
      await next()
    })
    mountAccessTokenRoutes(limited, { store: tokens, audit: createAuditWriter(pools.rw) })
    for (const [method, path] of [['GET', ''], ['POST', ''], ['PATCH', `/${issued.accessToken.id}`], ['POST', `/${issued.accessToken.id}/regenerate`], ['DELETE', `/${issued.accessToken.id}`]]) {
      expect((await limited.request(`/access-tokens${path}`, { method })).status).toBe(403)
    }
    expect(await credentials.authenticate(issued.token)).not.toBeNull()
  })

  it('不正な識別子で更新・再発行・削除を要求しても状態を変えない', async () => {
    const issued = await issue()
    for (const input of [
      { path: '/invalid', method: 'PATCH', body: { status: 'disabled', expectedRevision: 1 } },
      { path: '/invalid/regenerate', method: 'POST', body: { expectedRevision: 1 } },
      { path: '/invalid?expectedRevision=1', method: 'DELETE' },
    ]) expect((await request(input)).status).toBe(400)
    expect(await credentials.authenticate(issued.token)).not.toBeNull()
    expect((await tokens.listTokens())[0].revision).toBe(1)
  })

  it('同じ内容の再保存ではrevisionと監査を増やさず、Namespaceの重複も吸収する', async () => {
    const issued = await issue()
    const response = await request({ path: `/${issued.accessToken.id}`, method: 'PATCH', body: {
      name: 'ML Tracking', description: 'Training integration', scopes: ['lineage:write', 'lineage:read'],
      namespaces: ['speech', 'speech'], status: 'active', expiresAt: null, expectedRevision: 1,
    } })
    expect(response.status).toBe(200)
    expect((await tokens.listTokens())[0].revision).toBe(1)
    expect((await pools.rw.query('SELECT id FROM audit_events')).rowCount).toBe(1)
    const update = await request({ path: `/${issued.accessToken.id}`, method: 'PATCH', body: {
      namespaces: ['podcast', 'podcast'], expectedRevision: 1,
    } })
    expect(update.status).toBe(200)
    expect(await credentials.authenticate(issued.token)).toMatchObject({ namespaces: ['podcast'] })
    expect((await tokens.listTokens())[0].revision).toBe(2)
  })

  it('保存に失敗すると認証情報・内部の持ち主・監査が残らない', async () => {
    const insertKey = keyRecords.insertServiceAccountKey
    const failure = vi.spyOn(keyRecords, 'insertServiceAccountKey').mockImplementation(async (database, input) => {
      await insertKey(database, input)
      throw new Error('fixture storage failure after inserting the credential')
    })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect((await request({ method: 'POST', body: { name: 'failed', scopes: ['lineage:read'], namespaces: ['speech'] } })).status).toBe(500)
      expect((await pools.rw.query('SELECT id FROM service_accounts')).rowCount).toBe(0)
      expect((await pools.rw.query('SELECT id FROM service_account_keys')).rowCount).toBe(0)
      expect((await pools.rw.query('SELECT id FROM audit_events')).rowCount).toBe(0)
    } finally {
      failure.mockRestore()
      log.mockRestore()
    }
  })
})
