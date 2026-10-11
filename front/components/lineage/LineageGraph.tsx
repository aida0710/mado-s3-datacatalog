import { useLocalizedMemo } from '../../i18n/useLocalizedMemo'
import { useLocale } from '../../i18n/useLocale'
import { translate } from '../../i18n/translate'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Background, BackgroundVariant, Controls, MarkerType, MiniMap, ReactFlow, ReactFlowProvider,
  type NodeMouseHandler, useReactFlow,
} from '@xyflow/react'
import { Search } from 'lucide-react'
import type { LineageGraph as LineageGraphDto, LineageNodeSummary } from '../../lib/api/types'
import { narrowerThan } from '../../lib/breakpoints'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { toFlowElements, type LineageFlowNode } from '../../lib/lineage/graphModel'
import {
  searchLineageNodes, traceLineagePath, type LineageDirection,
} from '../../lib/lineage/interaction'
import { LINEAGE_KIND_LABEL } from '../../lib/lineage/labels'
import { layoutLineage } from '../../lib/lineage/layout'
import { LineageNode } from './LineageNode'

const nodeTypes = { lineage: LineageNode }

// 強調した経路の矢印の色。矢印は辺ごとではなく共有の <marker> なので、色ごとに別の marker を使う。
// 色は CSS の変数で渡し、テーマの切り替えに追従させる。ほかの矢印は --xy-edge-stroke (lineage.css)。
const PATH_MARKER_COLOR = 'var(--link)'

// ミニマップの四角の色を種類ごとに変えるための class (lineage.css)。
const minimapNodeClass = (node: LineageFlowNode) => `lineage-minimap-node--${node.data.kind}`

// 最初に全体を収める表示。狭い画面では全体が入らなくても項目の文字が読める大きさ (0.5 倍、
// Mado Model Tracking の Lineage と同じ) で開き、残りは動かして見る。
const WIDE_FIT_VIEW = { padding: 0.2, maxZoom: 1.15 }
const NARROW_FIT_VIEW = { ...WIDE_FIT_VIEW, minZoom: 0.5 }

// グラフの操作ボタンとミニマップの名前 (ツールチップにも出る)。React Flow の既定は英語。
const ARIA_LABELS = {
  get 'controls.ariaLabel'() { return translate("lineageGraph.graphControls") },
  get 'controls.zoomIn.ariaLabel'() { return translate("lineageGraph.zoomIn") },
  get 'controls.zoomOut.ariaLabel'() { return translate("lineageGraph.zoomOut") },
  get 'controls.fitView.ariaLabel'() { return translate("lineageGraph.fitToView") },
  get 'minimap.ariaLabel'() { return translate("lineageGraph.graphOverview") },
}

interface Props {
  graph: LineageGraphDto
  selectedId: string
  onSelect: (node: LineageNodeSummary) => void
  onClearSelection: () => void
}

interface CanvasProps extends Props {
  direction: LineageDirection
}

const DIRECTIONS: Array<{ value: LineageDirection; label: string }> = [
  { value: 'both', get label() { return translate("lineageGraph.both") } },
  { value: 'upstream', get label() { return translate("lineageGraph.upstream") } },
  { value: 'downstream', get label() { return translate("lineageGraph.downstream") } },
]

function Canvas({ graph, selectedId, direction, onSelect, onClearSelection }: CanvasProps) {
  useLocale()
  const { fitView } = useReactFlow<LineageFlowNode>()
  const narrow = useMediaQuery(narrowerThan('md'))
  const focusedSelection = useRef('')
  const { nodes, edges } = useLocalizedMemo(() => {
    const elements = toFlowElements(graph)
    const traced = selectedId
      ? traceLineagePath({ nodes: elements.nodes, edges: elements.edges, selectedId, direction })
      : null
    const activePath = traced && traced.nodeIds.size > 0 ? traced : null
    const layout = layoutLineage(
      elements.nodes.map(node => ({
        ...node,
        className: activePath
          ? activePath.nodeIds.has(node.id) ? 'lineage-flow-node--path' : 'lineage-flow-node--muted'
          : undefined,
      })),
      elements.edges.map(edge => {
        const onPath = activePath?.edgeIds.has(edge.id) ?? false
        return {
          ...edge,
          className: activePath
            ? onPath ? 'lineage-flow-edge--path' : 'lineage-flow-edge--muted'
            : undefined,
          markerEnd: onPath
            ? { type: MarkerType.ArrowClosed, width: 15, height: 15, color: PATH_MARKER_COLOR }
            : edge.markerEnd,
        }
      }),
    )
    return {
      nodes: layout.nodes.map(node => ({ ...node, selected: node.id === selectedId })),
      edges: layout.edges,
    }
  }, [direction, graph, selectedId])

  const byId = useMemo(() => new Map(graph.nodes.map(node => [node.id, node])), [graph.nodes])
  const handleNodeClick: NodeMouseHandler<LineageFlowNode> = (_, node) => {
    const domain = byId.get(node.id)
    if (domain) onSelect(domain)
  }
  const graphKey = `${nodes.map(node => node.id).join('|')}::${edges.map(edge => edge.id).join('|')}`

  useEffect(() => {
    if (!selectedId) {
      focusedSelection.current = ''
      return
    }
    const selectedNodes = nodes.filter(node => node.id === selectedId)
    const focusKey = `${graphKey}::${selectedId}`
    if (selectedNodes.length === 0 || focusedSelection.current === focusKey) return
    focusedSelection.current = focusKey
    const frame = window.requestAnimationFrame(() => {
      void fitView({ nodes: selectedNodes, padding: 1.1, minZoom: 0.9, maxZoom: 1.35, duration: 350 })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [fitView, graphKey, nodes, selectedId])

  return (
    <div className="lineage-canvas" aria-label={translate("lineageGraph.dataLineageGraph")}>
      <ReactFlow
        key={graphKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={onClearSelection}
        nodesConnectable={false}
        nodesDraggable={false}
        edgesFocusable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}
        defaultMarkerColor={null}
        fitView
        fitViewOptions={narrow ? NARROW_FIT_VIEW : WIDE_FIT_VIEW}
        minZoom={0.18}
        maxZoom={2}
        ariaLabelConfig={ARIA_LABELS}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
        <Controls showInteractive={false} />
        {nodes.length > 8 && <MiniMap<LineageFlowNode> pannable zoomable nodeClassName={minimapNodeClass} />}
      </ReactFlow>
    </div>
  )
}

export function LineageGraph(props: Props) {
  useLocale()
  const [direction, setDirection] = useState<LineageDirection>('both')
  const [query, setQuery] = useState('')
  const results = useLocalizedMemo(() => searchLineageNodes(props.graph.nodes, query), [props.graph.nodes, query])
  const visibleResults = results.slice(0, 8)
  const searching = query.trim() !== ''

  return (
    <div className="lineage-graph">
      <div className="lineage-toolbar lineage-graph__tools">
        <div className="lineage-graph__search">
          <label className="lineage-search-field">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">{translate("lineageGraph.searchGraph")}</span>
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={translate("lineageGraph.datasetOrProcessingName")}
              autoComplete="off"
            />
          </label>
          {searching && (
            <div className="popover lineage-graph__results">
              {visibleResults.length === 0 ? (
                <p className="muted">{translate("lineageGraph.noMatchingItems")}</p>
              ) : (
                <ul>
                  {visibleResults.map(node => (
                    <li key={node.id}>
                      <button type="button" onClick={() => { props.onSelect(node); setQuery('') }}>
                        <strong>{node.label}</strong>
                        <span className="lineage-kind" data-kind={node.kind}>
                          {LINEAGE_KIND_LABEL[node.kind]}{node.namespace ? ` · ${node.namespace}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {results.length > visibleResults.length && (
                <p className="muted">{translate("common.additionalItems", { value0: results.length - visibleResults.length })}</p>
              )}
            </div>
          )}
        </div>
        <div className="lineage-toolbar__item">
          <span>{translate("lineageGraph.traversalDirection")}</span>
          <div className="lineage-segmented" role="group" aria-label={translate("lineageGraph.traversalDirectionFromTheSelectedItem")}>
            {DIRECTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={direction === option.value}
                onClick={() => setDirection(option.value)}
              >{option.label}</button>
            ))}
          </div>
        </div>
      </div>
      <ReactFlowProvider><Canvas {...props} direction={direction} /></ReactFlowProvider>
    </div>
  )
}

export default LineageGraph
