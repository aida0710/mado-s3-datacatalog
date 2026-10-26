import { readFile } from 'node:fs/promises'
import { afterAll, describe, expect, it } from 'vitest'
import { closePools, createPools } from '../db.js'

const database = process.env.MDC_TEST_DATABASE_URL ?? 'postgres://dashboard_rw:CHANGEME@localhost:5432/dashboard_test'
const pools = createPools({ rw: database, ro: database })
afterAll(() => closePools(pools))

describe('migration 043', () => {
  it('前置きを mado_dc_ に替え、発行済みの秘密を使えなくし、旧形式の前置きを入れられなくする', async () => {
    const client = await pools.rw.connect()
    try {
      await client.query('BEGIN')
      // 一時表がテスト用 DB の本物の表より先に見つかるので、適用済みのスキーマに触れずに移行を流せる。
      await client.query(`
        CREATE TEMP TABLE service_account_keys (
          id text PRIMARY KEY,
          token_prefix text NOT NULL UNIQUE,
          secret_hash bytea NOT NULL,
          revision integer NOT NULL,
          CONSTRAINT service_account_keys_token_prefix_check CHECK (token_prefix ~ '^mado_lin_[A-Za-z0-9_-]{8,32}$')
        ) ON COMMIT DROP;
        INSERT INTO service_account_keys VALUES
          ('first', 'mado_lin_0123456789abcdef', sha256('known-secret'::bytea), 3),
          ('second', 'mado_lin_fedcba9876543210', sha256('known-secret'::bytea), 1);
      `)
      const migration = await readFile(new URL('../migrations/043_access_token_prefix.sql', import.meta.url), 'utf8')
      await client.query(migration)
      const rows = (await client.query<{ id: string; token_prefix: string; known_secret: boolean; revision: number }>(
        "SELECT id, token_prefix, secret_hash = sha256('known-secret'::bytea) AS known_secret, revision FROM service_account_keys ORDER BY id",
      )).rows
      expect(rows).toEqual([
        { id: 'first', token_prefix: 'mado_dc_0123456789abcdef', known_secret: false, revision: 4 },
        { id: 'second', token_prefix: 'mado_dc_fedcba9876543210', known_secret: false, revision: 2 },
      ])
      await client.query('SAVEPOINT old_prefix')
      await expect(client.query("UPDATE service_account_keys SET token_prefix = 'mado_lin_0123456789abcdef' WHERE id = 'first'"))
        .rejects.toThrow(/service_account_keys_token_prefix_check/)
      await client.query('ROLLBACK TO SAVEPOINT old_prefix')
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
})
