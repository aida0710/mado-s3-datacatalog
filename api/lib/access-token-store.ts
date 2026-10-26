import type { Pool, PoolClient } from 'pg'
import { withTransaction, type Queryable } from '../db.js'
import { newId, randomToken, sha256 } from './auth-crypto.js'
import { ACTIVE_SERVICE_KEY_CONDITION, insertServiceAccountKey, insertServiceKeyPermissions, SERVICE_KEY_SECRET_BYTES } from './service-account-key-record.js'
import { accessTokenGrants } from './access-token-grants.js'
import { saveInternalTokenGrants } from './internal-token-grants.js'
import { serviceKeyScopesForPermissions } from '../shared/access-token-permissions.js'
import type { AccessToken, AccessTokenInput, AccessTokenPatch, AccessTokenRow, AccessTokenUpdate } from './access-token-types.js'

// 内部の持ち主の名前は、既存のservice_accountsの名前の制約に収める。
const ACCOUNT_NAME_MAX_LENGTH = 128
const TOKEN_SELECT = `SELECT k.id, k.service_account_id,
  k.name, k.description, k.token_prefix, k.created_at, k.expires_at,
  k.disabled_at, k.regenerated_at, k.last_used_at, k.revision,
  COALESCE((SELECT array_agg(scope ORDER BY scope) FROM service_account_key_scopes WHERE key_id = k.id), ARRAY[]::text[]) AS scopes,
  COALESCE((SELECT array_agg(namespace ORDER BY namespace) FROM service_account_key_namespaces WHERE key_id = k.id), ARRAY[]::text[]) AS namespaces,
  ARRAY(SELECT permission FROM service_account_key_permissions WHERE key_id=k.id ORDER BY permission) AS permissions,
  ARRAY(SELECT connection_id FROM service_account_key_connections WHERE key_id=k.id ORDER BY connection_id) AS connections
  FROM service_account_keys k
  WHERE k.revoked_at IS NULL`

export class AccessTokenConflictError extends Error {
  constructor() { super('access token has changed; reload and try again') }
}

export class AccessTokenPermissionsError extends Error {
  constructor() { super('invalid access token permissions') }
}

export class AccessTokenActorInactiveError extends Error {
  constructor() { super('the calling access token is no longer active') }
}

/** トークンの呼び出し元を、書き込みと同じトランザクションの中で、ロックした対象と照らし合わせる。 */
export interface AccessTokenWriteGuard {
  /** 呼び出したアクセストークンのkey ID。書き込みを確定する時点でも有効でなければならない。 */
  actorKeyId?: string
  authorize?(current: AccessToken): Promise<void>
}

// 認証と同じ条件。要求の途中で無効化・失効された呼び出し元は、書き込みを終えられない。
// 行はロックしない。ロックすると、互いを編集する2つのトークンが逆の順にロックしてデッドロックする。
const ACTIVE_KEY_SELECT = `SELECT 1 FROM service_account_keys k WHERE k.id = $1 AND ${ACTIVE_SERVICE_KEY_CONDITION}`

async function assertActorActive(database: Queryable, guard: AccessTokenWriteGuard | undefined): Promise<void> {
  if (!guard?.actorKeyId) return
  const active = await database.query(ACTIVE_KEY_SELECT, [guard.actorKeyId])
  if (!active.rows[0]) throw new AccessTokenActorInactiveError()
}

function toAccessToken(row: AccessTokenRow): AccessToken {
  const disabled = row.disabled_at !== null
  const expired = row.expires_at !== null && row.expires_at.getTime() <= Date.now()
  return {
    id: row.id, name: row.name, description: row.description, tokenPrefix: row.token_prefix,
    scopes: row.scopes, namespaces: row.namespaces, permissions: row.permissions, connections: row.connections,
    status: disabled ? 'disabled' : expired ? 'expired' : 'active',
    createdAt: row.created_at, expiresAt: row.expires_at, regeneratedAt: row.regenerated_at,
    lastUsedAt: row.last_used_at, revision: row.revision,
  }
}

async function getTokenRow(database: Queryable, id: string): Promise<AccessTokenRow | null> {
  const selected = await database.query<AccessTokenRow>(`${TOKEN_SELECT} AND k.id = $1`, [id])
  return selected.rows[0] ?? null
}

function haveSameMembers(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every(value => right.includes(value))
}

function tokenNeedsUpdate(row: AccessTokenRow, patch: AccessTokenPatch): boolean {
  if (patch.name !== undefined && patch.name !== row.name) return true
  if (patch.description !== undefined && patch.description !== row.description) return true
  if (patch.expiresAt !== undefined && patch.expiresAt?.getTime() !== row.expires_at?.getTime()) return true
  if (patch.namespaces !== undefined && !haveSameMembers(patch.namespaces, row.namespaces)) return true
  if (patch.permissions !== undefined && !haveSameMembers(patch.permissions, row.permissions)) return true
  if (patch.connections !== undefined && !haveSameMembers(patch.connections, row.connections)) return true
  if (patch.status === 'disabled') return row.disabled_at === null
  if (patch.status === 'active') return row.disabled_at !== null
  return false
}

async function lockToken(database: PoolClient, input: { id: string; expectedRevision: number },
  guard?: AccessTokenWriteGuard): Promise<AccessTokenRow | null> {
  const selected = await database.query<AccessTokenRow>(`${TOKEN_SELECT} AND k.id = $1 FOR UPDATE OF k`, [input.id])
  const row = selected.rows[0]
  if (!row) return null
  // revisionを比べる前に、ロックした行で認可する。拒否したときにrevisionを明かさないため。
  await guard?.authorize?.(toAccessToken(row))
  if (row.revision !== input.expectedRevision) throw new AccessTokenConflictError()
  await assertActorActive(database, guard)
  return row
}

export interface AccessTokenStore {
  listTokens(): Promise<AccessToken[]>
  getToken(id: string): Promise<AccessToken | null>
  createToken(input: AccessTokenInput & { createdBy: string | null }, guard?: AccessTokenWriteGuard): Promise<{ accessToken: AccessToken; token: string }>
  updateToken(input: { id: string; expectedRevision: number; patch: AccessTokenPatch }, guard?: AccessTokenWriteGuard): Promise<AccessTokenUpdate | null>
  regenerateToken(input: { id: string; expectedRevision: number }, guard?: AccessTokenWriteGuard): Promise<{ accessToken: AccessToken; token: string } | null>
  deleteToken(input: { id: string; expectedRevision: number }, guard?: AccessTokenWriteGuard): Promise<AccessToken | null>
}

export function createAccessTokenStore(pool: Pool): AccessTokenStore {
  return {
    async listTokens() {
      const rows = await pool.query<AccessTokenRow>(`${TOKEN_SELECT} ORDER BY k.created_at DESC, k.id`)
      return rows.rows.map(toAccessToken)
    },
    async getToken(id) {
      const row = await getTokenRow(pool, id)
      return row ? toAccessToken(row) : null
    },
    createToken: (input, guard) => withTransaction(pool, async database => {
      const parsed = accessTokenGrants.safeParse(input)
      if (!parsed.success) throw new AccessTokenPermissionsError()
      await assertActorActive(database, guard)
      const grants = parsed.data
      const accountId = newId()
      // 新しいトークンごとに内部の持ち主を1つ作り、Registry・監査の主体IDの契約を保つ。
      const suffix = ` [${accountId}]`
      const accountName = `${input.name.slice(0, ACCOUNT_NAME_MAX_LENGTH - suffix.length)}${suffix}`
      await database.query(
        'INSERT INTO service_accounts (id, name, description, created_by) VALUES ($1, $2, $3, $4)',
        [accountId, accountName, input.description, input.createdBy],
      )
      const issued = await insertServiceAccountKey(database, {
        ...input, ...grants, scopes: serviceKeyScopesForPermissions(grants.permissions), accountId,
      })
      await saveInternalTokenGrants(database, { id: issued.id, ...grants })
      return { accessToken: toAccessToken((await getTokenRow(database, issued.id))!), token: issued.token }
    }),
    updateToken: (input, guard) => withTransaction(pool, async database => {
      const row = await lockToken(database, input, guard)
      if (!row) return null
      const parsed = accessTokenGrants.safeParse({
        namespaces: input.patch.namespaces ?? row.namespaces,
        permissions: input.patch.permissions ?? row.permissions,
        connections: input.patch.connections ?? row.connections,
      })
      if (!parsed.success) throw new AccessTokenPermissionsError()
      const grants = parsed.data
      if (!tokenNeedsUpdate(row, { ...input.patch, ...grants })) return { accessToken: toAccessToken(row), changed: false }
      if (input.patch.permissions !== undefined || input.patch.namespaces !== undefined) {
        // 連携scopeは権限に合わせる。
        await database.query('DELETE FROM service_account_key_scopes WHERE key_id = $1', [input.id])
        await database.query('DELETE FROM service_account_key_namespaces WHERE key_id = $1', [input.id])
        await insertServiceKeyPermissions(database, {
          id: input.id, scopes: serviceKeyScopesForPermissions(grants.permissions), namespaces: grants.namespaces,
        })
      }
      if (input.patch.permissions !== undefined || input.patch.connections !== undefined) {
        await saveInternalTokenGrants(database, { id: input.id, ...grants })
      }
      await database.query(`UPDATE service_account_keys SET name = $2, description = $3, expires_at = $4,
        disabled_at = CASE WHEN $5 = 'disabled' THEN COALESCE(disabled_at, now())
                           WHEN $5 = 'active' THEN NULL ELSE disabled_at END,
        revision = revision + 1 WHERE id = $1`,
      [input.id, input.patch.name ?? row.name, input.patch.description ?? row.description,
        input.patch.expiresAt === undefined ? row.expires_at : input.patch.expiresAt, input.patch.status ?? null])
      return { accessToken: toAccessToken((await getTokenRow(database, input.id))!), changed: true }
    }),
    regenerateToken: (input, guard) => withTransaction(pool, async database => {
      const row = await lockToken(database, input, guard)
      if (!row) return null
      const secret = randomToken(SERVICE_KEY_SECRET_BYTES)
      await database.query(`UPDATE service_account_keys SET secret_hash = $2, regenerated_at = now(),
        revision = revision + 1 WHERE id = $1`, [input.id, sha256(secret)])
      return { accessToken: toAccessToken((await getTokenRow(database, input.id))!), token: `${row.token_prefix}.${secret}` }
    }),
    deleteToken: (input, guard) => withTransaction(pool, async database => {
      const row = await lockToken(database, input, guard)
      if (!row) return null
      // 過去の監査とRegistryの記録が誰のものか分かるよう、keyと持ち主のIDは残す。
      await database.query('UPDATE service_account_keys SET revoked_at = now(), revision = revision + 1 WHERE id = $1', [input.id])
      return toAccessToken(row)
    }),
  }
}
