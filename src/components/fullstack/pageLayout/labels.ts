import type { FullstackEntityDef, FullstackPageDef, FullstackPageType, FullstackWidgetDef } from '../../../types'
import { t, tn } from '../../../i18n'
import { describeNewTypePage } from '../newPageTypes'
import { LIST_VIEWS, MAX_PAGES, MAX_WIDGETS } from './limits'
import { groupByFields, REFRESH_CHOICES, reportCharts } from './dashboard'
import { childTabEntity, childTabVia } from './childTabs'

/**
 * Words for a layout: a page's summary line and label, ids from titles, the layout made from the
 * entities alone ("Start from my entities"), the page types' cards, and the undo history's
 * description of a change.
 */

/** One line describing what a page shows. */
export function describePage(page: FullstackPageDef, pages: FullstackPageDef[]): string {
  switch (page.type) {
    case 'entity-list': {
      const parts = [t('{entity} list', { entity: page.entity ?? '' })]
      if (page.view) parts.push(LIST_VIEWS.find(v => v.value === page.view)?.label.toLowerCase() ?? page.view)
      if (page.columns?.length) parts.push(tn(page.columns.length, '{n} column', '{n} columns'))
      if (page.sort?.field) parts.push(t('by {field} {arrow}', { field: page.sort.field, arrow: page.sort.dir === 'desc' ? '↓' : '↑' }))
      if (page.detail === 'side') parts.push(t('side pane'))
      else if (page.detail) parts.push(t('rows open in the {detail}', { detail: page.detail }))
      const filter = Object.entries(page.presetFilter ?? {}).map(([k, v]) => `${k} = ${v}`).join(', ')
      if (filter) parts.push(t('filtered on {filter}', { filter }))
      return parts.join(' · ')
    }
    case 'dashboard': {
      const counts = { kpi: 0, bar: 0, donut: 0, stacked: 0, pivot: 0, line: 0, recent: 0, top: 0, progress: 0, activity: 0, text: 0, links: 0, list: 0, funnel: 0, gauge: 0, timeInState: 0 }
      for (const w of page.widgets ?? []) if (w.kind in counts) counts[w.kind]++
      const parts = [
        counts.kpi && tn(counts.kpi, '{n} number tile', '{n} number tiles'),
        counts.progress && tn(counts.progress, '{n} progress tile', '{n} progress tiles'),
        counts.gauge && tn(counts.gauge, '{n} gauge', '{n} gauges'),
        counts.funnel && tn(counts.funnel, '{n} funnel', '{n} funnels'),
        counts.timeInState && tn(counts.timeInState, '{n} time-in-state chart', '{n} time-in-state charts'),
        counts.bar && tn(counts.bar, '{n} breakdown chart', '{n} breakdown charts'),
        counts.donut && tn(counts.donut, '{n} donut chart', '{n} donut charts'),
        counts.stacked && tn(counts.stacked, '{n} stacked chart', '{n} stacked charts'),
        counts.pivot && tn(counts.pivot, '{n} pivot table', '{n} pivot tables'),
        counts.line && tn(counts.line, '{n} trend', '{n} trends'),
        counts.top && tn(counts.top, '{n} top list', '{n} top lists'),
        counts.recent && tn(counts.recent, '{n} recent-rows list', '{n} recent-rows lists'),
        counts.activity && tn(counts.activity, '{n} activity feed', '{n} activity feeds'),
        counts.text && tn(counts.text, '{n} text note', '{n} text notes'),
        counts.links && tn(counts.links, '{n} page-links panel', '{n} page-links panels'),
        counts.list && tn(counts.list, '{n} embedded list', '{n} embedded lists'),
      ].filter(Boolean)
      if (page.filters?.length && parts.length) parts.push(t('filters: {filters}', { filters: page.filters.join(', ') }))
      const every = REFRESH_CHOICES.find(r => r.value === page.refreshSeconds)
      if (every && parts.length) parts.push(t('refreshes {every}', { every: every.label }))
      return parts.join(' · ') || t('No widgets')
    }
    case 'tabs':
      return (page.tabs ?? [])
        .map(tab => tab.title || pages.find(p => p.id === tab.page)?.title || tab.page)
        .join(' | ')
    case 'master-detail':
      return `${page.parent ?? '?'} → ${page.child ?? '?'}${page.via ? ` ${t('via {relation}', { relation: page.via })}` : ''}${page.showParent ? ` · ${t('parent card')}` : ''}`
    case 'report': {
      const charts = reportCharts(page)
      const chart = charts[0]
      const by = chart.groupBy ?? t('its first enum, boolean or date field')
      const how = !chart.agg || chart.agg === 'count' ? t('row count') : t('{agg} of {field}', { agg: chart.agg, field: chart.field ?? '' })
      const more = charts.length > 1 ? ` · +${tn(charts.length - 1, '{n} chart', '{n} charts')}` : ''
      const grouped = chart.bucket ? t('{how} by {by} per {bucket}', { how, by, bucket: chart.bucket }) : t('{how} by {by}', { how, by })
      return `${page.entity ?? '?'} · ${grouped}${more}`
    }
    case 'wizard': {
      const steps = page.steps?.length
      return `${page.entity ?? '?'} · ${steps ? tn(steps, '{n} step and a review', '{n} steps and a review') : t('default steps and a review')}`
    }
    case 'form':
      return `${page.entity ?? '?'} · ${t('its whole form — New and Edit open it')}`
    case 'record': {
      const tabs = page.childTabs
      const related = tabs == null ? t('its related lists') : tabs.length === 0 ? t('no related lists')
        : tabs.map(tab => (childTabVia(tab) ? `${childTabEntity(tab)} (${childTabVia(tab)})` : childTabEntity(tab))).join(', ')
      return `${t('One {entity}', { entity: page.entity ?? '?' })} · ${related}${page.printable ? ` · ${t('print')}` : ''}`
    }
    default:
      return describeNewTypePage(page, [])
  }
}

/** Nav label as the generated app shows it (mirrors the backend defaults). */
export function pageLabel(page: FullstackPageDef): string {
  if (page.title) return page.title
  if (page.type === 'dashboard') return 'Dashboard'
  if (page.type === 'master-detail') return page.parent ?? page.id
  return page.entity ?? page.id
}

/** A page slug from free text: "Order lines" → "order-lines". */
export function slugify(text: string): string {
  const slug = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return /^[a-z]/.test(slug) ? slug.replace(/-+$/, '') : ''
}

/** `base`, `base-2`, `base-3`… — the first id not already in `taken`. */
export function uniquePageId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const seed = base || 'page'
  if (!used.has(seed)) return seed
  for (let n = 2; ; n++) {
    const candidate = `${seed}-${n}`
    if (!used.has(candidate)) return candidate
  }
}

/**
 * The layout that matches the classic shell: a dashboard (one count tile per entity, a chart per
 * entity that can be grouped, the latest rows of the first one) plus a list page per entity — the
 * starting point users then rearrange. A big model stays inside the validator's caps: tiles and
 * charts are trimmed (charts first) to MAX_WIDGETS, list pages to MAX_PAGES. `heading` is the
 * setup panel's dashboard title/overview, carried onto the dashboard page.
 */
export function seedLayout(entities: FullstackEntityDef[], heading: { title?: string; description?: string } = {}): FullstackPageDef[] {
  const named = entities.filter(e => e.name.trim())
  if (named.length === 0) return []
  const ids = new Set<string>()
  const take = (base: string) => {
    const id = uniquePageId(slugify(base), ids)
    ids.add(id)
    return id
  }
  const room = MAX_WIDGETS - 1 // the recent-rows widget always fits
  const kpis = named.slice(0, room).map(e => ({ kind: 'kpi' as const, entity: e.name }))
  const bars = named.filter(e => groupByFields(e).length > 0).slice(0, room - kpis.length)
    .map(e => ({ kind: 'bar' as const, entity: e.name }))
  const dashboard: FullstackPageDef = {
    id: take('dashboard'),
    type: 'dashboard',
    widgets: [...kpis, ...bars, { kind: 'recent' as const, entity: named[0].name }],
  }
  const title = heading.title?.trim().slice(0, 80)
  const description = heading.description?.trim().slice(0, 300)
  if (title) dashboard.title = title
  if (description) dashboard.description = description
  const lists = named.slice(0, MAX_PAGES - 1).map(e => ({ id: take(e.name), type: 'entity-list' as const, entity: e.name }))
  return [dashboard, ...lists]
}

/** What each page type is, for the "Add page" gallery. */
export const PAGE_TYPE_META: Record<FullstackPageType, { icon: string; readonly label: string; readonly blurb: string }> = {
  dashboard: { icon: 'dashboard', get label() { return t('Dashboard') }, get blurb() { return t('Number tiles, charts, rankings, recent rows, lists, notes and links to other pages — optionally with a period picker.') } },
  'entity-list': { icon: 'table_rows', get label() { return t('Entity list') }, get blurb() { return t('One entity’s table, optionally filtered to start with.') } },
  tabs: { icon: 'tab', get label() { return t('Tabs') }, get blurb() { return t('Two to six other pages side by side as tabs.') } },
  'master-detail': { icon: 'vertical_split', get label() { return t('Master–detail') }, get blurb() { return t('A parent list beside the selected parent’s rows.') } },
  record: { icon: 'article', get label() { return t('Record') }, get blurb() { return t('One row opened from a list, with its related lists as tabs.') } },
  report: { icon: 'monitoring', get label() { return t('Report') }, get blurb() { return t('One entity’s filters above up to four charts and a totals table (an Export button with the CSV export option).') } },
  wizard: { icon: 'format_list_numbered', get label() { return t('Wizard') }, get blurb() { return t('A create form split into steps, with a review before saving.') } },
  form: { icon: 'edit_note', get label() { return t('Form') }, get blurb() { return t('One entity’s whole form on a page of its own — New and Edit open it instead of a drawer.') } },
  calendar: { icon: 'calendar_month', get label() { return t('Calendar') }, get blurb() { return t('One entity’s rows by date — month, week, agenda or a timeline of bars; click a day to add one.') } },
  board: { icon: 'view_kanban', get label() { return t('Board') }, get blurb() { return t('Cards in lanes of an enum or yes/no field, dragged between lanes, with optional lane limits.') } },
  content: { icon: 'description', get label() { return t('Content') }, get blurb() { return t('A page of text — headings, lists, notes and links to other pages or the web.') } },
  import: { icon: 'upload_file', get label() { return t('Import') }, get blurb() { return t('Upload a CSV file, match its columns, check every row, then create them all at once.') } },
  search: { icon: 'search', get label() { return t('Search') }, get blurb() { return t('One search box over several entities, results grouped by entity — optionally in the app’s header.') } },
  inbox: { icon: 'inbox', get label() { return t('Inbox') }, get blurb() { return t('A workflow’s tasks — mine, unassigned, all open — with each row’s next steps, Claim and Release.') } },
  tree: { icon: 'account_tree', get label() { return t('Tree') }, get blurb() { return t('One entity’s rows as an outline — each under the row it belongs to. Needs a relation of the entity to itself (a parent).') } },
}

/** A short name for what changed between two layouts — the undo history's entry label. */
export function describePagesChange(prev: FullstackPageDef[], next: FullstackPageDef[]): string {
  if (prev.length === 0 && next.length > 0) return t('Started a page layout')
  if (next.length === 0 && prev.length > 0) return t('Switched to the classic page layout')
  if (next.length > prev.length) {
    const added = next.filter(n => !prev.some(p => p.id === n.id))
    if (added.length > 1) return t('Added {n} pages (“{page}”…)', { n: added.length, page: pageLabel(added[0]) })
    return t('Added the “{page}” page', { page: pageLabel(added[0] ?? next[next.length - 1]) })
  }
  if (next.length < prev.length) {
    const gone = prev.find(p => !next.some(n => n.id === p.id))
    return gone ? t('Removed the “{page}” page', { page: pageLabel(gone) }) : t('Removed a page')
  }
  const key = (p: FullstackPageDef) => JSON.stringify(p)
  if (prev.map(key).sort().join('\n') === next.map(key).sort().join('\n')) return t('Reordered pages')
  // Every change is the same group name becoming another: the nav strip's rename.
  const changed = next.map((b, i) => [prev[i], b] as const).filter(([a, b]) => key(a) !== key(b))
  if (changed.length > 0 && changed.every(([a, b]) => a.id === b.id && key({ ...a, group: b.group }) === key(b))) {
    const from = changed[0][0].group
    const to = changed[0][1].group
    if (from && changed.every(([a, b]) => a.group === from && b.group === to) && (changed.length > 1 || !to)) {
      return to ? t('Renamed the “{from}” group to “{to}”', { from, to }) : t('Ungrouped the “{from}” pages', { from })
    }
  }
  for (let i = 0; i < next.length; i++) {
    const a = prev[i]; const b = next[i]
    if (key(a) === key(b)) continue
    const name = pageLabel(b)
    if (a.type !== b.type) return t('Changed “{name}” to a {label} page', { name, label: PAGE_TYPE_META[b.type].label.toLowerCase() })
    if (a.title !== b.title || a.id !== b.id) return t('Renamed the “{name}” page', { name })
    const wa = a.widgets ?? []; const wb = b.widgets ?? []
    if (wb.length > wa.length) return t('Added a widget to “{name}”', { name })
    if (wb.length < wa.length) return t('Removed a widget from “{name}”', { name })
    const wkey = (w: FullstackWidgetDef) => JSON.stringify(w)
    if (wa.length > 0 && wa.map(wkey).join('\n') !== wb.map(wkey).join('\n')) {
      if (wa.map(wkey).sort().join('\n') === wb.map(wkey).sort().join('\n')) return t('Reordered the widgets of “{name}”', { name })
      const spanless = (w: FullstackWidgetDef) => JSON.stringify({ ...w, span: undefined })
      if (wa.map(spanless).join('\n') === wb.map(spanless).join('\n')) return t('Resized a widget on “{name}”', { name })
    }
    const ta = a.tabs ?? []; const tb = b.tabs ?? []
    if (tb.length > ta.length) return t('Added a tab to “{name}”', { name })
    if (tb.length < ta.length) return t('Removed a tab from “{name}”', { name })
    if (Boolean(a.hidden) !== Boolean(b.hidden)) {
      return b.hidden ? t('Hid “{name}” from the navigation', { name }) : t('Showed “{name}” in the navigation', { name })
    }
    return t('Edited the “{name}” page', { name })
  }
  return t('Changed page layout')
}
