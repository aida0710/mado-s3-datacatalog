import type { AccessTokenStore } from './access-token-store.js'
import type { MarquezNamespaceClient } from './marquez-client.js'
import type { AccessTokenNamespaces } from './access-token-types.js'
import { NAMESPACE_MAX_LENGTH } from './access-token-grants.js'

// Fetch namespaces directly rather than scanning every dataset in the catalog.
const NAMESPACE_PAGE_SIZE = 1000
// Bound work against a misbehaving upstream; a partial list remains usable with manual additions.
const NAMESPACE_MAX_PAGES = 10
export interface AccessTokenNamespaceCatalog {
  listNamespaces(): Promise<AccessTokenNamespaces>
}

async function listProjectedNamespaces(marquez: MarquezNamespaceClient | null): Promise<AccessTokenNamespaces> {
  if (!marquez) return { namespaces: [], sourceStatus: 'unconfigured' }
  const names = new Set<string>()
  let sourceStatus: AccessTokenNamespaces['sourceStatus'] = 'partial'
  try {
    for (let page = 0; page < NAMESPACE_MAX_PAGES; page++) {
      const namespaces = await marquez.listNamespaces({ limit: NAMESPACE_PAGE_SIZE, offset: page * NAMESPACE_PAGE_SIZE })
      for (const name of namespaces) names.add(name)
      if (namespaces.length < NAMESPACE_PAGE_SIZE) { sourceStatus = 'ready'; break }
    }
  } catch { sourceStatus = 'unavailable' }
  return { namespaces: [...names], sourceStatus }
}

export function createAccessTokenNamespaceCatalog(deps: {
  store: Pick<AccessTokenStore, 'listTokens'>
  marquez: MarquezNamespaceClient | null
}): AccessTokenNamespaceCatalog {
  return {
    async listNamespaces() {
      const [tokens, projected] = await Promise.all([deps.store.listTokens(), listProjectedNamespaces(deps.marquez)])
      const names = new Set([...projected.namespaces, ...tokens.flatMap(token => token.namespaces)])
      return {
        namespaces: [...names].filter(name => name !== '*' && name.length > 0 && name.length <= NAMESPACE_MAX_LENGTH).sort(),
        sourceStatus: projected.sourceStatus,
      }
    },
  }
}
