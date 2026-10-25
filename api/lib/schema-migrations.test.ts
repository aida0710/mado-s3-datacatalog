import { createHash, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyPendingMigrations, assertMigrationsApplied, MigrationStateError, readMigrationFiles, recordAppliedMigrations,
  SCHEMA_MIGRATION_LOCK_KEY, type MigrationFile,
} from './schema-migrations.js'

const RW = process.env.DATABASE_URL_RW_TEST ?? 'postgres://dashboard_rw:CHANGEME@localhost:5432/dashboard_test'
const schemaSetup = new Pool({ connectionString: RW, max: 1 })
afterAll(() => schemaSetup.end())

// 本物の移行はロールの作成を含み管理者の権限が要るので、ここでは自前の SQL を使い、
// テストごとの schema へ search_path を向けて schema_migrations も含めて隔離する。
let schema: string
let pools: Pool[] = []
function poolInSchema(): Pool {
  const pool = new Pool({ connectionString: RW, max: 2, options: `-c search_path=${schema}` })
  pools.push(pool)
  return pool
}

// pg_locks を見に行く間隔。
const LOCK_POLL_MS = 10

// 当てる側が advisory lock を取ったのを pg_locks で見てから確認を始める。鍵は 32 ビットに収まるので objid に入る。
async function waitUntilMigrationLockIsHeld(): Promise<void> {
  for (;;) {
    const result = await schemaSetup.query<{ held: boolean }>(
      "SELECT count(*) > 0 AS held FROM pg_locks WHERE locktype = 'advisory' AND granted AND objid = $1",
      [SCHEMA_MIGRATION_LOCK_KEY],
    )
    if (result.rows[0]?.held) return
    await new Promise(resolve => setTimeout(resolve, LOCK_POLL_MS))
  }
}

function migration(name: string, sql: string): MigrationFile {
  return { name, sql, sha256: createHash('sha256').update(sql).digest('hex') }
}

beforeEach(async () => {
  schema = `migration_test_${randomUUID().replaceAll('-', '')}`
  await schemaSetup.query(`CREATE SCHEMA ${schema}`)
})
afterEach(async () => {
  await Promise.all(pools.map(pool => pool.end()))
  pools = []
  await schemaSetup.query(`DROP SCHEMA ${schema} CASCADE`)
})

describe('移行の自動適用', () => {
  const files = [
    migration('001_first.sql', 'CREATE TABLE first_table (id int PRIMARY KEY);'),
    migration('002_second.sql', 'CREATE TABLE second_table (id int PRIMARY KEY);'),
  ]

  it('未適用のものを名前の順に当てて記録し、2 回目は何も当てない', async () => {
    const pool = poolInSchema()
    expect(await applyPendingMigrations(pool, files)).toEqual(['001_first.sql', '002_second.sql'])
    expect(await applyPendingMigrations(pool, files)).toEqual([])
    const recorded = await pool.query('SELECT name, sha256 FROM schema_migrations ORDER BY name')
    expect(recorded.rows).toEqual(files.map(file => ({ name: file.name, sha256: file.sha256 })))
  })

  it('2 つのプロセスが同時に起動しても、移行は 1 回だけ当たる', async () => {
    const results = await Promise.all([applyPendingMigrations(poolInSchema(), files), applyPendingMigrations(poolInSchema(), files)])
    expect(results.map(applied => applied.length).sort()).toEqual([0, 2])
  })

  it('当てた後にファイルの中身が変わっていたら、何も当てずに止まる', async () => {
    const pool = poolInSchema()
    await applyPendingMigrations(pool, files.slice(0, 1))
    const changed = [migration('001_first.sql', 'CREATE TABLE first_table (id bigint PRIMARY KEY);'), files[1]!]
    await expect(applyPendingMigrations(pool, changed)).rejects.toThrow(/applied migrations were changed: 001_first\.sql/)
    expect((await pool.query("SELECT to_regclass('second_table') AS table")).rows[0].table).toBeNull()
  })

  it('表があるのに記録の無い DB には、古い移行を流し直さないよう何も当てずに止まる', async () => {
    const pool = poolInSchema()
    await pool.query('CREATE TABLE first_table (id int PRIMARY KEY)')
    await expect(applyPendingMigrations(pool, files)).rejects.toThrow(/has tables but no schema_migrations/)
    expect((await pool.query("SELECT to_regclass('schema_migrations') AS table")).rows[0].table).toBeNull()
  })

  it('失敗した移行は中身も記録も残さず、それより前の移行は記録に残る', async () => {
    const pool = poolInSchema()
    const failing = [files[0]!, migration('002_broken.sql', 'CREATE TABLE half_done (id int); SELECT 1 / 0;')]
    await expect(applyPendingMigrations(pool, failing)).rejects.toThrow(MigrationStateError)
    expect((await pool.query('SELECT name FROM schema_migrations')).rows).toEqual([{ name: '001_first.sql' }])
    expect((await pool.query("SELECT to_regclass('half_done') AS table")).rows[0].table).toBeNull()
  })
})

describe('移行が済んでいるかの確認 (api-lineage と media-worker)', () => {
  const files = [migration('001_first.sql', 'CREATE TABLE first_table (id int PRIMARY KEY);')]

  it('記録が無い・未適用が残る・中身が違うときは起動させない', async () => {
    const pool = poolInSchema()
    await expect(assertMigrationsApplied(pool, files)).rejects.toThrow(/schema_migrations does not exist/)
    await applyPendingMigrations(pool, files)
    const next = migration('002_next.sql', 'CREATE TABLE next_table (id int);')
    await expect(assertMigrationsApplied(pool, [...files, next])).rejects.toThrow(/not applied yet: 002_next\.sql/)
    const changed = [migration('001_first.sql', 'CREATE TABLE first_table (id bigint);')]
    await expect(assertMigrationsApplied(pool, changed)).rejects.toThrow(/were changed/)
  })

  it('全部当たっていれば通る。適用中なら終わるまで待つ', async () => {
    const slow = [...files, migration('002_slow.sql', 'SELECT pg_sleep(0.3); CREATE TABLE slow_table (id int);')]
    const applying = applyPendingMigrations(poolInSchema(), slow)
    await waitUntilMigrationLockIsHeld()
    await expect(assertMigrationsApplied(poolInSchema(), slow)).resolves.toBeUndefined()
    expect(await applying).toEqual(['001_first.sql', '002_slow.sql'])
  })
})

describe('手で当ててきた DB を適用済みとして記録する', () => {
  // 中身を実行すると失敗する SQL にして、記録だけで実行しないことを確かめる。
  const files = [
    migration('001_first.sql', 'SELECT 1 / 0;'),
    migration('002_second.sql', 'SELECT 1 / 0;'),
    migration('003_third.sql', 'CREATE TABLE third_table (id int);'),
  ]

  it('指定した番号までを実行せずに記録し、残りは次の起動で当たる', async () => {
    const pool = poolInSchema()
    await pool.query('CREATE TABLE existing_table (id text PRIMARY KEY)')
    expect(await recordAppliedMigrations(pool, '002', files)).toEqual(['001_first.sql', '002_second.sql'])
    expect(await applyPendingMigrations(pool, files)).toEqual(['003_third.sql'])
  })

  it('記録が既にある DB・表の無い DB・存在しない番号では断る', async () => {
    const pool = poolInSchema()
    await expect(recordAppliedMigrations(pool, '009', files)).rejects.toThrow(/no migration file starts with 009_/)
    await expect(recordAppliedMigrations(pool, '002', files)).rejects.toThrow(/has no tables/)
    await pool.query('CREATE TABLE existing_table (id text PRIMARY KEY)')
    await recordAppliedMigrations(pool, '001', files)
    await expect(recordAppliedMigrations(pool, '002', files)).rejects.toThrow(/already exists/)
  })
})

describe('同梱の移行ファイル', () => {
  it('番号は 3 桁で重ならず、名前の順が番号の順になっている', async () => {
    const names = (await readMigrationFiles()).map(file => file.name)
    expect(names.length).toBeGreaterThan(40)
    for (const name of names) expect(name).toMatch(/^\d{3}_[a-z0-9_]+\.sql$/)
    const numbers = names.map(name => name.slice(0, 3))
    expect(new Set(numbers).size).toBe(numbers.length)
  })
})
