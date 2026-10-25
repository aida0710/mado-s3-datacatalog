import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { mountServiceAccessTokenRoutes, type ServiceAccessTokenPrincipal } from './service-access-token.js'

const bearer = { Authorization: 'Bearer mado_dc_0123456789abcdef.unit-test-secret' }
const principal: ServiceAccessTokenPrincipal & { serviceAccountId: string } = {
  serviceAccountId: 'internal-owner',
  keyId: '00000000-0000-4000-8000-000000000001',
  keyName: 'ML Tracking',
  scopes: ['lineage:read', 'lineage:write'],
  namespaces: ['mado-model-tracking', 'speech'],
  expiresAt: new Date('2027-01-01T00:00:00.000Z'),
}

function appWith(authenticated: ServiceAccessTokenPrincipal | null) {
  const app = new Hono()
  const authenticate = vi.fn(async () => authenticated)
  mountServiceAccessTokenRoutes(app, { authenticate })
  return { app, authenticate }
}

describe('アクセストークン自身の許可範囲', () => {
  it('呼び出したトークンの名前・scope・Namespace・有効期限だけを返し、cacheさせない', async () => {
    const { app, authenticate } = appWith(principal)
    const response = await app.request('/access-token', { headers: bearer })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      id: principal.keyId,
      name: 'ML Tracking',
      scopes: ['lineage:read', 'lineage:write'],
      namespaces: ['mado-model-tracking', 'speech'],
      expiresAt: '2027-01-01T00:00:00.000Z',
    })
    expect(authenticate).toHaveBeenCalledWith('mado_dc_0123456789abcdef.unit-test-secret')
  })

  it('scopeを問わず答え、無期限・全Namespaceのトークンはその値のまま返す', async () => {
    const response = await appWith({ ...principal, scopes: ['metrics:read'], namespaces: ['*'], expiresAt: null })
      .app.request('/access-token', { headers: bearer })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ scopes: ['metrics:read'], namespaces: ['*'], expiresAt: null })
  })

  it('内部の所有者IDとトークンの値を返さない', async () => {
    const text = await (await appWith(principal).app.request('/access-token', { headers: bearer })).text()
    expect(text).not.toContain('internal-owner')
    expect(text).not.toContain('unit-test-secret')
  })

  it('Bearerなし・無効なトークンは401で、browser sessionだけでは答えない', async () => {
    expect((await appWith(principal).app.request('/access-token', {
      headers: { Cookie: 'mado_session=existing-browser-session' },
    })).status).toBe(401)
    expect((await appWith(null).app.request('/access-token', { headers: bearer })).status).toBe(401)
  })
})
