import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { bearerToken } from './service-key-authenticator.js'
import type { AccessTokenPrincipal } from './auth-types.js'
import type { SessionStore } from './auth-session-store.js'
import { setRequestPrincipal } from './rbac.js'
import { apiError } from './api-error.js'

export function requireInternalApiAuthentication(deps: {
  sessions: Pick<SessionStore, 'authenticateSession'>
  authenticateToken(token: string): Promise<AccessTokenPrincipal | null>
  cookieName: string
  idleSeconds: number
}): MiddlewareHandler {
  return async (context, next) => {
    // Authorizationヘッダーを明示した要求は、決してブラウザのcookieでの認証に回さない。
    const authorization = context.req.header('Authorization')
    if (authorization !== undefined) {
      const token = bearerToken(authorization)
      if (!token) return context.json(apiError('invalid_token', 'invalid bearer token'), 401)
      let principal
      try { principal = await deps.authenticateToken(token) }
      catch { return context.json(apiError('authentication_unavailable', 'authentication service unavailable'), 503) }
      if (!principal) return context.json(apiError('invalid_token', 'invalid access token'), 401)
      setRequestPrincipal(context, principal)
    } else {
      const token = getCookie(context, deps.cookieName)
      const principal = token ? await deps.sessions.authenticateSession(token, deps.idleSeconds) : null
      if (!principal) return context.json(apiError('authentication_required', 'unauthorized'), 401)
      setRequestPrincipal(context, principal)
    }
    await next()
  }
}
