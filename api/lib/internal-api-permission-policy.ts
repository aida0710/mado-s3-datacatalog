import type { MiddlewareHandler } from 'hono'
import type { InternalApiPermission } from '../shared/access-token-permissions.js'
import { hasPermission } from './auth-types.js'
import { getRequestPrincipal } from './rbac.js'

interface PermissionRoute {
  methods: readonly string[]
  path: RegExp
  permission: InternalApiPermission
}

const permissionRoutes: readonly PermissionRoute[] = [
  { methods: ['GET'], path: /^\/connections$/, permission: 'connections:read' },
  { methods: ['GET'], path: /^\/connections\/access-users$/, permission: 'connections:manage' },
  { methods: ['POST'], path: /^\/connections$/, permission: 'connections:manage' },
  { methods: ['PUT'], path: /^\/connections\/[^/]+(?:\/default)?$/, permission: 'connections:manage' },
  { methods: ['DELETE'], path: /^\/connections\/[^/]+$/, permission: 'connections:delete' },
  { methods: ['GET'], path: /^\/storage\/[^/]+\/(?:buckets|list|preview\/[^/]+|media\/[^/]+)$/, permission: 'storage:read' },
  { methods: ['GET'], path: /^\/storage\/[^/]+\/(?:readme(?:\/history(?:\/[^/]+)?)?|readmes\/search)$/, permission: 'readmes:read' },
  { methods: ['PUT'], path: /^\/storage\/[^/]+\/readme$/, permission: 'readmes:write' },
  { methods: ['GET'], path: /^\/notes\/[^/]+(?:\/history(?:\/[^/]+)?)?$/, permission: 'notes:read' },
  { methods: ['PUT'], path: /^\/notes\/[^/]+$/, permission: 'notes:write' },
  { methods: ['GET'], path: /^\/(?:tags|storage\/[^/]+\/tags(?:\/search)?)$/, permission: 'tags:read' },
  { methods: ['POST', 'PUT'], path: /^\/(?:tags(?:\/[^/]+)?|storage\/[^/]+\/tags)$/, permission: 'tags:write' },
  { methods: ['DELETE'], path: /^\/(?:tags\/[^/]+|storage\/[^/]+\/tags)$/, permission: 'tags:delete' },
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
  { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], path: /^\/users(?:\/.*)?$/, permission: 'users:manage' },
  { methods: ['GET'], path: /^\/(?:access-tokens|service-accounts)(?:\/.*)?$/, permission: 'service_accounts:read' },
  { methods: ['POST', 'PATCH', 'DELETE'], path: /^\/access-tokens(?:\/.*)?$/, permission: 'service_accounts:manage' },
  { methods: ['POST', 'PATCH', 'DELETE'], path: /^\/service-accounts(?:\/.*)?$/, permission: 'service_accounts:manage' },
  { methods: ['GET'], path: /^\/audit-events$/, permission: 'audit:read' },
]

function internalApiPath(pathname: string): string {
  return pathname.replace(/^\/api\/internal(?=\/|$)/, '').replace(/\/$/, '') || '/'
}

export function internalApiPermission(method: string, pathname: string): InternalApiPermission | null {
  const path = internalApiPath(pathname)
  const verb = method === 'HEAD' ? 'GET' : method
  return permissionRoutes.find(route => route.methods.includes(verb) && route.path.test(path))?.permission ?? null
}

export function requireInternalApiPermission(): MiddlewareHandler {
  return async (context, next) => {
    const principal = getRequestPrincipal(context)
    if (!principal) return context.json({ error: 'unauthorized' }, 401)
    if (principal.kind === 'user' && !hasPermission(principal, 'storage:read')) {
      return context.json({ error: 'forbidden', permission: 'storage:read' }, 403)
    }
    const permission = internalApiPermission(context.req.method, context.req.path)
    if (permission && !hasPermission(principal, permission)) {
      return context.json({ error: 'forbidden', permission }, 403)
    }
    if (principal.kind === 'user' && permission === 'lineage:curate' && !hasPermission(principal, 'lineage:read')) {
      return context.json({ error: 'forbidden', permission: 'lineage:read' }, 403)
    }
    // New endpoints stay closed to tokens until they have an explicit policy.
    if (!permission && principal.kind === 'service_account') {
      return context.json({ error: 'endpoint is not available to access tokens' }, 403)
    }
    if (principal.kind === 'service_account' && context.req.method !== 'GET' && context.req.method !== 'HEAD') {
      const path = internalApiPath(context.req.path)
      const globalConnectionChange = path === '/connections' || /^\/connections\/[^/]+\/default$/.test(path)
        || /^\/tags(?:\/[^/]+)?$/.test(path)
      if (globalConnectionChange && !principal.connections?.includes('*')) {
        return context.json({ error: 'this operation requires all connections' }, 403)
      }
    }
    await next()
  }
}
