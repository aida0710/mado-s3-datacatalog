import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { internalApiPermission } from './lib/internal-api-permission-policy.js'
import { mountConnectionsRoutes } from './routes/connections.js'
import { mountStorageListRoutes } from './routes/storage-list.js'
import { mountStorageReadmeRoutes } from './routes/storage-readme.js'
import { mountStoragePreviewRoutes } from './routes/storage-preview.js'
import { mountStorageMediaRoutes } from './routes/storage-media.js'
import { mountJobRoutes } from './routes/jobs.js'
import { mountStorageScanRoutes } from './routes/storage-scan.js'
import { mountStorageCapacityRoutes } from './routes/storage-capacity.js'
import { mountStorageEstimateRoutes } from './routes/storage-estimate.js'
import { mountPricingRoutes } from './routes/pricing.js'
import { mountStorageFavoritesRoutes } from './routes/storage-favorites.js'
import { mountSettingsRoutes } from './routes/settings.js'
import { mountNotesRoutes } from './routes/notes.js'
import { mountStorageTagsRoutes } from './routes/storage-tags.js'
import { mountLineageRoutes } from './routes/lineage.js'
import { mountLineageCurationRoutes } from './routes/lineage-curation.js'
import { mountAdminUsersRoutes } from './routes/admin-users.js'
import { mountServiceAccountRoutes } from './routes/service-accounts.js'
import { mountAccessTokenRoutes } from './routes/access-tokens.js'
import { mountAuditRoutes } from './routes/audit.js'

// Every function internal.ts uses to add routes to /api/internal. Mounting them on an empty app
// lists the routes without a database; the dependencies are never called while mounting.
const INTERNAL_ROUTE_MOUNTS = {
  mountConnectionsRoutes, mountStorageListRoutes, mountStorageReadmeRoutes, mountStoragePreviewRoutes,
  mountStorageMediaRoutes, mountJobRoutes, mountStorageScanRoutes, mountStorageCapacityRoutes,
  mountStorageEstimateRoutes, mountPricingRoutes, mountStorageFavoritesRoutes, mountSettingsRoutes,
  mountNotesRoutes, mountStorageTagsRoutes, mountLineageRoutes, mountLineageCurationRoutes,
  mountAdminUsersRoutes, mountServiceAccountRoutes, mountAccessTokenRoutes, mountAuditRoutes,
} as const

// Routes deliberately closed to access tokens; they answer 403 to every token.
const SESSION_ONLY_ROUTES = [
  // The two-level legacy API predates delegation checks; tokens manage tokens through /access-tokens.
  /^\/service-accounts(?:\/|$)/,
]

/** Stands in for any dependency: property reads and calls return another stand-in. */
function placeholderDependency(): unknown {
  return new Proxy(function placeholder() {}, {
    get: (_target, key) => key === 'then' ? undefined : placeholderDependency(),
    apply: () => placeholderDependency(),
  })
}

function internalRoutes(): Array<{ method: string; path: string }> {
  const app = new Hono()
  for (const mount of Object.values(INTERNAL_ROUTE_MOUNTS)) {
    (mount as (app: Hono, deps: unknown) => void)(app, placeholderDependency())
  }
  const routes = app.routes
    .filter(route => route.method !== 'ALL')
    .map(route => ({ method: route.method, path: route.path.replace(/:[A-Za-z]+(?:\{[^}]*\})?\??/g, 'sample-id') }))
  return [...new Map(routes.map(route => [`${route.method} ${route.path}`, route])).values()]
}

describe('内部APIのルートとトークンの権限表', () => {
  it('internal.tsが内部APIへ載せるルート群をすべて確かめている', () => {
    const source = readFileSync(new URL('./internal.ts', import.meta.url), 'utf8')
    const mounted = [...source.matchAll(/\b(mount\w+Routes)\(api\b/g)].map(match => match[1])
    expect(new Set(mounted)).toEqual(new Set(Object.keys(INTERNAL_ROUTE_MOUNTS)))
  })

  it('セッション専用と決めたものを除き、すべてのルートに必要な権限が決まっている', () => {
    const routes = internalRoutes()
    expect(routes.length).toBeGreaterThan(50)
    const undecided = routes.filter(route => !SESSION_ONLY_ROUTES.some(pattern => pattern.test(route.path))
      && internalApiPermission(route.method, `/api/internal${route.path}`) === null)
    expect(undecided).toEqual([])
  })

  it('セッション専用のルートには権限表の項目を置かない', () => {
    const sessionOnly = internalRoutes().filter(route => SESSION_ONLY_ROUTES.some(pattern => pattern.test(route.path)))
    expect(sessionOnly.length).toBeGreaterThan(0)
    for (const route of sessionOnly) expect(internalApiPermission(route.method, `/api/internal${route.path}`)).toBeNull()
  })
})
