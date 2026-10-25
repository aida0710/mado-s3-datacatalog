import { Pool, type PoolClient } from 'pg'

export interface Pools {
  rw: Pool
  ro: Pool
}

export interface PoolConfig {
  rw: string
  ro: string
}

export function createPools(config: PoolConfig): Pools {
  return {
    rw: new Pool({ connectionString: config.rw, max: 10 }),
    ro: new Pool({ connectionString: config.ro, max: 10 }),
  }
}

export async function closePools(p: Pools): Promise<void> {
  await Promise.all([p.rw.end(), p.ro.end()])
}

/** Pool でも transaction 中の client でも同じように SQL を投げられる相手。 */
export type Queryable = Pool | PoolClient

/**
 * fn を 1 つの transaction で実行する。fn が投げたら ROLLBACK して投げ直す。
 * ROLLBACK 自体の失敗で元の例外を隠さないよう、ROLLBACK の失敗はログにだけ残す。
 */
export async function withTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    return await inTransaction(client, () => fn(client))
  } finally {
    client.release()
  }
}

/** 既に借りている client の上で fn を 1 つの transaction にする。advisory lock のように接続に結び付いた状態を保ったまま使う。 */
export async function inTransaction<T>(client: PoolClient, fn: () => Promise<T>): Promise<T> {
  await client.query('BEGIN')
  try {
    const result = await fn()
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(rollbackError => console.error('rollback failed', rollbackError))
    throw error
  }
}
