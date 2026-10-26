// api-internal の起動: 移行を当て、アプリを組み立てて待ち受ける。
import { serve } from '@hono/node-server'
import { loadEnv } from './env.js'
import { closePools } from './db.js'
import { migrateDatabase } from './lib/schema-migrations.js'
import { createInternalApplication } from './internal-app.js'

const env = loadEnv()
// 表を使う前に未適用の移行を当てる。api-lineage と media-worker は当て終わるのを待ってから起動する。
await migrateDatabase(env.DATABASE_URL_MIGRATE)

// LAN ダッシュボード: 1 つのストリーム teardown 起因の未捕捉例外で全ユーザーの
// リクエストを巻き添えにしない。root cause は都度直す前提の最後の砦 (ログは大声で)。
// 移行の確認より後に付ける。先に付けると、起動時の失敗でもプロセスが残り続ける。
process.on('uncaughtException', err => console.error('UNCAUGHT EXCEPTION (kept alive)', err))
process.on('unhandledRejection', err => console.error('UNHANDLED REJECTION (kept alive)', err))

const { app, pools, storageFactory, deleteExpiredAuthRecords } = createInternalApplication(env)

// 期限切れ session と OIDC attempt の掃除。attempt の有効期限は分単位なので 1 時間おきで十分。
const AUTH_CLEANUP_INTERVAL_MS = 60 * 60 * 1000
const authCleanupTimer = setInterval(() => {
  deleteExpiredAuthRecords().catch(error => console.error('failed to clean expired auth records', error))
}, AUTH_CLEANUP_INTERVAL_MS)
authCleanupTimer.unref()

const server = serve({ fetch: app.fetch, port: env.PORT }, info => {
  console.log(
    `internal listening on http://localhost:${info.port}; ` +
    `allowed origins: ${env.ALLOWED_ORIGINS.join(', ')}`,
  )
})

let shuttingDown = false
const shutdown = async () => {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(authCleanupTimer)
  setTimeout(() => process.exit(1), 10_000).unref()
  await new Promise<void>(resolve => server.close(() => resolve()))
  await storageFactory.close()
  await closePools(pools)
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
