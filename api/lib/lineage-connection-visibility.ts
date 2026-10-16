import type { DatasetDetail, StorageLocationDetail, VersionLineageGraph } from '../shared/lineage-types.js'

// 接続のホワイトリストで隠した接続は、Lineage の応答でも存在を明かさない。
// 保存場所には Mado の接続 ID が 2 か所に入りうる。Mado が binding から付ける madoConnectionId と、
// 手動登録のときに Registry へ保存した metadata.madoConnectionId。どちらも除く。

/** visibleConnectionIds が null なら全接続が見える (接続の管理者または全接続を許可したトークン)。 */
export function withoutHiddenConnection(
  location: StorageLocationDetail,
  visibleConnectionIds: ReadonlySet<string> | null,
): StorageLocationDetail {
  if (visibleConnectionIds === null) return location
  const isHidden = (value: unknown) => typeof value === 'string' && !visibleConnectionIds.has(value)
  const { madoConnectionId: metadataConnectionId, ...metadataWithoutConnection } = location.metadata
  return {
    ...location,
    madoConnectionId: isHidden(location.madoConnectionId) ? null : location.madoConnectionId,
    metadata: isHidden(metadataConnectionId) ? metadataWithoutConnection : location.metadata,
  }
}

export function datasetWithoutHiddenConnections(
  detail: DatasetDetail,
  visibleConnectionIds: ReadonlySet<string> | null,
): DatasetDetail {
  if (visibleConnectionIds === null) return detail
  return {
    ...detail,
    versions: detail.versions.map(version => ({
      ...version,
      locations: version.locations.map(location => withoutHiddenConnection(location, visibleConnectionIds)),
    })),
  }
}

export function graphWithoutHiddenConnections(
  graph: VersionLineageGraph,
  visibleConnectionIds: ReadonlySet<string> | null,
): VersionLineageGraph {
  if (visibleConnectionIds === null) return graph
  // Graph payloads contain both version locations and nested Registry metadata.
  function visibleReferences(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visibleReferences)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      key === 'madoConnectionId' && typeof item === 'string' && !visibleConnectionIds!.has(item)
        ? null : visibleReferences(item),
    ]))
  }
  return { ...graph, nodes: graph.nodes.map(node => ({ ...node, data: visibleReferences(node.data) as Record<string, unknown> })) }
}
