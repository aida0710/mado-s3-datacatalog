import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { DatasetDetail, DatasetVersionDetail } from '../shared/lineage-types.js'
import { mountServiceLineageRoutes } from './service-lineage.js'
import type { ServiceLineageRegistry } from '../lib/service-lineage-read.js'

const datasetId = '00000000-0000-4000-8000-000000000001'
const versionId = '00000000-0000-4000-8000-000000000002'
const headers = { Authorization: 'Bearer unit-test-key' }
const version: DatasetVersionDetail = { id: versionId, datasetId, version: 'v1', contentHash: 'sha256:abc', manifestUri: null, manifestHash: null, schemaUri: null, createdAt: '2026-10-08T00:00:00Z', metadata: { privateValue: 'not-in-integration' }, locations: [{ id: 'location', uri: 's3://data/v1', storageKind: 's3', storageSystemKey: 'private-system', region: null, bucket: 'data', status: 'available', isPrimary: true, observedAt: '2026-10-08T00:00:00Z', madoConnectionId: 'private-connection', metadata: { credentials: 'not-in-integration' } }] }
const dataset: DatasetDetail = { kind: 'dataset', datasetId, datasetKey: 'speech/corpus', namespace: 'speech', name: 'corpus', displayName: 'Corpus', aliases: [], description: '', mediaType: 'audio', owner: null, currentVersionId: versionId, versionCount: 1, createdAt: '2026-10-08T00:00:00Z', versions: [version] }
function fixture(options: { scopes?: string[]; namespaces?: string[]; registry?: ServiceLineageRegistry | null; invalidKey?: boolean } = {}) {
  const registry: ServiceLineageRegistry = { searchDatasets: vi.fn(async () => ({ results: [dataset], totalCount: 1 })), getDataset: vi.fn(async () => dataset), getVersion: vi.fn(async () => version) }
  const app = new Hono()
  mountServiceLineageRoutes(app, { authenticate: async () => options.invalidKey ? null : { scopes: options.scopes ?? ['lineage:read'], namespaces: options.namespaces ?? ['speech'] }, registry: options.registry === undefined ? registry : options.registry })
  return { app, registry }
}
describe('Service Account Dataset API', () => {
  it('requires its own read scope and never accepts a browser session alone', async () => {
    expect((await fixture().app.request('/lineage/catalog?namespace=speech')).status).toBe(401)
    expect((await fixture({ invalidKey: true }).app.request('/lineage/catalog?namespace=speech', { headers })).status).toBe(401)
    expect((await fixture({ scopes: ['metrics:read'] }).app.request('/lineage/catalog?namespace=speech', { headers })).status).toBe(403)
    expect((await fixture({ scopes: ['lineage:write'] }).app.request('/lineage/catalog?namespace=speech', { headers })).status).toBe(403)
  })
  it('searches only an allowed Namespace and does not cache the response', async () => {
    const { app, registry } = fixture()
    const response = await app.request('/lineage/catalog?namespace=speech&q=corpus&limit=10', { headers })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(registry.searchDatasets).toHaveBeenCalledWith({ q: 'corpus', namespace: 'speech', limit: 10, offset: 0 })
    expect((await app.request('/lineage/catalog?namespace=other', { headers })).status).toBe(403)
    expect((await app.request('/lineage/catalog', { headers })).status).toBe(403)
  })
  it('does not trust a Registry response that broadens its requested Namespace', async () => {
    const { app } = fixture({ registry: { searchDatasets: async () => ({ results: [{ ...dataset, namespace: 'other' }], totalCount: 1 }), getDataset: async () => dataset, getVersion: async () => version } })
    const response = await app.request('/lineage/catalog?namespace=speech', { headers })
    expect(response.status).toBe(403)
    expect(await response.text()).not.toContain('corpus')
  })
  it('resolves a version identity and URI while omitting private connection fields', async () => {
    const response = await fixture().app.request(`/lineage/versions/${versionId}`, { headers })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id: versionId, namespace: 'speech', name: 'corpus', version: 'v1', locations: [{ uri: 's3://data/v1' }] })
    const text = await (await fixture().app.request(`/lineage/datasets/${datasetId}`, { headers })).text()
    expect(text).not.toContain('private-connection'); expect(text).not.toContain('private-system'); expect(text).not.toContain('not-in-integration')
  })
  it('conceals a version outside the read key Namespace', async () => {
    const response = await fixture({ namespaces: ['other'] }).app.request(`/lineage/versions/${versionId}`, { headers })
    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain('corpus')
  })
  it('authenticates before reporting Registry availability and rejects invalid paging', async () => {
    expect((await fixture({ registry: null }).app.request('/lineage/catalog?namespace=speech', { headers })).status).toBe(503)
    expect((await fixture({ registry: null }).app.request('/lineage/catalog?namespace=speech')).status).toBe(401)
    expect((await fixture().app.request('/lineage/catalog?namespace=speech&limit=9999', { headers })).status).toBe(400)
  })
})
