import type { Hono } from 'hono'
import type { IntegrationConnectionReader } from '../lib/integration-connections.js'
import { getServiceKeyPrincipal, requireServiceKey, type ScopedServicePrincipal } from '../lib/service-key-auth.js'

/** トークンは、挙げた接続だけを読む。['*']は全接続。 */
export interface ServiceConnectionsPrincipal extends ScopedServicePrincipal {
  connections: readonly string[]
}

export interface ServiceConnectionsRoutesDeps {
  authenticate(token: string): Promise<ServiceConnectionsPrincipal | null>
  connections: IntegrationConnectionReader
}

/**
 * 連携先（ML Trackingなど）が、S3の場所がどの接続のものかを選ぶための一覧。
 * scopeを問わず、呼び出したトークンに許可した接続のID・名前・種類だけを返す。トークンの
 * 許可の内容を本人に見せるだけなので、接続の設定を読む権限（connections:read）は求めない。
 */
export function mountServiceConnectionsRoutes(app: Hono, deps: ServiceConnectionsRoutesDeps): void {
  app.get('/connections',
    requireServiceKey({ authenticate: deps.authenticate }),
    async c => {
      const { connections } = getServiceKeyPrincipal<ServiceConnectionsPrincipal>(c)
      const items = await deps.connections.list(connections.includes('*') ? null : new Set(connections))
      c.header('Cache-Control', 'no-store')
      return c.json({ items })
    })
}
