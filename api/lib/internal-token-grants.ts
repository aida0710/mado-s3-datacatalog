import type { Queryable } from '../db.js'
import type { InternalApiPermission } from '../shared/access-token-permissions.js'

export class UnknownTokenConnectionError extends Error {
  constructor() { super('one or more token connections do not exist') }
}

export async function saveInternalTokenGrants(database: Queryable, input: {
  id: string
  permissions: InternalApiPermission[]
  connections: string[]
}): Promise<void> {
  if (input.connections.length && !input.connections.includes('*')) {
    const known = await database.query<{ id: string }>(`
      SELECT id FROM storage_connections WHERE id=ANY($1::text[])
      UNION SELECT connection_id AS id FROM service_account_key_connections
        WHERE key_id=$2 AND connection_id=ANY($1::text[])`, [input.connections, input.id])
    if (known.rowCount !== input.connections.length) throw new UnknownTokenConnectionError()
  }
  await database.query('DELETE FROM service_account_key_permissions WHERE key_id=$1', [input.id])
  await database.query('DELETE FROM service_account_key_connections WHERE key_id=$1', [input.id])
  await database.query('INSERT INTO service_account_key_permissions (key_id,permission) SELECT $1,unnest($2::text[])', [input.id, input.permissions])
  await database.query('INSERT INTO service_account_key_connections (key_id,connection_id) SELECT $1,unnest($2::text[])', [input.id, input.connections])
}
