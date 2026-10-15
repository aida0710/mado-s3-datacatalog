import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { bearerToken } from './auth-api-keys.js'
import type { AccessTokenPrincipal } from './auth-types.js'
import type { SessionStore } from './auth-session-store.js'
import { setRequestPrincipal } from './rbac.js'

export function requireInternalApiAuthentication(deps: {
  sessions: Pick<SessionStore, 'authenticateSession'>
  authenticateToken(token: string): Promise<AccessTokenPrincipal | null>
  cookieName: string
  idleSeconds: number
}): MiddlewareHandler {
  return async (context, next) => {
    // An explicit Authorization header must never fall back to browser cookies.
    const authorization = context.req.header('Authorization')
    if (authorization !== undefined) {
      const token = bearerToken(authorization)
      if (!token) return context.json({ error: 'invalid bearer token' }, 401)
      let principal
      try { principal = await deps.authenticateToken(token) }
      catch { return context.json({ error: 'authentication service unavailable' }, 503) }
      if (!principal) return context.json({ error: 'invalid access token' }, 401)
      setRequestPrincipal(context, principal)
    } else {
      const token = getCookie(context, deps.cookieName)
      const principal = token ? await deps.sessions.authenticateSession(token, deps.idleSeconds) : null
      if (!principal) return context.json({ error: 'unauthorized' }, 401)
      setRequestPrincipal(context, principal)
    }
    await next()
  }
}
