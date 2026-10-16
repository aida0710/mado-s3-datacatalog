import type { Hono } from 'hono'
import { getServiceKeyPrincipal, requireServiceKey, type ScopedServicePrincipal } from '../lib/service-key-auth.js'

export interface ServiceAccessTokenPrincipal extends ScopedServicePrincipal {
  keyId: string
  keyName: string
  namespaces: readonly string[]
  expiresAt: Date | null
}

export interface ServiceAccessTokenRoutesDeps {
  authenticate(token: string): Promise<ServiceAccessTokenPrincipal | null>
}

/**
 * 連携先（ML Trackingなど）が、渡されたアクセストークン自身の許可範囲を確かめる入口。
 * 利用者にNamespaceを手入力させずに済むよう、scopeを問わず呼び出したトークン自身の情報だけを返す。
 * 他のトークンの情報と値（secret）は返さない。
 */
export function mountServiceAccessTokenRoutes(app: Hono, deps: ServiceAccessTokenRoutesDeps): void {
  app.get('/access-token', requireServiceKey({ authenticate: deps.authenticate }), c => {
    const principal = getServiceKeyPrincipal<ServiceAccessTokenPrincipal>(c)
    c.header('Cache-Control', 'no-store')
    return c.json({
      id: principal.keyId,
      name: principal.keyName,
      scopes: principal.scopes,
      namespaces: principal.namespaces,
      expiresAt: principal.expiresAt?.toISOString() ?? null,
    })
  })
}
