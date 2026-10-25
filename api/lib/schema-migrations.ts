import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Pool, type PoolClient } from 'pg'
import { inTransaction } from '../db.js'

// api/migrations の SQL。ビルドは dist/migrations へ写すので、ソースからも dist からも lib の隣の階層にある。
const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../migrations/', import.meta.url))
// この DB の中で移行の適用を直列にする advisory lock の鍵。値に意味は無く、ほかの advisory lock と重ならなければよい。
export const SCHEMA_MIGRATION_LOCK_KEY = 4_152_001
const CREATE_SCHEMA_MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  sha256 text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
)`

/** 移行の SQL ファイル 1 つ。`sha256` は適用後に中身が変わっていないかを確かめるために記録する。 */
export interface MigrationFile {
  name: string
  sha256: string
  sql: string
}

/** 適用済みの記録と手元の移行が食い違う、または移行に失敗した。起動を止めて運用者に直してもらう。 */
export class MigrationStateError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'MigrationStateError'
  }
}

export async function readMigrationFiles(directory = MIGRATIONS_DIRECTORY): Promise<MigrationFile[]> {
  const names = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()
  return Promise.all(names.map(async name => {
    const sql = await readFile(`${directory}/${name}`, 'utf8')
    return { name, sha256: createHash('sha256').update(sql).digest('hex'), sql }
  }))
}

/** 移行用の接続 URL (DB の管理者) で未適用の移行を当て、当てた名前を返す。api-internal の起動時と scripts/migrate.ts が使う。 */
export async function migrateDatabase(connectionString: string): Promise<string[]> {
  const pool = new Pool({ connectionString, max: 1 })
  try {
    const applied = await applyPendingMigrations(pool)
    console.log(applied.length > 0 ? `applied migrations: ${applied.join(', ')}` : 'migrations are up to date')
    return applied
  } finally {
    await pool.end()
  }
}

/**
 * 未適用の移行を名前の順に当て、当てた名前を返す。1 ファイルごとに 1 つの transaction で、
 * 中身と schema_migrations への記録を一緒に確定する。api-internal が DB の管理者の接続で起動時に呼ぶ。
 * 同時に起動した別のプロセスは advisory lock で待ち、待ち終えたときには全部当たっているので何もしない。
 */
export async function applyPendingMigrations(pool: Pool, files?: readonly MigrationFile[]): Promise<string[]> {
  const migrations = files ?? await readMigrationFiles()
  return withMigrationLock(pool, 'exclusive', async client => {
    if (!await schemaMigrationsExists(client)) {
      // 記録の無いまま表がある DB は、どこまで当たっているか分からない。古い移行をもう一度流さないよう止める。
      if (await hasTables(client)) {
        throw new MigrationStateError('this database has tables but no schema_migrations; record the migrations applied by hand first '
          + '(node dist/scripts/record-applied-migrations.js --through <NNN>)')
      }
      await client.query(CREATE_SCHEMA_MIGRATIONS_TABLE)
    }
    const applied = await appliedDigests(client)
    assertUnchanged(migrations, applied)
    const pending = migrations.filter(migration => !applied.has(migration.name))
    for (const migration of pending) {
      try {
        await inTransaction(client, async () => {
          await client.query(migration.sql)
          await recordMigration(client, migration)
        })
      } catch (error) {
        throw new MigrationStateError(`migration ${migration.name} failed`, { cause: error })
      }
    }
    return pending.map(migration => migration.name)
  })
}

/**
 * 手元の移行がすべて当たっていることを確かめる。移行を当てる権限を持たない api-lineage と media-worker が起動時に呼ぶ。
 * 適用中なら advisory lock で終わるまで待つ。未適用や中身の違いがあれば MigrationStateError を投げる。
 */
export async function assertMigrationsApplied(pool: Pool, files?: readonly MigrationFile[]): Promise<void> {
  const migrations = files ?? await readMigrationFiles()
  await withMigrationLock(pool, 'shared', async client => {
    if (!await schemaMigrationsExists(client)) {
      throw new MigrationStateError('schema_migrations does not exist; start api-internal first so that it applies the migrations')
    }
    const applied = await appliedDigests(client)
    assertUnchanged(migrations, applied)
    const pending = migrations.filter(migration => !applied.has(migration.name)).map(migration => migration.name)
    if (pending.length > 0) {
      throw new MigrationStateError(`migrations are not applied yet: ${pending.join(', ')}; start api-internal first so that it applies them`)
    }
  })
}

/**
 * 移行を手で当ててきた DB を、番号 `through` のファイルまで適用済みとして記録する (中身は実行しない)。
 * schema_migrations が無い DB で一度だけ使う。記録が既にある DB と、表の無い空の DB では断る。
 */
export async function recordAppliedMigrations(pool: Pool, through: string, files?: readonly MigrationFile[]): Promise<string[]> {
  const migrations = files ?? await readMigrationFiles()
  const last = migrations.findIndex(migration => migration.name.startsWith(`${through}_`))
  if (last < 0) throw new MigrationStateError(`no migration file starts with ${through}_`)
  const recorded = migrations.slice(0, last + 1)
  return withMigrationLock(pool, 'exclusive', async client => {
    if (await schemaMigrationsExists(client)) {
      throw new MigrationStateError('schema_migrations already exists; this database already records its migrations')
    }
    if (!await hasTables(client)) {
      throw new MigrationStateError('this database has no tables; start api-internal and let it apply every migration instead')
    }
    await inTransaction(client, async () => {
      await client.query(CREATE_SCHEMA_MIGRATIONS_TABLE)
      for (const migration of recorded) await recordMigration(client, migration)
    })
    return recorded.map(migration => migration.name)
  })
}

async function withMigrationLock<T>(pool: Pool, mode: 'exclusive' | 'shared', work: (client: PoolClient) => Promise<T>): Promise<T> {
  const [lock, unlock] = mode === 'exclusive'
    ? ['pg_advisory_lock', 'pg_advisory_unlock']
    : ['pg_advisory_lock_shared', 'pg_advisory_unlock_shared']
  const client = await pool.connect()
  try {
    await client.query(`SELECT ${lock}($1)`, [SCHEMA_MIGRATION_LOCK_KEY])
    try {
      return await work(client)
    } finally {
      await client.query(`SELECT ${unlock}($1)`, [SCHEMA_MIGRATION_LOCK_KEY])
    }
  } finally {
    client.release()
  }
}

async function schemaMigrationsExists(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>("SELECT to_regclass('schema_migrations') IS NOT NULL AS exists")
  return result.rows[0]?.exists === true
}

async function hasTables(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>('SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = current_schema()) AS exists')
  return result.rows[0]?.exists === true
}

async function appliedDigests(client: PoolClient): Promise<Map<string, string>> {
  const result = await client.query<{ name: string; sha256: string }>('SELECT name, sha256 FROM schema_migrations')
  return new Map(result.rows.map(row => [row.name, row.sha256]))
}

async function recordMigration(client: PoolClient, migration: MigrationFile): Promise<void> {
  await client.query('INSERT INTO schema_migrations (name, sha256) VALUES ($1, $2)', [migration.name, migration.sha256])
}

// 当てた後に書き換えたファイルは、新しい DB と既存の DB で中身が違ってしまうので起動させない。
function assertUnchanged(migrations: readonly MigrationFile[], applied: ReadonlyMap<string, string>): void {
  const changed = migrations.filter(migration => {
    const digest = applied.get(migration.name)
    return digest !== undefined && digest !== migration.sha256
  })
  if (changed.length > 0) {
    throw new MigrationStateError(`applied migrations were changed: ${changed.map(migration => migration.name).join(', ')}`)
  }
}
