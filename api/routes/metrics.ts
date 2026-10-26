import type { Hono } from 'hono'
import type { MetricsCollector } from '../lib/metrics-collector.js'
import { PROMETHEUS_TEXT_CONTENT_TYPE, renderPrometheusText } from '../lib/prometheus-exposition.js'
import { getServiceKeyPrincipal, requireServiceKeyScope, type ScopedServicePrincipal } from '../lib/service-key-auth.js'
import { apiError } from '../lib/api-error.js'

/** メトリクス用のトークンは、挙げた接続だけを読む。['*']は全接続。 */
export interface MetricsPrincipal extends ScopedServicePrincipal {
  connections: readonly string[]
}

export interface MetricsRoutesDeps {
  authenticate(token: string): Promise<MetricsPrincipal | null>
  collectors: MetricsCollector[]
  log?: Pick<Console, 'error'>
}

/**
 * Prometheus向け。browser sessionではなく`metrics:read`のService Account keyで読む。
 * 領域ごとにpathを分け、変化の速さに合わせてscrape間隔を変えられるようにする。
 * 読めなかった領域は503を返し、Prometheusの`up`で失敗を知らせる。
 */
export function mountMetricsRoutes(app: Hono, deps: MetricsRoutesDeps): void {
  const requireMetricsRead = requireServiceKeyScope({ authenticate: deps.authenticate, scope: 'metrics:read' })
  const log = deps.log ?? console
  for (const collector of deps.collectors) {
    app.get(`/metrics/${collector.name}`, requireMetricsRead, async c => {
      try {
        const { connections } = getServiceKeyPrincipal<MetricsPrincipal>(c)
        const connectionIds = connections.includes('*') ? null : new Set(connections)
        const families = await collector.collect({ connectionIds })
        return c.body(renderPrometheusText(families), 200, {
          'Content-Type': PROMETHEUS_TEXT_CONTENT_TYPE,
          'Cache-Control': 'no-store',
        })
      } catch (error) {
        log.error(`metrics collector "${collector.name}" failed`, error)
        return c.json(apiError('metrics_unavailable', 'metrics unavailable'), 503)
      }
    })
  }
}
