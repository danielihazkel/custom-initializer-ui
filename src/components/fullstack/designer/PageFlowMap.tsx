import { useMemo, useState } from 'react'
import type { FullstackEntityDef, FullstackPageDef } from '../../../types'
import { FLOW_EDGE_KINDS, MENU, buildPageFlow, type FlowEdge, type FlowEdgeKind } from '../pageFlow'
import { PAGE_TYPE_META, inNav, pageLabel } from '../pageLayout'

const NODE_W = 168
const NODE_H = 42
const COL_GAP = 76
const ROW_GAP = 14
const PAD = 12
const MENU_W = 92

/** How each kind of link is drawn (literal values, so they read in both themes). */
const EDGE_STYLE: Record<FlowEdgeKind, { color: string; dash?: string }> = {
  nav: { color: 'var(--color-outline)', dash: '3 3' },
  search: { color: 'var(--color-outline)', dash: '1 3' },
  tab: { color: '#8b5cf6' },
  row: { color: 'var(--color-primary)' },
  create: { color: '#10b981' },
  save: { color: '#10b981', dash: '5 3' },
  drill: { color: '#f59e0b' },
  link: { color: '#06b6d4' },
  back: { color: 'var(--color-outline)', dash: '6 4' },
}

interface Box { x: number; y: number; w: number }

/**
 * The layout as a map of where each page leads: the menu on the left, then the pages a click
 * further on in each column, and the pages nothing leads to in a column of their own. Hovering
 * or focusing a page lights its links; a click opens it in the design view.
 */
export function PageFlowMap({ pages, entities, startIndex, onOpenPage }: {
  pages: FullstackPageDef[]
  entities: FullstackEntityDef[]
  startIndex?: number
  onOpenPage: (index: number) => void
}) {
  const flow = useMemo(() => buildPageFlow(pages, entities), [pages, entities])
  const [focus, setFocus] = useState<number | null>(null)
  const [showMenu, setShowMenu] = useState(true)

  const boxes = new Map<number, Box>()
  boxes.set(MENU, { x: PAD, y: PAD, w: MENU_W })
  const colX = (c: number) => PAD + MENU_W + COL_GAP + c * (NODE_W + COL_GAP)
  flow.columns.forEach((column, c) => column.forEach((index, r) => boxes.set(index, { x: colX(c), y: PAD + r * (NODE_H + ROW_GAP), w: NODE_W })))
  const width = colX(flow.columns.length) - COL_GAP + PAD
  const height = PAD * 2 + Math.max(1, ...flow.columns.map(c => c.length)) * (NODE_H + ROW_GAP) - ROW_GAP
  const unreachableX = flow.unreachable.length > 0 ? colX(flow.columns.length - 1) : null

  const edges = flow.edges.filter(e => showMenu || e.from !== MENU)
  const between = flow.edges.filter(e => e.from !== MENU).length
  const touches = (e: FlowEdge) => focus == null || e.from === focus || e.to === focus
  const kindsShown = FLOW_EDGE_KINDS.filter(k => edges.some(e => e.kinds.includes(k.kind)))
  const nameOf = (i: number) => (i === MENU ? 'the menu' : pageLabel(pages[i]))
  const describe = (i: number) => {
    const into = flow.edges.filter(e => e.to === i).map(e => `${nameOf(e.from)} (${e.kinds.map(kindLabel).join(', ')})`)
    const out = flow.edges.filter(e => e.from === i).map(e => `${nameOf(e.to)} (${e.kinds.map(kindLabel).join(', ')})`)
    return [
      into.length ? `Reached from ${into.join('; ')}` : 'Nothing leads here',
      out.length ? `leads to ${out.join('; ')}` : 'leads nowhere',
    ].join(' — ')
  }

  function path(e: FlowEdge): string {
    const s = boxes.get(e.from)!
    const t = boxes.get(e.to)!
    const sy = s.y + NODE_H / 2
    const ty = t.y + NODE_H / 2
    if (t.x > s.x) {
      const [x1, x2] = [s.x + s.w, t.x]
      const bend = Math.max(24, (x2 - x1) / 2)
      return `M${x1},${sy} C${x1 + bend},${sy} ${x2 - bend},${ty} ${x2},${ty}`
    }
    if (t.x < s.x) {
      const [x1, x2] = [s.x, t.x + t.w]
      const bend = Math.max(24, (x1 - x2) / 2)
      return `M${x1},${sy} C${x1 - bend},${sy} ${x2 + bend},${ty} ${x2},${ty}`
    }
    // Same column: out of the right edge and back in.
    const x = s.x + s.w
    const bend = 28 + Math.abs(ty - sy) / 6
    return `M${x},${sy} C${x + bend},${sy} ${x + bend},${ty} ${x},${ty}`
  }

  if (pages.length === 0) return <p className="text-[11px] text-secondary">No pages yet.</p>

  return (
    <div className="space-y-3" data-page-flow>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-secondary">
        <span>
          {pages.length} page{pages.length === 1 ? '' : 's'} · {between} link{between === 1 ? '' : 's'} between them
        </span>
        {flow.unreachable.length > 0 && (
          <span className="font-semibold text-error" data-flow-unreachable>
            Nothing leads to {flow.unreachable.map(i => `“${pageLabel(pages[i])}”`).join(', ')}
          </span>
        )}
        <label className="ms-auto inline-flex items-center gap-1.5">
          <input type="checkbox" className="accent-primary" checked={showMenu} onChange={e => setShowMenu(e.target.checked)} />
          Menu links
        </label>
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-secondary" aria-label="Kinds of link" data-flow-legend>
        {kindsShown.map(({ kind, label }) => (
          <li key={kind} className="inline-flex items-center gap-1">
            <svg width="22" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="22" y2="3" stroke={EDGE_STYLE[kind].color} strokeWidth="2" strokeDasharray={EDGE_STYLE[kind].dash} />
            </svg>
            {label}
          </li>
        ))}
      </ul>
      <div className="overflow-auto rounded-xl border border-outline-variant bg-surface-container-lowest">
        <div className="relative" style={{ width, height }}>
          {unreachableX != null && (
            <div
              className="absolute rounded-lg border border-dashed border-error/50 bg-error/5"
              style={{ left: unreachableX - 8, top: 4, width: NODE_W + 16, height: height - 8 }}
              aria-hidden="true"
            />
          )}
          <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden="true">
            <defs>
              {FLOW_EDGE_KINDS.map(({ kind }) => (
                <marker key={kind} id={`flow-arrow-${kind}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L8,4 L0,8 z" fill={EDGE_STYLE[kind].color} />
                </marker>
              ))}
            </defs>
            {edges.map(e => {
              const kind = e.kinds[0]
              const lit = touches(e)
              return (
                <path
                  key={`${e.from}>${e.to}`}
                  d={path(e)}
                  fill="none"
                  stroke={EDGE_STYLE[kind].color}
                  strokeWidth={focus != null && lit ? 2.2 : 1.4}
                  strokeDasharray={EDGE_STYLE[kind].dash}
                  markerEnd={`url(#flow-arrow-${kind})`}
                  opacity={lit ? (focus == null && e.from === MENU ? 0.45 : 0.9) : 0.08}
                  data-flow-edge={`${e.from}>${e.to}`}
                  data-flow-kinds={e.kinds.join(' ')}
                />
              )
            })}
          </svg>
          <div
            className="absolute flex items-center justify-center gap-1 rounded-lg border border-outline bg-surface-container text-xs font-semibold text-on-surface"
            style={{ left: PAD, top: PAD, width: MENU_W, height: NODE_H }}
            onMouseEnter={() => setFocus(MENU)}
            onMouseLeave={() => setFocus(null)}
            data-flow-node="menu"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">menu</span>
            Menu
          </div>
          {pages.map((page, i) => {
            const box = boxes.get(i)
            if (!box) return null
            const meta = PAGE_TYPE_META[page.type]
            const lost = flow.depth[i] == null
            const dim = focus != null && focus !== i && !flow.edges.some(e => (e.from === focus && e.to === i) || (e.to === focus && e.from === i))
            return (
              <button
                key={`${i}:${page.id}`}
                type="button"
                onClick={() => onOpenPage(i)}
                onMouseEnter={() => setFocus(i)}
                onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(i)}
                onBlur={() => setFocus(null)}
                aria-label={`${pageLabel(page)}, ${meta?.label ?? page.type} page. ${describe(i)}. Opens it in the design view.`}
                title={describe(i)}
                className={`absolute flex items-center gap-1.5 rounded-lg border px-2 text-start transition-opacity ${
                  lost ? 'border-dashed border-error/60 bg-error/5' : inNav(page) ? 'border-outline-variant bg-surface-container' : 'border-dashed border-outline bg-surface-container'
                } ${focus === i ? 'ring-2 ring-primary/60' : ''} hover:border-primary/60`}
                style={{ left: box.x, top: box.y, width: box.w, height: NODE_H, opacity: dim ? 0.35 : 1 }}
                data-flow-node={page.id}
                data-flow-depth={flow.depth[i] ?? 'none'}
              >
                <span className="material-symbols-outlined shrink-0 text-secondary" style={{ fontSize: '16px' }} aria-hidden="true">{meta?.icon ?? 'web_asset'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-on-surface">{pageLabel(page)}</span>
                  <span className="block truncate text-[10px] text-secondary">{meta?.label ?? page.type}{inNav(page) ? '' : ' · off the menu'}</span>
                </span>
                {i === startIndex && <span className="material-symbols-outlined shrink-0 text-amber-500" style={{ fontSize: '14px' }} aria-hidden="true">home</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function kindLabel(kind: FlowEdgeKind): string {
  return FLOW_EDGE_KINDS.find(k => k.kind === kind)?.label.toLowerCase() ?? kind
}
