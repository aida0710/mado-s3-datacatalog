// 移行を手で当ててきた DB を、指定した番号まで適用済みとして記録する (SQL は実行しない)。
//   MDC_DATABASE_URL_MIGRATE=postgres://postgres:...@host/dashboard node dist/scripts/record-applied-migrations.js --through 041
// v0.4.0 まで (schema_migrations が無い) の DB で、新しい api-internal を起動する前に一度だけ使う。
import { Pool } from 'pg'
import { recordAppliedMigrations } from '../lib/schema-migrations.js'
import { assertNoRenamedEnvironmentVariables } from '../renamed-environment-variables.js'

assertNoRenamedEnvironmentVariables(process.env)
const connectionString = process.env.MDC_DATABASE_URL_MIGRATE
const throughIndex = process.argv.indexOf('--through')
const through = throughIndex >= 0 ? process.argv[throughIndex + 1] : undefined
if (!connectionString || !through || !/^\d{3}$/.test(through)) {
  console.error('usage: MDC_DATABASE_URL_MIGRATE=<administrator URL> node dist/scripts/record-applied-migrations.js --through <NNN>')
  process.exit(2)
}

const pool = new Pool({ connectionString, max: 1 })
try {
  const recorded = await recordAppliedMigrations(pool, through)
  console.log(`recorded ${recorded.length} migrations as applied: ${recorded[0]} .. ${recorded.at(-1)}`)
} finally {
  await pool.end()
}
