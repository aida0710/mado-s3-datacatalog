import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { closePools, createPools } from '../db.js'
import { createUserStore } from './auth-user-store.js'
import { createAccessTokenStore } from './access-token-store.js'
import type { AccessTokenInput } from './access-token-types.js'
import { createServiceKeyAuthenticator } from './service-key-authenticator.js'

const RW = process.env.DATABASE_URL_RW_TEST
  ?? 'postgres://dashboard_rw:CHANGEME@localhost:5432/dashboard_test'
const pools = createPools({ rw: RW, ro: RW.replace('dashboard_rw', 'dashboard_ro') })
const users = createUserStore(pools.rw)
const tokens = createAccessTokenStore(pools.rw)
const authenticate = createServiceKeyAuthenticator(pools.rw)

beforeEach(async () => {
  await pools.rw.query('TRUNCATE audit_events, service_accounts, auth_users CASCADE')
})
afterAll(() => closePools(pools))

async function issue(grants: Partial<AccessTokenInput> = {}) {
  const admin = await users.createUser({ email: 'admin@example.com', displayName: 'Admin', roles: ['admin'] })
  return tokens.createToken({ name: 'prod', description: '', permissions: ['lineage:read'], namespaces: ['speech'],
    connections: [], expiresAt: null, ...grants, createdBy: admin.id })
}

describe('アクセストークンの認証', () => {
  it.each([
    [['lineage:read'], ['lineage:read']],
    [['lineage:send'], ['lineage:write']],
  ] as const)('%sの値を一度だけ返し、権限から決まるscopeとNamespaceで認証し、削除後は拒否する', async (permissions, scopes) => {
    const issued = await issue({ permissions: [...permissions] })
    expect(issued.token).toMatch(/^mado_dc_[^.]+\.[A-Za-z0-9_-]+$/)
    const stored = await pools.rw.query<{ secret_hash: Buffer }>(
      'SELECT secret_hash FROM service_account_keys WHERE id = $1', [issued.accessToken.id],
    )
    expect(stored.rows[0].secret_hash).toHaveLength(32)
    expect(stored.rows[0].secret_hash.toString()).not.toContain(issued.token)

    expect(await authenticate(issued.token)).toMatchObject({
      keyId: issued.accessToken.id, keyName: 'prod', scopes: [...scopes], namespaces: ['speech'], expiresAt: null,
    })
    expect(await authenticate(`${issued.token}x`)).toBeNull()
    // 前置きが mado_lin_ だった旧形式は、同じ鍵 ID と秘密でも受け付けない。
    expect(await authenticate(issued.token.replace('mado_dc_', 'mado_lin_'))).toBeNull()
    await tokens.deleteToken({ id: issued.accessToken.id, expectedRevision: issued.accessToken.revision })
    expect(await authenticate(issued.token)).toBeNull()
  })

  it('有効期限のあるトークンは認証結果にその期限を含め、期限切れは拒否する', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    const issued = await issue({ expiresAt })
    expect((await authenticate(issued.token))?.expiresAt?.getTime()).toBe(expiresAt.getTime())
    await pools.rw.query("UPDATE service_account_keys SET expires_at = now() - interval '1 second' WHERE id = $1", [issued.accessToken.id])
    expect(await authenticate(issued.token)).toBeNull()
  })

  it('無効化したトークンは拒否し、有効に戻すと同じ値で認証できる', async () => {
    const issued = await issue()
    const disabled = await tokens.updateToken({ id: issued.accessToken.id, expectedRevision: 1, patch: { status: 'disabled' } })
    expect(await authenticate(issued.token)).toBeNull()
    await tokens.updateToken({ id: issued.accessToken.id, expectedRevision: disabled!.accessToken.revision, patch: { status: 'active' } })
    expect(await authenticate(issued.token)).not.toBeNull()
  })
})
