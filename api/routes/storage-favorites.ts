import type { Hono } from 'hono'
import type { Pools } from '../db.js'
import { markAuditNoChange } from '../lib/audit-activity.js'
import { apiError } from '../lib/api-error.js'

// お気に入りは接続ごとに共有する。認証と操作権限は internal-app.ts で検証する。

export interface StorageFavoritesDeps {
  pools: Pools
}

export function mountStorageFavoritesRoutes(app: Hono, deps: StorageFavoritesDeps): void {
  app.get('/storage/:connectionId/favorites', async c => {
    const connectionId = c.req.param('connectionId')
    const r = await deps.pools.ro.query(
      `SELECT bucket FROM storage_favorite_buckets
         WHERE connection_id = $1
         ORDER BY bucket`,
      [connectionId],
    )
    return c.json(r.rows.map(row => row.bucket as string))
  })

  app.put('/storage/:connectionId/favorites/:bucket', async c => {
    const connectionId = c.req.param('connectionId')
    const bucket = c.req.param('bucket')
    if (!bucket) return c.json(apiError('invalid_request', 'bucket required'), 400)
    const result = await deps.pools.rw.query(
      `INSERT INTO storage_favorite_buckets(connection_id, bucket) VALUES ($1, $2)
         ON CONFLICT (connection_id, bucket) DO NOTHING`,
      [connectionId, bucket],
    )
    if ((result.rowCount ?? 0) === 0) markAuditNoChange(c)
    return c.json({ ok: true })
  })

  app.delete('/storage/:connectionId/favorites/:bucket', async c => {
    const connectionId = c.req.param('connectionId')
    const bucket = c.req.param('bucket')
    if (!bucket) return c.json(apiError('invalid_request', 'bucket required'), 400)
    const result = await deps.pools.rw.query(
      `DELETE FROM storage_favorite_buckets
         WHERE connection_id = $1 AND bucket = $2`,
      [connectionId, bucket],
    )
    if ((result.rowCount ?? 0) === 0) markAuditNoChange(c)
    return c.json({ ok: true })
  })
}
