import { readFile } from 'node:fs/promises'
import { afterAll, describe, expect, it } from 'vitest'
import { closePools, createPools } from '../db.js'

const database = process.env.MDC_TEST_DATABASE_URL
if (!database) throw new Error('MDC_TEST_DATABASE_URL is required')
const pools = createPools({ rw: database, ro: database })
afterAll(() => closePools(pools))

describe('migration 041', () => {
  it('設定の実効値を保存しメタ情報か所有接続のないキャッシュを削除する', async () => {
    const client = await pools.rw.connect()
    try {
      await client.query('BEGIN')
      // 一時的な表を使い、移行をテスト用DBの適用済みのスキーマから切り離す。
      await client.query(`
        CREATE TEMP TABLE storage_connections (id text PRIMARY KEY) ON COMMIT DROP;
        CREATE TEMP TABLE connection_settings (
          connection_id text NOT NULL, key text NOT NULL, value text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (connection_id, key)
        ) ON COMMIT DROP;
        CREATE TEMP TABLE media_cache (cache_key text PRIMARY KEY, meta jsonb, connection_id text) ON COMMIT DROP;
        INSERT INTO storage_connections VALUES ('missing'), ('configured');
        INSERT INTO connection_settings (connection_id, key, value) VALUES
          ('configured', 'cap.download', 'false'), ('configured', 'cap.preview', 'true'),
          ('configured', 'cap.list', 'FALSE'), ('configured', 'scan_enabled', '0'),
          ('configured', 'capacity_metrics_enabled', ''), ('configured', 'pricing.provider', 'onprem');
        INSERT INTO media_cache VALUES
          ('sql-null', NULL, 'configured'), ('json-null', 'null', 'configured'),
          ('no-connection', '{}', NULL), ('complete', '{"channels":null}', 'configured');
      `)
      const migration = await readFile(new URL('../migrations/041_explicit_connection_settings_media_cache.sql', import.meta.url), 'utf8')
      await client.query(migration)
      const settings = await client.query<{ connection_id: string; key: string; value: string }>(
        'SELECT connection_id, key, value FROM connection_settings',
      )
      const required = [
        'cap.list', 'cap.preview', 'cap.download', 'cap.archive', 'cap.audioInfo',
        'cap.audioSpectrogram', 'cap.readmeRead', 'cap.readmeWrite', 'scan_enabled', 'capacity_metrics_enabled',
      ]
      for (const connectionId of ['missing', 'configured']) {
        const values = Object.fromEntries(settings.rows.filter(row => row.connection_id === connectionId).map(row => [row.key, row.value]))
        for (const key of required) {
          expect(values[key]).toBe(connectionId === 'configured' && key === 'cap.download' ? 'false' : 'true')
        }
      }
      expect(settings.rows.find(row => row.key === 'pricing.provider')?.value).toBe('onprem')
      expect((await client.query('SELECT * FROM media_cache')).rows).toEqual([
        { cache_key: 'complete', meta: { channels: null }, connection_id: 'configured' },
      ])
      const invalidWrites = [
        "UPDATE connection_settings SET value = '1' WHERE key = 'cap.list'",
        "INSERT INTO media_cache VALUES ('bad', NULL, 'configured')",
        "INSERT INTO media_cache VALUES ('bad', 'null', 'configured')",
        "INSERT INTO media_cache VALUES ('bad', '{}', NULL)",
      ]
      for (const sql of invalidWrites) {
        await client.query('SAVEPOINT invalid_write')
        await expect(client.query(sql)).rejects.toThrow()
        await client.query('ROLLBACK TO SAVEPOINT invalid_write')
      }
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
})
