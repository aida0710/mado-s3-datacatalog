import type { Queryable } from '../db.js'
import type { IssuedServiceAccountKey } from './auth-api-keys.js'
import { newId, randomToken, sha256 } from './auth-crypto.js'

// Existing producers and the database constraint depend on this public prefix.
const SERVICE_KEY_TOKEN_PREFIX = 'mado_lin_'
const PUBLIC_ID_LENGTH = 16
// Keep 256 bits of entropy for both first issuance and regeneration.
export const SERVICE_KEY_SECRET_BYTES = 32

export async function insertServiceAccountKey(database: Queryable, input: {
  accountId: string
  name: string
  description?: string
  scopes: string[]
  namespaces: string[]
  expiresAt?: Date | null
  createdBy: string
}): Promise<IssuedServiceAccountKey> {
  const id = newId()
  const tokenPrefix = `${SERVICE_KEY_TOKEN_PREFIX}${id.replaceAll('-', '').slice(0, PUBLIC_ID_LENGTH)}`
  const secret = randomToken(SERVICE_KEY_SECRET_BYTES)
  const inserted = await database.query<{ created_at: Date }>(
    `INSERT INTO service_account_keys
       (id, service_account_id, name, token_prefix, secret_hash, created_by, expires_at, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING created_at`,
    [id, input.accountId, input.name.trim(), tokenPrefix, sha256(secret), input.createdBy, input.expiresAt ?? null, input.description ?? ''],
  )
  const scopes = [...new Set(input.scopes)].sort()
  const namespaces = [...new Set(input.namespaces)].sort()
  await insertServiceKeyPermissions(database, { id, scopes, namespaces })
  return {
    id, serviceAccountId: input.accountId, name: input.name.trim(), tokenPrefix, scopes, namespaces,
    createdAt: inserted.rows[0].created_at, expiresAt: input.expiresAt ?? null,
    revokedAt: null, lastUsedAt: null, token: `${tokenPrefix}.${secret}`,
  }
}

export async function insertServiceKeyPermissions(database: Queryable, input: {
  id: string
  scopes: string[]
  namespaces: string[]
}): Promise<void> {
  for (const scope of input.scopes)
    await database.query('INSERT INTO service_account_key_scopes (key_id, scope) VALUES ($1, $2)', [input.id, scope])
  for (const namespace of input.namespaces)
    await database.query('INSERT INTO service_account_key_namespaces (key_id, namespace) VALUES ($1, $2)', [input.id, namespace])
}
