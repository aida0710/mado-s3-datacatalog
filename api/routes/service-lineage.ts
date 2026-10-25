import type { Hono } from 'hono'
import { z } from 'zod'
import { createServiceLineageRead, ServiceLineageAccessError, type ServiceLineageRegistry } from '../lib/service-lineage-read.js'
import { RegistryClientError } from '../lib/registry-client.js'
import { getServiceKeyPrincipal, requireServiceKeyScope, type ScopedServicePrincipal } from '../lib/service-key-auth.js'
import { apiError } from '../lib/api-error.js'

export interface ServiceLineagePrincipal extends ScopedServicePrincipal {
  namespaces: readonly string[]
}

export interface ServiceLineageRoutesDeps {
  authenticate(token: string): Promise<ServiceLineagePrincipal | null>
  registry: ServiceLineageRegistry | null
}

// Bound public search work independently of the operator-supplied Registry.
const MAX_CATALOG_QUERY_LENGTH = 512
const MAX_CATALOG_PAGE_SIZE = 100
const DEFAULT_CATALOG_PAGE_SIZE = 50
const MAX_CATALOG_OFFSET = 1_000_000

const CatalogQuery = z.object({
  q: z.string().trim().max(MAX_CATALOG_QUERY_LENGTH).default(''),
  namespace: z.string().trim().min(1).max(MAX_CATALOG_QUERY_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_CATALOG_PAGE_SIZE).default(DEFAULT_CATALOG_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).max(MAX_CATALOG_OFFSET).default(0),
})

export function mountServiceLineageRoutes(app: Hono, deps: ServiceLineageRoutesDeps): void {
  const service = deps.registry ? createServiceLineageRead(deps.registry) : null
  const authenticate = requireServiceKeyScope({ authenticate: deps.authenticate, scope: 'lineage:read' })
  app.use('/lineage/*', authenticate, async (c, next) => {
    c.header('Cache-Control', 'no-store')
    if (!service) return c.json(apiError('registry_unavailable', 'Dataset Registry is unavailable'), 503)
    await next()
  })

  app.get('/lineage/catalog', async c => {
    const query = CatalogQuery.safeParse(c.req.query())
    if (!query.success) return c.json(apiError('invalid_request', 'invalid catalog query'), 400)
    const principal = getServiceKeyPrincipal<ServiceLineagePrincipal>(c)
    try {
      return c.json(await service!.catalog(query.data, principal.namespaces))
    } catch (error) {
      if (error instanceof ServiceLineageAccessError) return c.json(apiError('namespace_not_allowed', 'namespace is not allowed'), 403)
      if (error instanceof RegistryClientError) return c.json(apiError('registry_unavailable', 'Dataset Registry is unavailable'), 502)
      throw error
    }
  })

  function mountDetail(route: 'datasets' | 'versions'): void {
    app.get(`/lineage/${route}/:id`, async c => {
      const id = z.string().uuid().safeParse(c.req.param('id'))
      if (!id.success) return c.json(apiError('invalid_request', 'invalid id'), 400)
      const principal = getServiceKeyPrincipal<ServiceLineagePrincipal>(c)
      try {
        const detail = route === 'datasets'
          ? await service!.dataset(id.data, principal.namespaces)
          : await service!.version(id.data, principal.namespaces)
        return c.json(detail)
      } catch (error) {
        if (error instanceof ServiceLineageAccessError || (error instanceof RegistryClientError && error.status === 404)) {
          return c.json(apiError('not_found', 'not found'), 404)
        }
        if (error instanceof RegistryClientError) return c.json(apiError('registry_unavailable', 'Dataset Registry is unavailable'), 502)
        throw error
      }
    })
  }

  mountDetail('datasets')
  mountDetail('versions')
}
