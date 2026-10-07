import type { Hono } from 'hono'
import { z } from 'zod'
import { createServiceLineageRead, ServiceLineageAccessError, type ServiceLineageRegistry } from '../lib/service-lineage-read.js'
import { RegistryClientError } from '../lib/registry-client.js'
import { getServiceKeyPrincipal, requireServiceKeyScope, type ScopedServicePrincipal } from '../lib/service-key-auth.js'

export interface ServiceLineagePrincipal extends ScopedServicePrincipal { namespaces: readonly string[] }
export interface ServiceLineageRoutesDeps {
  authenticate(token: string): Promise<ServiceLineagePrincipal | null>
  registry: ServiceLineageRegistry | null
}
const CatalogQuery = z.object({
  q: z.string().trim().max(512).default(''), namespace: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
})

export function mountServiceLineageRoutes(app: Hono, deps: ServiceLineageRoutesDeps): void {
  const service = deps.registry ? createServiceLineageRead(deps.registry) : null
  const authenticate = requireServiceKeyScope({ authenticate: deps.authenticate, scope: 'lineage:read' })
  app.use('/lineage/*', authenticate, async (c, next) => {
    c.header('Cache-Control', 'no-store')
    if (!service) return c.json({ error: 'Dataset Registry is unavailable' }, 503)
    await next()
  })
  app.get('/lineage/catalog', async c => {
    const query = CatalogQuery.safeParse(c.req.query())
    if (!query.success) return c.json({ error: 'invalid catalog query' }, 400)
    const principal = getServiceKeyPrincipal<ServiceLineagePrincipal>(c)
    try { return c.json(await service!.catalog(query.data, principal.namespaces)) }
    catch (error) {
      if (error instanceof ServiceLineageAccessError) return c.json({ error: 'namespace is not allowed' }, 403)
      if (error instanceof RegistryClientError) return c.json({ error: 'Dataset Registry is unavailable' }, 502)
      throw error
    }
  })
  function mountDetail(route: 'datasets' | 'versions'): void {
    app.get(`/lineage/${route}/:id`, async c => {
      const id = z.string().uuid().safeParse(c.req.param('id'))
      if (!id.success) return c.json({ error: 'invalid id' }, 400)
      const principal = getServiceKeyPrincipal<ServiceLineagePrincipal>(c)
      try {
        return c.json(await (route === 'datasets' ? service!.dataset(id.data, principal.namespaces) : service!.version(id.data, principal.namespaces)))
      } catch (error) {
        if (error instanceof ServiceLineageAccessError || (error instanceof RegistryClientError && error.status === 404)) return c.json({ error: 'not found' }, 404)
        if (error instanceof RegistryClientError) return c.json({ error: 'Dataset Registry is unavailable' }, 502)
        throw error
      }
    })
  }
  mountDetail('datasets')
  mountDetail('versions')
}
