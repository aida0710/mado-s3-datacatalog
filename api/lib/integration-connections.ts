import type { Pool } from 'pg'
import { CONNECTION_SETTINGS_SUBQUERY } from '../storage.js'
import { settingsToProfile, type Provider } from './pricing.js'

/** 連携先に見せる接続。どのストレージかを選ぶのに要るものだけで、エンドポイントや鍵は含めない。 */
export interface IntegrationConnection {
  id: string
  name: string
  provider: Provider
}

export interface IntegrationConnectionReader {
  /** `connectionIds`がnullなら全接続。名前順で返す。 */
  list(connectionIds: ReadonlySet<string> | null): Promise<IntegrationConnection[]>
}

export function createIntegrationConnectionReader(pool: Pool): IntegrationConnectionReader {
  return {
    async list(connectionIds) {
      const result = await pool.query<{
        id: string; name: string; endpoint: string; region: string; settings: Record<string, string>
      }>(
        `SELECT c.id, c.name, c.endpoint, c.region, ${CONNECTION_SETTINGS_SUBQUERY}
           FROM storage_connections c
          WHERE $1::text[] IS NULL OR c.id = ANY($1::text[])
          ORDER BY lower(c.name), c.id`,
        [connectionIds === null ? null : [...connectionIds]],
      )
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        provider: settingsToProfile(row, row.settings).provider,
      }))
    },
  }
}
