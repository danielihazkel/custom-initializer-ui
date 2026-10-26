import type { FullstackEntityDef, FullstackPageDef, FullstackWidgetDef } from '../../types'
import { contentLinks } from './contentMarkdown'
import { inNav } from './pageLayout'
import { buildPlayLinks } from './playLinks'

/** How one page leads to another in the generated app. */
export type FlowEdgeKind = 'nav' | 'search' | 'tab' | 'row' | 'create' | 'save' | 'drill' | 'link' | 'back'

export const FLOW_EDGE_KINDS: { kind: FlowEdgeKind; label: string }[] = [
  { kind: 'nav', label: 'Menu' },
  { kind: 'search', label: 'Header search' },
  { kind: 'tab', label: 'Tab' },
  { kind: 'row', label: 'Opens a row' },
  { kind: 'create', label: 'New' },
  { kind: 'save', label: 'After save' },
  { kind: 'drill', label: 'Drill-down / View all' },
  { kind: 'link', label: 'Link' },
  { kind: 'back', label: 'Back' },
]

/** The app's menu, where every walk starts. */
export const MENU = -1

export interface FlowEdge {
  /** A page index, or MENU. */
  from: number
  to: number
  /** Every way `from` leads to `to`, in FLOW_EDGE_KINDS order. */
  kinds: FlowEdgeKind[]
}

export interface PageFlow {
  edges: FlowEdge[]
  /** Clicks from the menu to each page (1 = in the menu), null when nothing leads there. */
  depth: (number | null)[]
  /** Page indexes by column: the depths in order, then the pages nothing leads to. */
  columns: number[][]
  unreachable: number[]
}

/** The widgets whose card opens the rows behind them (or, for a list or recent rows, View all). */
const OPENS: ReadonlySet<FullstackWidgetDef['kind']> = new Set(['kpi', 'progress', 'bar', 'donut', 'stacked', 'pivot', 'line', 'top', 'list', 'recent'])

/**
 * How the layout's pages lead to each other: the menu, the header search, tabs, and every link
 * Play mode follows (`buildPlayLinks`), as deduplicated edges; then how many clicks each page is
 * from the menu, and which pages nothing leads to at all.
 */
export function buildPageFlow(pages: FullstackPageDef[], entities: FullstackEntityDef[]): PageFlow {
  const links = buildPlayLinks(pages, entities)
  const byPair = new Map<string, FlowEdge>()
  const add = (from: number, to: number | null | undefined, kind: FlowEdgeKind) => {
    if (to == null || to < 0 || to >= pages.length || to === from) return
    const key = `${from}>${to}`
    const edge = byPair.get(key) ?? { from, to, kinds: [] }
    if (!edge.kinds.includes(kind)) edge.kinds.push(kind)
    byPair.set(key, edge)
  }

  pages.forEach((page, i) => {
    if (inNav(page)) add(MENU, i, 'nav')
    if (page.type === 'search' && page.shellSearch) add(MENU, i, 'search')
    const l = links[i]
    add(i, l.row, 'row')
    l.childRows.forEach(to => add(i, to, 'row'))
    l.groups.forEach(to => add(i, to, 'row'))
    add(i, l.create, 'create')
    add(i, l.afterSave, 'save')
    add(i, l.drill, 'drill')
    add(i, l.back, 'back')
    ;(page.widgets ?? []).forEach((w, wi) => {
      const goes = l.widgets[wi]
      if (!goes) return
      if (OPENS.has(w.kind)) add(i, goes.open, 'drill')
      if (w.kind === 'recent' || w.kind === 'list') add(i, goes.rows, 'row')
      if (w.kind === 'links') goes.tiles.forEach(to => add(i, to, 'link'))
    })
    for (const tab of page.tabs ?? []) add(i, l.pageIds.get(tab.page), 'tab')
    if (page.type === 'content') {
      for (const run of contentLinks(page.body ?? '')) if (run.kind === 'page-link') add(i, l.pageIds.get(run.target ?? ''), 'link')
    }
  })
  const order = FLOW_EDGE_KINDS.map(k => k.kind)
  const edges = [...byPair.values()].map(e => ({ ...e, kinds: [...e.kinds].sort((a, b) => order.indexOf(a) - order.indexOf(b)) }))

  // Breadth first from the menu: a page's depth is the fewest clicks that reach it.
  const depth: (number | null)[] = pages.map(() => null)
  let frontier = [MENU]
  for (let d = 1; frontier.length > 0; d++) {
    const next: number[] = []
    for (const from of frontier) {
      for (const e of edges) {
        if (e.from !== from || depth[e.to] != null) continue
        depth[e.to] = d
        next.push(e.to)
      }
    }
    frontier = next
  }
  const deepest = Math.max(0, ...depth.map(d => d ?? 0))
  const columns: number[][] = Array.from({ length: deepest }, (_, c) => pages.map((_, i) => i).filter(i => depth[i] === c + 1))
  const unreachable = pages.map((_, i) => i).filter(i => depth[i] == null)
  if (unreachable.length > 0) columns.push(unreachable)
  return { edges, depth, columns, unreachable }
}
