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
import { mountAccessTokenRoutes } from './routes/access-tokens.js'
import { mountAuditRoutes } from './routes/audit.js'

// internal-app.tsが/api/internalにルートを足すのに使う関数すべて。空のappに載せると、DB無しで
// ルートの一覧が取れる。載せている間に依存先が呼ばれることはない。
const INTERNAL_ROUTE_MOUNTS = {
  mountConnectionsRoutes, mountStorageListRoutes, mountStorageReadmeRoutes, mountStoragePreviewRoutes,
  mountStorageMediaRoutes, mountJobRoutes, mountStorageScanRoutes, mountStorageCapacityRoutes,
  mountStorageEstimateRoutes, mountPricingRoutes, mountStorageFavoritesRoutes, mountSettingsRoutes,
  mountNotesRoutes, mountStorageTagsRoutes, mountLineageRoutes, mountLineageCurationRoutes,
  mountAdminUsersRoutes, mountAccessTokenRoutes, mountAuditRoutes,
} as const

/** どの依存先の代わりにもなる。プロパティを読んでも呼び出しても、別の代わりを返す。 */
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
  it('internal-app.tsが内部APIへ載せるルート群をすべて確かめている', () => {
    const source = readFileSync(new URL('./internal-app.ts', import.meta.url), 'utf8')
    const mounted = [...source.matchAll(/\b(mount\w+Routes)\(api\b/g)].map(match => match[1])
    expect(new Set(mounted)).toEqual(new Set(Object.keys(INTERNAL_ROUTE_MOUNTS)))
  })

  it('すべてのルートに、トークンに必要な権限が決まっている', () => {
    const routes = internalRoutes()
    expect(routes.length).toBeGreaterThan(50)
    const undecided = routes.filter(route => internalApiPermission(route.method, `/api/internal${route.path}`) === null)
    expect(undecided).toEqual([])
  })
})
