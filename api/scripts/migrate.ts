// 未適用の DB 移行を当てる: `MDC_DATABASE_URL_MIGRATE=postgres://postgres:...@host/dashboard node dist/scripts/migrate.js`。
// api-internal は起動時に同じことをするので、普段は要らない。テスト用の DB (dashboard_test) を用意するときに使う。
import { migrateDatabase } from '../lib/schema-migrations.js'
import { assertNoRenamedEnvironmentVariables } from '../renamed-environment-variables.js'

assertNoRenamedEnvironmentVariables(process.env)
const connectionString = process.env.MDC_DATABASE_URL_MIGRATE
if (!connectionString) {
  console.error('MDC_DATABASE_URL_MIGRATE is required (a PostgreSQL administrator URL of the target database)')
  process.exit(2)
}
await migrateDatabase(connectionString)
