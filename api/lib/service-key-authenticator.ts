import type { Pool } from 'pg'
import type { ServicePrincipal } from './auth-types.js'
import { equalDigest, sha256 } from './auth-crypto.js'
import { ACTIVE_SERVICE_KEY_CONDITION, SERVICE_KEY_TOKEN_PREFIX } from './service-account-key-record.js'

const SERVICE_KEY_PREFIX_PATTERN = new RegExp(`^${SERVICE_KEY_TOKEN_PREFIX}[A-Za-z0-9_-]{8,32}$`)
// last_used_at の更新を、request ごとではなくこの間隔に間引いて書き込みを減らす。
const LAST_USED_UPDATE_INTERVAL_SECONDS = 300

interface AuthenticatedKeyRow {
  id: string
  service_account_id: string
  account_name: string
  name: string
  secret_hash: Buffer
  scopes: string[]
  namespaces: string[]
  expires_at: Date | null
  last_used_at: Date | null
}

const AUTHENTICATED_KEY_SELECT = `
  SELECT k.id, k.service_account_id, a.name AS account_name, k.name, k.secret_hash, k.expires_at, k.last_used_at,
         ARRAY(SELECT s.scope FROM service_account_key_scopes s WHERE s.key_id = k.id ORDER BY s.scope) AS scopes,
         ARRAY(SELECT n.namespace FROM service_account_key_namespaces n WHERE n.key_id = k.id ORDER BY n.namespace) AS namespaces
    FROM service_account_keys k
    JOIN service_accounts a ON a.id = k.service_account_id
   WHERE k.token_prefix = $1 AND ${ACTIVE_SERVICE_KEY_CONDITION}`

/** 連携APIと内部APIのために、アクセストークンの値（`<prefix>.<secret>`）を認証する。 */
export function createServiceKeyAuthenticator(pool: Pool): (token: string) => Promise<ServicePrincipal | null> {
  return async token => {
    const dot = token.indexOf('.')
    if (dot < 0 || dot !== token.lastIndexOf('.')) return null
    const prefix = token.slice(0, dot)
    const secret = token.slice(dot + 1)
    if (!SERVICE_KEY_PREFIX_PATTERN.test(prefix) || secret.length < 32 || secret.length > 128) return null
    const row = (await pool.query<AuthenticatedKeyRow>(AUTHENTICATED_KEY_SELECT, [prefix])).rows[0]
    if (!row || !equalDigest(row.secret_hash, sha256(secret))) return null
    if (!row.last_used_at || Date.now() - row.last_used_at.getTime() >= LAST_USED_UPDATE_INTERVAL_SECONDS * 1000) {
      void pool.query(
        `UPDATE service_account_keys SET last_used_at = now()
          WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < now() - ($2 * interval '1 second'))`,
        [row.id, LAST_USED_UPDATE_INTERVAL_SECONDS],
      ).catch(e => console.error('failed to update service key last_used_at', e))
    }
    return {
      kind: 'service_account',
      serviceAccountId: row.service_account_id,
      serviceAccountName: row.account_name,
      keyId: row.id,
      keyName: row.name,
      scopes: row.scopes,
      namespaces: row.namespaces,
      expiresAt: row.expires_at,
    }
  }
}

const BEARER_RE = /^Bearer[ \t]+([^ \t]+)$/i

export function bearerToken(header: string | undefined): string | null {
  const match = BEARER_RE.exec(header ?? '')
  return match?.[1] ?? null
}
