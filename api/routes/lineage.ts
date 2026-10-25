import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { LineageService } from '../lib/lineage-service.js'
import { LineageNamespaceError, type NamespaceLineagePolicy } from '../lib/namespace-lineage-policy.js'
import { createNamespaceLineageService } from '../lib/namespace-lineage-service.js'
import { graphWithoutHiddenConnections } from '../lib/lineage-connection-visibility.js'
import { MarquezClientError } from '../lib/marquez-client.js'
import { RegistryClientError } from '../lib/registry-client.js'
import { apiError } from '../lib/api-error.js'
import { decodePageCursor, encodePageCursor } from '../lib/page-cursor.js'

const Identity = z.string().trim().min(1).max(1024)
const Uuid = z.string().uuid()
// Registry の一覧は件数の位置で続きを読むので、cursor の中身はその位置。上限は Registry へ渡す値の範囲を抑えるため。
const MAX_CATALOG_OFFSET = 1_000_000
const CatalogPagePosition = z.strictObject({ offset: z.number().int().min(1).max(MAX_CATALOG_OFFSET) })

export interface LineageRoutesDeps {
  service: LineageService
  namespacePolicy?: (c: Context) => NamespaceLineagePolicy | null
  /** 利用者に見える接続。null は全接続。ホワイトリスト接続のIDを詳細に出さないために使う。 */
  visibleConnectionIds: (c: Context) => Promise<ReadonlySet<string> | null>
}

function boundedInt(value: string | undefined, { fallback, min, max }: { fallback: number; min: number; max: number }): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
}

function backendError(c: Context, error: unknown): Response {
  if (error instanceof LineageNamespaceError) return c.json(apiError(error.code, error.message), error.status)
  if (error instanceof RegistryClientError) {
    if (error.status === 404) return c.json(apiError('not_found', 'not found'), 404)
    return c.json(apiError('registry_unavailable', 'Dataset Registry is unavailable'), 502)
  }
  if (error instanceof MarquezClientError) {
    return c.json(apiError('marquez_unavailable', 'Marquez is unavailable'), 502)
  }
  throw error
}

export function mountLineageRoutes(app: Hono, deps: LineageRoutesDeps): void {
  const serviceFor = (context: Context) => {
    const policy = deps.namespacePolicy?.(context)
    return policy ? createNamespaceLineageService(deps.service, policy) : deps.service
  }
  app.get('/lineage/graph', async c => {
    if (c.req.query('kind') !== undefined) return c.json(apiError('invalid_request', 'kind is not supported; use rootKind'), 400)
    const mode = c.req.query('mode') ?? 'logical'
    const depth = boundedInt(c.req.query('depth'), { fallback: 3, min: 1, max: 10 })
    try {
      if (mode === 'versions') {
        const versionId = Uuid.safeParse(c.req.query('versionId'))
        if (!versionId.success) return c.json(apiError('invalid_request', 'valid versionId is required'), 400)
        const rawDirection = c.req.query('direction') ?? 'both'
        if (!['upstream', 'downstream', 'both'].includes(rawDirection)) {
          return c.json(apiError('invalid_request', 'invalid direction'), 400)
        }
        const graph = await serviceFor(c).versionGraph({
          versionId: versionId.data,
          direction: rawDirection as 'upstream' | 'downstream' | 'both',
          depth,
        })
        return c.json(graphWithoutHiddenConnections(graph, await deps.visibleConnectionIds(c)))
      }
      if (mode !== 'logical') return c.json(apiError('invalid_request', 'invalid graph mode'), 400)

      const kind = c.req.query('rootKind')
      const namespace = Identity.safeParse(c.req.query('namespace'))
      const name = Identity.safeParse(c.req.query('name'))
      if (kind !== 'dataset' && kind !== 'job') {
        return c.json(apiError('invalid_request', 'rootKind must be dataset or job'), 400)
      }
      if (!namespace.success || !name.success) {
        return c.json(apiError('invalid_request', 'namespace and name are required'), 400)
      }
      return c.json(await serviceFor(c).logicalGraph({
        kind,
        namespace: namespace.data,
        name: name.data,
        depth,
      }))
    } catch (error) {
      return backendError(c, error)
    }
  })

  app.get('/lineage/search', async c => {
    const q = (c.req.query('q') ?? '').trim()
    const namespace = c.req.query('namespace')?.trim() || undefined
    const limit = boundedInt(c.req.query('limit'), { fallback: 50, min: 1, max: 100 })
    try {
      return c.json(await serviceFor(c).search({ q, namespace, limit }))
    } catch (error) {
      return backendError(c, error)
    }
  })

  app.get('/lineage/catalog', async c => {
    const q = (c.req.query('q') ?? '').trim()
    const namespace = c.req.query('namespace')?.trim() || undefined
    const limit = boundedInt(c.req.query('limit'), { fallback: 20, min: 1, max: 100 })
    const cursor = c.req.query('cursor')
    const position = cursor === undefined ? { offset: 0 } : decodePageCursor(cursor, CatalogPagePosition)
    if (!position) return c.json(apiError('invalid_cursor', 'invalid cursor'), 400)
    try {
      const catalog = await serviceFor(c).catalog({ q, namespace, limit, offset: position.offset })
      const nextOffset = position.offset + catalog.results.length
      const hasMore = catalog.results.length > 0 && nextOffset < catalog.totalCount && nextOffset <= MAX_CATALOG_OFFSET
      return c.json({ ...catalog, nextCursor: hasMore ? encodePageCursor({ offset: nextOffset }) : null })
    } catch (error) {
      return backendError(c, error)
    }
  })

  app.get('/lineage/resolve-location', async c => {
    const connectionId = z.string().min(1).max(256).safeParse(c.req.query('connectionId'))
    const bucket = z.string().min(1).max(1024).safeParse(c.req.query('bucket'))
    const key = z.string().max(8192).safeParse(c.req.query('key') ?? '')
    const limit = boundedInt(c.req.query('limit'), { fallback: 20, min: 1, max: 100 })
    if (!connectionId.success || !bucket.success || !key.success) {
      return c.json(apiError('invalid_request', 'connectionId, bucket and a valid key are required'), 400)
    }
    try {
      return c.json(await serviceFor(c).resolveLocation({
        connectionId: connectionId.data,
        bucket: bucket.data,
        key: key.data,
        limit,
      }))
    } catch (error) {
      return backendError(c, error)
    }
  })

  app.get('/lineage/projection-status', async c => {
    return c.json(await serviceFor(c).projectionStatus())
  })

  app.get('/lineage/datasets/:id', async c => {
    const id = Uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json(apiError('invalid_request', 'invalid dataset id'), 400)
    try {
      return c.json(await serviceFor(c).dataset(id.data, await deps.visibleConnectionIds(c)))
    } catch (error) {
      return backendError(c, error)
    }
  })

  app.get('/lineage/versions/:id', async c => {
    const id = Uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json(apiError('invalid_request', 'invalid version id'), 400)
    try {
      return c.json(await serviceFor(c).version(id.data, await deps.visibleConnectionIds(c)))
    } catch (error) {
      return backendError(c, error)
    }
  })

  app.get('/lineage/runs/:id', async c => {
    const id = Uuid.safeParse(c.req.param('id'))
    if (!id.success) return c.json(apiError('invalid_request', 'invalid run id'), 400)
    try {
      return c.json(await serviceFor(c).run(id.data))
    } catch (error) {
      return backendError(c, error)
    }
  })

  app.get('/lineage/job-runs', async c => {
    const namespace = Identity.safeParse(c.req.query('namespace'))
    const name = Identity.safeParse(c.req.query('name'))
    if (!namespace.success || !name.success) {
      return c.json(apiError('invalid_request', 'namespace and name are required'), 400)
    }
    const limit = boundedInt(c.req.query('limit'), { fallback: 50, min: 1, max: 100 })
    try {
      return c.json(await serviceFor(c).jobRuns(namespace.data, name.data, limit))
    } catch (error) {
      return backendError(c, error)
    }
  })
}
