import type { Pool } from 'pg'
import type { AccessTokenPrincipal, ServicePrincipal } from './auth-types.js'
import { isInternalApiPermission } from '../shared/access-token-permissions.js'
import { equalDigest, sha256 } from './auth-crypto.js'
import { ACTIVE_SERVICE_KEY_CONDITION } from './service-account-key-record.js'

export function createInternalTokenAuthenticator(deps: {
  pool: Pool
  authenticate(token: string): Promise<ServicePrincipal | null>
}) {
  return async (token: string): Promise<AccessTokenPrincipal | null> => {
    const principal = await deps.authenticate(token)
    if (!principal) return null
    const grants = await deps.pool.query<{ name: string; secret_hash: Buffer; scopes: string[]; namespaces: string[];
      permissions: string[]; connections: string[] | null }>(`
      SELECT k.name, k.secret_hash,
        ARRAY(SELECT scope FROM service_account_key_scopes WHERE key_id=k.id ORDER BY scope) AS scopes,
        ARRAY(SELECT namespace FROM service_account_key_namespaces WHERE key_id=k.id ORDER BY namespace) AS namespaces,
        ARRAY(SELECT permission FROM service_account_key_permissions WHERE key_id=k.id ORDER BY permission) AS permissions,
        CASE WHEN k.connections_restricted THEN
          ARRAY(SELECT connection_id FROM service_account_key_connections WHERE key_id=k.id ORDER BY connection_id)
        ELSE NULL END AS connections
      FROM service_account_keys k JOIN service_accounts a ON a.id=k.service_account_id
      WHERE k.id=$1 AND ${ACTIVE_SERVICE_KEY_CONDITION}`, [principal.keyId])
    const row = grants.rows[0]
    // Read all grants from one snapshot and recheck the secret if regeneration raced with authentication.
    if (!row || !equalDigest(row.secret_hash, sha256(token.slice(token.indexOf('.') + 1)))) return null
    return { ...principal, tokenName: row.name,
      scopes: row.scopes, namespaces: row.namespaces,
      permissions: row.permissions.filter(isInternalApiPermission), connections: row.connections }
  }
}
