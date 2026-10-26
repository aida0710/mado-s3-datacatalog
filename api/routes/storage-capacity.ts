import type { Hono } from 'hono'
import { z } from 'zod'
import type { CapacityStore } from '../lib/capacity-store.js'
import type { ConnectionConfig } from '../storage.js'
import { markAuditNoChange } from '../lib/audit-activity.js'
import type { Pools } from '../db.js'
import { PRICING_SETTING_KEYS } from '../lib/pricing.js'
import type { JobStore } from '../lib/jobs.js'
import { enqueueCapacityScans } from '../lib/capacity-scheduler.js'
import { apiError } from '../lib/api-error.js'

const Days = z.coerce.number().int().refine(value => [7, 30, 90, 400].includes(value))
export const CapacityPrefixHistoryQuery = z.object({
  bucket: z.string().min(1),
  prefix: z.string().min(1),
  days: Days.default(90),
})

export interface StorageCapacityDeps {
  store: CapacityStore
  jobs: Pick<JobStore, 'enqueueWithResult'>
  getConnectionConfig: (connectionId: string) => Promise<ConnectionConfig>
  listBuckets: (connectionId: string) => Promise<string[]>
  pools?: Pools
}

export function mountStorageCapacityRoutes(app: Hono, deps: StorageCapacityDeps): void {
  app.get('/storage/:connectionId/capacity', async c => {
    const parsedDays = Days.safeParse(c.req.query('days') ?? '90')
    if (!parsedDays.success) return c.json(apiError('invalid_request', 'days must be one of 7, 30, 90, 400'), 400)
    const connectionId = c.req.param('connectionId')
    const buckets = await deps.listBuckets(connectionId)
    const data = await deps.store.overview(connectionId, buckets, parsedDays.data)
    let capacityBytes: number | null = null
    if (deps.pools) {
      const setting = await deps.pools.ro.query<{ value: string }>(
        `SELECT value FROM connection_settings WHERE connection_id = $1 AND key = $2`,
        [connectionId, PRICING_SETTING_KEYS.capacityBytes],
      )
      const n = Number(setting.rows[0]?.value)
      if (Number.isSafeInteger(n) && n > 0) capacityBytes = n
    }
    return c.json({ connectionId, days: parsedDays.data, capacityBytes, ...data })
  })

  // 内訳のディレクトリはbucketごとに数十件あるので、推移は画面で開いたものだけ個別に読む。
  app.get('/storage/:connectionId/capacity/prefix', async c => {
    const query = CapacityPrefixHistoryQuery.safeParse(c.req.query())
    if (!query.success) return c.json(apiError('invalid_request', 'bucket and prefix are required; days must be one of 7, 30, 90, 400'), 400)
    const points = await deps.store.prefixHistory({ connectionId: c.req.param('connectionId'), ...query.data })
    return c.json({ points })
  })

  app.post('/storage/:connectionId/capacity/scan', async c => {
    const connectionId = c.req.param('connectionId')
    const config = await deps.getConnectionConfig(connectionId)
    if (!config.scanEnabled) return c.json(apiError('scan_disabled', 'scanning is disabled for this connection'), 403)
    if (!config.capacityMetricsEnabled) {
      return c.json(apiError('bucket_metrics_disabled', 'bucket metrics are disabled for this connection'), 403)
    }

    const active = await deps.store.scanActivity(connectionId)
    if (active.jobs.length > 0) {
      return c.json(apiError('capacity_scan_running', 'a bucket measurement is already running for this connection'), 409)
    }

    const buckets = await deps.listBuckets(connectionId)
    const jobs = await enqueueCapacityScans({ capacity: deps.store, jobs: deps.jobs }, connectionId, buckets)
    if (jobs.every(job => !job.created)) markAuditNoChange(c)
    return c.json({ jobs: jobs.map(({ bucket, jobId }) => ({ bucket, jobId })) })
  })
}
