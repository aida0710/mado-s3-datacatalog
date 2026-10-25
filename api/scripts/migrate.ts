// 未適用の DB 移行を当てる: `DATABASE_URL_MIGRATE=postgres://postgres:...@host/dashboard node dist/scripts/migrate.js`。
// api-internal は起動時に同じことをするので、普段は要らない。テスト用の DB (dashboard_test) を用意するときに使う。
import { migrateDatabase } from '../lib/schema-migrations.js'

const connectionString = process.env.DATABASE_URL_MIGRATE
if (!connectionString) {
  console.error('DATABASE_URL_MIGRATE is required (a PostgreSQL administrator URL of the target database)')
  process.exit(2)
}
await migrateDatabase(connectionString)
