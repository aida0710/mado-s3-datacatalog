import type { MiddlewareHandler } from 'hono'
import type { InternalApiPermission } from '../shared/access-token-permissions.js'
import { hasPermission } from './auth-types.js'
import { coversAllConnections } from './access-token-authority.js'
import { getRequestPrincipal } from './rbac.js'
import { apiError } from './api-error.js'

interface PermissionRoute {
  methods: readonly string[]
  path: RegExp
  permission: InternalApiPermission
  /** The route changes what every connection shares, so a token limited to some connections cannot use it. */
  requiresAllConnections?: true
}

const permissionRoutes: readonly PermissionRoute[] = [
  { methods: ['GET'], path: /^\/connections$/, permission: 'connections:read' },
  { methods: ['GET'], path: /^\/connections\/access-users$/, permission: 'connections:manage' },
  { methods: ['POST'], path: /^\/connections$/, permission: 'connections:manage', requiresAllConnections: true },
  { methods: ['PUT'], path: /^\/connections\/[^/]+\/default$/, permission: 'connections:manage', requiresAllConnections: true },
  { methods: ['PUT'], path: /^\/connections\/[^/]+$/, permission: 'connections:manage' },
  { methods: ['DELETE'], path: /^\/connections\/[^/]+$/, permission: 'connections:delete' },
  { methods: ['GET'], path: /^\/storage\/[^/]+\/(?:buckets|list|preview\/[^/]+|media\/[^/]+)$/, permission: 'storage:read' },
  { methods: ['GET'], path: /^\/storage\/[^/]+\/(?:readme(?:\/history(?:\/[^/]+)?)?|readmes\/search)$/, permission: 'readmes:read' },
  { methods: ['PUT'], path: /^\/storage\/[^/]+\/readme$/, permission: 'readmes:write' },
  { methods: ['GET'], path: /^\/notes\/[^/]+(?:\/history(?:\/[^/]+)?)?$/, permission: 'notes:read' },
  { methods: ['PUT'], path: /^\/notes\/[^/]+$/, permission: 'notes:write' },
  { methods: ['GET'], path: /^\/(?:tags|storage\/[^/]+\/tags(?:\/search)?)$/, permission: 'tags:read' },
  // Tag definitions are shared by every connection.
  { methods: ['POST'], path: /^\/tags$/, permission: 'tags:write', requiresAllConnections: true },
  { methods: ['PUT'], path: /^\/tags\/[^/]+$/, permission: 'tags:write', requiresAllConnections: true },
  { methods: ['DELETE'], path: /^\/tags\/[^/]+$/, permission: 'tags:delete', requiresAllConnections: true },
  { methods: ['PUT'], path: /^\/storage\/[^/]+\/tags$/, permission: 'tags:write' },
  { methods: ['DELETE'], path: /^\/storage\/[^/]+\/tags$/, permission: 'tags:delete' },
  { methods: ['GET'], path: /^\/storage\/[^/]+\/favorites$/, permission: 'favorites:read' },
  { methods: ['PUT'], path: /^\/storage\/[^/]+\/favorites\/[^/]+$/, permission: 'favorites:write' },
  { methods: ['DELETE'], path: /^\/storage\/[^/]+\/favorites\/[^/]+$/, permission: 'favorites:delete' },
  { methods: ['GET'], path: /^\/lineage\/(?:graph|search|catalog|resolve-location|projection-status|job-runs|(?:datasets|versions|runs)\/[^/]+)$/, permission: 'lineage:read' },
  { methods: ['POST'], path: /^\/lineage\/curation\/(?:datasets|locations|runs)$/, permission: 'lineage:curate' },
  { methods: ['PATCH'], path: /^\/lineage\/curation\/datasets\/[^/]+$/, permission: 'lineage:curate' },
  { methods: ['GET'], path: /^\/jobs\/[^/]+$/, permission: 'jobs:read' },
  { methods: ['POST'], path: /^\/(?:jobs\/[^/]+\/cancel|storage\/[^/]+\/scan)$/, permission: 'jobs:operate' },
  { methods: ['GET'], path: /^\/storage\/[^/]+\/capacity(?:\/prefix)?$/, permission: 'capacity:read' },
  { methods: ['POST'], path: /^\/storage\/[^/]+\/capacity\/scan$/, permission: 'capacity:operate' },
  { methods: ['GET'], path: /^\/(?:pricing|storage\/[^/]+\/estimate)$/, permission: 'pricing:read' },
  { methods: ['POST'], path: /^\/pricing\/refresh$/, permission: 'pricing:refresh' },
  { methods: ['GET'], path: /^\/settings$/, permission: 'settings:read' },
  { methods: ['PUT'], path: /^\/settings\/[^/]+$/, permission: 'settings:manage' },
  { methods: ['GET'], path: /^\/users$/, permission: 'users:read' },
  { methods: ['POST'], path: /^\/users$/, permission: 'users:manage' },
  { methods: ['PATCH', 'DELETE'], path: /^\/users\/[^/]+$/, permission: 'users:manage' },
  { methods: ['PUT'], path: /^\/users\/[^/]+\/roles$/, permission: 'users:manage' },
  { methods: ['POST'], path: /^\/users\/[^/]+\/reset-password$/, permission: 'users:manage' },
  { methods: ['GET'], path: /^\/access-tokens(?:\/namespaces)?$/, permission: 'service_accounts:read' },
  { methods: ['POST'], path: /^\/access-tokens$/, permission: 'service_accounts:manage' },
  { methods: ['PATCH', 'DELETE'], path: /^\/access-tokens\/[^/]+$/, permission: 'service_accounts:manage' },
  { methods: ['POST'], path: /^\/access-tokens\/[^/]+\/regenerate$/, permission: 'service_accounts:manage' },
  // As for users, audit:read reads the whole log; connection and namespace limits do not narrow it.
  { methods: ['GET'], path: /^\/audit-events$/, permission: 'audit:read' },
]

function internalApiPath(pathname: string): string {
  return pathname.replace(/^\/api\/internal(?=\/|$)/, '').replace(/\/$/, '') || '/'
}

function findPermissionRoute(method: string, pathname: string): PermissionRoute | null {
  const path = internalApiPath(pathname)
  const verb = method === 'HEAD' ? 'GET' : method
  return permissionRoutes.find(route => route.methods.includes(verb) && route.path.test(path)) ?? null
}

export function internalApiPermission(method: string, pathname: string): InternalApiPermission | null {
  return findPermissionRoute(method, pathname)?.permission ?? null
}

export function requireInternalApiPermission(): MiddlewareHandler {
  return async (context, next) => {
    const principal = getRequestPrincipal(context)
    if (!principal) return context.json(apiError('authentication_required', 'unauthorized'), 401)
    if (principal.kind === 'user' && !hasPermission(principal, 'storage:read')) {
      return context.json({ ...apiError('forbidden', 'forbidden'), permission: 'storage:read' }, 403)
    }
    const route = findPermissionRoute(context.req.method, context.req.path)
    if (route && !hasPermission(principal, route.permission)) {
      return context.json({ ...apiError('forbidden', 'forbidden'), permission: route.permission }, 403)
    }
    if (principal.kind === 'user' && route?.permission === 'lineage:curate' && !hasPermission(principal, 'lineage:read')) {
      return context.json({ ...apiError('forbidden', 'forbidden'), permission: 'lineage:read' }, 403)
    }
    if (principal.kind === 'service_account') {
      // New endpoints stay closed to tokens until they have an explicit policy.
      if (!route) return context.json(apiError('token_endpoint_forbidden', 'endpoint is not available to access tokens'), 403)
      if (route.requiresAllConnections && !coversAllConnections(principal)) {
        return context.json(apiError('all_connections_token_required', 'this operation requires a token for all connections'), 403)
      }
    }
    await next()
  }
}
