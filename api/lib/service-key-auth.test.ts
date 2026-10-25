import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import {
  getServiceKeyPrincipal, requireServiceKey, requireServiceKeyScope, type ScopedServicePrincipal,
} from './service-key-auth.js'

interface TestPrincipal extends ScopedServicePrincipal {
  keyId: string
}

function appWith(authenticate: (token: string) => Promise<TestPrincipal | null>): Hono {
  const app = new Hono()
  app.get('/protected', requireServiceKeyScope({ authenticate, scope: 'metrics:read' }), c =>
    c.text(getServiceKeyPrincipal<TestPrincipal>(c).keyId))
  return app
}

const bearer = { Authorization: 'Bearer mado_lin_key.secret' }

describe('requireServiceKeyScope', () => {
  it('Bearerなしは認証を呼ばずに401とWWW-Authenticateを返す', async () => {
    const authenticate = vi.fn()
    const response = await appWith(authenticate).request('/protected')
    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer')
    expect(authenticate).not.toHaveBeenCalled()
  })

  it('無効なkeyは401を返す', async () => {
    const response = await appWith(async () => null).request('/protected', { headers: bearer })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'invalid service key', code: 'invalid_token' })
  })

  it('認証の問い合わせが失敗したら503を返す', async () => {
    const response = await appWith(async () => { throw new Error('db down') })
      .request('/protected', { headers: bearer })
    expect(response.status).toBe(503)
  })

  it('必要なscopeがないkeyは403を返す', async () => {
    const response = await appWith(async () => ({ keyId: 'key-1', scopes: ['lineage:write'] }))
      .request('/protected', { headers: bearer })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'metrics:read scope is required', code: 'scope_required', scope: 'metrics:read' })
  })

  it('scopeを持つkeyはhandlerへ認証済みprincipalを渡す', async () => {
    const authenticate = vi.fn().mockResolvedValue({ keyId: 'key-1', scopes: ['metrics:read'] })
    const response = await appWith(authenticate).request('/protected', { headers: bearer })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('key-1')
    expect(authenticate).toHaveBeenCalledWith('mado_lin_key.secret')
  })
})

describe('requireServiceKey', () => {
  function appWithoutScope(authenticate: (token: string) => Promise<TestPrincipal | null>): Hono {
    const app = new Hono()
    app.get('/own', requireServiceKey({ authenticate }), c => c.text(getServiceKeyPrincipal<TestPrincipal>(c).keyId))
    return app
  }

  it('scopeを問わず有効なkeyを通し、Bearerなし・無効なkey・認証の失敗はscope付きと同じ応答にする', async () => {
    const withoutScopes = await appWithoutScope(async () => ({ keyId: 'key-1', scopes: [] }))
      .request('/own', { headers: bearer })
    expect(withoutScopes.status).toBe(200)
    expect(await withoutScopes.text()).toBe('key-1')
    const missing = await appWithoutScope(vi.fn()).request('/own')
    expect(missing.status).toBe(401)
    expect(missing.headers.get('WWW-Authenticate')).toBe('Bearer')
    expect((await appWithoutScope(async () => null).request('/own', { headers: bearer })).status).toBe(401)
    expect((await appWithoutScope(async () => { throw new Error('db down') })
      .request('/own', { headers: bearer })).status).toBe(503)
  })
})
