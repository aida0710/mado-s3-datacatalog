import { describe, expect, it, vi } from 'vitest'
import type { DatasetDetail, DatasetVersionDetail, LineageRunDetail, LogicalLineageGraph, VersionLineageGraph } from '../shared/lineage-types.js'
import type { RegistryClient } from './registry-client.js'
import type { LineageService } from './lineage-service.js'
import { createNamespaceLineagePolicy } from './namespace-lineage-policy.js'
import { createNamespaceLineageService } from './namespace-lineage-service.js'

const DATASET = '00000000-0000-4000-8000-000000000010'
const VERSION = '00000000-0000-4000-8000-000000000011'
const OTHER_DATASET = '00000000-0000-4000-8000-000000000020'
const OTHER_VERSION = '00000000-0000-4000-8000-000000000021'
const RUN = '00000000-0000-4000-8000-000000000031'
const version: DatasetVersionDetail = { id: VERSION, datasetId: DATASET, version: 'v1', contentHash: null,
  manifestUri: null, manifestHash: null, schemaUri: null, createdAt: '2026-10-15T00:00:00Z', metadata: {}, locations: [] }
const dataset: DatasetDetail = { datasetId: DATASET, datasetKey: 'dataset', namespace: 'speech', name: 'dataset',
  kind: 'dataset', displayName: null, aliases: [], description: null, mediaType: null, owner: null,
  currentVersionId: VERSION, versionCount: 1, createdAt: '2026-10-15T00:00:00Z', versions: [version] }
const run: LineageRunDetail = { id: RUN, runKey: 'run', jobNamespace: 'speech', jobName: 'train', status: 'COMPLETE',
  startedAt: '2026-10-15T00:00:00Z', endedAt: null, createdAt: null, gitSha: null, containerDigest: null,
  configUri: null, configHash: null, modelRefs: [], runtime: {}, metrics: {}, errorMessage: null, inputs: [], outputs: [], sources: [] }

function fixture(namespaces = ['speech']) {
  const registry = {
    getDataset: vi.fn(async (id: string) => id === DATASET ? dataset : { ...dataset, datasetId: OTHER_DATASET, namespace: 'private' }),
    getVersion: vi.fn(async (id: string) => id === VERSION ? version : { ...version, id: OTHER_VERSION, datasetId: OTHER_DATASET }),
    getRun: vi.fn().mockResolvedValue(run),
  }
  const policy = createNamespaceLineagePolicy(registry as unknown as RegistryClient, namespaces)
  const base: LineageService = {
    logicalGraph: vi.fn(), versionGraph: vi.fn(), search: vi.fn(), catalog: vi.fn(), resolveLocation: vi.fn(),
    dataset: vi.fn().mockResolvedValue(dataset), version: vi.fn().mockResolvedValue(version), run: vi.fn(),
    jobRuns: vi.fn(), projectionStatus: vi.fn(),
  }
  return { registry, policy, base, service: createNamespaceLineageService(base, policy) }
}

describe('内部DataLineageのNamespace制限', () => {
  it('詳細は正本のIDとNamespaceを確認し、別Dataset・Version・入出力を持つRunを隠す', async () => {
    const { service, registry } = fixture()
    expect((await service.dataset(DATASET, null)).namespace).toBe('speech')
    expect((await service.version(VERSION, null)).id).toBe(VERSION)
    await expect(service.dataset(OTHER_DATASET, null)).rejects.toMatchObject({ status: 404 })
    await expect(service.version(OTHER_VERSION, null)).rejects.toMatchObject({ status: 404 })
    registry.getRun.mockResolvedValue({ ...run, inputs: [{ namespace: 'private' }] })
    await expect(service.run(RUN)).rejects.toMatchObject({ status: 404 })
    registry.getDataset.mockResolvedValue({ ...dataset, datasetId: OTHER_DATASET })
    const mismatched = createNamespaceLineagePolicy(registry as unknown as RegistryClient, ['speech'])
    await expect(mismatched.dataset(DATASET)).rejects.toMatchObject({ status: 404 })
  })

  it('検索とカタログはNamespaceの明示を必須にし、外部から範囲外の結果が来ても返さない', async () => {
    const { service, base } = fixture()
    await expect(service.search({ q: '', limit: 20 })).rejects.toMatchObject({ status: 403 })
    await expect(service.catalog({ q: '', limit: 20, offset: 0 })).rejects.toMatchObject({ status: 403 })
    await expect(service.search({ q: '', namespace: 'private', limit: 20 })).rejects.toMatchObject({ status: 403 })
    vi.mocked(base.catalog).mockResolvedValue({ results: [{ ...dataset, namespace: 'private' }], totalCount: 1 })
    await expect(service.catalog({ q: '', namespace: 'speech', limit: 20, offset: 0 })).rejects.toMatchObject({ status: 403 })
  })

  it('論理グラフから範囲外のノードと辺を除き、保存場所の検索も同じ範囲に絞る', async () => {
    const { service, base } = fixture()
    vi.mocked(base.logicalGraph).mockResolvedValue({
      nodes: [{ id: 'allowed', namespace: 'speech', registry: null }, { id: 'hidden', namespace: 'private', registry: null }],
      edges: [{ source: 'allowed', target: 'hidden' }], warnings: ['Skipped malformed Marquez node: private'],
    } as LogicalLineageGraph)
    const graph = await service.logicalGraph({ kind: 'dataset', namespace: 'speech', name: 'dataset', depth: 3 })
    expect(graph.nodes.map(node => node.id)).toEqual(['allowed'])
    expect(graph.edges).toEqual([])
    expect(JSON.stringify(graph)).not.toContain('private')
    vi.mocked(base.resolveLocation).mockResolvedValue({ storageSystemKey: null, uri: 's3://data/',
      matches: [{ namespace: 'speech' }, { namespace: 'private' }] as never })
    expect((await service.resolveLocation({ connectionId: 'selected', bucket: 'data', key: '', limit: 20 })).matches)
      .toEqual([{ namespace: 'speech' }])
  })

  it('バージョングラフはopaqueなノードIDを解析せず、正本を検証したノードだけ返す', async () => {
    const { service, base } = fixture()
    vi.mocked(base.versionGraph).mockResolvedValue({ rootVersionId: VERSION, direction: 'both', truncated: false,
      nodes: [
        { id: 'opaque:allowed:node', kind: 'version', label: 'Untrusted', data: { id: VERSION, secret: 'untrusted graph payload' } },
        { id: 'opaque:private:node', kind: 'version', label: 'Private', data: { id: OTHER_VERSION } },
        { id: `version:${OTHER_VERSION}`, kind: 'version', label: 'No canonical ID', data: {} },
      ], edges: [{ id: 'edge', kind: 'input', source: 'opaque:allowed:node', target: 'opaque:private:node' }],
    } satisfies VersionLineageGraph)
    const graph = await service.versionGraph({ versionId: VERSION, direction: 'both', depth: 3 })
    expect(graph.nodes.map(node => node.id)).toEqual(['opaque:allowed:node'])
    expect(graph.nodes[0].label).toBe('v1')
    expect(graph.edges).toEqual([])
    expect(graph.truncated).toBe(true)
    expect(JSON.stringify(graph)).not.toContain('untrusted graph payload')
  })

  it('ジョブ実行一覧に別Namespaceの入出力があればその実行を除く', async () => {
    const { service, base } = fixture()
    vi.mocked(base.jobRuns).mockResolvedValue({ runs: [
      { id: 'allowed', job: { namespace: 'speech' }, inputs: [{ namespace: 'speech' }] },
      { id: 'hidden', job: { namespace: 'speech' }, inputs: [{ namespace: 'private' }] },
    ], totalCount: 99 })
    expect(await service.jobRuns('speech', 'train', 20)).toEqual({ runs: [
      { id: 'allowed', job: { namespace: 'speech' }, inputs: [{ namespace: 'speech' }] },
    ] })
  })

  it('全Namespaceを許可した利用者と既存ブラウザは従来のグラフをそのまま使う', () => {
    const { service, base } = fixture(['*'])
    expect(service).toBe(base)
  })
  it('Datasetの中に別DatasetのVersionが混じった応答を返さない', async () => {
    const { service, registry } = fixture()
    registry.getDataset.mockResolvedValue({ ...dataset, versions: [{ ...version, datasetId: OTHER_DATASET }] })
    await expect(service.dataset(DATASET, null)).rejects.toMatchObject({ status: 404 })
  })
})
