import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { loadEnv, loadLineageEnv } from '../env.js'
import { createInternalApplication } from '../internal-app.js'
import { createLineageApplication } from '../lineage-app.js'
import { closePools } from '../db.js'
import { buildOpenApiDocument, formatOpenApiDocument, internalRoutePermission } from './build-openapi-document.js'
import { API_ROUTES } from './route-catalog.js'

const VERSION_FILE = new URL('../../VERSION', import.meta.url)
const API_MANIFEST = new URL('../package.json', import.meta.url)
const GENERATED_DOCUMENT = new URL('../../docs/openapi.json', import.meta.url)
// つながない DB。アプリを組むだけではルートの表しか読まない。ループバックの閉じたポートを指す。
const UNREACHABLE_DATABASE_URL = 'postgres://mado@127.0.0.1:1/unreachable'
const REGISTRY_TOKEN = 'openapi-test-registry-token'

function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`
}

/** api-internal と api-lineage が実際に持つルート。Registry と Marquez を設定して DataLineage のルートも載せる。 */
async function applicationRoutes(): Promise<Set<string>> {
  const internal = createInternalApplication(loadEnv({
    MDC_AUTH_MODE: 'local',
    MDC_DATABASE_URL_RW: UNREACHABLE_DATABASE_URL,
    MDC_DATABASE_URL_RO: UNREACHABLE_DATABASE_URL,
    MDC_DATABASE_URL_MIGRATE: UNREACHABLE_DATABASE_URL,
    MDC_STORAGE_SECRET_KEY: '0'.repeat(64),
    MDC_WEB_ORIGIN: 'http://localhost',
    MDC_DATASET_REGISTRY_URL: 'http://registry.invalid',
    MDC_DATASET_REGISTRY_TOKEN: REGISTRY_TOKEN,
    MDC_MARQUEZ_URL: 'http://marquez.invalid',
  }))
  const lineage = createLineageApplication(loadLineageEnv({
    MDC_DATABASE_URL_RW: UNREACHABLE_DATABASE_URL,
    MDC_DATABASE_URL_RO: UNREACHABLE_DATABASE_URL,
    MDC_DATASET_REGISTRY_URL: 'http://registry.invalid',
    MDC_DATASET_REGISTRY_TOKEN: REGISTRY_TOKEN,
  }))
  try {
    return new Set([...internal.app.routes, ...lineage.app.routes]
      // ミドルウェア (app.use) は method ALL で並ぶ。ハンドラを複数渡したルートは同じものが重なる。
      .filter(route => route.method !== 'ALL')
      .map(route => routeKey(route.method, route.path)))
  } finally {
    await Promise.all([closePools(internal.pools), closePools(lineage.pools), internal.storageFactory.close()])
  }
}

function collectRefs(value: unknown, refs: Set<string>): void {
  if (Array.isArray(value)) value.forEach(item => collectRefs(item, refs))
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === '$ref' && typeof item === 'string') refs.add(item)
      else collectRefs(item, refs)
    }
  }
}

async function releaseVersion(): Promise<string> {
  return (await readFile(VERSION_FILE, 'utf8')).trim()
}

describe('API の OpenAPI 文書', () => {
  it('アプリが持つルートと文書のルートがちょうど一致する', async () => {
    const served = await applicationRoutes()
    const declared = new Set(API_ROUTES.map(route => routeKey(route.method, route.path)))
    expect([...served].filter(route => !declared.has(route)).sort()).toEqual([])
    expect([...declared].filter(route => !served.has(route)).sort()).toEqual([])
  })

  it('/api/internal のルートはどれも、トークンに要る権限が権限表で決まっている', () => {
    const internal = API_ROUTES.filter(route => route.access.kind === 'internal')
    expect(internal.length).toBeGreaterThan(50)
    expect(internal.filter(route => internalRoutePermission(route) === null).map(route => `${route.method} ${route.path}`)).toEqual([])
  })

  it('参照がどれも components にあり、operationId が重ならない', async () => {
    const document = buildOpenApiDocument({ version: await releaseVersion() })
    expect(document.openapi).toBe('3.1.0')
    const refs = new Set<string>()
    collectRefs(document, refs)
    const unresolved = [...refs].filter(ref => !(ref.replace('#/components/schemas/', '') in document.components.schemas))
    expect(unresolved).toEqual([])
    const operationIds = Object.values(document.paths).flatMap(methods =>
      Object.values(methods).map(operation => (operation as { operationId: string }).operationId))
    expect(new Set(operationIds).size).toBe(API_ROUTES.length)
  })

  it('文書の版はリリースの版 (VERSION) と同じで、API の package.json とコミット済みの文書も同じ版を持つ', async () => {
    const version = await releaseVersion()
    const manifest = JSON.parse(await readFile(API_MANIFEST, 'utf8')) as { version: string }
    const committed = JSON.parse(await readFile(GENERATED_DOCUMENT, 'utf8')) as { info: { version: string } }
    expect(manifest.version).toBe(version)
    expect(buildOpenApiDocument({ version }).info.version).toBe(version)
    expect(committed.info.version).toBe(version)
  })

  it('コミット済みの docs/openapi.json が今のルートの一覧から作ったものと同じ (直したら npm run openapi:generate)', async () => {
    const committed = await readFile(GENERATED_DOCUMENT, 'utf8')
    expect(committed === formatOpenApiDocument(buildOpenApiDocument({ version: await releaseVersion() }))).toBe(true)
  })
})
