import { Hono } from 'hono'
import type { LineageEnv } from './env.js'
import { createPools } from './db.js'
import { createAuditWriter } from './lib/audit.js'
import { createServiceKeyAuthenticator } from './lib/service-key-authenticator.js'
import { createRegistryClient } from './lib/registry-client.js'
import { mountOpenLineageRoutes } from './routes/openlineage.js'
import { requestLogger } from './lib/request-logger.js'
import { mountHealthRoute } from './lib/health-route.js'
import { apiError } from './lib/api-error.js'

/**
 * Pipeline が OpenLineage のイベントを送る公開 API (api-lineage) の Hono アプリを組み立てる。
 * 待ち受けと移行の確認は起動側 (lineage.ts) が持つ。DB にはつながずに組める。
 */
export function createLineageApplication(env: LineageEnv) {
  const pools = createPools({ rw: env.DATABASE_URL_RW, ro: env.DATABASE_URL_RO })
  const authenticateServiceKey = createServiceKeyAuthenticator(pools.rw)
  const audit = createAuditWriter(pools.rw)
  const registry = createRegistryClient({
    baseUrl: env.DATASET_REGISTRY_URL,
    token: env.DATASET_REGISTRY_TOKEN,
  })

  const app = new Hono()
  // ヘルスチェックは数秒ごとに来るので、要求のログより先に付けてログに出さない。
  mountHealthRoute(app, pools.ro)
  app.use('*', requestLogger())

  const api = new Hono()
  mountOpenLineageRoutes(api, {
    auth: {
      authenticate: authenticateServiceKey,
      async recordUse(event) {
        await audit.write({
          actor: {
            type: 'service_account',
            serviceAccountId: event.principal.serviceAccountId,
          },
          action: 'lineage.ingest',
          outcome: 'success',
          resourceType: 'openlineage_run',
          resourceId: event.runId,
          details: {
            keyId: event.principal.keyId,
            jobNamespace: event.jobNamespace,
            jobName: event.jobName,
            ingestOutcome: event.outcome,
          },
        })
      },
    },
    registry,
    bodyLimitBytes: env.OPENLINEAGE_BODY_LIMIT_BYTES,
  })
  app.route('/api', api)

  app.onError((error, c) => {
    console.error('unhandled lineage API error', error)
    return c.json(apiError('internal_error', 'internal error'), 500)
  })

  return { app, pools }
}
