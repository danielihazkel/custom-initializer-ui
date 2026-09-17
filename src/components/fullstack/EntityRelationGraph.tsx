import { useMemo } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum } from 'd3-force'
import type { FullstackEntityDef } from '../../types'
import { pluralize } from './naming'

interface Props {
  entities: FullstackEntityDef[]
  /** Mirrors the `inverseCollections` opt: parents list the derived @OneToMany collections. */
  showInverse: boolean
  onSelect?: (uid: string) => void
}

interface Node extends SimulationNodeDatum {
  id: string
  uid?: string
  label: string
  fields: number
  readOnly: boolean
  isView: boolean
  /** Derived inverse collections (child plural names) when showInverse. */
  inverse: string[]
}
interface Edge {
  id: string
  source: Node
  target: Node
  label: string
  required: boolean
}

const NODE_W = 150
const NODE_H = 46
const R = 10

/**
 * Read-only entity–relation diagram: one box per entity, one arrow per MANY_TO_ONE (from the
 * FK owner to its target; dashed when optional). Laid out with d3-force, computed synchronously
 * from a deterministic start so the picture is stable between renders. Clicking a box jumps to
 * its card in the editor.
 */
export function EntityRelationGraph({ entities, showInverse, onSelect }: Props) {
  const { nodes, edges, width, height } = useMemo(() => {
    const byLower = new Map<string, Node>()
    const nodes: Node[] = entities.map((e, i) => {
      const n: Node = {
        id: e.uid ?? `i${i}`, uid: e.uid, label: e.name.trim() || '(unnamed)', fields: e.fields.length,
        readOnly: Boolean(e.readOnly || e.viewQuery), isView: Boolean(e.viewQuery), inverse: [],
      }
      if (e.name.trim()) byLower.set(e.name.trim().toLowerCase(), n)
      return n
    })
    const edges: Edge[] = []
    entities.forEach((e, i) => {
      for (const r of e.relations ?? []) {
        const target = byLower.get(r.targetEntity.trim().toLowerCase())
        if (!target || !r.fieldName.trim()) continue
        const source = nodes[i]
        edges.push({ id: `${source.id}-${r.fieldName}`, source, target, label: r.fieldName.trim(), required: Boolean(r.required) })
        if (showInverse && source !== target) {
          const camel = source.label.charAt(0).toLowerCase() + source.label.slice(1)
          target.inverse.push(pluralize(camel))
        }
      }
    })

    const n = nodes.length
    const width = Math.max(520, Math.min(1100, 230 * Math.ceil(Math.sqrt(n)) + 200))
    const height = Math.max(220, 150 * Math.ceil(n / Math.ceil(Math.sqrt(n) || 1)) + 100)
    // Deterministic start: around a circle in entity order — no Math.random, so the layout
    // doesn't jump when the user edits a field.
    nodes.forEach((node, i) => {
      const a = (2 * Math.PI * i) / Math.max(n, 1)
      node.x = width / 2 + Math.cos(a) * Math.min(width, height) * 0.3
      node.y = height / 2 + Math.sin(a) * Math.min(width, height) * 0.3
    })
    const sim = forceSimulation<Node>(nodes)
      .force('link', forceLink<Node, Edge>(edges.filter(e => e.source !== e.target)).id(d => d.id).distance(200).strength(0.6))
      .force('charge', forceManyBody<Node>().strength(-500))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<Node>(90))
      .stop()
    for (let i = 0; i < 200; i++) sim.tick()
    // Clamp into the canvas.
    for (const node of nodes) {
      node.x = Math.max(NODE_W / 2 + 8, Math.min(width - NODE_W / 2 - 8, node.x ?? 0))
      node.y = Math.max(NODE_H / 2 + 8, Math.min(height - NODE_H / 2 - 8, node.y ?? 0))
    }
    return { nodes, edges, width, height }
  }, [entities, showInverse])

  if (nodes.length === 0) return null

  /** Point on the border of a node's box along the line towards (tx, ty). */
  function borderPoint(node: Node, tx: number, ty: number): { x: number; y: number } {
    const cx = node.x ?? 0; const cy = node.y ?? 0
    const dx = tx - cx; const dy = ty - cy
    if (dx === 0 && dy === 0) return { x: cx, y: cy }
    const sx = (NODE_W / 2) / Math.abs(dx || 1e-6)
    const sy = (NODE_H / 2) / Math.abs(dy || 1e-6)
    const s = Math.min(sx, sy)
    return { x: cx + dx * s, y: cy + dy * s }
  }

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low overflow-x-auto" data-entity-graph>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ minWidth: Math.min(width, 520), maxHeight: 420, display: 'block' }}
        role="img"
        aria-label="Entity relation diagram"
      >
        <defs>
          <marker id="er-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-secondary, #64748b)" />
          </marker>
        </defs>
        {edges.map(e => {
          const stroke = 'var(--color-secondary, #64748b)'
          const dash = e.required ? undefined : '5,4'
          if (e.source === e.target) {
            // Self-reference (e.g. Employee.manager): a loop off the top-right corner.
            const x = (e.source.x ?? 0) + NODE_W / 2 - 16
            const y = (e.source.y ?? 0) - NODE_H / 2
            return (
              <g key={e.id}>
                <path d={`M ${x} ${y} C ${x + 10} ${y - 40}, ${x + 50} ${y - 40}, ${x + 28} ${y}`} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray={dash} markerEnd="url(#er-arrow)" />
                <text x={x + 30} y={y - 32} fontSize={10} fill="var(--color-on-surface-variant, #64748b)" fontFamily="ui-monospace, monospace">{e.label}</text>
              </g>
            )
          }
          const from = borderPoint(e.source, e.target.x ?? 0, e.target.y ?? 0)
          const to = borderPoint(e.target, e.source.x ?? 0, e.source.y ?? 0)
          const mx = (from.x + to.x) / 2; const my = (from.y + to.y) / 2
          return (
            <g key={e.id}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={stroke} strokeWidth={1.5} strokeDasharray={dash} markerEnd="url(#er-arrow)" />
              {/* FK label on a small plate so it stays readable across a line */}
              <rect x={mx - e.label.length * 3.2 - 4} y={my - 8} width={e.label.length * 6.4 + 8} height={15} rx={4} fill="var(--color-surface-container-low, #fff)" />
              <text x={mx} y={my + 3} textAnchor="middle" fontSize={10} fill="var(--color-on-surface-variant, #64748b)" fontFamily="ui-monospace, monospace">{e.label}</text>
              <text x={from.x + (mx - from.x) * 0.18} y={from.y + (my - from.y) * 0.18 - 3} fontSize={9} fill={stroke} textAnchor="middle">*</text>
              <text x={to.x + (mx - to.x) * 0.18} y={to.y + (my - to.y) * 0.18 - 3} fontSize={9} fill={stroke} textAnchor="middle">1</text>
            </g>
          )
        })}
        {nodes.map(node => {
          const x = (node.x ?? 0) - NODE_W / 2; const y = (node.y ?? 0) - NODE_H / 2
          const clickable = Boolean(onSelect && node.uid)
          return (
            <g
              key={node.id}
              transform={`translate(${x}, ${y})`}
              onClick={() => clickable && onSelect!(node.uid!)}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
              role={clickable ? 'button' : undefined}
              aria-label={clickable ? `Go to ${node.label}` : undefined}
            >
              <rect
                width={NODE_W} height={NODE_H} rx={R}
                fill="var(--color-surface-container, #fff)"
                stroke={node.readOnly ? 'var(--color-secondary, #64748b)' : 'var(--color-primary, #6366f1)'}
                strokeWidth={1.5}
                strokeDasharray={node.isView ? '4,3' : undefined}
              />
              <text x={12} y={19} fontSize={12} fontWeight={700} fill="var(--color-on-surface, #111)" fontFamily="ui-monospace, monospace">
                {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
              </text>
              <text x={12} y={35} fontSize={10} fill="var(--color-secondary, #64748b)">
                {node.fields} field{node.fields === 1 ? '' : 's'}{node.readOnly ? ' · read-only' : ''}
                {node.inverse.length > 0 ? ` · ⇐ ${node.inverse.join(', ')}` : ''}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="px-3 py-1.5 text-[10px] text-secondary border-t border-outline-variant/60">
        Arrow = @ManyToOne from the FK owner to its target (dashed = optional); dashed box = SELECT-backed view.
        Click a box to jump to it.
      </p>
    </div>
  )
}
