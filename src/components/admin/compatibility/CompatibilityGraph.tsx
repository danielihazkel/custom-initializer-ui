import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { AnimatePresence, motion } from 'framer-motion'
import type { AdminDependencyCompatibility, RelationType } from '../../../types'
import { useCompatibilityGraphData, type GraphNode } from './useCompatibilityGraphData'
import { CompatibilityGraphLegend } from './CompatibilityGraphLegend'

interface Props {
  rules: AdminDependencyCompatibility[]
  onEditRule?: (rule: AdminDependencyCompatibility) => void
}

// D3 simulation node type (extends GraphNode with mutable position fields)
interface SimNode extends GraphNode {
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  vx?: number
  vy?: number
  index?: number
}

interface SimEdge {
  source: SimNode | string
  target: SimNode | string
  relationType: RelationType
  description: string
  id: number
}

// Group colors — cycling through design tokens by index
const GROUP_COLORS = [
  { stroke: 'var(--color-primary, #6366f1)', fill: 'rgba(99,102,241,0.08)' },
  { stroke: 'var(--color-tertiary, #8b5cf6)', fill: 'rgba(139,92,246,0.08)' },
  { stroke: 'var(--color-secondary, #64748b)', fill: 'rgba(100,116,139,0.08)' },
  { stroke: 'var(--color-warning, #f59e0b)', fill: 'rgba(245,158,11,0.08)' },
  { stroke: 'var(--color-error, #ef4444)', fill: 'rgba(239,68,68,0.08)' },
]

const EDGE_STYLES: Record<RelationType, { stroke: string; dash: string; bidirectional: boolean }> = {
  REQUIRES:   { stroke: 'var(--color-warning, #f59e0b)',  dash: 'none',  bidirectional: false },
  CONFLICTS:  { stroke: 'var(--color-error, #ef4444)',    dash: '6,4',   bidirectional: true  },
  RECOMMENDS: { stroke: 'var(--color-primary, #6366f1)', dash: '3,3',   bidirectional: false },
}

const RELATION_BADGE: Record<RelationType, string> = {
  CONFLICTS:  'bg-error/10 text-error border-error/20',
  REQUIRES:   'bg-warning/10 text-warning border-warning/20',
  RECOMMENDS: 'bg-primary/10 text-primary border-primary/20',
}

function nodeWidth(name: string) { return Math.max(80, name.length * 7 + 24) }
const NODE_HEIGHT = 30
const NODE_RX = 8

export function CompatibilityGraph({ rules, onEditRule }: Props) {
  const { nodes, edges, loading } = useCompatibilityGraphData(rules)

  const svgRef = useRef<SVGSVGElement>(null)
  const zoomGroupRef = useRef<SVGGElement>(null)
  const simRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null)
  const simNodesRef = useRef<SimNode[]>([])
  const simEdgesRef = useRef<SimEdge[]>([])
  const rafRef = useRef<number | null>(null)

  const [, setRenderTick] = useState(0)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<number | null>(null)

  // Map groupId → color index
  const groupColorMap = useRef<Map<number, number>>(new Map())

  const getGroupColor = useCallback((groupId: number): typeof GROUP_COLORS[0] => {
    if (!groupColorMap.current.has(groupId)) {
      groupColorMap.current.set(groupId, groupColorMap.current.size % GROUP_COLORS.length)
    }
    return GROUP_COLORS[groupColorMap.current.get(groupId)!]
  }, [])

  // Determine if a node/edge is connected to the selection
  const connectedNodeIds = useCallback((nodeId: string | null): Set<string> => {
    if (!nodeId) return new Set()
    const connected = new Set<string>([nodeId])
    for (const e of simEdgesRef.current) {
      const s = typeof e.source === 'string' ? e.source : (e.source as SimNode).id
      const t = typeof e.target === 'string' ? e.target : (e.target as SimNode).id
      if (s === nodeId) connected.add(t)
      if (t === nodeId) connected.add(s)
    }
    return connected
  }, [])

  const connectedEdgeIds = useCallback((nodeId: string | null): Set<number> => {
    if (!nodeId) return new Set()
    const ids = new Set<number>()
    for (const e of simEdgesRef.current) {
      const s = typeof e.source === 'string' ? e.source : (e.source as SimNode).id
      const t = typeof e.target === 'string' ? e.target : (e.target as SimNode).id
      if (s === nodeId || t === nodeId) ids.add(e.id)
    }
    return ids
  }, [])

  const edgeNodeIds = useCallback((edgeId: number | null): Set<string> => {
    if (!edgeId) return new Set()
    const ids = new Set<string>()
    for (const e of simEdgesRef.current) {
      if (e.id === edgeId) {
        ids.add(typeof e.source === 'string' ? e.source : (e.source as SimNode).id)
        ids.add(typeof e.target === 'string' ? e.target : (e.target as SimNode).id)
      }
    }
    return ids
  }, [])

  // Build or update simulation when data changes
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return
    const svg = svgRef.current
    const W = svg.clientWidth || 800
    const H = svg.clientHeight || 500

    // Preserve positions for existing nodes
    const existingPos = new Map<string, { x: number; y: number; fx?: number | null; fy?: number | null }>()
    for (const n of simNodesRef.current) {
      if (n.x != null && n.y != null) {
        existingPos.set(n.id, { x: n.x, y: n.y, fx: n.fx, fy: n.fy })
      }
    }

    const simNodes: SimNode[] = nodes.map(n => {
      const prev = existingPos.get(n.id)
      return { ...n, x: prev?.x ?? W / 2 + (Math.random() - 0.5) * 100, y: prev?.y ?? H / 2 + (Math.random() - 0.5) * 100, fx: prev?.fx, fy: prev?.fy }
    })
    const simEdges: SimEdge[] = edges.map(e => ({ ...e, source: e.source, target: e.target }))

    simNodesRef.current = simNodes
    simEdgesRef.current = simEdges

    if (simRef.current) simRef.current.stop()

    const sim = d3.forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimEdge>(simEdges).id(d => d.id).distance(150).strength(0.5))
      .force('charge', d3.forceManyBody<SimNode>().strength(-350))
      .force('center', d3.forceCenter(W / 2, H / 2).strength(0.05))
      .force('collision', d3.forceCollide<SimNode>(50))
      .alphaDecay(0.02)
      .on('tick', () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => setRenderTick(t => t + 1))
      })

    simRef.current = sim

    // Attach zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (zoomGroupRef.current) {
          d3.select(zoomGroupRef.current).attr('transform', event.transform.toString())
        }
      })

    const svgSel = d3.select<SVGSVGElement, unknown>(svg)
    svgSel.call(zoomBehavior)
    svgSel.on('dblclick.zoom', () => svgSel.transition().duration(400).call(zoomBehavior.transform, d3.zoomIdentity))

    return () => {
      sim.stop()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [nodes, edges])

  // Attach drag behaviors after each render that has new nodes
  useEffect(() => {
    if (!svgRef.current || simNodesRef.current.length === 0 || !simRef.current) return
    const sim = simRef.current

    const dragBehavior = d3.drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0)
        // Keep node pinned where user dropped it
        d.fx = d.x
        d.fy = d.y
      })

    d3.select(svgRef.current)
      .selectAll<SVGGElement, SimNode>('.graph-node')
      .data(simNodesRef.current)
      .call(dragBehavior)
  })

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedEdgeId(null)
    setSelectedNodeId(prev => prev === nodeId ? null : nodeId)
  }, [])

  const handleEdgeClick = useCallback((edgeId: number) => {
    setSelectedNodeId(null)
    setSelectedEdgeId(prev => prev === edgeId ? null : edgeId)
  }, [])

  const handleBgClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }, [])

  // Selection sets
  const connNodes = connectedNodeIds(selectedNodeId)
  const connEdges = connectedEdgeIds(selectedNodeId)
  const edgeNodes = edgeNodeIds(selectedEdgeId)
  const hasSelection = selectedNodeId !== null || selectedEdgeId !== null

  const selectedEdgeData = selectedEdgeId != null ? simEdgesRef.current.find(e => e.id === selectedEdgeId) : null
  const selectedNodeData = selectedNodeId != null ? simNodesRef.current.find(n => n.id === selectedNodeId) : null
  const nodeRules = selectedNodeId != null ? rules.filter(r => r.sourceDepId === selectedNodeId || r.targetDepId === selectedNodeId) : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-secondary text-sm">
        <span className="material-symbols-outlined animate-spin mr-2" style={{ fontSize: '20px' }}>progress_activity</span>
        Loading graph data...
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-secondary text-sm gap-2">
        <span className="material-symbols-outlined text-4xl opacity-30">hub</span>
        <p>No compatibility rules defined yet.</p>
        <p className="text-xs text-on-surface-variant">Add rules to see the dependency graph.</p>
      </div>
    )
  }

  return (
    <div className="relative rounded-xl border border-outline-variant overflow-hidden bg-surface-container-lowest" style={{ height: 520 }}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        onClick={handleBgClick}
      >
        <defs>
          {/* Arrow markers — one per color */}
          {(['REQUIRES', 'CONFLICTS', 'RECOMMENDS'] as RelationType[]).map(type => {
            const style = EDGE_STYLES[type]
            return (
              <marker
                key={`arrow-${type}`}
                id={`arrow-${type}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={style.stroke} />
              </marker>
            )
          })}
        </defs>

        <g ref={zoomGroupRef}>
          {/* Edges */}
          <g>
            {simEdgesRef.current.map(edge => {
              const s = edge.source as SimNode
              const t = edge.target as SimNode
              if (s.x == null || s.y == null || t.x == null || t.y == null) return null

              const style = EDGE_STYLES[edge.relationType]
              const isSelected = edge.id === selectedEdgeId
              const isDimmed = hasSelection && !isSelected && !connEdges.has(edge.id) && !edgeNodes.has(typeof edge.source === 'string' ? edge.source : s.id)

              const mx = (s.x + t.x) / 2
              const my = (s.y + t.y) / 2

              // Offset source/target to node edge
              const dx = t.x - s.x
              const dy = t.y - s.y
              const len = Math.sqrt(dx * dx + dy * dy) || 1
              const sw = nodeWidth(s.name) / 2
              const tw = nodeWidth(t.name) / 2
              const x1 = s.x + (dx / len) * (sw + 2)
              const y1 = s.y + (dy / len) * (NODE_HEIGHT / 2 + 2)
              const x2 = t.x - (dx / len) * (tw + 2)
              const y2 = t.y - (dy / len) * (NODE_HEIGHT / 2 + 2)

              return (
                <g key={edge.id} style={{ opacity: isDimmed ? 0.15 : 1, cursor: 'pointer' }}>
                  {/* Invisible wider hit area */}
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="transparent"
                    strokeWidth={12}
                    onClick={e => { e.stopPropagation(); handleEdgeClick(edge.id) }}
                  />
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={style.stroke}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    strokeDasharray={style.dash === 'none' ? undefined : style.dash}
                    markerEnd={`url(#arrow-${edge.relationType})`}
                    markerStart={style.bidirectional ? `url(#arrow-${edge.relationType})` : undefined}
                    onClick={e => { e.stopPropagation(); handleEdgeClick(edge.id) }}
                  />
                  {/* Hover label at midpoint */}
                  {isSelected && (
                    <text
                      x={mx} y={my - 6}
                      textAnchor="middle"
                      fontSize="9"
                      fill={style.stroke}
                      fontWeight="600"
                      letterSpacing="0.05em"
                      style={{ pointerEvents: 'none', textTransform: 'uppercase' }}
                    >
                      {edge.relationType}
                    </text>
                  )}
                </g>
              )
            })}
          </g>

          {/* Nodes */}
          <g>
            {simNodesRef.current.map(node => {
              if (node.x == null || node.y == null) return null

              const w = nodeWidth(node.name)
              const color = getGroupColor(node.groupId)
              const isSelected = node.id === selectedNodeId
              const isDimmed = hasSelection && !isSelected && !connNodes.has(node.id) && !edgeNodes.has(node.id)
              const isHighlighted = !isSelected && (connNodes.has(node.id) || edgeNodes.has(node.id)) && hasSelection

              return (
                <g
                  key={node.id}
                  className="graph-node"
                  transform={`translate(${node.x},${node.y})`}
                  style={{ cursor: 'pointer', opacity: isDimmed ? 0.2 : 1 }}
                  onClick={e => { e.stopPropagation(); handleNodeClick(node.id) }}
                >
                  <rect
                    x={-w / 2}
                    y={-NODE_HEIGHT / 2}
                    width={w}
                    height={NODE_HEIGHT}
                    rx={NODE_RX}
                    fill={isSelected ? color.fill.replace('0.08', '0.18') : color.fill}
                    stroke={isSelected ? color.stroke : isHighlighted ? color.stroke : 'var(--color-outline-variant)'}
                    strokeWidth={isSelected ? 2 : isHighlighted ? 1.5 : 1}
                    filter={isSelected ? 'drop-shadow(0 0 6px rgba(99,102,241,0.35))' : undefined}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fontWeight={isSelected ? '700' : '500'}
                    fill={isSelected ? color.stroke : 'var(--color-on-surface)'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.name}
                  </text>
                  {/* Group label below node */}
                  <text
                    y={NODE_HEIGHT / 2 + 10}
                    textAnchor="middle"
                    fontSize="8"
                    fill="var(--color-on-surface-variant)"
                    opacity={isSelected || isHighlighted ? 1 : 0.6}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.groupName}
                  </text>
                </g>
              )
            })}
          </g>
        </g>
      </svg>

      <CompatibilityGraphLegend />

      {/* Detail panel */}
      <AnimatePresence>
        {(selectedNodeData || selectedEdgeData) && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
            className="absolute top-4 right-4 w-64 bg-surface/95 backdrop-blur-sm border border-outline-variant rounded-xl shadow-lg p-4 text-sm"
            onClick={e => e.stopPropagation()}
          >
            {selectedNodeData && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-on-surface">{selectedNodeData.name}</div>
                    <code className="text-[10px] text-secondary">{selectedNodeData.id}</code>
                  </div>
                  <button
                    onClick={() => setSelectedNodeId(null)}
                    className="text-secondary hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                  </button>
                </div>
                <div className="text-[10px] text-on-surface-variant mb-2 font-medium uppercase tracking-widest">
                  {selectedNodeData.groupName}
                </div>
                {nodeRules.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Rules ({nodeRules.length})</div>
                    {nodeRules.map(r => (
                      <div key={r.id} className="flex items-center gap-1.5 text-[11px]">
                        <code className="text-secondary shrink-0 max-w-[60px] truncate">{r.sourceDepId}</code>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${RELATION_BADGE[r.relationType]}`}>
                          {r.relationType}
                        </span>
                        <code className="text-secondary shrink-0 max-w-[60px] truncate">{r.targetDepId}</code>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {selectedEdgeData && (() => {
              const s = selectedEdgeData.source as SimNode
              const t = selectedEdgeData.target as SimNode
              const sId = typeof s === 'string' ? s : s.id
              const tId = typeof t === 'string' ? t : t.id
              const sNode = simNodesRef.current.find(n => n.id === sId)
              const tNode = simNodesRef.current.find(n => n.id === tId)
              const style = EDGE_STYLES[selectedEdgeData.relationType]
              return (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs px-2 py-0.5 rounded border font-bold ${RELATION_BADGE[selectedEdgeData.relationType]}`}>
                      {selectedEdgeData.relationType}
                    </span>
                    <button
                      onClick={() => setSelectedEdgeId(null)}
                      className="text-secondary hover:text-on-surface transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{sNode?.name ?? sId}</code>
                    <svg width="28" height="10" className="shrink-0">
                      <line x1="0" y1="5" x2="20" y2="5" stroke={style.stroke} strokeWidth="1.5" strokeDasharray={style.dash === 'none' ? undefined : style.dash} />
                      <polygon points="20,2 28,5 20,8" fill={style.stroke} />
                    </svg>
                    <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{tNode?.name ?? tId}</code>
                  </div>
                  {selectedEdgeData.description && (
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">{selectedEdgeData.description}</p>
                  )}
                  {onEditRule && (() => {
                    const rule = rules.find(r => r.id === selectedEdgeData.id)
                    return rule ? (
                      <button
                        onClick={() => onEditRule(rule)}
                        className="mt-3 w-full text-xs py-1.5 rounded border border-outline-variant text-secondary hover:text-on-surface hover:border-outline transition-colors"
                      >
                        Edit Rule
                      </button>
                    ) : null
                  })()}
                </>
              )
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Node count badge */}
      <div className="absolute top-3 left-3 text-[10px] text-secondary bg-surface/80 px-2 py-1 rounded border border-outline-variant">
        {nodes.length} deps · {edges.length} rules
      </div>
    </div>
  )
}
