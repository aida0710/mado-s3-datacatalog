import type { Context, MiddlewareHandler } from 'hono'
import type { Pool } from 'pg'
import { hasPermission, type RequestPrincipal } from './auth-types.js'
import { getRequestPrincipal } from './rbac.js'

/** 接続管理者は全接続へアクセスできる。 */
export function managesConnections(c: Context): boolean {
  const principal = getRequestPrincipal(c)
  return principal !== null && hasPermission(principal, 'connections:manage')
}

/** 現在のUserが接続を利用できるか。非許可時は存在自体を隠すため呼び出し側は404にする。 */
export async function canAccessConnection(
  pool: Pool,
  c: Context,
  connectionId: string,
): Promise<boolean> {
  const caller = getRequestPrincipal(c)
  if (caller?.kind === 'service_account') {
    return caller.connections.includes('*') || caller.connections.includes(connectionId)
  }
  if (!caller || caller.kind !== 'user') return false
  if (hasPermission(caller, 'connections:manage')) return true
  const result = await pool.query(
    `SELECT 1
       FROM storage_connections connection
      WHERE connection.id = $1
        AND (
          connection.visibility_mode = 'public'
          OR EXISTS (
            SELECT 1 FROM connection_user_allowlist allowed
             WHERE allowed.connection_id = connection.id
               AND allowed.user_id = $2
          )
        )`,
    [connectionId, caller.user.id],
  )
  return (result.rowCount ?? 0) > 0
}

/** nullは「管理者なので全件」。通常Userは利用可能なconnection IDだけを返す。 */
export async function connectionIdsForPrincipal(pool: Pool, caller: RequestPrincipal | null): Promise<Set<string> | null> {
  if (caller?.kind === 'service_account') {
    return caller.connections.includes('*') ? null : new Set(caller.connections)
  }
  if (!caller || caller.kind !== 'user') return new Set()
  if (hasPermission(caller, 'connections:manage')) return null
  const result = await pool.query<{ id: string }>(
    `SELECT connection.id
       FROM storage_connections connection
      WHERE connection.visibility_mode = 'public'
         OR EXISTS (
           SELECT 1 FROM connection_user_allowlist allowed
            WHERE allowed.connection_id = connection.id
              AND allowed.user_id = $1
         )`,
    [caller.user.id],
  )
  return new Set(result.rows.map(row => row.id))
}

export function visibleConnectionIds(pool: Pool, c: Context): Promise<Set<string> | null> {
  return connectionIdsForPrincipal(pool, getRequestPrincipal(c))
}

export function requireConnectionAccess(pool: Pool): MiddlewareHandler {
  return async (c, next) => {
    const connectionId = c.req.param('connectionId')
    if (!connectionId) return c.json({ error: 'connectionId required' }, 400)
    if (!await canAccessConnection(pool, c, connectionId)) {
      return c.json({ error: 'connection not found' }, 404)
    }
    await next()
  }
}

export function requireConnectionQueryAccess(pool: Pool): MiddlewareHandler {
  return async (c, next) => {
    const connectionId = c.req.query('connectionId')
    if (!connectionId) return c.json({ error: 'connectionId required' }, 400)
    if (!await canAccessConnection(pool, c, connectionId)) {
      return c.json({ error: 'connection not found' }, 404)
    }
    await next()
  }
}
