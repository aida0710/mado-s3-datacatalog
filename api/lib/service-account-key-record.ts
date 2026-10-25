import type { Queryable } from '../db.js'
import { newId, randomToken, sha256 } from './auth-crypto.js'

// トークンの値の前置き。DB の制約 (migration 043) と同じ。mado ML Tracking は mado_mt_ を使う。
export const SERVICE_KEY_TOKEN_PREFIX = 'mado_dc_'
const PUBLIC_ID_LENGTH = 16
// Keep 256 bits of entropy for both first issuance and regeneration.
export const SERVICE_KEY_SECRET_BYTES = 32
/** When a key may act, for queries aliasing service_account_keys as `k`. */
export const ACTIVE_SERVICE_KEY_CONDITION = `k.revoked_at IS NULL AND k.disabled_at IS NULL
  AND (k.expires_at IS NULL OR k.expires_at > now())`

/** A newly stored key; `token` is returned once and never stored. */
export interface IssuedServiceAccountKey {
  id: string
  token: string
}

export async function insertServiceAccountKey(database: Queryable, input: {
  accountId: string
  name: string
  description?: string
  scopes: string[]
  namespaces: string[]
  expiresAt?: Date | null
  createdBy: string | null
}): Promise<IssuedServiceAccountKey> {
  const id = newId()
  const tokenPrefix = `${SERVICE_KEY_TOKEN_PREFIX}${id.replaceAll('-', '').slice(0, PUBLIC_ID_LENGTH)}`
  const secret = randomToken(SERVICE_KEY_SECRET_BYTES)
  await database.query(
    `INSERT INTO service_account_keys
       (id, service_account_id, name, token_prefix, secret_hash, created_by, expires_at, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, input.accountId, input.name.trim(), tokenPrefix, sha256(secret), input.createdBy, input.expiresAt ?? null, input.description ?? ''],
  )
  const scopes = [...new Set(input.scopes)].sort()
  const namespaces = [...new Set(input.namespaces)].sort()
  await insertServiceKeyPermissions(database, { id, scopes, namespaces })
  return { id, token: `${tokenPrefix}.${secret}` }
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
