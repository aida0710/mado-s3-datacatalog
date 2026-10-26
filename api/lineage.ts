// api-lineage の起動: 移行が済んでいることを確かめ、アプリを組み立てて待ち受ける。
import { serve } from '@hono/node-server'
import { loadLineageEnv } from './env.js'
import { closePools } from './db.js'
import { assertMigrationsApplied } from './lib/schema-migrations.js'
import { createLineageApplication } from './lineage-app.js'

const env = loadLineageEnv()
const { app, pools } = createLineageApplication(env)
// 公開側のプロセスは移行を当てる権限を持たない。api-internal が当て終えていなければ起動しない。
await assertMigrationsApplied(pools.ro)

const server = serve({ fetch: app.fetch, port: env.LINEAGE_API_PORT }, info => {
  console.log(`lineage API listening on http://localhost:${info.port}`)
})

let shuttingDown = false
const shutdown = async () => {
  if (shuttingDown) return
  shuttingDown = true
  setTimeout(() => process.exit(1), 10_000).unref()
  await new Promise<void>(resolve => server.close(() => resolve()))
  await closePools(pools)
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
