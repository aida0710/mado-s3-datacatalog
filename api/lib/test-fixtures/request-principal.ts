import { Hono } from 'hono'
import { setRequestPrincipal } from '../rbac.js'
import type { AccessTokenPrincipal, RequestPrincipal } from '../auth-types.js'

export function testPrincipal(tokenName = 'Test token'): AccessTokenPrincipal {
  return {
    kind: 'service_account', serviceAccountId: '11111111-1111-4111-8111-111111111111',
    serviceAccountName: 'Test integration', keyId: '22222222-2222-4222-8222-222222222222',
    keyName: tokenName, tokenName, scopes: [], namespaces: ['*'], connections: ['*'],
    permissions: ['connections:manage', 'notes:write', 'readmes:write'], expiresAt: null,
  }
}

export function createTestAppWithPrincipal(principal: RequestPrincipal | null = testPrincipal()): Hono {
  const app = new Hono()
  app.use('*', async (context, next) => {
    if (principal) setRequestPrincipal(context, principal)
    await next()
  })
  return app
}
