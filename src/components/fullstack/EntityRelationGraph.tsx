import { useMemo, useRef, useState } from 'react'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum } from 'd3-force'
import type { FullstackEntityDef } from '../../types'
import { pluralize } from './naming'

interface Props {
  entities: FullstackEntityDef[]
  /** Mirrors the `inverseCollections` opt: parents list the derived @OneToMany collections. */
  showInverse: boolean
  onSelect?: (uid: string) => void
  /**
   * Drag from one box's handle onto another to add a `MANY_TO_ONE` on the source. Omitted, the
   * diagram stays purely a picture.
   */
  onCreateRelation?: (sourceUid: string, targetUid: string) => void
  /** Why a drop was refused — the caller surfaces it (a toast); the rules mirror the backend's. */
  onRefuseRelation?: (message: string) => void
}

interface Node extends SimulationNodeDatum {
  id: string
  uid?: string
  label: string
  fields: number
  readOnly: boolean
  isView: boolean
  /** Primary-key summary: `id`, or `orderId + lineNo` for a composite key. */
  pk: string
  compositePk: boolean
  /** First non-PK text field — what the generated UI uses as a row's label. */
  labelField?: string
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

const NODE_W = 172
const NODE_H = 62
const R = 10
/** Radius of the connect handle that sits on a box's right edge. */
const HANDLE_R = 6

/**
 * Entity–relation diagram: one box per entity, one arrow per MANY_TO_ONE (from the FK owner to
 * its target; dashed when optional). Laid out with d3-force, computed synchronously from a
 * deterministic start so the picture is stable between renders.
 *
 * It is also an editing surface: drag a box's handle onto another box to add that relation. The
 * caller writes it through the same `entity.relations` path the Relations table uses, so
 * undo/redo, validation and lint pick it up with no special handling. Drops the backend would
 * reject are refused here, in the backend's own words.
 */
export function EntityRelationGraph({ entities, showInverse, onSelect, onCreateRelation, onRefuseRelation }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ fromId: string; x: number; y: number; overId: string | null } | null>(null)
  // Suppresses the click that follows a drag release, so finishing a drag on a box does not also
  // navigate to that box's card.
  const draggedRef = useRef(false)

  const { nodes, edges, width, height } = useMemo(() => {
    const byLower = new Map<string, Node>()
    const nodes: Node[] = entities.map((e, i) => {
      const pkFields = e.fields.filter(f => f.primaryKey)
      const labelField = e.fields.find(f => !f.primaryKey && (f.type === 'STRING' || f.type === 'TEXT'))
      const n: Node = {
        id: e.uid ?? `i${i}`, uid: e.uid, label: e.name.trim() || '(unnamed)', fields: e.fields.length,
        readOnly: Boolean(e.readOnly || e.viewQuery), isView: Boolean(e.viewQuery), inverse: [],
        pk: pkFields.map(f => f.name).join(' + ') || '—',
        compositePk: pkFields.length > 1,
        labelField: labelField?.name,
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
    const width = Math.max(520, Math.min(1100, 250 * Math.ceil(Math.sqrt(n)) + 200))
    const height = Math.max(240, 160 * Math.ceil(n / Math.ceil(Math.sqrt(n) || 1)) + 100)
    // Deterministic start: around a circle in entity order — no Math.random, so the layout
    // doesn't jump when the user edits a field.
    nodes.forEach((node, i) => {
      const a = (2 * Math.PI * i) / Math.max(n, 1)
      node.x = width / 2 + Math.cos(a) * Math.min(width, height) * 0.3
      node.y = height / 2 + Math.sin(a) * Math.min(width, height) * 0.3
    })
    const sim = forceSimulation<Node>(nodes)
      .force('link', forceLink<Node, Edge>(edges.filter(e => e.source !== e.target)).id(d => d.id).distance(210).strength(0.6))
      .force('charge', forceManyBody<Node>().strength(-560))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<Node>(100))
      .stop()
    for (let i = 0; i < 200; i++) sim.tick()
    // Clamp into the canvas, leaving room for the connect handle on the right edge.
    for (const node of nodes) {
      node.x = Math.max(NODE_W / 2 + 8, Math.min(width - NODE_W / 2 - HANDLE_R - 8, node.x ?? 0))
      node.y = Math.max(NODE_H / 2 + 8, Math.min(height - NODE_H / 2 - 8, node.y ?? 0))
    }
    return { nodes, edges, width, height }
  }, [entities, showInverse])

  if (nodes.length === 0) return null

  const byId = new Map(nodes.map(n => [n.id, n]))
  const editable = Boolean(onCreateRelation)

  /**
   * Why this relation cannot exist, mirroring `FullstackRequestValidator`: a SELECT-backed view
   * may neither declare relations nor be targeted, and a single `<field>Id` column cannot address
   * a composite key. A self-reference is fine.
   */
  function refusal(source: Node, target: Node): string | null {
    if (source.isView) return `${source.label} is a SELECT-backed view — a view cannot declare relations.`
    if (target.isView) return `${target.label} is a SELECT-backed view — a relation cannot target one.`
    if (target.compositePk) return `${target.label} has a composite primary key — a relation cannot target one.`
    return null
  }

  /** Viewport point → viewBox coordinates. `xMinYMin meet` keeps this a single uniform scale. */
  function toSvg(clientX: number, clientY: number): { x: number; y: number } {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return { x: 0, y: 0 }
    const scale = Math.min(rect.width / width, rect.height / height) || 1
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }
  }

  function nodeAt(x: number, y: number): Node | null {
    for (const node of nodes) {
      const cx = node.x ?? 0; const cy = node.y ?? 0
      if (Math.abs(x - cx) <= NODE_W / 2 && Math.abs(y - cy) <= NODE_H / 2) return node
    }
    return null
  }

  function onHandleDown(e: React.PointerEvent, node: Node) {
    if (!editable || !node.uid) return
    e.stopPropagation()
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = toSvg(e.clientX, e.clientY)
    draggedRef.current = false
    setDrag({ fromId: node.id, x: p.x, y: p.y, overId: null })
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return
    const p = toSvg(e.clientX, e.clientY)
    draggedRef.current = true
    const over = nodeAt(p.x, p.y)
    setDrag({ ...drag, x: p.x, y: p.y, overId: over?.id ?? null })
  }

  function onPointerUp() {
    if (!drag) return
    const source = byId.get(drag.fromId)
    const target = drag.overId ? byId.get(drag.overId) : null
    setDrag(null)
    if (!source || !target || !source.uid || !target.uid) return
    const why = refusal(source, target)
    if (why) { onRefuseRelation?.(why); return }
    onCreateRelation?.(source.uid, target.uid)
  }

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

  const dragSource = drag ? byId.get(drag.fromId) : null
  const dragTarget = drag?.overId ? byId.get(drag.overId) : null
  const dragRefusal = dragSource && dragTarget ? refusal(dragSource, dragTarget) : null

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low overflow-x-auto" data-entity-graph>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        preserveAspectRatio="xMinYMin meet"
        style={{ minWidth: Math.min(width, 520), maxHeight: 460, display: 'block', touchAction: drag ? 'none' : undefined }}
        role="img"
        aria-label="Entity relation diagram"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
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

        {/* The in-flight connection. Red while hovering a box the backend would reject. */}
        {drag && dragSource && (
          <line
            x1={(dragSource.x ?? 0) + NODE_W / 2}
            y1={dragSource.y ?? 0}
            x2={drag.x}
            y2={drag.y}
            stroke={dragRefusal ? 'var(--color-error, #ef4444)' : 'var(--color-primary, #6366f1)'}
            strokeWidth={2}
            strokeDasharray="4,3"
            markerEnd="url(#er-arrow)"
            pointerEvents="none"
          />
        )}

        {nodes.map(node => {
          const x = (node.x ?? 0) - NODE_W / 2; const y = (node.y ?? 0) - NODE_H / 2
          const clickable = Boolean(onSelect && node.uid)
          const isDropTarget = drag?.overId === node.id
          const refused = isDropTarget && Boolean(dragRefusal)
          return (
            <g key={node.id}>
              <g
                transform={`translate(${x}, ${y})`}
                onClick={() => {
                  if (draggedRef.current) { draggedRef.current = false; return }
                  if (clickable) onSelect!(node.uid!)
                }}
                style={{ cursor: clickable ? 'pointer' : 'default' }}
                role={clickable ? 'button' : undefined}
                aria-label={clickable ? `Go to ${node.label}` : undefined}
              >
                <rect
                  width={NODE_W} height={NODE_H} rx={R}
                  fill="var(--color-surface-container, #fff)"
                  stroke={refused
                    ? 'var(--color-error, #ef4444)'
                    : isDropTarget
                      ? 'var(--color-primary, #6366f1)'
                      : node.readOnly ? 'var(--color-secondary, #64748b)' : 'var(--color-primary, #6366f1)'}
                  strokeWidth={isDropTarget ? 2.5 : 1.5}
                  strokeDasharray={node.isView ? '4,3' : undefined}
                />
                <text x={12} y={19} fontSize={12} fontWeight={700} fill="var(--color-on-surface, #111)" fontFamily="ui-monospace, monospace">
                  {node.label.length > 20 ? node.label.slice(0, 19) + '…' : node.label}
                </text>
                {/* The key and the label field: what a relation to this entity would point at, and
                    what the generated UI would show for a row. */}
                <text x={12} y={34} fontSize={9.5} fill="var(--color-on-surface-variant, #64748b)" fontFamily="ui-monospace, monospace">
                  {node.compositePk ? '⚿ ' : '🔑 '}{node.pk.length > 22 ? node.pk.slice(0, 21) + '…' : node.pk}
                  {node.labelField ? `  ·  ${node.labelField.length > 12 ? node.labelField.slice(0, 11) + '…' : node.labelField}` : ''}
                </text>
                <text x={12} y={49} fontSize={9.5} fill="var(--color-secondary, #64748b)">
                  {node.fields} field{node.fields === 1 ? '' : 's'}{node.readOnly ? ' · read-only' : ''}
                  {node.inverse.length > 0 ? ` · ⇐ ${node.inverse.join(', ')}` : ''}
                </text>
              </g>
              {editable && node.uid && !node.isView && (
                <circle
                  cx={(node.x ?? 0) + NODE_W / 2}
                  cy={node.y ?? 0}
                  r={HANDLE_R}
                  fill="var(--color-surface-container, #fff)"
                  stroke="var(--color-primary, #6366f1)"
                  strokeWidth={1.5}
                  style={{ cursor: 'crosshair' }}
                  onPointerDown={e => onHandleDown(e, node)}
                >
                  <title>Drag onto another entity to add a @ManyToOne from {node.label}</title>
                </circle>
              )}
            </g>
          )
        })}
      </svg>
      <p className="px-3 py-1.5 text-[10px] text-secondary border-t border-outline-variant/60">
        Arrow = @ManyToOne from the FK owner to its target (dashed = optional); dashed box = SELECT-backed view.
        Click a box to jump to it.
        {editable && ' Drag the dot on a box’s right edge onto another box to add a relation.'}
      </p>
    </div>
  )
}
