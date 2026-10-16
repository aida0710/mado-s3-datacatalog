import type { Context, MiddlewareHandler } from 'hono'
import type { RequestPrincipal, SessionPrincipal } from './auth-types.js'
import { hasPermission } from './auth-types.js'

const PRINCIPAL_KEY = 'madoPrincipal'

export function setSessionPrincipal(c: Context, principal: SessionPrincipal): void {
  setRequestPrincipal(c, principal)
}

export function setRequestPrincipal(c: Context, principal: RequestPrincipal): void {
  c.set(PRINCIPAL_KEY, principal)
}

export function getRequestPrincipal(c: Context): RequestPrincipal | null {
  return c.get(PRINCIPAL_KEY) as RequestPrincipal | undefined ?? null
}

export function getSessionPrincipal(c: Context): SessionPrincipal | null {
  const got = c.get(PRINCIPAL_KEY) as SessionPrincipal | undefined
  return got?.kind === 'user' ? got : null
}

export function requirePermission(permission: string): MiddlewareHandler {
  return async (c, next) => {
    const principal = getRequestPrincipal(c)
    if (!principal) return c.json({ error: 'unauthorized' }, 401)
    if (!hasPermission(principal, permission)) {
      return c.json({ error: 'forbidden', permission }, 403)
    }
    await next()
  }
}
