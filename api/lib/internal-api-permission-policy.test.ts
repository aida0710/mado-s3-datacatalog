import { describe, expect, it } from 'vitest'
import { internalApiPermission } from './internal-api-permission-policy.js'

describe('内部APIの操作ごとの権限', () => {
  it.each([
    ['GET', '/connections', 'connections:read'], ['POST', '/connections', 'connections:manage'],
    ['PUT', '/connections/id', 'connections:manage'], ['PUT', '/connections/id/default', 'connections:manage'],
    ['DELETE', '/connections/id', 'connections:delete'], ['GET', '/connections/access-users', 'connections:manage'],
    ...['buckets', 'list', 'preview/text', 'preview/raw', 'preview/image', 'preview/tar', 'preview/tar-entry', 'media/analyze', 'media/spectrogram']
      .map(path => ['GET', `/storage/id/${path}`, 'storage:read']),
    ...['readme', 'readme/history', 'readme/history/42', 'readmes/search'].map(path => ['GET', `/storage/id/${path}`, 'readmes:read']),
    ['PUT', '/storage/id/readme', 'readmes:write'],
    ...['home', 'home/history', 'home/history/42'].map(path => ['GET', `/notes/${path}`, 'notes:read']),
    ['PUT', '/notes/home', 'notes:write'], ['GET', '/tags', 'tags:read'], ['POST', '/tags', 'tags:write'],
    ['PUT', '/tags/42', 'tags:write'], ['DELETE', '/tags/42', 'tags:delete'],
    ['GET', '/storage/id/tags', 'tags:read'], ['GET', '/storage/id/tags/search', 'tags:read'],
    ['PUT', '/storage/id/tags', 'tags:write'], ['DELETE', '/storage/id/tags', 'tags:delete'],
    ['GET', '/storage/id/favorites', 'favorites:read'], ['PUT', '/storage/id/favorites/bucket', 'favorites:write'],
    ['DELETE', '/storage/id/favorites/bucket', 'favorites:delete'],
    ...['graph', 'search', 'catalog', 'resolve-location', 'projection-status', 'datasets/id', 'versions/id', 'runs/id', 'job-runs']
      .map(path => ['GET', `/lineage/${path}`, 'lineage:read']),
    ...['datasets', 'locations', 'runs'].map(path => ['POST', `/lineage/curation/${path}`, 'lineage:curate']),
    ['PATCH', '/lineage/curation/datasets/id', 'lineage:curate'],
    ['GET', '/jobs/latest', 'jobs:read'], ['GET', '/jobs/42', 'jobs:read'], ['POST', '/jobs/42/cancel', 'jobs:operate'],
    ['POST', '/storage/id/scan', 'jobs:operate'], ['GET', '/storage/id/capacity', 'capacity:read'],
    ['GET', '/storage/id/capacity/prefix', 'capacity:read'], ['POST', '/storage/id/capacity/scan', 'capacity:operate'],
    ['GET', '/pricing', 'pricing:read'], ['GET', '/storage/id/estimate', 'pricing:read'], ['POST', '/pricing/refresh', 'pricing:refresh'],
    ['GET', '/settings', 'settings:read'], ['PUT', '/settings/key', 'settings:manage'],
    ['GET', '/users', 'users:read'], ['POST', '/users', 'users:manage'], ['PATCH', '/users/id', 'users:manage'],
    ['PUT', '/users/id/roles', 'users:manage'], ['POST', '/users/id/reset-password', 'users:manage'], ['DELETE', '/users/id', 'users:manage'],
    ['GET', '/access-tokens', 'service_accounts:read'], ['GET', '/access-tokens/namespaces', 'service_accounts:read'],
    ['POST', '/access-tokens', 'service_accounts:manage'], ['PATCH', '/access-tokens/id', 'service_accounts:manage'],
    ['POST', '/access-tokens/id/regenerate', 'service_accounts:manage'], ['DELETE', '/access-tokens/id', 'service_accounts:manage'],
    ['GET', '/audit-events', 'audit:read'],
  ])('%s %sには%sを要求する', (method, path, permission) => {
    expect(internalApiPermission(method, `/api/internal${path}`)).toBe(permission)
  })
  it('HEADにも読み取り権限を要求し、未登録のDataLineage APIには権限を推測しない', () => {
    expect(internalApiPermission('HEAD', '/api/internal/notes/home')).toBe('notes:read')
    expect(internalApiPermission('GET', '/api/internal/lineage/future-endpoint')).toBeNull()
  })
  it('実在しない操作や旧二階層APIには権限を割り当てない', () => {
    for (const [method, path] of [['POST', '/tags/42'], ['POST', '/storage/id/tags'], ['PUT', '/users'],
      ['DELETE', '/users/id/roles'], ['PATCH', '/access-tokens'], ['GET', '/access-tokens/id/regenerate'],
      ['GET', '/service-accounts'], ['POST', '/service-accounts/id/keys']]) {
      expect(internalApiPermission(method, `/api/internal${path}`)).toBeNull()
    }
  })
})
