import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closePools, createPools } from '../db.js'
import { createIntegrationConnectionReader } from './integration-connections.js'

const RW = process.env.MDC_TEST_DATABASE_URL
  ?? 'postgres://dashboard_rw:CHANGEME@localhost:5432/dashboard_test'
const RO = RW.replace('dashboard_rw', 'dashboard_ro')
const pools = createPools({ rw: RW, ro: RO })
const reader = createIntegrationConnectionReader(pools.ro)
const AWS_ID = 'intconnaws'
const EXPLICIT_ID = 'intconnexp'

beforeAll(async () => {
  await pools.rw.query(
    `INSERT INTO storage_connections
       (id, name, endpoint, access_key_id_enc, secret_access_key_enc, access_key_id_masked)
     VALUES ($1, 'integration b aws', 'https://s3.ap-northeast-1.amazonaws.com', 'x', 'x', 'x'),
            ($2, 'integration a explicit', 'https://storage.example.test', 'x', 'x', 'x')
     ON CONFLICT (id) DO NOTHING`, [AWS_ID, EXPLICIT_ID],
  )
  await pools.rw.query(
    `INSERT INTO connection_settings (connection_id, key, value) VALUES ($1, 'provider', 'onprem')
     ON CONFLICT (connection_id, key) DO UPDATE SET value = EXCLUDED.value`, [EXPLICIT_ID],
  )
})
afterAll(async () => {
  await pools.rw.query('DELETE FROM storage_connections WHERE id = ANY($1::text[])', [[AWS_ID, EXPLICIT_ID]])
  await closePools(pools)
})

describe('createIntegrationConnectionReader', () => {
  it('挙げた接続だけを名前順で返し、種類は設定があればそれを、無ければエンドポイントから決める', async () => {
    expect(await reader.list(new Set([AWS_ID, EXPLICIT_ID, 'intconnnone']))).toEqual([
      { id: EXPLICIT_ID, name: 'integration a explicit', provider: 'onprem' },
      { id: AWS_ID, name: 'integration b aws', provider: 'aws' },
    ])
    expect(await reader.list(new Set())).toEqual([])
  })

  it('nullなら全接続を返す', async () => {
    const ids = (await reader.list(null)).map(connection => connection.id)
    expect(ids).toEqual(expect.arrayContaining([AWS_ID, EXPLICIT_ID]))
  })
})
