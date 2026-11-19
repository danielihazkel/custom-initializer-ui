import type {
  FullstackAgg,
  FullstackChartDef,
  FullstackChartKind,
  FullstackChildTabDef,
  FullstackDateRange,
  FullstackEntityDef,
  FullstackFieldDef,
  FullstackListSort,
  FullstackListAction,
  FullstackListView,
  FullstackNavIcon,
  FullstackPageDef,
  FullstackPageRole,
  FullstackPageType,
  FullstackRelationDef,
  FullstackWidgetDef,
} from '../../types'
import {
  blankNewTypePage, checkBoard, checkCalendar, checkContent, checkImport, checkInbox, checkSearch, describeNewTypePage,
  newSearchReason, newTypeReason, renameEntityInNewPages, renameEnumValueInNewPages, renameFieldInNewPages,
  renamePageIdInBody, renameRelationInNewPages,
} from './newPageTypes'
import { humanize, pluralize, relationLabel } from './naming'
import { enumLabel, humanizeConstant } from './enumLabels'
import { summarizeEntity } from './summary'
import { CHOICES, LIMITS, NAME_RULES } from './schema'
import { isDateType, isNumericType, isSortableType } from './fieldTypes'
import { t, tn } from '../../i18n'

/**
 * The frontend page layout (`pages`) model: validation, the summary lines the editor shows, and
 * the two bulk operations (seed a layout from the entities, follow an entity rename).
 *
 * The checks mirror FullstackPageValidator so a broken layout shows up here, on the offending
 * control, instead of as a 400 on Generate.
 */

export const PAGE_ID = NAME_RULES.pageId
export const MAX_PAGES = LIMITS.maxPages
/** Every title in a layout — a page's, a widget's, a tab's, a step's, a header tile's (FullstackPageValidator.MAX_TITLE). */
export const MAX_TITLE = LIMITS.maxTitle
export const MAX_DESCRIPTION = LIMITS.maxDescription
export const MAX_WIDGETS = LIMITS.maxWidgets
export const MIN_TABS = LIMITS.minTabs
export const MAX_TABS = LIMITS.maxTabs
export const MAX_CHILD_TABS = MAX_TABS - 1
export const MAX_RECENT_LIMIT = LIMITS.maxRecentLimit
export const MAX_GROUP = LIMITS.maxGroup
export const MAX_SPAN = LIMITS.maxSpan
export const MAX_CHARTS = LIMITS.maxCharts
export const MAX_STEPS = LIMITS.maxSteps
export const DEFAULT_STEP_SIZE = LIMITS.defaultStepSize
export const MAX_HEADER_STATS = LIMITS.maxHeaderStats
export const MAX_TEXT = LIMITS.maxText
/** The pages one links widget can open. */
export const MAX_LINKS = LIMITS.maxLinks
/** A list widget's rows per page: the pager's own sizes that fit a card. */
export const LIST_WIDGET_LIMITS = [10, 20]
/** The rows-per-page choices the generated pager offers — what a list page may open on. */
export const LIST_PAGE_SIZES = CHOICES.listPageSizes
export const DEFAULT_PAGE_SIZE = 20
// The tables of labels below keep their texts behind getters: read when shown, in the site's
// language then, not when this module loads.
export const LIST_VIEWS: { value: FullstackListView; readonly label: string; icon: string }[] = [
  { value: 'table', get label() { return t('Table') }, icon: 'table' },
  { value: 'cards', get label() { return t('Cards') }, icon: 'grid_view' },
  { value: 'kanban', get label() { return t('Board') }, icon: 'view_kanban' },
  { value: 'calendar', get label() { return t('Calendar') }, icon: 'calendar_month' },
  { value: 'gallery', get label() { return t('Gallery') }, icon: 'photo_library' },
]

// ── List presentation (entity-list pages) ───────────────────────────────────

/** Whether the generated list of `entity` carries the audit columns (EntityScaffoldContext's
 *  `auditApplicable`): the entity's own override, else the project's `audit` opt, on a writable entity. */
export function auditOn(entity: FullstackEntityDef | undefined, scaffoldOpts: string[] = []): boolean {
  if (!entity || entity.readOnly || entity.viewQuery != null) return false
  return entity.opts?.audit ?? scaffoldOpts.includes('audit')
}

export interface ListColumnOption {
  key: string
  label: string
  /** The generated list endpoint sorts by every field and the audit pair, never by a relation. */
  sortable: boolean
  kind: 'field' | 'relation' | 'audit'
}

/** The columns a list page can show, in the generated order: every field, every MANY_TO_ONE
 *  relation (by field name) and, when audit applies, Created/Updated. */
export function listColumns(entity: FullstackEntityDef | undefined, scaffoldOpts: string[] = []): ListColumnOption[] {
  if (!entity) return []
  const out: ListColumnOption[] = entity.fields
    .filter(f => f.name.trim())
    .map(f => ({ key: f.name, label: f.label?.trim() || humanize(f.name), sortable: isSortableType(f.type), kind: 'field' as const }))
  for (const r of entity.relations ?? []) {
    if (r.type === 'MANY_TO_ONE' && r.fieldName.trim()) out.push({ key: r.fieldName, label: relationLabel(r), sortable: false, kind: 'relation' })
  }
  if (auditOn(entity, scaffoldOpts)) {
    out.push({ key: 'createdAt', label: t('Created'), sortable: true, kind: 'audit' }, { key: 'updatedAt', label: t('Updated'), sortable: true, kind: 'audit' },
      { key: 'createdBy', label: t('Created by'), sortable: true, kind: 'audit' }, { key: 'updatedBy', label: t('Updated by'), sortable: true, kind: 'audit' })
  }
  return out
}

/** The column keys a list page may open sorted by (the generated controller's SORTABLE). */
export function sortableKeys(entity: FullstackEntityDef | undefined, scaffoldOpts: string[] = []): string[] {
  return listColumns(entity, scaffoldOpts).filter(c => c.sortable).map(c => c.key)
}

/** The views the generated page of `entity` offers, in its order — the ticked list views minus the
 *  ones its fields cannot support (EntityScaffoldContext.emittedListViews). */
export function enabledListViews(entity: FullstackEntityDef | undefined): FullstackListView[] {
  if (!entity) return ['table']
  return summarizeEntity(entity).views.map(v => v.name as FullstackListView)
}

/** Why `view` is not offered on `entity`, or undefined when it is. */
export function viewDisabledReason(entity: FullstackEntityDef | undefined, view: FullstackListView): string | undefined {
  if (!entity || enabledListViews(entity).includes(view)) return undefined
  const readOnly = Boolean(entity.readOnly) || entity.viewQuery != null
  if (view === 'kanban' && readOnly) return t('Kanban needs a writable entity')
  if (view === 'kanban' && !entity.fields.some(f => f.type === 'ENUM' || f.type === 'BOOLEAN')) return t('Kanban needs an enum or boolean field')
  if (view === 'calendar' && !entity.fields.some(f => isDateType(f.type))) return t('Calendar needs a date field')
  if (view === 'gallery' && !entity.fields.some(f => f.type === 'IMAGE')) return t('Gallery needs an image field')
  return t('Not ticked in the list views of {entity}', { entity: entity.name })
}

/** What a wizard step can ask for: every field but a generated key, then the MANY_TO_ONE
 *  relations (by field name) — what the entity's form shows. */
/** What a wizard can ask for: the form's fields, without a workflow's status (it starts in its
 *  initial state, and only transitions move it) or its assignee (set by claiming and reassigning). */
export function wizardFields(entity: FullstackEntityDef | undefined): { name: string; required: boolean; relation: boolean }[] {
  const status = entity?.workflow?.statusField
  const assignee = entity?.workflow?.assigneeField
  return stepFields(entity).filter(a => a.relation || (a.name !== status && a.name !== assignee))
}

/** What a wizard's steps are dealt from: the form's fields and links, then its sets of linked rows
 *  (the many-to-manys — a step may ask for one, and it may always be empty). */
export function stepFields(entity: FullstackEntityDef | undefined): { name: string; required: boolean; relation: boolean }[] {
  return [
    ...askableFields(entity),
    ...(entity?.relations ?? []).filter(r => r.type === 'MANY_TO_MANY' && r.fieldName.trim())
      .map(r => ({ name: r.fieldName, required: false, relation: true })),
  ]
}

export function askableFields(entity: FullstackEntityDef | undefined): { name: string; required: boolean; relation: boolean }[] {
  if (!entity) return []
  return [
    ...entity.fields.filter(f => f.name.trim() && !(f.primaryKey && f.generated))
      .map(f => ({ name: f.name, required: Boolean(f.required || f.primaryKey), relation: false })),
    ...(entity.relations ?? []).filter(r => r.type === 'MANY_TO_ONE' && r.fieldName.trim())
      .map(r => ({ name: r.fieldName, required: Boolean(r.required), relation: true })),
  ]
}

/** The steps a wizard gets when it names none (FullstackPageValidator): four fields to a step. */
export function defaultWizardSteps(entity: FullstackEntityDef | undefined): { title?: string; fields: string[] }[] {
  const names = wizardFields(entity).map(f => f.name)
  const status = entity?.workflow?.statusField
  const assignee = entity?.workflow?.assigneeField
  // The entity's form sections, one step each, then whatever they leave out (FullstackPageValidator.steps).
  if (entity?.formSections?.length) {
    const placed = new Set(entity.formSections.flatMap(s => s.fields.map(f => f.toLowerCase())))
    const rest = names.filter(n => !placed.has(n.toLowerCase()))
    const sections = entity.formSections
      .map(s => ({ title: s.title, fields: s.fields.filter(f => f !== status && f !== assignee) }))
      .filter(s => s.fields.length > 0)
    return [...sections, ...(rest.length ? [{ fields: rest }] : [])]
  }
  const steps: { fields: string[] }[] = []
  for (let i = 0; i < names.length; i += DEFAULT_STEP_SIZE) steps.push({ fields: names.slice(i, i + DEFAULT_STEP_SIZE) })
  return steps
}

/** A report's charts, whichever way the page spells them (`chart` or `charts`). */
export function reportCharts(page: FullstackPageDef): FullstackChartDef[] {
  if (page.charts && page.charts.length > 0) return page.charts
  return [page.chart ?? {}]
}

/** The control key of one chart's setting: `chart.groupBy` for the first, `chart2.groupBy`… after. */
export function chartControl(index: number, key: 'groupBy' | 'bucket' | 'field' | 'kind' | 'series'): string {
  return `${index === 0 ? 'chart' : `chart${index + 1}`}.${key}`
}

/** What a top list can rank by: a groupable field, or a MANY_TO_ONE relation (its field name). */
export function rankableKeys(entity: FullstackEntityDef | undefined): string[] {
  return [
    ...groupByFields(entity).map(f => f.name),
    ...(entity?.relations ?? []).filter(r => r.type === 'MANY_TO_ONE').map(r => r.fieldName),
  ]
}

/** What a top list ranks by when it names nothing: the first enum, else boolean, else relation. */
export function defaultTopGroupBy(entity: FullstackEntityDef | undefined): string | undefined {
  return defaultBarGroupBy(entity) ?? (entity?.relations ?? []).find(r => r.type === 'MANY_TO_ONE')?.fieldName
}

/** The dashboard period picker's options, in the order the generated picker shows them. */
export const DATE_RANGES: { value: FullstackDateRange; readonly label: string }[] = [
  { value: 'all', get label() { return t('All time') } },
  { value: '7d', get label() { return t('Last 7 days') } },
  { value: '30d', get label() { return t('Last 30 days') } },
  { value: '90d', get label() { return t('Last 90 days') } },
  { value: 'ytd', get label() { return t('This year') } },
  { value: '12m', get label() { return t('Last 12 months') } },
]

/** How often a dashboard may reload its widgets (FullstackPageValidator.REFRESH_SECONDS). */
export const REFRESH_CHOICES: { value: number; readonly label: string }[] = [
  { value: 30, get label() { return t('every 30 seconds') } },
  { value: 60, get label() { return t('every minute') } },
  { value: 300, get label() { return t('every 5 minutes') } },
  { value: 900, get label() { return t('every 15 minutes') } },
]

/** The widgets that show data (and so reload): every kind but a note, a launcher and an embedded list. */
export const reloads = (w: FullstackWidgetDef) => w.kind !== 'text' && w.kind !== 'links' && w.kind !== 'list'

/** Grid columns a widget takes when it names none: a tile one, a chart or list two, a launcher the row. */
export function defaultSpan(kind: FullstackWidgetDef['kind']): number {
  return kind === 'kpi' || kind === 'progress' || kind === 'gauge' ? 1 : kind === 'links' || kind === 'list' || kind === 'pivot' ? 4 : 2
}

/** What a stacked chart splits by when no series is named: the next enum/boolean after `groupBy`. */
export function defaultSeries(entity: FullstackEntityDef | undefined, groupBy: string | undefined): string | undefined {
  return groupByFields(entity).find(f => f.name !== groupBy)?.name
}

/** The nav icons a page may pick (the generated app draws the lucide icon; the editor shows the
 *  Material Symbol that looks like it). */
export const NAV_ICONS: Record<FullstackNavIcon, { symbol: string; readonly label: string }> = {
  LayoutDashboard: { symbol: 'dashboard', get label() { return t('Dashboard') } },
  Columns3: { symbol: 'view_week', get label() { return t('Board') } },
  Search: { symbol: 'search', get label() { return t('Search') } },
  Upload: { symbol: 'upload', get label() { return t('Upload') } },
  Table2: { symbol: 'table', get label() { return t('Table') } },
  Layers: { symbol: 'layers', get label() { return t('Layers') } },
  PanelLeft: { symbol: 'vertical_split', get label() { return t('Split panel') } },
  BarChart3: { symbol: 'bar_chart', get label() { return t('Chart') } },
  ListChecks: { symbol: 'checklist', get label() { return t('Checklist') } },
  Users: { symbol: 'group', get label() { return t('People') } },
  ShoppingCart: { symbol: 'shopping_cart', get label() { return t('Cart') } },
  Package: { symbol: 'package_2', get label() { return t('Package') } },
  Ticket: { symbol: 'confirmation_number', get label() { return t('Ticket') } },
  Inbox: { symbol: 'inbox', get label() { return t('Inbox') } },
  Calendar: { symbol: 'calendar_month', get label() { return t('Calendar') } },
  FileText: { symbol: 'description', get label() { return t('Document') } },
  FilePlus: { symbol: 'note_add', get label() { return t('New document') } },
  Settings: { symbol: 'settings', get label() { return t('Settings') } },
  Truck: { symbol: 'local_shipping', get label() { return t('Truck') } },
  Wallet: { symbol: 'account_balance_wallet', get label() { return t('Wallet') } },
  Building2: { symbol: 'apartment', get label() { return t('Building') } },
  Tag: { symbol: 'sell', get label() { return t('Tag') } },
  Star: { symbol: 'star', get label() { return t('Star') } },
  Wand2: { symbol: 'auto_fix_high', get label() { return t('Wand') } },
}

/** The icon a page shows in the nav when it names none (EntityScaffoldContext.putPageContext). */
export const DEFAULT_NAV_ICON: Record<FullstackPageType, FullstackNavIcon> = {
  dashboard: 'LayoutDashboard',
  'entity-list': 'Table2',
  tabs: 'Layers',
  'master-detail': 'PanelLeft',
  record: 'Table2',
  report: 'BarChart3',
  wizard: 'Wand2',
  form: 'FilePlus',
  calendar: 'Calendar',
  board: 'Columns3',
  content: 'FileText',
  import: 'Upload',
  search: 'Search',
  inbox: 'Inbox',
  tree: 'Layers',
}

/** Whether a page is listed in the generated nav (a record page never is). */
export function inNav(page: FullstackPageDef): boolean {
  return !page.hidden && page.type !== 'record'
}

/**
 * The nav as the generated shell groups it: pages sharing a group gathered where the group first
 * appears, ungrouped runs as label-less sections between them. Indices point into `pages`.
 */
export function navSections(pages: FullstackPageDef[]): { group?: string; items: number[] }[] {
  const sections: { group?: string; items: number[] }[] = []
  const byGroup = new Map<string, { group?: string; items: number[] }>()
  let loose: { items: number[] } | null = null
  pages.forEach((page, index) => {
    if (!inNav(page)) return
    const group = page.group?.trim()
    if (!group) {
      if (!loose) {
        loose = { items: [] }
        sections.push(loose)
      }
      loose.items.push(index)
      return
    }
    loose = null
    let section = byGroup.get(group)
    if (!section) {
      section = { group, items: [] }
      byGroup.set(group, section)
      sections.push(section)
    }
    section.items.push(index)
  })
  return sections
}

/** Renames a nav group on every page that carries it (a blank `to` ungroups them). */
export function renameGroupInPages(pages: FullstackPageDef[], from: string, to: string): FullstackPageDef[] {
  const f = from.trim()
  const t = to.trim()
  if (!f || f === t) return pages
  let changed = false
  const next = pages.map(page => {
    if (page.group?.trim() !== f) return page
    changed = true
    const { group: _group, ...rest } = page
    return t ? { ...rest, group: t } : rest
  })
  return changed ? next : pages
}

/** Moves one nav section past its neighbour (`delta` ±1) by reordering its pages as a block;
 *  hidden and record pages keep their slots. */
export function moveNavGroup(pages: FullstackPageDef[], sectionIndex: number, delta: number): FullstackPageDef[] {
  const sections = navSections(pages)
  const target = sectionIndex + delta
  if (sectionIndex < 0 || sectionIndex >= sections.length || target < 0 || target >= sections.length) return pages
  const order = sections.map(s => s.items)
  ;[order[sectionIndex], order[target]] = [order[target], order[sectionIndex]]
  const flat = order.flat()
  let k = 0
  return pages.map(page => (inNav(page) ? pages[flat[k++]] : page))
}

/** The group a page dropped at `index` should take: the one its nav neighbours above and below
 *  share, when that differs from its own — so a drag into the middle of a section joins it.
 *  Undefined when the page keeps its group. */
export function adoptedGroup(pages: FullstackPageDef[], index: number): string | undefined {
  const page = pages[index]
  if (!page || !inNav(page)) return undefined
  const above = pages.slice(0, index).reverse().find(inNav)
  const below = pages.slice(index + 1).find(inNav)
  const group = above?.group?.trim()
  if (!group || group !== below?.group?.trim()) return undefined
  return page.group?.trim() === group ? undefined : group
}

/** What a chart can group or split by: any non-key enum/boolean field (the generated `/stats`
 *  groups by every one; only preset filters and drill-downs need the field to be filterable). */
/** The ways a report chart can be drawn, by whether it groups over a date (`overTime`) or not
 *  (null: either) — mirrors PageDefinition.ChartKind. */
export const CHART_KINDS: { value: FullstackChartKind; readonly label: string; overTime: boolean | null }[] = [
  { value: 'bar', get label() { return t('Bars') }, overTime: false },
  { value: 'donut', get label() { return t('Ring of shares') }, overTime: false },
  { value: 'stacked', get label() { return t('Stacked bars') }, overTime: false },
  { value: 'line', get label() { return t('Line') }, overTime: true },
  { value: 'area', get label() { return t('Filled area') }, overTime: true },
  { value: 'table', get label() { return t('Totals table only') }, overTime: null },
]

/** The kinds a chart grouped this way can take: over a date, by a field, or by a relation (no stacking). */
export function chartKindsFor(overTime: boolean, byRelation: boolean): typeof CHART_KINDS {
  return CHART_KINDS.filter(k => (k.overTime == null || k.overTime === overTime) && !(byRelation && k.value === 'stacked'))
}

/** The series a stacked chart splits by when it names none: the next enum/boolean field. */
export function defaultChartSeries(entity: FullstackEntityDef | undefined, groupBy: string | undefined): string | undefined {
  return groupByFields(entity).find(f => f.name !== groupBy)?.name
}

export function groupByFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? []).filter(f => !f.primaryKey && (f.type === 'ENUM' || f.type === 'BOOLEAN'))
}

/** What the generated app can preset-filter (or split into tabs) by: a filterable, non-key enum/boolean field. */
export function groupableFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? []).filter(f => !f.primaryKey && f.filterable !== false && (f.type === 'ENUM' || f.type === 'BOOLEAN'))
}

/** What a time series can be bucketed over: a non-key date column. */
export function dateFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? []).filter(f => !f.primaryKey && (isDateType(f.type)))
}

/** What the dashboard period can limit: a filterable, non-key date (the list's own date filter). */
export function filterableDateFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return dateFields(entity).filter(f => f.filterable !== false)
}

// ── Dashboard filters and widget click targets ──────────────────────────────

/** At most this many dashboard filters (FullstackPageValidator.MAX_DASHBOARD_FILTERS). */
export const MAX_DASHBOARD_FILTERS = LIMITS.maxDashboardFilters

/** The widgets that read an entity — every kind but a note and a launcher. They take the
 *  dashboard's filters, and their clicks can open a chosen page (`drillTo`). */
export const readsEntity = (w: FullstackWidgetDef) => w.kind !== 'text' && w.kind !== 'links' && w.kind !== 'activity'

/** The most entities an activity feed reads, and how many changes it lists (FullstackPageValidator). */
export const MAX_ACTIVITY_ENTITIES = LIMITS.maxActivityEntities
export const MIN_ACTIVITY_LIMIT = LIMITS.minActivityLimit

/** The entities an activity feed reads: the ones it names, else every one the audit opt applies to. */
export function activityEntities(w: FullstackWidgetDef, entities: FullstackEntityDef[], scaffoldOpts: string[] = []): string[] {
  if (w.entities?.length) return w.entities
  return entities.filter(e => auditOn(e, scaffoldOpts)).slice(0, MAX_ACTIVITY_ENTITIES).map(e => e.name)
}

/** A pivot's columns when none is named: the next enum, boolean or relation after its rows. */
export function defaultPivotColumns(entity: FullstackEntityDef | undefined, rows: string | undefined): string | undefined {
  return rankableKeys(entity).find(k => k !== rows)
}

/** The entities a dashboard's filters can reach: those of its entity widgets, once each, in order. */
export function dashboardFilterEntities(page: FullstackPageDef, entities: FullstackEntityDef[]): FullstackEntityDef[] {
  const out: FullstackEntityDef[] = []
  for (const w of page.widgets ?? []) {
    if (!readsEntity(w) || !w.entity?.trim()) continue
    const e = entities.find(x => sameName(x.name, w.entity))
    if (e && !out.includes(e)) out.push(e)
  }
  return out
}

/** How `entity` filters by `name` (ignoring case): its declared spelling and the shape one control
 *  has to match — the same words FullstackPageValidator.dashboardFilters uses. Undefined when the
 *  entity has no such non-key, filterable enum/boolean field or MANY_TO_ONE relation. */
export function dashboardFilterShape(entity: FullstackEntityDef, name: string, entities: FullstackEntityDef[] = []):
  { name: string; shape: string; field?: FullstackFieldDef } | undefined {
  const wanted = name.trim().toLowerCase()
  let found: { name: string; shape: string; field?: FullstackFieldDef } | undefined
  for (const f of entity.fields) {
    if (f.name.trim().toLowerCase() === wanted && !f.primaryKey && f.filterable !== false && (f.type === 'ENUM' || f.type === 'BOOLEAN')) {
      found = { name: f.name, field: f, shape: f.type === 'BOOLEAN' ? t('a yes/no field') : t('the values {values}', { values: (f.enumValues ?? []).join(', ') }) }
    }
  }
  for (const r of entity.relations ?? []) {
    if (r.type === 'MANY_TO_ONE' && r.fieldName.trim().toLowerCase() === wanted) {
      const target = entities.find(e => sameName(e.name, r.targetEntity))?.name ?? r.targetEntity.trim()
      found = { name: r.fieldName, shape: t('a link to {entity}', { entity: target }) }
    }
  }
  return found
}

/** One dashboard filter resolved against the widgets' entities: its spelling, or the two entities
 *  that disagree on what it is, or undefined when none of them has it. */
export type DashboardFilterResolution =
  | { name: string; field?: FullstackFieldDef; entities: string[] }
  | { conflict: { name: string; shape: string; owner: string; otherShape: string; other: string } }

export function resolveDashboardFilter(name: string, reach: FullstackEntityDef[], entities: FullstackEntityDef[] = []): DashboardFilterResolution | undefined {
  let first: { name: string; shape: string; field?: FullstackFieldDef; owner: string } | undefined
  const owners: string[] = []
  for (const e of reach) {
    const found = dashboardFilterShape(e, name, entities)
    if (!found) continue
    if (!first) first = { ...found, owner: e.name }
    else if (found.shape !== first.shape) {
      return { conflict: { name: name.trim(), shape: first.shape, owner: first.owner, otherShape: found.shape, other: e.name } }
    }
    owners.push(e.name)
  }
  return first ? { name: first.name, ...(first.field ? { field: first.field } : {}), entities: owners } : undefined
}

/** Every filter a dashboard could offer: the enum/boolean fields and relations of its widgets'
 *  entities that one control can set on all of them, by their first entity's spelling. */
export function dashboardFilterCandidates(page: FullstackPageDef, entities: FullstackEntityDef[]): { name: string; field?: FullstackFieldDef; entities: string[] }[] {
  const reach = dashboardFilterEntities(page, entities)
  const seen = new Set<string>()
  const out: { name: string; field?: FullstackFieldDef; entities: string[] }[] = []
  for (const e of reach) {
    const keys = [...groupableFields(e).map(f => f.name), ...relationKeys(e)]
    for (const key of keys) {
      const lower = key.trim().toLowerCase()
      if (!lower || seen.has(lower)) continue
      seen.add(lower)
      const r = resolveDashboardFilter(key, reach, entities)
      if (r && !('conflict' in r)) out.push(r)
    }
  }
  return out
}

/** The pages a widget on `entity` can open on click: a visible entity-list or report page of it. */
export function drillToPages(pages: FullstackPageDef[], entity: string | undefined): FullstackPageDef[] {
  if (!entity?.trim()) return []
  return pages.filter(p => (p.type === 'entity-list' || p.type === 'report') && !p.hidden && sameName(p.entity, entity))
}

// ── Preset filters ──────────────────────────────────────────────────────────

/** The list actions a list page can leave out, in the order the generator keeps them. */
export const LIST_ACTIONS: { value: FullstackListAction; readonly label: string; readonly hint: string }[] = [
  { value: 'new', get label() { return t('New') }, get hint() { return t('The New button, the empty list’s offer and the n shortcut') } },
  { value: 'edit', get label() { return t('Edit') }, get hint() { return t('Edit on a row, the side pane and the quick look; inline cells and dragging a card') } },
  { value: 'delete', get label() { return t('Delete') }, get hint() { return t('Delete on a row and in the side pane') } },
  { value: 'export', get label() { return t('Export') }, get hint() { return t('Export CSV and Excel (the csvExport and xlsxExport options)') } },
  { value: 'import', get label() { return t('Import') }, get hint() { return t('Import CSV (the csvImport option)') } },
  { value: 'bulk', get label() { return t('Bulk actions') }, get hint() { return t('Row checkboxes and the bulk bar (bulkDelete / bulkUpdate)') } },
]

/** The periods a date field can be preset to, ending on the day the app is opened. */
export const PRESET_PERIODS: { value: string; readonly label: string }[] = [
  { value: 'last:7d', get label() { return t('Last 7 days') } },
  { value: 'last:30d', get label() { return t('Last 30 days') } },
  { value: 'last:90d', get label() { return t('Last 90 days') } },
  { value: 'ytd', get label() { return t('This year') } },
  { value: '12m', get label() { return t('Last 12 months') } },
]

/** How a field is preset: a pick of its values, a date period or range, or a number range. */
export type PresetKind = 'choice' | 'date' | 'number'

export function presetKind(f: FullstackFieldDef): PresetKind {
  if (isDateType(f.type)) return 'date'
  if (isNumericType(f.type)) return 'number'
  return 'choice'
}

/** Every field a list, report or widget can be preset on: filterable enum/boolean, date and number fields. */
export function presettableFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? []).filter(f => !f.primaryKey && f.filterable !== false
    && (f.type === 'ENUM' || f.type === 'BOOLEAN' || presetKind(f) !== 'choice'))
}

/** The relations a list, report or widget can be preset on: every MANY_TO_ONE, keyed by its
 *  `<field>Id` filter param (the backend accepts the bare field name too, and keeps this). */
export function presettableRelations(entity: FullstackEntityDef | undefined): FullstackRelationDef[] {
  return (entity?.relations ?? []).filter(r => r.type === 'MANY_TO_ONE' && r.fieldName.trim() !== '')
}

/** The preset key of a relation: its filter param, `customerId`. */
export function relationPresetKey(r: Pick<FullstackRelationDef, 'fieldName'>): string {
  return `${r.fieldName}Id`
}

/** The relation a preset key names (`customerId`, or the bare `customer`), if any. */
export function relationOfPresetKey(entity: FullstackEntityDef | undefined, key: string): FullstackRelationDef | undefined {
  const k = key.trim().toLowerCase()
  return presettableRelations(entity).find(r => r.fieldName.toLowerCase() === k || relationPresetKey(r).toLowerCase() === k)
}

const UUID_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TEXT_ID = /^[A-Za-z0-9._~-]+$/

/** Why `value` is not a list of ids of `target` (mirrors FullstackPageValidator.relationIds), or undefined. */
export function relationPresetProblem(value: string, target: FullstackEntityDef | undefined): string | undefined {
  if (!value.trim()) return t('needs an id')
  const keyType = target?.fields.find(f => f.primaryKey)?.type
  for (const raw of value.split(',')) {
    const id = raw.trim()
    if (!id) return t('has an empty id')
    if (keyType === 'LONG' || keyType === 'INTEGER') {
      if (!/^-?\d+$/.test(id)) return t('“{id}” is not a whole number', { id })
    } else if (keyType === 'UUID') {
      if (!UUID_ID.test(id)) return t('“{id}” is not a UUID', { id })
    } else if (!TEXT_ID.test(id)) {
      return t('“{id}” may hold only letters, digits and . _ ~ -', { id })
    }
  }
  return undefined
}

/** The values of a multi-value preset (`OPEN,PAID` → both). */
export function presetValues(value: string): string[] {
  return value.split(',').map(v => v.trim()).filter(v => v !== '')
}

/** The two halves of a range value `a..b` (either blank), or null when it is not a range. */
export function parsePresetRange(value: string): { from: string; to: string } | null {
  const at = value.indexOf('..')
  if (at < 0) return null
  return { from: value.slice(0, at).trim(), to: value.slice(at + 2).trim() }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/

/** Why `value` is not a valid preset of `f` (mirrors FullstackPageValidator.presetFilter), or undefined. */
export function presetValueProblem(f: FullstackFieldDef, value: string): string | undefined {
  const v = value.trim()
  if (!v) return t('needs a value')
  switch (presetKind(f)) {
    case 'choice':
      if (f.type === 'BOOLEAN') return v === 'true' || v === 'false' ? undefined : t('expected true or false')
      if (v.split(',').some(part => part.trim() === '')) return t('has an empty value')
      for (const one of presetValues(v)) {
        if (!(f.enumValues ?? []).includes(one)) return t('“{value}” is not one of the values of {field}', { value: one, field: f.name })
      }
      return undefined
    case 'date': {
      if (PRESET_PERIODS.some(p => p.value === v.toLowerCase())) return undefined
      const range = parsePresetRange(v)
      if (!range) return t('needs a period or a date range (from..to)')
      if (!range.from && !range.to) return t('a range needs a from or a to')
      const ok = (d: string) => ISO_DAY.test(d) || (f.type === 'LOCAL_DATE_TIME' && ISO_DATE_TIME.test(d))
      if ((range.from && !ok(range.from)) || (range.to && !ok(range.to))) return t('dates must be yyyy-mm-dd')
      if (range.from && range.to && range.from > range.to) return t('from is after to')
      return undefined
    }
    case 'number': {
      const range = parsePresetRange(v)
      if (!range) return t('needs a number range (min..max)')
      if (!range.from && !range.to) return t('a range needs a min or a max')
      if ((range.from && !Number.isFinite(Number(range.from))) || (range.to && !Number.isFinite(Number(range.to)))) return t('min and max must be numbers')
      if (range.from && range.to && Number(range.from) > Number(range.to)) return t('min is above max')
      return undefined
    }
  }
}

/** A field's first sensible preset: its first value, the last 30 days, or "at least 0". */
export function defaultPresetValue(f: FullstackFieldDef): string {
  switch (presetKind(f)) {
    case 'date': return 'last:30d'
    case 'number': return '0..'
    default: return valuesOf(f)[0] ?? ''
  }
}

/** The periods as the generated app's preview names them — not the editor's words (the preview
 *  keeps English here, whatever the site's language). */
const PRESET_PERIOD_WORDS: Record<string, string> = {
  'last:7d': 'last 7 days', 'last:30d': 'last 30 days', 'last:90d': 'last 90 days', ytd: 'this year', '12m': 'last 12 months',
}

/** A preset as the generated UI would say it: "Placed on: last 30 days", "Total: 100 – 500", "Status: Open". */
export function describePresetValue(f: FullstackFieldDef, value: string): string {
  const period = PRESET_PERIOD_WORDS[value.trim().toLowerCase()]
  if (period) return period
  const range = presetKind(f) === 'choice' ? null : parsePresetRange(value)
  if (range) {
    if (range.from && range.to) return `${range.from} – ${range.to}`
    return range.from ? `≥ ${range.from}` : `≤ ${range.to}`
  }
  return presetValues(value).join(' or ')
}

/** The date a widget's period applies to: its own, else the entity's first filterable one. */
export function widgetDateField(w: FullstackWidgetDef, entity: FullstackEntityDef | undefined): string | undefined {
  return w.dateField || filterableDateFields(entity)[0]?.name
}

/** The date a kpi's trend plots over, as the backend resolves it: the period picker's date, else
 *  the named `dateField` (a picker-less dashboard lets a trend name any date), else the first date. */
export function trendDateField(w: FullstackWidgetDef, entity: FullstackEntityDef | undefined, hasPicker: boolean): string | undefined {
  if (hasPicker) return widgetDateField(w, entity) ?? dateFields(entity)[0]?.name
  if (w.dateField) return dateFields(entity).some(f => f.name === w.dateField) ? w.dateField : undefined
  return dateFields(entity)[0]?.name
}

/** What sum/avg/min/max can reduce: a non-key numeric column. */
export function numericFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? [])
    .filter(f => !f.primaryKey && (isNumericType(f.type)))
}

/** What a report can group by: an enum/boolean draws bars, a date draws a line. */
export function chartableFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return [...groupByFields(entity), ...dateFields(entity)]
}

/** The MANY_TO_ONE relations of an entity, by field name — a report chart (like a top list) can
 *  group by one, its bars named from the target's list. */
export function relationKeys(entity: FullstackEntityDef | undefined): string[] {
  return (entity?.relations ?? []).filter(r => r.type === 'MANY_TO_ONE' && r.fieldName.trim()).map(r => r.fieldName)
}

/** Everything a report chart can group by: the chartable fields, then the relations. */
export function reportGroupKeys(entity: FullstackEntityDef | undefined): string[] {
  return [...chartableFields(entity).map(f => f.name), ...relationKeys(entity)]
}

/** The entity a record page's tab lists. */
export function childTabEntity(tab: FullstackChildTabDef): string {
  return typeof tab === 'string' ? tab : tab.entity
}

/** The relation a record page's tab links through, when one is named. */
export function childTabVia(tab: FullstackChildTabDef): string | undefined {
  return typeof tab === 'string' ? undefined : tab.via
}

/** A tab entry in its shortest spelling: the bare entity unless a relation is named. */
export function childTab(entity: string, via?: string): FullstackChildTabDef {
  return via ? { entity, via } : entity
}

/** A related-list tab with some of its parts changed, keeping the rest (its columns and sort);
 *  a tab left with only its entity is written as the bare name. */
export function withChildTab(tab: FullstackChildTabDef, patch: { entity?: string; via?: string; columns?: string[]; sort?: FullstackListSort }): FullstackChildTabDef {
  const next: Record<string, unknown> = { ...(typeof tab === 'string' ? { entity: tab } : tab), ...patch }
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k]
  return Object.keys(next).length === 1 ? (next.entity as string) : (next as Exclude<FullstackChildTabDef, string>)
}

/** The columns and sort a related-list tab opens with (none: the list's defaults). */
export function childTabPresentation(tab: FullstackChildTabDef): { columns?: string[]; sort?: FullstackListSort } {
  return typeof tab === 'string' ? {} : { columns: tab.columns, sort: tab.sort }
}

/** The child's MANY_TO_ONE fields pointing at `parent`, in declaration order. */
type HeaderStat = NonNullable<FullstackPageDef['headerStats']>[number]

/** A record page's header tile moved to another related entity: it keeps its title, its measure
 *  when the new entity has the same numeric field, and its link when that relation also points at
 *  the record's entity. `dropped` names what did not fit, for the editor's notice. */
export function retargetHeaderStat(stat: HeaderStat, child: FullstackEntityDef | undefined, recordEntity: string | undefined): { stat: HeaderStat; dropped: string[] } {
  const next: HeaderStat = { child: child?.name ?? '' }
  const dropped: string[] = []
  if (stat.agg && stat.agg !== 'count') {
    if (stat.field && numericFields(child).some(f => f.name === stat.field)) {
      next.agg = stat.agg
      next.field = stat.field
    } else dropped.push(t('measure'))
  } else if (stat.agg) next.agg = stat.agg
  if (stat.via) {
    if (relationsTo(child, recordEntity).includes(stat.via)) next.via = stat.via
    else dropped.push(t('link'))
  }
  if (stat.title) next.title = stat.title
  return { stat: next, dropped }
}

export function relationsTo(child: FullstackEntityDef | undefined, parent: string | undefined): string[] {
  if (!child || !parent) return []
  return (child.relations ?? [])
    .filter(r => r.type === 'MANY_TO_ONE' && r.targetEntity.trim().toLowerCase() === parent.trim().toLowerCase())
    .map(r => r.fieldName)
}

/** A one-click repair of an issue. It takes the whole layout, so it can remove a page or a widget
 *  as well as patch one page; the editor records an undo entry under `label` before applying it. */
export interface PageFix {
  label: string
  apply: (pages: FullstackPageDef[]) => FullstackPageDef[]
}

export interface PageLayoutValidation {
  /** Page index → control name → message, for the inline errors in the editor. */
  byPage: Record<number, Record<string, string>>
  /** Problems that belong to the layout as a whole. */
  general: string[]
  /** Everything, as sentences naming the page — what the caller counts as errors. */
  problems: string[]
  /** The same problems with where they live, so the list can jump to the offending control, and
   *  a fix when the problem has one obvious repair. */
  issues: { page?: number; field?: string; summary: string; fix?: PageFix; alsoFix?: PageFix }[]
  count: number
  /** Advice, not errors: the layout generates, but with a dead end the user probably did not mean
   *  (a hidden page nothing opens, a chart nothing drills from, a default that was capped). Never
   *  counted, never blocks Generate. Each has a stable `key` (kind + page id + detail) by which it
   *  can be dismissed; dismissed ones are in `dismissedWarnings` instead. */
  warnings: LayoutWarning[]
  /** The warnings the user dismissed (`PageLayoutContext.dismissed`) — kept so they can be restored. */
  dismissedWarnings: LayoutWarning[]
  /** Page index → how many of the (not dismissed) warnings are about it. */
  warningsByPage: Record<number, number>
}

export interface LayoutWarning {
  /** Stable across edits that leave the warning standing: `<kind>:<page id>[:<detail>]`. */
  key: string
  page?: number
  field?: string
  summary: string
  fix?: PageFix
}

interface Issue {
  /** Warnings only: the dismissal key. */
  key?: string
  page?: number
  field?: string
  /** Shown on the control. */
  message: string
  /** Shown in the problem list, naming the page. */
  summary: string
  fix?: PageFix
  /** A second repair, offered beside `fix` (a stale entity: switch to the likely replacement, or remove). */
  alsoFix?: PageFix
}

const singlePk = (e: FullstackEntityDef) => e.fields.filter(f => f.primaryKey).length === 1

/** What the page checks need beyond the layout: whether an LDAP auth dependency (ldap-auth-rest or ldap-auth) is selected
 *  (page roles need one). Omitted, that check is skipped. */
export interface PageLayoutContext {
  ldapAuth?: boolean
  /** The project-wide scaffold opts: a list page may show or sort by the audit columns only with
   *  `audit` among them (or overridden on the entity). Omitted: no audit columns. */
  scaffoldOpts?: string[]
  /** Keys of the warnings the user dismissed (they move to `dismissedWarnings`). */
  dismissed?: string[]
}

export const PAGE_ROLES: FullstackPageRole[] = ['ADMIN', 'USER']

export function validatePages(pages: FullstackPageDef[], entities: FullstackEntityDef[], context: PageLayoutContext = {}): PageLayoutValidation {
  const issues = collect(pages, entities, context.scaffoldOpts ?? [])
  issues.push(...roleIssues(pages, context))
  const byPage: Record<number, Record<string, string>> = {}
  const general: string[] = []
  for (const issue of issues) {
    if (issue.page == null) general.push(issue.summary)
    else {
      const fields = (byPage[issue.page] ??= {})
      // First message per control wins: it is the one that explains the rest.
      fields[issue.field ?? 'page'] ??= issue.message
    }
  }
  const dismissed = new Set(context.dismissed ?? [])
  const all = collectWarnings(pages, entities).map(({ key, page, field, summary, fix }): LayoutWarning =>
    ({ key: key ?? summary, page, field, summary, ...(fix ? { fix } : {}) }))
  const warnings = all.filter(w => !dismissed.has(w.key))
  const warningsByPage: Record<number, number> = {}
  for (const w of warnings) if (w.page != null) warningsByPage[w.page] = (warningsByPage[w.page] ?? 0) + 1
  return {
    byPage,
    general,
    problems: issues.map(i => i.summary),
    issues: issues.map(({ page, field, summary, fix, alsoFix }) => ({ page, field, summary, ...(fix ? { fix } : {}), ...(alsoFix ? { alsoFix } : {}) })),
    count: issues.length,
    warnings,
    dismissedWarnings: all.filter(w => dismissed.has(w.key)),
    warningsByPage,
  }
}

/**
 * Applies every problem's own fix, one at a time: a fix is written against the layout it was found
 * in (it removes page 3, widget 2…), so the layout is validated again after each one instead of
 * applying them all to the first. A fix that leaves no fewer problems is skipped, so a fix that does
 * not hold cannot loop. Returns the layout and the labels of the fixes applied, in order.
 */
export function fixAllProblems(pages: FullstackPageDef[], entities: FullstackEntityDef[], context: PageLayoutContext = {}): { pages: FullstackPageDef[]; applied: string[] } {
  let current = pages
  const applied: string[] = []
  for (let round = 0; round < 100; round++) {
    const before = validatePages(current, entities, context)
    const fixes = before.issues.flatMap(i => (i.fix ? [i.fix] : []))
    let next: FullstackPageDef[] | null = null
    for (const fix of fixes) {
      const after = fix.apply(current)
      const check = validatePages(after, entities, context)
      if (check.count < before.count || check.issues.filter(i => i.fix).length < fixes.length) {
        next = after
        applied.push(fix.label)
        break
      }
    }
    if (!next) break
    current = next
  }
  return { pages: current, applied }
}

/** Advice thresholds: past these a layout still generates, but reads as crowded. */
export const ADVICE = {
  /** Visible nav entries with no group to sort them into. */
  navItems: 8,
  /** Widgets on one dashboard. */
  dashboardWidgets: 12,
  /** Columns a list shows — the ones it names, or by default every field and relation. */
  listColumns: 11,
  /** What a "keep the first N columns" fix keeps. */
  keepColumns: 6,
} as const

/** The nav group a crowded nav's fix files a page under, by what the page is for. */
function adviceGroup(type: FullstackPageType): string {
  switch (type) {
    case 'dashboard': case 'report': return 'Insights'
    case 'wizard': case 'form': case 'import': case 'content': case 'search': case 'inbox': return 'Tools'
    default: return 'Data'
  }
}

/** The dead ends a valid layout can still have — what the generated app silently does nothing
 *  about — and advice on one that reads as crowded. Each names the page (or the layout) and,
 *  where one repair is obvious, offers it. */
function collectWarnings(pages: FullstackPageDef[], entities: FullstackEntityDef[]): Issue[] {
  if (pages.length === 0) return []
  const out: Issue[] = []
  const byLower = new Map(entities.map(e => [e.name.trim().toLowerCase(), e]))
  const entityOf = (name: string | undefined) => (name ? byLower.get(name.trim().toLowerCase()) : undefined)
  const same = (a: string | undefined, b: string) => a != null && a.trim().toLowerCase() === b.trim().toLowerCase()
  // Where a chart drills to (EntityScaffoldContext.PageLinks.listPageOf): the entity's first list
  // page in the navigation. Where a row opens: its record page.
  const visibleList = (entity: string) => pages.some(p => p.type === 'entity-list' && !p.hidden && same(p.entity, entity))
  const recordPage = (entity: string) => pages.some(p => p.type === 'record' && same(p.entity, entity))
  const room = pages.length < MAX_PAGES
  const patchPage = (index: number, label: string, patch: (page: FullstackPageDef) => FullstackPageDef): PageFix => ({
    label,
    apply: all => all.map((p, i) => (i === index ? patch(p) : p)),
  })
  const addListPage = (e: FullstackEntityDef): PageFix | undefined => (room ? {
    label: t('Add a {entities} list page', { entities: pluralize(e.name) }),
    apply: all => [...all, { id: uniquePageId(slugify(pluralize(e.name)), all.map(p => p.id)), type: 'entity-list', entity: e.name }],
  } : undefined)
  const addRecordPage = (e: FullstackEntityDef): PageFix | undefined => (room ? {
    label: t('Add a {entity} record page', { entity: e.name }),
    apply: all => [...all, { id: uniquePageId(slugify(e.name), all.map(p => p.id)), type: 'record', entity: e.name, hidden: true }],
  } : undefined)
  const seen = new Set<string>()
  // Entities a record page lists as related tabs (their rows show there).
  const relatedShown: string[] = []

  pages.forEach((page, index) => {
    const label = pageLabel(page)
    const where = t('Page “{page}”', { page: label })
    // `kind` + the page id (+ a detail) is the warning's dismissal key: it survives a reorder and
    // any edit that leaves the warning standing.
    const warn = (kind: string, field: string, summary: string, fix?: PageFix, detail?: string) => {
      // One chart dead end per page and entity, not one per widget.
      if (seen.has(summary)) return
      seen.add(summary)
      const key = `${kind}:${page.id}${detail ? `:${detail.toLowerCase()}` : ''}`
      out.push({ key, page: index, field, message: '', summary, ...(fix ? { fix } : {}) })
    }

    if (page.hidden && page.type !== 'record' && !createsRows(page) && pagesEmbedding(pages, page.id).length === 0) {
      warn('unreachable', 'page', t('{where} is hidden but no tabs page embeds it, so nothing opens it', { where }),
        patchPage(index, t('Show “{page}” in the navigation', { page: label }), p => ({ ...p, hidden: false })))
    }
    if ((page.roles?.length ?? 0) > 0 && page.hidden && !createsRows(page)) {
      warn('hidden-roles', 'roles', t('{where} is restricted to roles, but it is out of the navigation, so the roles never apply', { where }),
        patchPage(index, t('Drop the roles of “{page}”', { page: label }), p => ({ ...p, roles: undefined })))
    }
    if (page.type === 'dashboard') {
      const dateless: number[] = []
      ;(page.widgets ?? []).forEach((w, wi) => {
        const e = entityOf(w.entity)
        if (!e || w.kind === 'text' || w.kind === 'links' || w.kind === 'list') return
        const chart = w.kind === 'bar' || w.kind === 'donut' || w.kind === 'stacked' || w.kind === 'top' || w.kind === 'line'
        // A widget with its own click target opens that page instead.
        if (chart && !w.drillTo?.trim() && !visibleList(e.name)) {
          warn('chart-dead-end', `widget.${wi}`, t('{where}: clicking a bar of the {entity} chart goes nowhere — {entity} has no list page in the navigation', { where, entity: e.name }), addListPage(e), e.name)
        }
        if (w.kind === 'pivot' && !w.drillTo?.trim() && !visibleList(e.name)) {
          warn('pivot-dead-end', `widget.${wi}`, t('{where}: clicking a cell of the {entity} pivot goes nowhere — {entity} has no list page in the navigation', { where, entity: e.name }), addListPage(e), e.name)
        }
        if (w.kind === 'recent' && singlePk(e) && !recordPage(e.name)) {
          warn('recent-dead-end', `widget.${wi}`, t('{where}: the recent {entity} rows open nothing — {entity} has no record page', { where, entity: e.name }), addRecordPage(e), e.name)
        }
        if (page.dateRange && !widgetDateField(w, e)) dateless.push(wi)
      })
      if (page.dateRange && dateless.length > 0) {
        warn('dateless', `widget.${dateless[0]}`, tn(dateless.length,
          '{where}: one widget has no date, so the period picker does not limit it',
          '{where}: {n} widgets have no date, so the period picker does not limit them', { where }))
      }
      const count = page.widgets?.length ?? 0
      if (count >= ADVICE.dashboardWidgets) {
        warn('crowded-dashboard', 'widgets', t('{where} has {n} widgets — consider splitting it into a tabs page or a second dashboard', { where, n: count }))
      }
    }
    if (page.type === 'entity-list') {
      const e = entityOf(page.entity)
      const all = e ? [...e.fields.map(f => f.name), ...(e.relations ?? []).filter(r => r.type === 'MANY_TO_ONE').map(r => r.fieldName)] : []
      const shown = page.columns ?? all
      if (e && shown.length >= ADVICE.listColumns) {
        warn('wide-list', 'columns', t('{where} shows {n} columns — a list reads best with {keep} or fewer', { where, n: shown.length, keep: ADVICE.keepColumns }),
          patchPage(index, t('Show the first {keep} columns of “{page}”', { keep: ADVICE.keepColumns, page: label }), p => ({ ...p, columns: shown.slice(0, ADVICE.keepColumns) })))
      }
      // The same list twice in the navigation: an earlier visible list of the entity that opens
      // the same way (preset and view).
      const twin = !page.hidden && e ? pages.findIndex((o, oi) => oi < index && o.type === 'entity-list' && !o.hidden && same(o.entity, e.name)
        && JSON.stringify(o.presetFilter ?? {}) === JSON.stringify(page.presetFilter ?? {}) && (o.view ?? null) === (page.view ?? null)) : -1
      if (twin >= 0) {
        const embedded = pagesEmbedding(pages, page.id).length > 0
        warn('duplicate-list', 'entity', t('{where} lists the same {entity} rows as “{other}”', { where, entity: e!.name, other: pageLabel(pages[twin]) }),
          embedded ? undefined : { label: t('Remove “{page}”', { page: label }), apply: all => all.filter((_, i) => i !== index) })
      }
    }
    if (page.type === 'report') {
      const e = entityOf(page.entity)
      if (e && !visibleList(e.name)) {
        warn('chart-dead-end', 'entity', t('{where}: clicking a bar of the chart goes nowhere — {entity} has no list page in the navigation', { where, entity: e.name }), addListPage(e), e.name)
      }
    }
    if (page.type === 'record') {
      const e = entityOf(page.entity)
      if (!e) return
      const related = entities.filter(o => o.name.trim() && relationsTo(o, e.name).length > 0)
      relatedShown.push(...(page.childTabs ? page.childTabs.map(childTabEntity) : related.slice(0, MAX_CHILD_TABS).map(o => o.name)))
      if (page.childTabs == null && related.length > MAX_CHILD_TABS) {
        warn('child-tabs-cap', 'childTabs', t('{where} shows only the first {max} of its {n} related lists', { where, max: MAX_CHILD_TABS, n: related.length }),
          patchPage(index, t('Choose the first {max} related lists', { max: MAX_CHILD_TABS }), p => ({ ...p, childTabs: related.slice(0, MAX_CHILD_TABS).map(o => o.name) })))
      }
      const tabs = page.childTabs ? page.childTabs.map(childTabEntity) : related.map(o => o.name)
      if (page.headerStats == null && tabs.length > MAX_HEADER_STATS) {
        warn('header-stats-cap', 'headerStats', t('{where} shows only the first {max} of its {n} header numbers', { where, max: MAX_HEADER_STATS, n: tabs.length }),
          patchPage(index, t('Choose the first {max} header numbers', { max: MAX_HEADER_STATS }), p => ({ ...p, headerStats: tabs.slice(0, MAX_HEADER_STATS).map(child => ({ child })) })))
      }
    }
  })

  // The layout as a whole.
  const layoutWarn = (key: string, summary: string, fix?: PageFix) => out.push({ key, message: '', summary, ...(fix ? { fix } : {}) })
  const nav = pages.map((p, i) => ({ p, i })).filter(({ p }) => !p.hidden && p.type !== 'record')
  if (nav.length > ADVICE.navItems && nav.every(({ p }) => !p.group?.trim())) {
    layoutWarn('crowded-nav:layout', t('The navigation lists {n} pages with no sections — group them so the menu stays scannable', { n: nav.length }), {
      label: t('Group the navigation by what each page is for'),
      apply: all => all.map(p => (!p.hidden && p.type !== 'record' ? { ...p, group: adviceGroup(p.type) } : p)),
    })
  }
  // An entity the layout forgot: no page, widget, tab or number names it, and it is not linked to
  // one that is (a lookup shown through a relation is left alone).
  const used = new Set<string>(relatedShown.map(n => n.trim().toLowerCase()))
  const mark = (name: string | undefined) => { if (name?.trim()) used.add(name.trim().toLowerCase()) }
  for (const p of pages) {
    mark(p.entity); mark(p.parent); mark(p.child)
    p.entities?.forEach(mark)
    p.childTabs?.forEach(t => mark(childTabEntity(t)))
    p.headerStats?.forEach(st => mark(st.child))
    p.widgets?.forEach(w => { mark(w.entity); w.entities?.forEach(mark) })
  }
  const linked = (e: FullstackEntityDef) => (e.relations ?? []).some(r => used.has(r.targetEntity.trim().toLowerCase()))
    || entities.some(o => used.has(o.name.trim().toLowerCase()) && relationsTo(o, e.name).length > 0)
  if (used.size > 0) {
    for (const e of entities) {
      const name = e.name.trim().toLowerCase()
      if (!name || used.has(name) || linked(e)) continue
      layoutWarn(`entity-without-page:${name}`, t('No page shows {entity} — the app offers no way to browse or edit its rows', { entity: e.name }), addListPage(e))
    }
  }
  // A writable entity nothing creates, which a created entity needs through a required relation:
  // that entity's New opens a form that can never be saved. What creates (the generated app's New):
  // a reachable list page that keeps New, a form, wizard, import or calendar page, either side of a
  // master-detail page, a record page's related tab and a list widget.
  const creates = new Set<string>(relatedShown.map(n => n.trim().toLowerCase()))
  const create = (name: string | undefined) => { if (name?.trim()) creates.add(name.trim().toLowerCase()) }
  for (const p of pages) {
    if (p.type === 'entity-list' && !(p.hideActions ?? []).includes('new') && (!p.hidden || pagesEmbedding(pages, p.id).length > 0)) create(p.entity)
    if (p.type === 'form' || p.type === 'wizard' || p.type === 'import' || p.type === 'calendar') create(p.entity)
    if (p.type === 'master-detail') { create(p.parent); create(p.child) }
    p.widgets?.forEach(w => { if (w.kind === 'list') create(w.entity) })
  }
  for (const e of entities) {
    const name = e.name.trim().toLowerCase()
    if (!name || e.readOnly || e.viewQuery?.trim() || creates.has(name)) continue
    // Only where it blocks something: an entity the layout creates rows of that needs this one.
    const needs = entities.filter(o => o !== e && creates.has(o.name.trim().toLowerCase()) && (o.relations ?? []).some(r =>
      r.type === 'MANY_TO_ONE' && r.required && r.targetEntity.trim().toLowerCase() === name))
    if (needs.length === 0) continue
    layoutWarn(`uncreatable:${name}`, tn(needs.length,
      'No page creates {entity} rows — {needs} needs one, so it cannot be saved either',
      'No page creates {entity} rows — {needs} need one, so they cannot be saved either',
      { entity: e.name, needs: needs.map(o => o.name).join(', ') }), addListPage(e))
  }
  return out
}

/** Page roles: known values, not on the start page or on a tab, and only with ldap-auth. */
function roleIssues(pages: FullstackPageDef[], context: PageLayoutContext): Issue[] {
  const out: Issue[] = []
  const start = pages.find(p => !p.hidden && p.type !== 'record')
  const tabbed = new Set(pages.flatMap(p => (p.type === 'tabs' ? (p.tabs ?? []).map(t => t.page) : [])))
  pages.forEach((page, index) => {
    const roles = page.roles ?? []
    if (roles.length === 0) return
    const where = `“${pageLabel(page)}”`
    const add = (message: string, summary: string) => out.push({ page: index, field: 'roles', message, summary })
    if (roles.some(r => !PAGE_ROLES.includes(r))) add(t('unknown role'), t('{where} names an unknown role', { where }))
    else if (page === start) add(t('the start page is open to everyone'), t('{where} is the start page, so it cannot be restricted to roles', { where }))
    else if (tabbed.has(page.id)) add(t('restrict the tabs page instead'), t('{where} is a tab, so it cannot be restricted to roles', { where }))
    else if (context.ldapAuth === false) add(t('needs ldap-auth-rest or ldap-auth'), t('{where} is restricted to roles, which need an LDAP auth dependency (ldap-auth-rest or ldap-auth)', { where }))
  })
  return out
}

/** Flat problem sentences — the layout summary and the error count read these. */
export function pageLayoutProblems(pages: FullstackPageDef[], entities: FullstackEntityDef[]): string[] {
  return validatePages(pages, entities).problems
}

type AddIssue = (field: string, message: string, summary?: string, fix?: PageFix) => void

/** The opening filters of a list, report or widget: a value of a filterable enum/boolean column, a
 *  period or date range on a date column, a number range on a number column. */
function checkPresetFilter(filter: Record<string, string> | undefined, e: FullstackEntityDef,
                           entityOf: (name: string | undefined) => FullstackEntityDef | undefined, add: AddIssue, where: string,
                           control: (field: string) => string = field => `presetFilter.${field}`): void {
  const presettable = presettableFields(e)
  for (const [field, value] of Object.entries(filter ?? {})) {
    const f = e.fields.find(x => x.name === field)
    const relation = f ? undefined : relationOfPresetKey(e, field)
    if (relation) {
      const problem = relationPresetProblem(value, entityOf(relation.targetEntity))
      if (problem) add(control(field), problem, t('{where} filters {field} on “{value}”, which {problem}', { where, field: relation.fieldName, value, problem }))
    } else if (!f) {
      add(control(field), t('{entity} no longer has “{field}”', { entity: e.name, field }),
        t('{where} filters on “{field}”, which {entity} no longer has', { where, field, entity: e.name }))
    } else if (!presettable.includes(f)) {
      add(control(field), t('only a filterable enum, boolean, date or number field can be preset'),
        t('{where} filters on “{field}”, which is not a filterable enum, boolean, date or number field', { where, field }))
    } else {
      const problem = presetValueProblem(f, value)
      if (problem) add(control(field), problem, t('{where} filters {field} on “{value}”, which {problem}', { where, field, value, problem: problem.replace(/^needs/, 'is not valid: needs') }))
    }
  }
}

/** `count` takes no field; every other aggregate needs a non-key numeric one. Shared by the
 *  dashboard widgets and a report's chart, which the backend validates with the same rule. */
function aggIssues(agg: FullstackAgg | undefined, field: string | undefined, e: FullstackEntityDef,
                   skip: boolean): { field: string; message: string; summary: string }[] {
  if (skip) return []
  if (!agg || agg === 'count') {
    return field
      ? [{ field: 'chart.field', message: t('a count takes no field'), summary: t('counts rows, so it takes no field') }]
      : []
  }
  if (!field) {
    return [{ field: 'chart.field', message: t('{agg} needs a numeric field of {entity}', { agg, entity: e.name }),
      summary: t('reduces {entity} with {agg} but names no numeric field', { entity: e.name, agg }) }]
  }
  if (!numericFields(e).some(f => f.name === field)) {
    return [{ field: 'chart.field', message: t('{entity} has no numeric field “{field}”', { entity: e.name, field }),
      summary: t('reduces “{field}”, which is not a numeric field of {entity}', { field, entity: e.name }) }]
  }
  return []
}

/** How a list page opens: known columns (none twice), a sortable sort, an offered view, a pager size. */
function checkListPresentation(page: FullstackPageDef, e: FullstackEntityDef, add: AddIssue, where: string, scaffoldOpts: string[]): void {
  const isAudit = (key: string) => key === 'createdAt' || key === 'updatedAt' || key === 'createdBy' || key === 'updatedBy'
  if (page.columns) {
    if (page.columns.length === 0) add('columns', t('needs at least one column'), t('{where} shows no columns', { where }))
    const keys = listColumns(e, scaffoldOpts).map(c => c.key)
    const seen = new Set<string>()
    for (const key of page.columns) {
      if (!keys.includes(key)) {
        add('columns', isAudit(key) ? t('“{key}” needs the audit option on {entity}', { key, entity: e.name }) : t('{entity} has no “{key}” column', { entity: e.name, key }),
          isAudit(key) ? t('{where} shows “{key}”, which needs the audit scaffold option on {entity}', { where, key, entity: e.name })
            : t('{where} shows “{key}”, which is not a column of {entity}', { where, key, entity: e.name }))
      } else if (seen.has(key)) add('columns', t('“{key}” is listed twice', { key }), t('{where} lists the “{key}” column twice', { where, key }))
      seen.add(key)
    }
  }
  if (page.detail != null) {
    if (!['drawer', 'side', 'record'].includes(page.detail)) add('detail', t('must be drawer, side or record'), t('{where} opens rows in “{detail}”, which is not drawer, side or record', { where, detail: page.detail }))
    else if (page.detail === 'side' && !singlePk(e)) add('detail', t('a side pane needs a single-key entity'), t('{where} opens rows in a side pane, but {entity} has a composite key', { where, entity: e.name }))
  }
  if (page.sort) {
    const key = page.sort.field
    if (!key?.trim()) add('sort', t('needs a column'), t('{where} sorts by no column', { where }))
    else if (!sortableKeys(e, scaffoldOpts).includes(key)) {
      add('sort', isAudit(key) ? t('“{key}” needs the audit option on {entity}', { key, entity: e.name }) : t('{entity} cannot sort by “{key}”', { entity: e.name, key }),
        isAudit(key) ? t('{where} sorts by “{key}”, which needs the audit scaffold option on {entity}', { where, key, entity: e.name })
          : t('{where} sorts by “{key}”, which {entity} cannot sort by', { where, key, entity: e.name }))
    }
    if (page.sort.dir && page.sort.dir !== 'asc' && page.sort.dir !== 'desc') {
      add('sort', t('direction must be asc or desc'), t('{where} has a sort direction that is neither asc nor desc', { where }))
    }
  }
  if (page.view) {
    if (!LIST_VIEWS.some(v => v.value === page.view)) add('view', t('“{view}” is not a list view', { view: page.view }), t('{where} opens as “{view}”, which is not a list view', { where, view: page.view }))
    else if (!enabledListViews(e).includes(page.view)) {
      const reason = viewDisabledReason(e, page.view)
      add('view', reason ?? t('{entity} does not offer it', { entity: e.name }),
        reason
          ? t('{where} opens as {view}, which {entity} does not offer ({reason})', { where, view: page.view, entity: e.name, reason: `${reason.charAt(0).toLowerCase()}${reason.slice(1)}` })
          : t('{where} opens as {view}, which {entity} does not offer', { where, view: page.view, entity: e.name }))
    }
  }
  if (page.pageSize != null && !LIST_PAGE_SIZES.includes(page.pageSize)) {
    add('pageSize', t('must be {sizes}', { sizes: LIST_PAGE_SIZES.join(', ') }), t('{where} opens with {n} rows per page, which the pager does not offer', { where, n: page.pageSize }))
  }
}

/** A dashboard's filters (FullstackPageValidator.dashboardFilters): at most four, each an
 *  enum/boolean/relation name one of its widgets' entities filters by, the same kind of filter on
 *  every entity that has it, none blank or twice. */
function checkDashboardFilters(page: FullstackPageDef, entities: FullstackEntityDef[], add: AddIssue, where: string,
                               dropFilter: (index: number, name: string) => PageFix): void {
  const filters = page.filters ?? []
  if (filters.length === 0) return
  if (filters.length > MAX_DASHBOARD_FILTERS) add('filters', t('has more than {max} filters', { max: MAX_DASHBOARD_FILTERS }))
  const reach = dashboardFilterEntities(page, entities)
  const seen: string[] = []
  filters.forEach((raw, fi) => {
    const name = (raw ?? '').trim()
    if (!name) {
      add('filters', t('a filter name is blank'), t('{where}: a filter name is blank', { where }), dropFilter(fi, ''))
      return
    }
    const r = resolveDashboardFilter(name, reach, entities)
    if (!r) {
      add('filters', t('none of the widgets’ entities filters by “{name}”', { name }),
        t('{where}: filter “{name}” is not an enum, boolean or relation filter of any of its widgets’ entities ({entities})', { where, name, entities: reach.map(e => e.name).join(', ') }),
        dropFilter(fi, name))
    } else if ('conflict' in r) {
      const c = r.conflict
      add('filters', t('“{name}” is {shape} on {owner} but {otherShape} on {other}', { name, shape: c.shape, owner: c.owner, otherShape: c.otherShape, other: c.other }),
        t('{where}: filter “{name}” is {shape} on {owner} but {otherShape} on {other} — one control cannot set both', { where, name, shape: c.shape, owner: c.owner, otherShape: c.otherShape, other: c.other }),
        dropFilter(fi, name))
    } else if (seen.includes(r.name.toLowerCase())) {
      add('filters', t('“{name}” is listed twice', { name: r.name }), t('{where}: filter “{name}” is listed twice', { where, name: r.name }), dropFilter(fi, r.name))
    } else seen.push(r.name.toLowerCase())
  })
}

function collect(pages: FullstackPageDef[], entities: FullstackEntityDef[], scaffoldOpts: string[] = []): Issue[] {
  if (pages.length === 0) return []
  const issues: Issue[] = []
  const byLower = new Map(entities.map(e => [e.name.trim().toLowerCase(), e]))
  const entityOf = (name: string | undefined) => (name ? byLower.get(name.trim().toLowerCase()) : undefined)
  const typeById = new Map(pages.map(p => [p.id, p.type]))
  const seenIds = new Set<string>()
  const recordEntities = new Map<string, string>()
  // The page that creates each entity's rows: a wizard or a form, one per entity.
  const createPages = new Map<string, FullstackPageDef>()
  const checkOneCreatePage = (e: FullstackEntityDef, page: FullstackPageDef, where: string,
                              add: (field: string, message: string, summary?: string) => void) => {
    const already = createPages.get(e.name)
    if (already) {
      add('entity', t('{entity} already has the {type} “{id}”', { entity: e.name, type: already.type, id: already.id }), already.type === page.type
        ? t('{where} is a second {type} for {entity}', { where, type: page.type, entity: e.name })
        : t('{where} is a {type} for {entity}, which already has a {other} — an entity has one or the other', { where, type: page.type, entity: e.name, other: already.type }))
    } else createPages.set(e.name, page)
  }

  if (pages.length > MAX_PAGES) {
    issues.push({ message: '', summary: t('A layout can have at most {max} pages', { max: MAX_PAGES }) })
  }

  // The fixes: a stale reference is removed (the page, or just the widget / tab / tile that holds
  // it), an ambiguous link takes the first relation, a wizard asks for what it forgot.
  const removePage = (index: number): PageFix => ({
    label: t('Remove the “{page}” page', { page: pageLabel(pages[index]) }),
    apply: all => removePageAt(all, index),
  })
  const patchPage = (index: number, label: string, patch: (page: FullstackPageDef) => FullstackPageDef): PageFix => ({
    label,
    apply: all => all.map((p, i) => (i === index ? patch(p) : p)),
  })
  // A page (or widget) naming an entity that is gone can switch to the likely replacement: the
  // one entity the layout does not mention yet — the usual shape of a rename by delete-and-add or
  // a re-import under a new name.
  const mentioned = new Set<string>()
  const mention = (name: string | undefined) => { if (name?.trim()) mentioned.add(name.trim().toLowerCase()) }
  for (const p of pages) {
    mention(p.entity); mention(p.parent); mention(p.child)
    p.widgets?.forEach(w => mention(w.entity))
    p.childTabs?.forEach(t => mention(childTabEntity(t)))
    p.headerStats?.forEach(st => mention(st.child))
  }
  const unmentioned = entities.filter(e => e.name.trim() && !mentioned.has(e.name.trim().toLowerCase()))
  const replacement = unmentioned.length === 1 ? unmentioned[0] : undefined
  const switchPage = (index: number): PageFix | undefined => {
    const page = pages[index]
    const r = replacement
    if (!r) return undefined
    const label = t('Switch to {entity}', { entity: r.name })
    switch (page.type) {
      case 'entity-list':
        return patchPage(index, label, p => ({ ...p, ...retargetEntityList(p, r, scaffoldOpts).patch }))
      case 'report':
        return reportGroupKeys(r).length ? patchPage(index, label, p => ({ ...p, ...retargetReport(p, r).patch })) : undefined
      case 'record':
        return singlePk(r) ? patchPage(index, label, p => ({ ...p, ...retargetRecord(p, r.name).patch })) : undefined
      case 'wizard':
        return !r.readOnly && askableFields(r).length ? patchPage(index, label, p => ({ ...p, entity: r.name, steps: retargetWizardSteps(p.steps, r).steps })) : undefined
      case 'form':
        return !r.readOnly ? patchPage(index, label, p => ({ ...p, entity: r.name })) : undefined
      default:
        return undefined
    }
  }
  const switchWidget = (index: number, wi: number): PageFix | undefined => (replacement ? patchPage(index, t('Switch widget {n} to {entity}', { n: wi + 1, entity: replacement.name }),
    p => ({ ...p, widgets: (p.widgets ?? []).map((w, j) => (j === wi ? retargetWidget(w, { entity: replacement.name }, replacement, scaffoldOpts).widget : w)) }))
    : undefined)

  pages.forEach((page, index) => {
    const where = t('Page “{page}”', { page: page.title || page.id || index + 1 })
    // The summary names the page: "Page “X” needs an id" — in Hebrew, with a colon between.
    const add = (field: string, message: string, summary = t('{where} {message}', { where, message }), fix?: PageFix, alsoFix?: PageFix) =>
      issues.push({ page: index, field, message, summary, ...(fix ? { fix } : {}), ...(alsoFix ? { alsoFix } : {}) })

    if (!page.id.trim()) add('id', t('needs an id'))
    else if (!PAGE_ID.test(page.id) || page.id.length > 40) {
      add('id', t('must be lower-case words joined by “-”'), t('{where} has an invalid id “{id}”', { where, id: page.id }))
    } else if (seenIds.has(page.id)) add('id', t('is already used'), t('Two pages share the id “{id}”', { id: page.id }))
    seenIds.add(page.id)
    const tooLong = (title: string | undefined) => (title ?? '').trim().length > MAX_TITLE
    if (tooLong(page.title)) add('title', t('is longer than {max} characters', { max: MAX_TITLE }))
    if ((page.description ?? '').trim().length > MAX_DESCRIPTION) add('description', t('is longer than {max} characters', { max: MAX_DESCRIPTION }))
    // The titles inside a page have the same cap on the server.
    ;(page.widgets ?? []).forEach((w, wi) => {
      if (tooLong(w.title)) add(`widget.${wi}.title`, t('has a title longer than {max} characters', { max: MAX_TITLE }), t('{where} has a widget title over {max} characters', { where, max: MAX_TITLE }))
    })
    ;(page.tabs ?? []).forEach((tab, ti) => {
      if (tooLong(tab.title)) add(`tab.${ti}`, t('has a title longer than {max} characters', { max: MAX_TITLE }), t('{where} has a tab title over {max} characters', { where, max: MAX_TITLE }))
    })
    ;(page.steps ?? []).forEach((step, si) => {
      if (tooLong(step.title)) add(`step.${si}`, t('has a title longer than {max} characters', { max: MAX_TITLE }), t('{where} has a step title over {max} characters', { where, max: MAX_TITLE }))
    })
    ;(page.headerStats ?? []).forEach((s, si) => {
      if (tooLong(s.title)) add(`headerStat.${si}`, t('has a title longer than {max} characters', { max: MAX_TITLE }), t('{where} has a header number title over {max} characters', { where, max: MAX_TITLE }))
    })
    if (page.group?.trim() || page.icon) {
      if (!inNav(page)) {
        add(page.group?.trim() ? 'group' : 'icon', t('only applies to a page in the navigation'),
          page.group?.trim()
            ? t('{where} is not in the navigation, so it takes no nav group', { where })
            : t('{where} is not in the navigation, so it takes no nav icon', { where }))
      }
      if ((page.group ?? '').trim().length > MAX_GROUP) add('group', t('is longer than {max} characters', { max: MAX_GROUP }))
      if (page.icon && !(page.icon in NAV_ICONS)) add('icon', t('“{icon}” is not a nav icon', { icon: page.icon }))
    }
    if (page.type !== 'dashboard' && (page.filters?.length ?? 0) > 0) {
      add('filters', t('only a dashboard takes filters — a list or report page has its own filter bar'),
        t('{where} ({type}) does not take filters (only a dashboard does — a list or report page has its own filter bar)', { where, type: page.type }),
        patchPage(index, t('Drop the dashboard filters of “{page}”', { page: pageLabel(page) }), p => {
          const { filters: _filters, ...rest } = p
          return rest
        }))
    }

    switch (page.type) {
      case 'entity-list': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            page.entity ? t('{where} lists “{entity}”, which is no longer an entity', { where, entity: page.entity }) : t('{where} lists no entity', { where }),
            page.entity ? switchPage(index) ?? removePage(index) : undefined,
            page.entity && switchPage(index) ? removePage(index) : undefined)
          break
        }
        checkPresetFilter(page.presetFilter, e, entityOf, add, where)
        checkListPresentation(page, e, add, where, scaffoldOpts)
        if (page.hideActions?.length) {
          const unknown = page.hideActions.find(a => !LIST_ACTIONS.some(x => x.value === a))
          // Either export is an action a list has: the CSV, or the Excel workbook.
          const exports = (e.opts?.csvExport ?? scaffoldOpts.includes('csvExport'))
            || (e.opts?.xlsxExport ?? scaffoldOpts.includes('xlsxExport'))
          if (unknown) add('hideActions', t('“{unknown}” is not a list action', { unknown }), t('{where} hides the unknown action “{unknown}”', { where, unknown }))
          else if (new Set(page.hideActions).size < page.hideActions.length) add('hideActions', t('lists an action twice'), t('{where} hides an action twice', { where }))
          else if ((e.readOnly || e.viewQuery != null) && !exports) {
            add('hideActions', t('{entity} is read-only and exports nothing — there is nothing to hide', { entity: e.name }),
              t('{where} hides actions, but {entity} is read-only and exports nothing', { where, entity: e.name }),
              patchPage(index, t('Show every action'), p => { const { hideActions: _h, ...rest } = p; return rest }))
          }
        }
        if (page.detail === 'record' && !pages.some(p => p.type === 'record' && p.entity?.trim().toLowerCase() === e.name.trim().toLowerCase())) {
          add('detail', t('needs a record page for {entity}', { entity: e.name }), t('{where} opens rows on a record page, but {entity} has none', { where, entity: e.name }),
            singlePk(e) && pages.length < MAX_PAGES ? {
              label: t('Add a {entity} record page', { entity: e.name }),
              apply: all => [...all, { id: uniquePageId(slugify(e.name), all.map(p => p.id)), type: 'record', entity: e.name, hidden: true }],
            } : undefined)
        }
        break
      }
      case 'dashboard': {
        const widgets = page.widgets ?? []
        if (widgets.length === 0) add('widgets', t('needs at least one widget'))
        if (widgets.length > MAX_WIDGETS) add('widgets', t('has more than {max} widgets', { max: MAX_WIDGETS }))
        const dropDrill = (wi: number, label: string) => patchPage(index, label,
          p => ({ ...p, widgets: (p.widgets ?? []).map((x, j) => {
            if (j !== wi) return x
            const { drillTo: _drillTo, ...kept } = x
            return kept
          }) }))
        // Where a widget's clicks go (FullstackPageValidator.drillTo): a visible list or report
        // page of the widget's own entity.
        const checkDrill = (w: FullstackWidgetDef, wi: number, e: FullstackEntityDef) => {
          const id = w.drillTo?.trim()
          if (!id) return
          const control = `widget.${wi}.drillTo`
          const fix = dropDrill(wi, t('Open {entity}’s own list from widget {n}', { entity: e.name, n: wi + 1 }))
          const target = pages.find(p => p.id === id)
          if (!target) {
            add(control, t('no page “{id}”', { id }), t('{where} has a widget whose clicks open the missing page “{id}”', { where, id }), fix)
          } else if (target.type !== 'entity-list' && target.type !== 'report') {
            add(control, t('“{page}” must be an entity-list or report page', { page: pageLabel(target) }),
              t('{where} has a widget whose clicks open “{page}”, which must be an entity-list or report page', { where, page: pageLabel(target) }), fix)
          } else if (target.hidden) {
            add(control, t('“{page}” is hidden, so it cannot be opened from a widget', { page: pageLabel(target) }),
              t('{where} has a widget whose clicks open “{page}”, which is hidden, so it cannot be opened from a widget', { where, page: pageLabel(target) }), fix)
          } else if (!sameName(target.entity, e.name)) {
            const shows = entityOf(target.entity)?.name ?? target.entity ?? '?'
            add(control, t('“{page}” shows {shows}, not {entity}', { page: pageLabel(target), shows, entity: e.name }),
              t('{where} has a widget whose clicks open “{page}”, which shows {shows}, not {entity}', { where, page: pageLabel(target), shows, entity: e.name }), fix)
          }
        }
        widgets.forEach((w, wi) => {
          if (!readsEntity(w) && w.drillTo?.trim()) {
            add(`widget.${wi}.drillTo`, t('a {kind} widget opens no page on click', { kind: w.kind }),
              w.kind === 'text'
                ? t('{where} gives a {kind} widget a click target, but a {kind} widget takes only text, a title and a width', { where, kind: w.kind })
                : t('{where} gives a {kind} widget a click target, but a {kind} widget takes only pages, a title and a width', { where, kind: w.kind }),
              dropDrill(wi, t('Drop the click target of widget {n}', { n: wi + 1 })))
          }
          if (w.kind === 'text') {
            if (!w.text?.trim()) add(`widget.${wi}.text`, t('needs some text'), t('{where} has an empty text widget', { where }))
            else if (w.text.length > MAX_TEXT) add(`widget.${wi}.text`, t('is longer than {max} characters', { max: MAX_TEXT }), t('{where} has a text widget over {max} characters', { where, max: MAX_TEXT }))
            return
          }
          if (w.kind === 'activity') {
            const named = w.entities ?? []
            if (named.length === 0 && activityEntities(w, entities, scaffoldOpts).length === 0) {
              add(`widget.${wi}.entities`, t('needs the audit option — no entity records when it changed'),
                t('{where} has an activity feed, but the audit option is off for every entity', { where }))
            }
            if (named.length > MAX_ACTIVITY_ENTITIES) {
              add(`widget.${wi}.entities`, t('reads at most {max} entities', { max: MAX_ACTIVITY_ENTITIES }), t('{where} has an activity feed over more than {max} entities', { where, max: MAX_ACTIVITY_ENTITIES }))
            }
            named.forEach((name, ni) => {
              const e = entityOf(name)
              if (!e) add(`widget.${wi}.entities`, t('“{name}” is no longer an entity', { name }), t('{where} has an activity feed over “{name}”, which is no longer an entity', { where, name }))
              else if (!auditOn(e, scaffoldOpts)) {
                add(`widget.${wi}.entities`, t('{entity} does not record when it changed (audit is off)', { entity: e.name }),
                  t('{where} has an activity feed over {entity}, which does not record when it changed', { where, entity: e.name }))
              } else if (named.findIndex(n => sameName(n, name)) !== ni) add(`widget.${wi}.entities`, t('lists {entity} twice', { entity: e.name }), t('{where} lists {entity} twice in its activity feed', { where, entity: e.name }))
            })
            if (w.limit != null && (w.limit < MIN_ACTIVITY_LIMIT || w.limit > MAX_RECENT_LIMIT)) {
              add(`widget.${wi}.limit`, t('between {min} and {max} changes', { min: MIN_ACTIVITY_LIMIT, max: MAX_RECENT_LIMIT }),
                t('{where} shows an activity feed of {limit} changes ({min}–{max})', { where, limit: w.limit, min: MIN_ACTIVITY_LIMIT, max: MAX_RECENT_LIMIT }))
            }
            if (w.span != null && (!Number.isInteger(w.span) || w.span < 1 || w.span > MAX_SPAN)) {
              add(`widget.${wi}.span`, t('spans 1 to {max} columns', { max: MAX_SPAN }), t('{where} has a widget {span} columns wide (1–{max})', { where, span: w.span, max: MAX_SPAN }))
            }
            return
          }
          if (w.kind === 'links') {
            const ids = w.pages ?? []
            const dropLink = (id: string) => patchPage(index, t('Drop the link to “{id}”', { id }),
              p => ({ ...p, widgets: (p.widgets ?? []).map((x, j) => (j === wi ? { ...x, pages: (x.pages ?? []).filter(k => k !== id) } : x)) }))
            if (ids.length === 0) add(`widget.${wi}.pages`, t('needs at least one page to open'), t('{where} has a links widget that opens no page', { where }))
            else if (ids.length > MAX_LINKS) add(`widget.${wi}.pages`, t('opens more than {max} pages', { max: MAX_LINKS }), t('{where} has a links widget over {max} pages', { where, max: MAX_LINKS }))
            ids.forEach((id, li) => {
              const target = pages.find(p => p.id === id)
              if (!target) add(`widget.${wi}.pages`, t('no page “{id}”', { id }), t('{where} links to the missing page “{id}”', { where, id }), dropLink(id))
              else if (target.type === 'record') {
                add(`widget.${wi}.pages`, t('“{page}” opens from a row, not a link', { page: pageLabel(target) }), t('{where} links to the record page “{page}”, which opens from a row', { where, page: pageLabel(target) }), dropLink(id))
              } else if (target.hidden && !createsRows(target) && target.type !== 'search') {
                add(`widget.${wi}.pages`, t('“{page}” is hidden, so a link cannot open it', { page: pageLabel(target) }), t('{where} links to “{page}”, which is hidden from the navigation', { where, page: pageLabel(target) }), dropLink(id))
              } else if (ids.indexOf(id) !== li) add(`widget.${wi}.pages`, t('links to “{page}” twice', { page: pageLabel(target) }), t('{where} links to “{page}” twice', { where, page: pageLabel(target) }))
            })
            return
          }
          const e = entityOf(w.entity)
          if (!e) {
            add(`widget.${wi}.entity`, w.entity ? t('“{entity}” is no longer an entity', { entity: w.entity }) : t('needs an entity'),
              t('{where} has a widget for “{entity}”, which is no longer an entity', { where, entity: w.entity }),
              !w.entity ? undefined
                : switchWidget(index, wi) ?? (widgets.length === 1 ? removePage(index)
                  : patchPage(index, t('Remove widget {n}', { n: wi + 1 }), p => ({ ...p, widgets: (p.widgets ?? []).filter((_, j) => j !== wi) }))),
              !w.entity || !switchWidget(index, wi) ? undefined
                : widgets.length === 1 ? removePage(index)
                  : patchPage(index, t('Remove widget {n}', { n: wi + 1 }), p => ({ ...p, widgets: (p.widgets ?? []).filter((_, j) => j !== wi) })))
            return
          }
          if (w.kind === 'list') {
            // The same presentation rules as a list page, reported on the widget.
            checkListPresentation({ id: page.id, type: 'entity-list', entity: e.name, columns: w.columns, sort: w.sort }, e,
              (field, message, summary, fix) => add(`widget.${wi}.${field}`, message, summary, fix), where, scaffoldOpts)
            if (w.limit != null && !LIST_WIDGET_LIMITS.includes(w.limit)) {
              const sizes = LIST_WIDGET_LIMITS.join(t(' or '))
              add(`widget.${wi}.limit`, t('shows {sizes} rows', { sizes }), t('{where} embeds a list of {limit} rows ({sizes})', { where, limit: w.limit, sizes }))
            }
            checkPresetFilter(w.presetFilter, e, entityOf, add, where, field => `widget.${wi}.presetFilter.${field}`)
            checkDrill(w, wi, e)
            return
          }
          if (w.kind === 'timeInState') {
            // It reads the workflow's move log — every row ever moved — so it takes an entity, a
            // title and a width, and nothing that filters or measures.
            if (!e.workflow?.trackMoves) {
              add(`widget.${wi}.entity`, e.workflow ? t('{entity}’s workflow keeps no log of its moves', { entity: e.name }) : t('{entity} has no workflow', { entity: e.name }),
                e.workflow
                  ? t('{where} shows time in state for {entity}, whose workflow keeps no log of its moves', { where, entity: e.name })
                  : t('{where} shows time in state for {entity}, which has no workflow', { where, entity: e.name }))
            }
            if (w.agg || w.field || w.groupBy || w.series || w.target || w.dateField || w.sortBy || w.drillTo
              || Object.keys(w.presetFilter ?? {}).length > 0) {
              add(`widget.${wi}.entity`, t('takes only an entity, a title and a width'),
                t('{where} has a time-in-state widget with settings it does not take', { where }),
                patchPage(index, t('Drop the extra settings'), p => ({
                  ...p, widgets: (p.widgets ?? []).map((x, j) => (j === wi ? { kind: x.kind, entity: x.entity, ...(x.title ? { title: x.title } : {}), ...(x.span ? { span: x.span } : {}) } : x)),
                })))
            }
            if (w.span != null && (!Number.isInteger(w.span) || w.span < 1 || w.span > MAX_SPAN)) {
              add(`widget.${wi}.span`, t('spans 1 to {max} columns', { max: MAX_SPAN }), t('{where} has a widget {span} columns wide (1–{max})', { where, span: w.span, max: MAX_SPAN }))
            }
            return
          }
          checkDrill(w, wi, e)
          if (w.kind === 'funnel') {
            const stages = funnelStageFields(e)
            if (w.groupBy && !stages.some(f => f.name.toLowerCase() === w.groupBy!.toLowerCase())) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum field “{groupBy}”', { entity: e.name, groupBy: w.groupBy }),
                t('{where} draws a funnel over “{groupBy}”, which is not an enum field of {entity}', { where, groupBy: w.groupBy, entity: e.name }))
            } else if (!w.groupBy && stages.length === 0) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum field for the stages', { entity: e.name }),
                t('{where} draws a funnel of {entity}, which has no enum field for its stages', { where, entity: e.name }))
            }
            if (w.agg && w.agg !== 'count' && w.agg !== 'sum') {
              add(`widget.${wi}.agg`, t('a funnel counts rows or sums a field'), t('{where} has a funnel that takes the {agg} — only a count or a sum adds up across stages', { where, agg: w.agg }))
            }
          }
          if (w.series && w.kind !== 'stacked' && w.kind !== 'pivot') {
            add(`widget.${wi}.series`, t('only a stacked chart or a pivot takes a series'), t('{where} splits a {kind} widget by a series', { where, kind: w.kind }))
          }
          if (w.kind === 'pivot') {
            const keys = rankableKeys(e)
            const rows = w.groupBy ?? keys[0]
            const columns = w.series ?? defaultPivotColumns(e, rows)
            if (w.groupBy && !keys.some(k => k.toLowerCase() === w.groupBy!.toLowerCase())) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum, boolean or relation “{groupBy}”', { entity: e.name, groupBy: w.groupBy }),
                t('{where} lays {entity} out by “{groupBy}”, which it no longer has', { where, entity: e.name, groupBy: w.groupBy }))
            } else if (w.series && !keys.some(k => k.toLowerCase() === w.series!.toLowerCase())) {
              add(`widget.${wi}.series`, t('{entity} has no enum, boolean or relation “{series}”', { entity: e.name, series: w.series }),
                t('{where} lays {entity} out in columns by “{series}”, which it no longer has', { where, entity: e.name, series: w.series }))
            } else if (!columns || columns === rows) {
              add(`widget.${wi}.series`, t('needs a second enum, boolean or relation for the columns'),
                t('{where} has a pivot of {entity}, which has no second enum, boolean or relation for its columns', { where, entity: e.name }))
            }
          }
          if (w.kind === 'stacked') {
            const by = w.groupBy ?? defaultBarGroupBy(e)
            const series = w.series ?? defaultSeries(e, by)
            if (w.series && !groupByFields(e).some(f => f.name === w.series)) {
              add(`widget.${wi}.series`, t('{entity} has no enum or boolean field “{series}”', { entity: e.name, series: w.series }),
                t('{where} splits {entity} by “{series}”, which it no longer has', { where, entity: e.name, series: w.series }))
            } else if (!series || series === by) {
              add(`widget.${wi}.series`, t('needs a second enum or boolean field to split by'),
                t('{where} has a stacked chart of {entity}, which has no second enum or boolean field to split by', { where, entity: e.name }))
            }
          }
          if (w.kind === 'bar' || w.kind === 'donut') {
            const keys = rankableKeys(e)
            if (w.groupBy && !keys.some(k => k.toLowerCase() === w.groupBy!.toLowerCase())) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum, boolean or relation “{groupBy}”', { entity: e.name, groupBy: w.groupBy }),
                t('{where} groups {entity} by “{groupBy}”, which it no longer has', { where, entity: e.name, groupBy: w.groupBy }))
            } else if (!w.groupBy && keys.length === 0) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum, boolean or relation to group by', { entity: e.name }),
                t('{where} charts {entity}, which has no enum, boolean or relation to group by', { where, entity: e.name }))
            }
          }
          if (w.kind === 'stacked') {
            const groupable = groupByFields(e)
            if (w.groupBy && !groupable.some(f => f.name === w.groupBy)) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum or boolean field “{groupBy}”', { entity: e.name, groupBy: w.groupBy }),
                t('{where} groups {entity} by “{groupBy}”, which it no longer has', { where, entity: e.name, groupBy: w.groupBy }))
            } else if (!w.groupBy && groupable.length === 0) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum or boolean field to group by', { entity: e.name }),
                t('{where} charts {entity}, which has no enum or boolean field to group by', { where, entity: e.name }))
            }
          }
          if (w.kind === 'line') {
            const dates = dateFields(e)
            if (w.groupBy && !dates.some(f => f.name === w.groupBy)) {
              add(`widget.${wi}.groupBy`, t('{entity} has no date field “{groupBy}”', { entity: e.name, groupBy: w.groupBy }),
                t('{where} plots {entity} over “{groupBy}”, which is not one of its date fields', { where, entity: e.name, groupBy: w.groupBy }))
            } else if (!w.groupBy && dates.length === 0) {
              add(`widget.${wi}.groupBy`, t('{entity} has no date field to plot over time', { entity: e.name }),
                t('{where} plots {entity} over time, but it has no date field', { where, entity: e.name }))
            }
          }
          if (w.kind === 'top') {
            const ranks = rankableKeys(e)
            if (w.groupBy && !ranks.some(k => k.toLowerCase() === w.groupBy!.toLowerCase())) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum, boolean or relation “{groupBy}”', { entity: e.name, groupBy: w.groupBy }),
                t('{where} ranks {entity} by “{groupBy}”, which it no longer has', { where, entity: e.name, groupBy: w.groupBy }))
            } else if (!w.groupBy && ranks.length === 0) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum, boolean or relation to rank by', { entity: e.name }),
                t('{where} ranks {entity}, which has nothing to rank by', { where, entity: e.name }))
            }
          }
          if (w.kind === 'progress' || w.kind === 'gauge') {
            const target = Number(w.target)
            if (!w.target?.trim()) {
              add(`widget.${wi}.target`, t('needs a target'), w.kind === 'gauge'
                ? t('{where} has a gauge without a target', { where })
                : t('{where} has a progress tile without a target', { where }))
            } else if (!Number.isFinite(target) || target <= 0) {
              add(`widget.${wi}.target`, t('the target must be a number above 0'), t('{where} has a progress target of “{target}”', { where, target: w.target }))
            }
          }
          if (w.compare) {
            if (w.kind !== 'kpi') {
              add(`widget.${wi}.compare`, t('only a number tile compares periods'), t('{where} compares periods on a {kind} widget', { where, kind: w.kind }))
            } else if (!page.dateRange || !widgetDateField(w, e)) {
              add(`widget.${wi}.compare`, t('comparing needs the period picker and a filterable date'),
                !page.dateRange
                  ? t('{where} compares periods, but has no period picker', { where })
                  : t('{where} compares periods, but {entity} has no filterable date', { where, entity: e.name }))
            }
          }
          if (w.trend) {
            if (w.kind !== 'kpi') {
              add(`widget.${wi}.trend`, t('only a number tile draws a trend'), t('{where} draws a trend on a {kind} widget', { where, kind: w.kind }))
            } else if (!['day', 'month', 'year'].includes(w.trend)) {
              add(`widget.${wi}.trend`, t('“{trend}” is not day, month or year', { trend: w.trend }), t('{where} draws a trend per “{trend}”', { where, trend: w.trend }))
            } else if (!trendDateField(w, e, Boolean(page.dateRange)) && !w.dateField) {
              add(`widget.${wi}.trend`, t('{entity} has no date field to plot over time', { entity: e.name }),
                t('{where} draws a trend of {entity}, which has no date field', { where, entity: e.name }))
            }
          }
          if (w.bucket && w.kind !== 'line') {
            add(`widget.${wi}.bucket`, t('only a trend takes a bucket'), t('{where} buckets a {kind} widget', { where, kind: w.kind }))
          }
          for (const issue of aggIssues(w.kind === 'recent' ? undefined : w.agg, w.field, e, w.kind === 'recent')) {
            add(`widget.${wi}.field`, issue.message, t('{where} {message}', { where, message: issue.summary }))
          }
          if (w.kind === 'recent' && (w.agg || w.field)) {
            add(`widget.${wi}.agg`, t('a recent list shows rows, not an aggregate'),
              t('{where} asks a recent list for an aggregate', { where }))
          }
          if ((w.kind === 'recent' || w.kind === 'top') && w.limit != null && (w.limit < 1 || w.limit > MAX_RECENT_LIMIT)) {
            add(`widget.${wi}.limit`, t('between 1 and {max} rows', { max: MAX_RECENT_LIMIT }),
              t('{where} shows a {kind} list of {limit} rows (1–{max})', { where, kind: w.kind, limit: w.limit, max: MAX_RECENT_LIMIT }))
          }
          if (w.span != null && (!Number.isInteger(w.span) || w.span < 1 || w.span > MAX_SPAN)) {
            add(`widget.${wi}.span`, t('spans 1 to {max} columns', { max: MAX_SPAN }), t('{where} has a widget {span} columns wide (1–{max})', { where, span: w.span, max: MAX_SPAN }))
          }
          if (w.sortBy) {
            if (w.kind !== 'recent') {
              add(`widget.${wi}.sortBy`, t('only a recent list takes a sort'), t('{where} sorts a {kind} widget', { where, kind: w.kind }))
            } else if (!e.fields.some(f => f.name === w.sortBy)
              && !(auditOn(e, scaffoldOpts) && (w.sortBy === 'createdAt' || w.sortBy === 'updatedAt'))) {
              add(`widget.${wi}.sortBy`, t('{entity} has no field “{sortBy}”', { entity: e.name, sortBy: w.sortBy }),
                t('{where} sorts {entity} by “{sortBy}”, which it no longer has', { where, entity: e.name, sortBy: w.sortBy }))
            } else if (e.fields.some(f => f.name === w.sortBy && !isSortableType(f.type))) {
              add(`widget.${wi}.sortBy`, t('“{sortBy}” is long text or a file, which a list cannot be sorted by', { sortBy: w.sortBy }),
                t('{where} sorts {entity} by “{sortBy}”, which is long text or a file', { where, entity: e.name, sortBy: w.sortBy }))
            }
          }
          checkPresetFilter(w.presetFilter, e, entityOf, add, t('{where} has a widget that', { where }), field => `widget.${wi}.presetFilter.${field}`)
          if (w.dateField) {
            if (!page.dateRange && w.kind === 'kpi' && w.trend) {
              // No picker: the date only names what the trend plots over.
              if (!dateFields(e).some(f => f.name === w.dateField)) {
                add(`widget.${wi}.dateField`, t('{entity} has no date field “{dateField}”', { entity: e.name, dateField: w.dateField }),
                  t('{where} plots a trend over “{dateField}”, which is not one of {entity}’s date fields', { where, dateField: w.dateField, entity: e.name }))
              }
            } else if (!page.dateRange) {
              add(`widget.${wi}.dateField`, t('a date field needs the dashboard’s period picker'),
                t('{where} limits a widget by “{dateField}”, but has no period picker', { where, dateField: w.dateField }))
            } else if (!filterableDateFields(e).some(f => f.name === w.dateField)) {
              add(`widget.${wi}.dateField`, t('{entity} has no filterable date field “{dateField}”', { entity: e.name, dateField: w.dateField }),
                t('{where} limits {entity} by “{dateField}”, which is not one of its filterable date fields', { where, entity: e.name, dateField: w.dateField }))
            }
          }
        })
        if (page.refreshSeconds != null) {
          if (!REFRESH_CHOICES.some(r => r.value === page.refreshSeconds)) {
            add('refreshSeconds', t('{refreshSeconds} seconds is not one of the refresh choices', { refreshSeconds: page.refreshSeconds }))
          } else if (widgets.length > 0 && !widgets.some(reloads)) {
            add('refreshSeconds', t('no widget shows data to reload'),
              t('{where} refreshes on a timer, but none of its widgets shows data to reload', { where }))
          }
        }
        if (page.dateRange) {
          if (!DATE_RANGES.some(r => r.value === page.dateRange)) {
            add('dateRange', t('“{dateRange}” is not a period', { dateRange: page.dateRange }))
          } else if (widgets.length > 0 && !widgets.some(w => widgetDateField(w, entityOf(w.entity)))) {
            add('dateRange', t('no widget counts an entity with a filterable date'),
              t('{where} has a period picker, but none of its widgets has a date for it to limit', { where }))
          }
        }
        checkDashboardFilters(page, entities, add, where, (fi, name) => patchPage(index, t('Drop the “{name}” filter', { name }), p => {
          const rest = (p.filters ?? []).filter((_, j) => j !== fi)
          const { filters: _filters, ...kept } = p
          return rest.length ? { ...kept, filters: rest } : kept
        }))
        break
      }
      case 'tabs': {
        if (!page.title?.trim()) add('title', t('needs a title (there is no entity to name it after)'))
        const tabs = page.tabs ?? []
        if (tabs.length < MIN_TABS || tabs.length > MAX_TABS) {
          add('tabs', t('needs between {min} and {max} tabs', { min: MIN_TABS, max: MAX_TABS }))
        }
        const seenTabs = new Set<string>()
        tabs.forEach((tab, ti) => {
          const targetType = typeById.get(tab.page)
          if (!targetType) {
            add(`tab.${ti}`, tab.page ? t('no page with id “{page}”', { page: tab.page }) : t('needs a page'),
              t('{where} has a tab for the missing page “{page}”', { where, page: tab.page }))
          } else if (targetType === 'tabs' || targetType === 'record') {
            add(`tab.${ti}`, t('a tab cannot embed a {targetType} page', { targetType }),
              t('{where} has a tab embedding the {targetType} page “{page}”', { where, targetType, page: tab.page }))
          } else if (seenTabs.has(tab.page)) {
            add(`tab.${ti}`, t('is already a tab of this page'), t('{where} has “{page}” as a tab twice', { where, page: tab.page }))
          }
          seenTabs.add(tab.page)
        })
        break
      }
      case 'master-detail': {
        const parent = entityOf(page.parent)
        const child = entityOf(page.child)
        if (!parent) {
          add('parent', page.parent ? t('“{parent}” is no longer an entity', { parent: page.parent }) : t('needs a parent entity'),
            t('{where} lists “{entity}”, which is no longer an entity', { where, entity: page.parent ?? '' }),
            page.parent ? removePage(index) : undefined)
        } else if (!singlePk(parent)) {
          add('parent', t('{entity} has a composite key', { entity: parent.name }),
            t('{where} lists {entity}, which has a composite key', { where, entity: parent.name }))
        }
        if (!child) {
          add('child', page.child ? t('“{child}” is no longer an entity', { child: page.child }) : t('needs a child entity'),
            t('{where} shows “{entity}”, which is no longer an entity', { where, entity: page.child ?? '' }),
            page.child ? removePage(index) : undefined)
        } else if (parent) {
          const candidates = relationsTo(child, parent.name)
          if (candidates.length === 0) {
            add('child', t('{entity} has no relation to {entity2}', { entity: child.name, entity2: parent.name }),
              t('{where} shows {entity}, which has no relation to {entity2}', { where, entity: child.name, entity2: parent.name }))
          } else if (page.via && !candidates.some(c => c.toLowerCase() === page.via!.toLowerCase())) {
            add('via', t('“{via}” is not a relation to {entity}', { via: page.via, entity: parent.name }),
              t('{where} links through “{via}”, which is not a relation of {entity} to {entity2}', { where, via: page.via, entity: child.name, entity2: parent.name }))
          } else if (!page.via && candidates.length > 1) {
            add('via', t('pick the relation to link through'),
              t('{where} must say which of the relations of {entity} to {entity2} it links through', { where, entity: child.name, entity2: parent.name }),
              patchPage(index, t('Link through “{candidates}”', { candidates: candidates[0] }), p => ({ ...p, via: candidates[0] })))
          }
        }
        // The child list may open with its own columns and sort.
        if (child && (page.columns || page.sort)) checkListPresentation(page, child, add, t('{where}’s {entity} list', { where, entity: child.name }), scaffoldOpts)
        break
      }
      case 'report': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            page.entity ? t('{where} reports on “{entity}”, which is no longer an entity', { where, entity: page.entity })
              : t('{where} reports on no entity', { where }),
            page.entity ? switchPage(index) ?? removePage(index) : undefined,
            page.entity && switchPage(index) ? removePage(index) : undefined)
          break
        }
        const charts = reportCharts(page)
        if (page.chart && page.charts?.length) {
          add('chart.groupBy', t('has both a chart and a list of charts'), t('{where} sets both “chart” and “charts”', { where }))
        }
        if (charts.length > MAX_CHARTS) add('chart.groupBy', t('has more than {max} charts', { max: MAX_CHARTS }))
        const chartable = chartableFields(e)
        charts.forEach((chart, ci) => {
          const which = charts.length > 1 ? t('{where} (chart {n})', { where, n: ci + 1 }) : where
          // The grouping the chart resolves to: the named field, else the generator's default.
          const groupName = chart.groupBy ?? defaultReportGroupBy(e)
          const grouped = groupName ? e.fields.find(f => f.name === groupName) : undefined
          if (chart.groupBy && !chartable.some(f => f.name === chart.groupBy) && !relationKeys(e).includes(chart.groupBy)) {
            add(chartControl(ci, 'groupBy'), t('{entity} has no enum, boolean or date field, or relation, “{groupBy}”', { entity: e.name, groupBy: chart.groupBy }),
              t('{which} groups by “{groupBy}”, which is not an enum, boolean or date field, or a relation, of {entity}', { which, groupBy: chart.groupBy, entity: e.name }))
          } else if (!chart.groupBy && chartable.length === 0) {
            add(chartControl(ci, 'groupBy'), t('{entity} has no enum, boolean or date field to group by', { entity: e.name }),
              t('{which} reports on {entity}, which has no enum, boolean or date field to group by', { which, entity: e.name }))
          }
          const overTime = grouped ? dateFields(e).some(f => f.name === grouped.name) : false
          if (chart.bucket && !overTime) {
            add(chartControl(ci, 'bucket'), t('a bucket applies to a date grouping'),
              t('{which} buckets by {bucket}, but it does not group over a date', { which, bucket: chart.bucket }))
          }
          for (const issue of aggIssues(chart.agg, chart.field, e, false)) {
            add(chartControl(ci, 'field'), issue.message, t('{where} {message}', { where: which, message: issue.summary }))
          }
          const byRelation = !!groupName && relationKeys(e).includes(groupName)
          if (chart.kind && !chartKindsFor(overTime, byRelation).some(k => k.value === chart.kind)) {
            add(chartControl(ci, 'kind'), overTime ? t('a {kind} chart cannot draw a date over time', { kind: chart.kind })
              : byRelation && chart.kind === 'stacked' ? t('a stacked chart splits an enum or boolean grouping, not a relation')
                : t('a {kind} chart draws a date over time', { kind: chart.kind }),
            t('{which} is drawn as {kind}, which does not fit its grouping', { which, kind: chart.kind }))
          }
          if (chart.series && chart.kind !== 'stacked') {
            add(chartControl(ci, 'series'), t('only a stacked chart splits by a series'), t('{which} splits by “{series}” but is not stacked', { which, series: chart.series }))
          } else if (chart.kind === 'stacked' && !byRelation && !overTime) {
            const series = chart.series ?? defaultChartSeries(e, groupName)
            if (!series) {
              add(chartControl(ci, 'series'), t('{entity} needs a second enum or boolean field to split the bars by', { entity: e.name }),
                t('{which} is stacked, but {entity} has no second enum or boolean field', { which, entity: e.name }))
            } else if (series === groupName || !groupByFields(e).some(f => f.name === series)) {
              add(chartControl(ci, 'series'), t('“{series}” must be an enum or boolean field other than the grouping', { series }),
                t('{which} splits by “{series}”, which is not another enum or boolean field', { which, series }))
            }
          }
          if (chart.kind === 'table' && chart.table === false) {
            add(chartControl(ci, 'kind'), t('a table chart is its totals table'), t('{which} is a table chart without its table', { which }))
          }
        })
        checkPresetFilter(page.presetFilter, e, entityOf, add, where)
        break
      }
      case 'record': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            t('{where} opens “{entity}”, which is no longer an entity', { where, entity: page.entity ?? '' }),
            page.entity ? switchPage(index) ?? removePage(index) : undefined,
            page.entity && switchPage(index) ? removePage(index) : undefined)
          break
        }
        if (!singlePk(e)) {
          add('entity', t('{entity} has a composite key', { entity: e.name }),
            t('{where} opens {entity}, which has a composite key and cannot be addressed by one id', { where, entity: e.name }))
        }
        const already = recordEntities.get(e.name)
        if (already) {
          add('entity', t('{entity} already has the record page “{already}”', { entity: e.name, already }),
            t('{where} is a second record page for {entity}', { where, entity: e.name }))
        }
        recordEntities.set(e.name, page.id)
        const seenChildren = new Set<string>()
        const childTabs = page.childTabs ?? []
        childTabs.forEach((tab, ci) => {
          const name = childTabEntity(tab)
          const via = childTabVia(tab)
          const child = entityOf(name)
          if (!child) {
            add(`childTab.${ci}`, t('“{name}” is no longer an entity', { name }),
              t('{where} has a tab for “{name}”, which is no longer an entity', { where, name }),
              patchPage(index, t('Remove the {name} tab', { name }), p => ({ ...p, childTabs: (p.childTabs ?? []).filter((_, j) => j !== ci) })))
          } else if (relationsTo(child, e.name).length === 0) {
            add(`childTab.${ci}`, t('{entity} has no relation to {entity2}', { entity: child.name, entity2: e.name }),
              t('{where} has a tab for {entity}, which has no relation to {entity2}', { where, entity: child.name, entity2: e.name }))
          } else if (seenChildren.has(child.name)) {
            add(`childTab.${ci}`, t('is already a tab'), t('{where} has {entity} as a tab twice', { where, entity: child.name }))
          } else if (via && !relationsTo(child, e.name).includes(via)) {
            add(`childTab.${ci}`, t('{entity} has no relation “{via}” to {entity2}', { entity: child.name, via, entity2: e.name }),
              t('{where} links {entity} through “{via}”, which is not one of its relations to {entity2}', { where, entity: child.name, via, entity2: e.name }))
          }
          const shown = childTabPresentation(tab)
          if (child && (shown.columns || shown.sort)) {
            checkListPresentation({ id: page.id, type: 'entity-list', ...shown }, child,
              (_field, message, summary, fix) => add(`childTab.${ci}`, message, summary, fix), t('{where}’s {entity} tab', { where, entity: child.name }), scaffoldOpts)
          }
          if (child) seenChildren.add(child.name)
        })
        if (childTabs.length > MAX_CHILD_TABS) add('childTabs', t('has more than {max} related lists', { max: MAX_CHILD_TABS }))
        const stats = page.headerStats ?? []
        if (stats.length > MAX_HEADER_STATS) add('headerStats', t('has more than {max} header numbers', { max: MAX_HEADER_STATS }))
        stats.forEach((s, si) => {
          const child = entityOf(s.child)
          if (!child) {
            add(`headerStat.${si}`, t('“{child}” is no longer an entity', { child: s.child }),
              t('{where} has a header number for “{child}”, which is no longer an entity', { where, child: s.child }),
              patchPage(index, t('Remove the {child} tile', { child: s.title || s.child }), p => ({ ...p, headerStats: (p.headerStats ?? []).filter((_, j) => j !== si) })))
          } else if (relationsTo(child, e.name).length === 0) {
            add(`headerStat.${si}`, t('{entity} has no relation to {entity2}', { entity: child.name, entity2: e.name }),
              t('{where} has a header number for {entity}, which has no relation to {entity2}', { where, entity: child.name, entity2: e.name }))
          } else if (s.via && !relationsTo(child, e.name).includes(s.via)) {
            add(`headerStat.${si}`, t('{entity} has no relation “{via}” to {entity2}', { entity: child.name, via: s.via, entity2: e.name }),
              t('{where} has a header number linked through “{via}”, which is not a relation of {entity} to {entity2}', { where, via: s.via, entity: child.name, entity2: e.name }))
          } else {
            for (const issue of aggIssues(s.agg, s.field, child, false)) {
              add(`headerStat.${si}`, issue.message, t('{where} has a header number that {summary}', { where, summary: issue.summary }))
            }
          }
        })
        break
      }
      case 'wizard': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            t('{where} creates “{entity}”, which is no longer an entity', { where, entity: page.entity ?? '' }),
            page.entity ? switchPage(index) ?? removePage(index) : undefined,
            page.entity && switchPage(index) ? removePage(index) : undefined)
          break
        }
        if (e.readOnly) add('entity', t('{entity} is read-only', { entity: e.name }), t('{where} creates {entity}, which is read-only', { where, entity: e.name }))
        checkOneCreatePage(e, page, where, add)
        const askable = wizardFields(e)
        const steps = page.steps ?? []
        if (steps.length > MAX_STEPS) add('steps', t('has more than {max} steps', { max: MAX_STEPS }))
        const asked = new Set<string>()
        steps.forEach((step, si) => {
          if (step.fields.length === 0) add(`step.${si}`, t('asks for nothing'), t('{where} has an empty step {n}', { where, n: si + 1 }))
          for (const name of step.fields) {
            if (name === e.workflow?.statusField) {
              add(`step.${si}`, t('“{name}” is set by the workflow', { name }), t('{where} asks for “{name}”, which its workflow sets', { where, name }))
            } else if (name === e.workflow?.assigneeField) {
              add(`step.${si}`, t('“{name}” is set by claiming and reassigning', { name }), t('{where} asks for “{name}”, which is set by claiming and reassigning', { where, name }))
            } else if (!askable.some(a => a.name === name)) {
              add(`step.${si}`, t('{entity} has no field “{name}”', { entity: e.name, name }), t('{where} asks for “{name}”, which {entity} no longer has', { where, name, entity: e.name }))
            } else if (asked.has(name)) {
              add(`step.${si}`, t('“{name}” is already asked for', { name }), t('{where} asks for “{name}” twice', { where, name }))
            }
            asked.add(name)
          }
        })
        if (steps.length > 0) {
          const missing = askable.filter(a => a.required && !asked.has(a.name)).map(a => a.name)
          if (missing.length > 0) {
            add('steps', tn(missing.length, 'never asks for {fields}, which is required', 'never asks for {fields}, which are required',
              { fields: missing.map(m => `“${m}”`).join(', ') }),
              undefined,
              patchPage(index, t('Add {fields} to the last step', { fields: missing.join(', ') }), p => {
                const next = [...(p.steps ?? [])]
                if (next.length === 0) return p
                const last = next[next.length - 1]
                const asked = new Set(next.flatMap(s => s.fields))
                next[next.length - 1] = { ...last, fields: [...last.fields, ...missing.filter(m => !asked.has(m))] }
                return { ...p, steps: next }
              }))
          }
        }
        if (askable.length === 0) add('entity', t('{entity} has no field to ask for', { entity: e.name }))
        break
      }
      case 'form': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            page.entity ? t('{where} creates “{entity}”, which is no longer an entity', { where, entity: page.entity }) : t('{where} names no entity', { where }),
            page.entity ? switchPage(index) ?? removePage(index) : undefined,
            page.entity && switchPage(index) ? removePage(index) : undefined)
          break
        }
        if (e.readOnly) add('entity', t('{entity} is read-only', { entity: e.name }), t('{where} creates {entity}, which is read-only', { where, entity: e.name }))
        checkOneCreatePage(e, page, where, add)
        break
      }
      case 'tree': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            page.entity ? t('{where} shows “{entity}”, which is no longer an entity', { where, entity: page.entity }) : t('{where} names no entity', { where }),
            page.entity ? removePage(index) : undefined)
          break
        }
        const links = selfLinks(e)
        if (e.fields.filter(f => f.primaryKey).length !== 1) {
          add('entity', t('{entity} has a composite key', { entity: e.name }), t('{where} draws a tree of {entity}, which has a composite key', { where, entity: e.name }))
        } else if (links.length === 0) {
          add('entity', t('{entity} has no relation to itself', { entity: e.name }), t('{where} draws a tree of {entity}, which has no relation to itself (a parent)', { where, entity: e.name }))
        } else if (page.via && !links.some(r => r.fieldName.toLowerCase() === page.via!.toLowerCase())) {
          add('via', t('“{via}” is not a relation of {entity} to itself', { via: page.via, entity: e.name }),
            t('{where} draws its tree by “{via}”, which is not a relation of {entity} to itself', { where, via: page.via, entity: e.name }),
            patchPage(index, t('Use {link}', { link: links[0].fieldName }), p => ({ ...p, via: links.length === 1 ? undefined : links[0].fieldName })))
        } else if (!page.via && links.length > 1) {
          add('via', t('say which link makes the tree'),
            t('{where} draws a tree of {entity}, which points at itself through {links}', { where, entity: e.name, links: links.map(r => r.fieldName).join(t(' and ')) }),
            patchPage(index, t('Use {link}', { link: links[0].fieldName }), p => ({ ...p, via: links[0].fieldName })))
        }
        break
      }
      case 'calendar':
      case 'board':
      case 'inbox':
      case 'import': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            page.entity ? t('{where} shows “{entity}”, which is no longer an entity', { where, entity: page.entity }) : t('{where} names no entity', { where }),
            page.entity ? removePage(index) : undefined)
          break
        }
        if (page.type === 'calendar') {
          checkPresetFilter(page.presetFilter, e, entityOf, add, where)
          checkCalendar(page, e, add, where)
        } else if (page.type === 'board') {
          checkPresetFilter(page.presetFilter, e, entityOf, add, where)
          checkBoard(page, e, add, where)
          if (page.sort) checkListPresentation({ id: page.id, type: 'entity-list', entity: e.name, sort: page.sort }, e, add, where, scaffoldOpts)
        } else if (page.type === 'inbox') {
          checkPresetFilter(page.presetFilter, e, entityOf, add, where)
          checkInbox(page, e, add, where)
          if (page.sort) checkListPresentation({ id: page.id, type: 'entity-list', entity: e.name, sort: page.sort }, e, add, where, scaffoldOpts)
        } else {
          checkImport(page, e, pages, add, where)
        }
        break
      }
      case 'content':
        checkContent(page, pages, add, where)
        break
      case 'search':
        checkSearch(page, entities, pages, add, where)
        break
    }
  })

  if (!pages.some(p => !p.hidden && p.type !== 'record')) {
    issues.push({ message: '', summary: t('Every page is hidden — at least one must be in the navigation') })
  }
  return issues
}

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

/** Follows an entity rename through every reference a layout can hold. */
export function renameEntityInPages(pages: FullstackPageDef[], from: string, to: string): FullstackPageDef[] {
  if (!from || !to || from === to) return pages
  const same = (name: string | undefined) => name != null && name.trim().toLowerCase() === from.trim().toLowerCase()
  return pages.map(page => {
    const next: FullstackPageDef = { ...page }
    if (same(next.entity)) next.entity = to
    if (same(next.parent)) next.parent = to
    if (same(next.child)) next.child = to
    if (next.widgets) {
      next.widgets = next.widgets.map(w => {
        const out = same(w.entity) ? { ...w, entity: to } : w
        return out.entities?.some(same) ? { ...out, entities: out.entities.map(n => (same(n) ? to : n)) } : out
      })
    }
    if (next.childTabs) next.childTabs = next.childTabs.map(tab => (same(childTabEntity(tab)) ? withChildTab(tab, { entity: to }) : tab))
    if (next.headerStats) next.headerStats = next.headerStats.map(s => (same(s.child) ? { ...s, child: to } : s))
    return renameEntityInNewPages(next, from, to)
  })
}

/** Follows a field rename on one entity (preset filters and chart groupings point at fields). */
export function renameFieldInPages(pages: FullstackPageDef[], entity: string, from: string, to: string): FullstackPageDef[] {
  if (!entity || !from || !to || from === to) return pages
  const isEntity = (name: string | undefined) => name != null && name.trim().toLowerCase() === entity.trim().toLowerCase()
  return pages.map(page => {
    const next: FullstackPageDef = { ...page }
    if (isEntity(next.entity) && next.presetFilter && from in next.presetFilter) {
      const filter: Record<string, string> = {}
      for (const [k, v] of Object.entries(next.presetFilter)) filter[k === from ? to : k] = v
      next.presetFilter = filter
    }
    if (isEntity(next.entity) && next.columns?.includes(from)) next.columns = next.columns.map(k => (k === from ? to : k))
    if (isEntity(next.entity) && next.sort?.field === from) next.sort = { ...next.sort, field: to }
    // A master-detail page's columns and sort are its child list's.
    if (next.type === 'master-detail' && isEntity(next.child)) {
      if (next.columns?.includes(from)) next.columns = next.columns.map(k => (k === from ? to : k))
      if (next.sort?.field === from) next.sort = { ...next.sort, field: to }
    }
    // ...and a record page's related tabs carry their own.
    if (next.childTabs?.some(t => typeof t !== 'string' && isEntity(t.entity) && (t.columns?.includes(from) || t.sort?.field === from))) {
      next.childTabs = next.childTabs.map(t => {
        if (typeof t === 'string' || !isEntity(t.entity)) return t
        return withChildTab(t, {
          ...(t.columns?.includes(from) ? { columns: t.columns.map(k => (k === from ? to : k)) } : {}),
          ...(t.sort?.field === from ? { sort: { ...t.sort, field: to } } : {}),
        })
      })
    }
    if (next.widgets) {
      next.widgets = next.widgets.map(w => {
        if (!isEntity(w.entity)) return w
        const patched: FullstackWidgetDef = { ...w }
        if (patched.groupBy === from) patched.groupBy = to
        if (patched.field === from) patched.field = to
        if (patched.sortBy === from) patched.sortBy = to
        if (patched.dateField === from) patched.dateField = to
        if (patched.series === from) patched.series = to
        if (patched.columns?.includes(from)) patched.columns = patched.columns.map(k => (k === from ? to : k))
        if (patched.sort?.field === from) patched.sort = { ...patched.sort, field: to }
        if (patched.presetFilter && from in patched.presetFilter) {
          const filter: Record<string, string> = {}
          for (const [k, v] of Object.entries(patched.presetFilter)) filter[k === from ? to : k] = v
          patched.presetFilter = filter
        }
        return patched
      })
    }
    // A dashboard filter names the field on every widget entity that has it; it follows the rename
    // when one of the dashboard's widgets reads the renamed entity.
    const followed = followFilterRename(next, isEntity, from, to)
    if (followed) next.filters = followed
    const renameChart = (c: FullstackChartDef): FullstackChartDef => ({
      ...c,
      ...(c.groupBy === from ? { groupBy: to } : {}),
      ...(c.field === from ? { field: to } : {}),
    })
    if (isEntity(next.entity) && next.steps) {
      next.steps = next.steps.map(step => ({ ...step, fields: step.fields.map(name => (name === from ? to : name)) }))
    }
    if (next.headerStats) {
      next.headerStats = next.headerStats.map(s => (isEntity(s.child) && s.field === from ? { ...s, field: to } : s))
    }
    if (isEntity(next.entity) && next.chart) next.chart = renameChart(next.chart)
    if (isEntity(next.entity) && next.charts) next.charts = next.charts.map(renameChart)
    return renameFieldInNewPages(next, entity, from, to)
  })
}

/** A dashboard's filters with `from` (ignoring case) renamed to `to`, when one of its entity
 *  widgets reads an entity `isEntity` accepts; undefined when nothing changes. */
function followFilterRename(page: FullstackPageDef, isEntity: (name: string | undefined) => boolean, from: string, to: string): string[] | undefined {
  if (page.type !== 'dashboard' || !page.filters?.length) return undefined
  const lower = from.trim().toLowerCase()
  if (!page.filters.some(k => k.trim().toLowerCase() === lower)) return undefined
  if (!(page.widgets ?? []).some(w => readsEntity(w) && isEntity(w.entity))) return undefined
  return page.filters.map(k => (k.trim().toLowerCase() === lower ? to : k))
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

/** An entity's many-to-one relations to itself: what a tree page can be drawn by. */
export function selfLinks(entity: FullstackEntityDef | undefined): FullstackRelationDef[] {
  if (!entity) return []
  const own = entity.name.trim().toLowerCase()
  return (entity.relations ?? []).filter(r => (r.type ?? 'MANY_TO_ONE') === 'MANY_TO_ONE' && r.targetEntity?.trim().toLowerCase() === own)
}

/** Why a tree page cannot be about `entity`, or undefined when it can. */
export function treeReason(entity: FullstackEntityDef): string | undefined {
  if (entity.fields.filter(f => f.primaryKey).length !== 1) return t('Needs a single primary key')
  return selfLinks(entity).length === 0 ? t('No relation to itself (a parent)') : undefined
}

// ── Defaults the generator resolves ─────────────────────────────────────────

const nonKey = (e: FullstackEntityDef | undefined) => (e?.fields ?? []).filter(f => !f.primaryKey)
const isDate = (f: FullstackFieldDef) => isDateType(f.type)

/** The field a breakdown chart groups by when none is picked: the first enum, else the first
 *  boolean (FullstackPageValidator.groupBy). */
export function defaultBarGroupBy(entity: FullstackEntityDef | undefined): string | undefined {
  const fields = nonKey(entity)
  return (fields.find(f => f.type === 'ENUM') ?? fields.find(f => f.type === 'BOOLEAN'))?.name
}

/** The date field a trend plots over when none is picked: the first one. */
export function defaultLineGroupBy(entity: FullstackEntityDef | undefined): string | undefined {
  return dateFields(entity)[0]?.name
}

/** Why a widget of `kind` cannot read `entity`, or undefined when it can — the validator's own
 *  rules, told before the widget exists (the Add-widget gallery, the kind switcher). */
/** The fields a funnel can read as stages: an entity's enums (its workflow's status first). */
export function funnelStageFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  const enums = (entity?.fields ?? []).filter(f => f.type === 'ENUM' && !f.primaryKey)
  const status = entity?.workflow?.statusField
  return [...enums.filter(f => f.name === status), ...enums.filter(f => f.name !== status)]
}

export function widgetKindDisabledReason(kind: FullstackWidgetDef['kind'], entity: FullstackEntityDef | undefined,
                                          audit?: { entities: FullstackEntityDef[]; scaffoldOpts: string[] }): string | undefined {
  if (kind === 'text' || kind === 'links') return undefined
  if (kind === 'activity') {
    return !audit || audit.entities.some(e => auditOn(e, audit.scaffoldOpts)) ? undefined
      : t('Turn the audit option on first — the feed reads when rows changed')
  }
  if (!entity) return t('Pick an entity first')
  const name = entity.name.trim() || t('This entity')
  switch (kind) {
    case 'bar':
    case 'donut':
      return rankableKeys(entity).length > 0 ? undefined : t('{name} has no enum, boolean or relation to break down by', { name })
    case 'stacked':
      return groupByFields(entity).length > 1 ? undefined : t('{name} needs two enum or boolean fields to stack', { name })
    case 'pivot':
      return rankableKeys(entity).length > 1 ? undefined : t('{name} needs two enum, boolean or relation fields to cross', { name })
    case 'line':
      return dateFields(entity).length > 0 ? undefined : t('{name} has no date field to plot over', { name })
    case 'top':
      return rankableKeys(entity).length > 0 ? undefined : t('{name} has no enum, boolean or relation to rank by', { name })
    case 'funnel':
      return funnelStageFields(entity).length > 0 ? undefined : t('{name} has no enum field for the stages', { name })
    case 'timeInState':
      return entity.workflow?.trackMoves ? undefined
        : entity.workflow ? t('Turn on “Keep a log of moves” in {name}’s workflow first', { name }) : t('{name} has no workflow', { name })
    default:
      return undefined
  }
}

/** A new widget of `kind` on `entity`, pre-filled with what the validator insists on so it is
 *  valid on sight; what the generator defaults (group by, date, series) stays implicit. */
export function newWidget(kind: FullstackWidgetDef['kind'], entity: string, pages: FullstackPageDef[] = []): FullstackWidgetDef {
  switch (kind) {
    case 'text': return { kind, entity: '', text: 'Note' }
    case 'activity': return { kind, entity: '' }
    case 'links': return { kind, entity: '', pages: linkablePages(pages).slice(0, 4).map(p => p.id) }
    case 'progress': return { kind, entity, target: '100' }
    case 'gauge': return { kind, entity, target: '100' }
    default: return { kind, entity }
  }
}

/** A report's grouping when none is picked: the first enum/boolean, else the first date field
 *  (FullstackPageValidator.chart). */
export function defaultReportGroupBy(entity: FullstackEntityDef | undefined): string | undefined {
  const fields = nonKey(entity)
  return (fields.find(f => f.type === 'ENUM' || f.type === 'BOOLEAN') ?? fields.find(isDate))?.name
}

/** The label of a "use the default" option: `Default (status)`, or what it would look for. */
export function defaultOptionLabel(resolved: string | undefined, looksFor: string, labelOf: (key: string) => string = k => k): string {
  return resolved ? t('Default ({field})', { field: labelOf(resolved) }) : t('Default (first {kind})', { kind: looksFor })
}

// ── Page references (tabs point at pages by id) ─────────────────────────────

/** Follows a page id change into every tab that embeds the page. */
export function renamePageIdInPages(pages: FullstackPageDef[], from: string, to: string): FullstackPageDef[] {
  if (!from || from === to) return pages
  let changed = false
  const next = pages.map(page => {
    // A content page's links to it follow too.
    if (page.type === 'content' && page.body) {
      const body = renamePageIdInBody(page.body, from, to)
      if (body !== page.body) {
        changed = true
        page = { ...page, body }
      }
    }
    if (page.widgets?.some(w => w.pages?.includes(from) || w.drillTo === from)) {
      changed = true
      page = {
        ...page,
        widgets: page.widgets.map(w => {
          let next = w.pages?.includes(from) ? { ...w, pages: w.pages.map(id => (id === from ? to : id)) } : w
          // A widget whose clicks open the page follows it too.
          if (next.drillTo === from) next = { ...next, drillTo: to }
          return next
        }),
      }
    }
    if (!page.tabs?.some(t => t.page === from)) return page
    changed = true
    return { ...page, tabs: page.tabs.map(t => (t.page === from ? { ...t, page: to } : t)) }
  })
  return changed ? next : pages
}

/** The tabs pages that embed the page with `id`. */
export function pagesEmbedding(pages: FullstackPageDef[], id: string): FullstackPageDef[] {
  return pages.filter(p => p.type === 'tabs' && (p.tabs ?? []).some(t => t.page === id))
}

/** The widgets of every page without their references to page `id`: a links widget stops
 *  offering it, and a widget whose clicks opened it goes back to its entity's own list. */
function dropWidgetLinksTo(pages: FullstackPageDef[], id: string): FullstackPageDef[] {
  return pages.map(page => {
    if (!page.widgets?.some(w => w.pages?.includes(id) || w.drillTo === id)) return page
    return {
      ...page,
      widgets: page.widgets.map(w => {
        let next = w.pages?.includes(id) ? { ...w, pages: w.pages.filter(k => k !== id) } : w
        if (next.drillTo === id) {
          const { drillTo: _drillTo, ...kept } = next
          next = kept
        }
        return next
      }),
    }
  })
}

/** Drops the tabs, links and click targets pointing at `id` (the page is being removed). */
export function dropTabsTo(pages: FullstackPageDef[], id: string): FullstackPageDef[] {
  return dropWidgetLinksTo(pages, id).map(page => (page.tabs?.some(t => t.page === id) ? { ...page, tabs: page.tabs.filter(t => t.page !== id) } : page))
}

/** The layout without the page at `index`, and without what pointed at it: links widgets stop
 *  offering it, widgets whose clicks opened it go back to their entity's own list and, when it was
 *  an entity's only record page, list pages that opened that entity's rows there fall back to the
 *  default. Tabs that embed it go only with `dropTabs` — the editor asks first, since that changes
 *  another page. */
export function removePageAt(pages: FullstackPageDef[], index: number, dropTabs = true): FullstackPageDef[] {
  const removed = pages[index]
  if (!removed) return pages
  const rest = pages.filter((_, i) => i !== index)
  let next = dropWidgetLinksTo(rest, removed.id)
  if (dropTabs) next = next.map(page => (page.tabs?.some(t => t.page === removed.id) ? { ...page, tabs: page.tabs.filter(t => t.page !== removed.id) } : page))
  const entity = removed.entity
  if (removed.type === 'record' && entity && !next.some(p => p.type === 'record' && sameName(p.entity, entity))) {
    next = next.map(page => {
      if (page.type !== 'entity-list' || page.detail !== 'record' || !sameName(page.entity, entity)) return page
      const { detail: _detail, ...kept } = page
      return kept
    })
  }
  return next
}

/** Follows a relation rename on `child` (the entity that owns it) into every reference a layout
 *  can hold: list and list-widget columns, wizard steps, report and top-list groupings, record
 *  tabs and tiles, master-detail links and dashboard filters. */
export function renameRelationInPages(pages: FullstackPageDef[], child: string, from: string, to: string): FullstackPageDef[] {
  if (!child || !from || !to || from === to) return pages
  const isChild = (name: string | undefined) => name != null && name.trim().toLowerCase() === child.trim().toLowerCase()
  const cols = (list: string[] | undefined) => (list?.includes(from) ? list.map(k => (k === from ? to : k)) : list)
  let changed = false
  const next = pages.map(page => {
    const out: FullstackPageDef = { ...page }
    if (page.type === 'entity-list' && isChild(page.entity) && page.columns?.includes(from)) out.columns = cols(page.columns)
    if (page.type === 'wizard' && isChild(page.entity) && page.steps?.some(step => step.fields.includes(from))) {
      out.steps = page.steps.map(step => ({ ...step, fields: step.fields.map(name => (name === from ? to : name)) }))
    }
    if (page.type === 'report' && isChild(page.entity) && reportCharts(page).some(c => c.groupBy === from)) {
      const follow = (c: FullstackChartDef) => (c.groupBy === from ? { ...c, groupBy: to } : c)
      if (page.charts?.length) out.charts = page.charts.map(follow)
      else out.chart = follow(page.chart ?? {})
    }
    if (page.widgets?.some(w => isChild(w.entity) && (w.groupBy === from || w.columns?.includes(from)))) {
      out.widgets = page.widgets.map(w => {
        if (!isChild(w.entity) || (w.groupBy !== from && !w.columns?.includes(from))) return w
        return { ...w, ...(w.groupBy === from ? { groupBy: to } : {}), ...(w.columns?.includes(from) ? { columns: cols(w.columns) } : {}) }
      })
    }
    if (page.type === 'record' && (page.childTabs?.some(t => isChild(childTabEntity(t)) && childTabVia(t) === from)
      || page.headerStats?.some(st => isChild(st.child) && st.via === from))) {
      out.childTabs = page.childTabs?.map(t => (isChild(childTabEntity(t)) && childTabVia(t) === from ? withChildTab(t, { via: to }) : t))
      out.headerStats = page.headerStats?.map(st => (isChild(st.child) && st.via === from ? { ...st, via: to } : st))
    }
    if (page.type === 'master-detail' && isChild(page.child) && page.via === from) out.via = to
    // A preset on the relation is keyed by its filter param, which follows the rename.
    const presetFrom = `${from}Id`
    const followPreset = (filter: Record<string, string> | undefined) => (filter && presetFrom in filter
      ? Object.fromEntries(Object.entries(filter).map(([k, v]) => [k === presetFrom ? `${to}Id` : k, v])) : filter)
    if (isChild(page.entity) && page.presetFilter && presetFrom in page.presetFilter) out.presetFilter = followPreset(page.presetFilter)
    if (page.widgets?.some(w => isChild(w.entity) && w.presetFilter && presetFrom in w.presetFilter)) {
      out.widgets = (out.widgets ?? page.widgets).map(w => (isChild(w.entity) ? { ...w, presetFilter: followPreset(w.presetFilter) } : w))
    }
    const filters = followFilterRename(page, isChild, from, to)
    if (filters) out.filters = filters
    Object.assign(out, renameRelationInNewPages(out, child, from, to))
    if (page.type === 'master-detail' && isChild(page.child) && page.columns?.includes(from)) out.columns = cols(page.columns)
    if (page.childTabs?.some(t => typeof t !== 'string' && isChild(t.entity) && t.columns?.includes(from))) {
      out.childTabs = (out.childTabs ?? page.childTabs).map(t => (typeof t !== 'string' && isChild(t.entity) && t.columns?.includes(from)
        ? withChildTab(t, { columns: cols(t.columns) }) : t))
    }
    if (JSON.stringify(out) === JSON.stringify(page)) return page
    changed = true
    return out
  })
  return changed ? next : pages
}

/**
 * Follows a renamed enum constant (or its display) on `entity.field` into the presets that name
 * it — a page's or a widget's `presetFilter` — and into a tab still titled with the constant's
 * derived label (the lists "Split into tabs" makes).
 */
export function renameEnumValueInPages(pages: FullstackPageDef[], entity: string, field: string, from: string, to: string): FullstackPageDef[] {
  if (!entity || !field || !from || !to || from === to) return pages
  const eq = (a: string | undefined, b: string) => a != null && a.trim().toLowerCase() === b.trim().toLowerCase()
  const follow = (filter: Record<string, string> | undefined): Record<string, string> | undefined => {
    if (!filter) return filter
    const key = Object.keys(filter).find(k => eq(k, field))
    if (key == null || !eq(filter[key], from)) return filter
    return { ...filter, [key]: to }
  }
  const moved = new Set<string>()
  let changed = false
  const next = pages.map(page => {
    const out: FullstackPageDef = { ...page }
    if (eq(page.entity, entity)) {
      const f = follow(page.presetFilter)
      if (f !== page.presetFilter) { out.presetFilter = f; moved.add(page.id) }
    }
    if (page.widgets?.some(w => eq(w.entity, entity) && follow(w.presetFilter) !== w.presetFilter)) {
      out.widgets = page.widgets.map(w => {
        const f = eq(w.entity, entity) ? follow(w.presetFilter) : w.presetFilter
        return f === w.presetFilter ? w : { ...w, presetFilter: f }
      })
    }
    // A board's lanes and limits name the constant too.
    Object.assign(out, renameEnumValueInNewPages(out, entity, field, from, to))
    if (JSON.stringify(out) === JSON.stringify(page)) return page
    changed = true
    return out
  })
  const oldTitle = humanizeConstant(from)
  const final = next.map(page => {
    if (page.type !== 'tabs' || !page.tabs?.some(t => moved.has(t.page) && t.title === oldTitle)) return page
    changed = true
    return { ...page, tabs: page.tabs.map(t => (moved.has(t.page) && t.title === oldTitle ? { ...t, title: humanizeConstant(to) } : t)) }
  })
  return changed ? final : pages
}

/** Page types a layout holds at most one of (per entity, or at all): a copy would be invalid
 *  the moment it was made, so the editor does not offer to duplicate them. */
const SINGLE_PAGE_TYPES: ReadonlySet<FullstackPageType> = new Set<FullstackPageType>(['record', 'wizard', 'form', 'import', 'search'])

/** Whether `page` creates its entity's rows (a wizard or a form) — a route of its own even when
 *  hidden, since New, a calendar's day and a record's Edit open it. */
export const createsRows = (page: FullstackPageDef): boolean => page.type === 'wizard' || page.type === 'form'

/** Whether the editor offers to duplicate `page`. */
export const canDuplicate = (page: FullstackPageDef): boolean => !SINGLE_PAGE_TYPES.has(page.type)

/** A copy of `page` under a fresh id and a "(copy)" title; the caller places it. The copy's id
 *  is minted, so it follows the copy's title again. A copy of a tab-only page goes in the nav:
 *  nothing embeds the copy, so hidden it could never be reached. */
export function duplicatePage(page: FullstackPageDef, taken: Iterable<string>): FullstackPageDef {
  const copy = JSON.parse(JSON.stringify(page)) as FullstackPageDef
  copy.id = uniquePageId(`${page.id || 'page'}-copy`.slice(0, 40).replace(/-+$/, ''), taken)
  copy.title = `${pageLabel(page)} (copy)`
  delete copy.idLocked
  if (copy.hidden) delete copy.hidden
  return copy
}

/** The layout as a request carries it: without the editor-only `idLocked` marks. */
export function requestPages(pages: FullstackPageDef[]): FullstackPageDef[] {
  return pages.map(p => Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'idLocked')) as FullstackPageDef)
}

// ── Splitting a list into tabs ──────────────────────────────────────────────

/** The values a preset filter on `field` can take: an enum's constants, a boolean's true/false. */
export const valuesOf = (field: { type: string; enumValues?: string[] } | undefined): string[] =>
  field?.type === 'BOOLEAN' ? ['true', 'false'] : (field?.enumValues ?? [])

/** Why a list page cannot be split into tabs by `field`, or undefined when it can. */
export function splitDisabledReason(page: FullstackPageDef, field: FullstackFieldDef | undefined, pages: FullstackPageDef[]): string | undefined {
  if (!field) return t('Pick a field to split by')
  const values = valuesOf(field)
  if (page.presetFilter?.[field.name] != null) return t('This list is already filtered on {name}', { name: field.name })
  if (values.length < MIN_TABS) return t('{name} needs at least {min} values to split by', { name: field.name, min: MIN_TABS })
  if (values.length > MAX_TABS) return t('{name} has {n} values; a tabs page takes at most {max}', { name: field.name, n: values.length, max: MAX_TABS })
  if (pages.length + values.length + 1 > MAX_PAGES) return t('Splitting would take the layout past {max} pages', { max: MAX_PAGES })
  return undefined
}

/**
 * The "queue" pattern in one step: one hidden, preset-filtered copy of `page` per value of
 * `field` (its columns, sort, view and page size carried over), under a new tabs page that shows
 * them side by side — inserted right after `page`, which stays as it is.
 */
export function splitListByField(page: FullstackPageDef, field: FullstackFieldDef, pages: FullstackPageDef[]): FullstackPageDef[] {
  const index = pages.findIndex(p => p.id === page.id)
  const taken = new Set(pages.map(p => p.id))
  const mint = (base: string) => {
    const id = uniquePageId(slugify(base) || 'page', taken)
    taken.add(id)
    return id
  }
  const entity = page.entity ?? ''
  const values = valuesOf(field)
  const tabLabel = (value: string) => (field.type === 'BOOLEAN' ? (value === 'true' ? 'Yes' : 'No') : enumLabel(field, value))
  const lists: FullstackPageDef[] = values.map(value => ({
    id: mint(field.type === 'BOOLEAN' ? `${entity}-${field.name}-${value}` : `${entity}-${value}`),
    type: 'entity-list',
    entity,
    hidden: true,
    presetFilter: { ...page.presetFilter, [field.name]: value },
    ...(page.columns ? { columns: [...page.columns] } : {}),
    ...(page.sort ? { sort: { ...page.sort } } : {}),
    ...(page.view ? { view: page.view } : {}),
    ...(page.pageSize ? { pageSize: page.pageSize } : {}),
  }))
  const fieldLabel = (field.label?.trim() || humanize(field.name)).toLowerCase()
  const tabs: FullstackPageDef = {
    id: mint(`${page.id}-by-${field.name}`),
    type: 'tabs',
    // The source list's own title, else its nav label (the entity's plural, as the generator names it).
    title: `${page.title?.trim() || pluralize(entity)} by ${fieldLabel}`,
    ...(page.group ? { group: page.group } : {}),
    ...(page.icon ? { icon: page.icon } : {}),
    tabs: lists.map((list, i) => ({ page: list.id, title: tabLabel(values[i]) })),
  }
  const next = [...pages]
  next.splice(index + 1, 0, tabs, ...lists)
  return next
}

// ── Suggestions for the "Add page" gallery ──────────────────────────────────

export interface PageSuggestion {
  key: string
  icon: string
  label: string
  blurb: string
  /** The page to add; `idBase` becomes its id once made unique. */
  page: Omit<FullstackPageDef, 'id'> & { idBase: string }
}

const sameName = (a: string | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Pages the model is shaped for and the layout lacks: a master-detail and a record page where
 * one entity points at another, a report for an entity with something to group by, a trend
 * dashboard for an entity with a date. At most `limit`, most specific first.
 */
export function suggestPages(entities: FullstackEntityDef[], pages: FullstackPageDef[], limit = 4): PageSuggestion[] {
  const named = entities.filter(e => e.name.trim())
  const out: PageSuggestion[] = []

  for (const child of named) {
    for (const r of child.relations ?? []) {
      if (r.type !== 'MANY_TO_ONE') continue
      const parent = named.find(e => sameName(e.name, r.targetEntity))
      if (!parent || parent === child || !singlePk(parent)) continue
      const key = `md:${parent.name}:${child.name}`
      if (out.some(s => s.key === key)) continue
      if (pages.some(p => p.type === 'master-detail' && sameName(p.parent, parent.name) && sameName(p.child, child.name))) continue
      const via = relationsTo(child, parent.name).length > 1 ? r.fieldName : undefined
      out.push({
        key,
        icon: PAGE_TYPE_META['master-detail'].icon,
        label: `${parent.name} → ${child.name}`,
        blurb: t('Pick a {entity} on the left, see its {entity2} rows on the right.', { entity: parent.name, entity2: child.name }),
        page: { idBase: parent.name, type: 'master-detail', parent: parent.name, child: child.name, ...(via ? { via } : {}), showParent: true },
      })
    }
  }
  for (const parent of named) {
    if (!singlePk(parent) || !named.some(c => c !== parent && relationsTo(c, parent.name).length > 0)) continue
    if (pages.some(p => p.type === 'record' && sameName(p.entity, parent.name))) continue
    out.push({
      key: `record:${parent.name}`,
      icon: PAGE_TYPE_META.record.icon,
      label: t('{entity} record', { entity: parent.name }),
      blurb: t('Open one {entity} with its related lists as tabs.', { entity: parent.name }),
      page: { idBase: parent.name, type: 'record', entity: parent.name, hidden: true },
    })
  }
  // A board or a calendar for an entity that already enables the view: a list page opening in it.
  for (const e of named) {
    const views = enabledListViews(e)
    const hasListIn = (view: FullstackListView) => pages.some(p => p.type === 'entity-list' && sameName(p.entity, e.name) && p.view === view)
    if (views.includes('kanban') && !hasListIn('kanban')) {
      const lane = e.fields.find(f => f.type === 'ENUM')?.name ?? e.fields.find(f => f.type === 'BOOLEAN')?.name ?? 'status'
      out.push({
        key: `board:${e.name}`,
        icon: 'view_kanban',
        label: t('{entity} board', { entity: e.name }),
        blurb: t('{entity} rows as cards, a lane per {lane} — drag one to move it.', { entity: e.name, lane }),
        page: { idBase: `${e.name}-board`, type: 'entity-list', entity: e.name, title: `${e.name} board`, view: 'kanban' },
      })
    }
    if (views.includes('calendar') && !hasListIn('calendar')) {
      const date = e.fields.find(f => isDateType(f.type))?.name ?? 'date'
      out.push({
        key: `calendar:${e.name}`,
        icon: 'calendar_month',
        label: t('{entity} calendar', { entity: e.name }),
        blurb: t('{entity} rows on a month grid, by {date}.', { entity: e.name, date }),
        page: { idBase: `${e.name}-calendar`, type: 'entity-list', entity: e.name, title: `${e.name} calendar`, view: 'calendar' },
      })
    }
  }
  for (const e of named) {
    const groupBy = defaultBarGroupBy(e)
    if (!groupBy || !groupByFields(e).some(f => f.name === groupBy)) continue
    if (pages.some(p => p.type === 'report' && sameName(p.entity, e.name))) continue
    const number = numericFields(e)[0]
    out.push({
      key: `report:${e.name}`,
      icon: PAGE_TYPE_META.report.icon,
      label: number ? t('{entity}: {field} by {groupBy}', { entity: e.name, field: number.name, groupBy }) : t('{entity} by {field}', { entity: e.name, field: groupBy }),
      blurb: t('Filters, a chart and grouped totals.'),
      page: {
        idBase: `${e.name}-report`,
        type: 'report',
        entity: e.name,
        chart: number ? { groupBy, agg: 'sum', field: number.name } : { groupBy },
      },
    })
  }
  for (const e of named) {
    const date = defaultLineGroupBy(e)
    if (!date) continue
    if (pages.some(p => (p.widgets ?? []).some(w => w.kind === 'line' && sameName(w.entity, e.name)))) continue
    const bar = defaultBarGroupBy(e)
    out.push({
      key: `trend:${e.name}`,
      icon: 'show_chart',
      label: t('{entity} trends', { entity: e.name }),
      blurb: t('A dashboard with {entity} counted per month.', { entity: e.name }),
      page: {
        idBase: `${e.name}-trends`,
        type: 'dashboard',
        title: `${e.name} trends`,
        widgets: [
          { kind: 'kpi', entity: e.name },
          { kind: 'line', entity: e.name, groupBy: date },
          ...(bar && groupableFields(e).some(f => f.name === bar) ? [{ kind: 'bar' as const, entity: e.name, groupBy: bar }] : []),
        ],
      },
    })
  }
  for (const e of named) {
    if (e.readOnly || askableFields(e).length < 6) continue
    if (pages.some(p => createsRows(p) && sameName(p.entity, e.name))) continue
    out.push({
      key: `wizard:${e.name}`,
      icon: PAGE_TYPE_META.wizard.icon,
      label: t('New {entity} wizard', { entity: e.name }),
      blurb: t('{n} fields is a long form — ask for them step by step.', { n: askableFields(e).length }),
      page: { idBase: `new-${e.name}`, type: 'wizard', entity: e.name, title: `New ${e.name}`, steps: defaultWizardSteps(e) },
    })
  }
  return out.slice(0, limit)
}

// ── Suggestions for the designer's widget library ───────────────────────────

export interface WidgetSuggestion {
  key: string
  icon: string
  label: string
  blurb: string
  /** The widget to add, settings and all. */
  widget: FullstackWidgetDef
}

/** What a widget shows, for spotting one the dashboard already has: its kind (a donut is a bar
 *  drawn round), entity, grouping (defaults resolved), aggregate and field. */
function widgetShape(w: FullstackWidgetDef, entity: FullstackEntityDef | undefined): string {
  const kind = w.kind === 'donut' ? 'bar' : w.kind
  const groupBy = w.groupBy ?? (kind === 'line' ? defaultLineGroupBy(entity) : kind === 'bar' || kind === 'top' ? defaultTopGroupBy(entity) : undefined)
  const agg = w.agg ?? 'count'
  return [kind, (w.entity ?? '').trim().toLowerCase(), groupBy ?? '', agg, agg === 'count' ? '' : w.field ?? ''].join('|')
}

/**
 * Ready-made widgets for one entity on one dashboard — a count, the total of its money (or other
 * number) column, a breakdown by its first enum/boolean, a trend over its first date, its top
 * related records, its latest rows — leaving out what the dashboard already shows. Each one is run
 * through the validator on the dashboard first, so a suggestion is valid the moment it is added.
 */
export function suggestWidgets(entity: FullstackEntityDef | undefined, pages: FullstackPageDef[], pageIndex: number,
                               context: { entities: FullstackEntityDef[]; scaffoldOpts?: string[] }, limit = 6): WidgetSuggestion[] {
  const dashboard = pages[pageIndex]
  if (!entity || !entity.name.trim() || dashboard?.type !== 'dashboard') return []
  const name = entity.name.trim()
  const plural = pluralize(name)
  const labelOf = (f: FullstackFieldDef) => f.label?.trim() || humanize(f.name)
  const candidates: WidgetSuggestion[] = [{
    key: 'count', icon: 'counter_1', label: t('Number of {plural}', { plural }), blurb: t('A tile counting the rows'),
    widget: { kind: 'kpi', entity: name },
  }]
  const numbers = numericFields(entity)
  const money = numbers.find(f => f.type === 'MONEY') ?? numbers.find(f => f.type === 'BIG_DECIMAL') ?? numbers[0]
  if (money) {
    candidates.push({
      key: `sum:${money.name}`, icon: 'functions', label: t('Total {field}', { field: labelOf(money).toLowerCase() }), blurb: t('A tile summing {money} over every {name}', { money: labelOf(money), name }),
      widget: { kind: 'kpi', entity: name, agg: 'sum', field: money.name },
    })
  }
  const group = defaultBarGroupBy(entity)
  const groupField = entity.fields.find(f => f.name === group)
  if (groupField) {
    candidates.push({
      key: `donut:${groupField.name}`, icon: 'donut_large', label: t('{plural} by {field}', { plural, field: labelOf(groupField).toLowerCase() }), blurb: t('Shares of each value, as a ring'),
      widget: { kind: 'donut', entity: name, groupBy: groupField.name },
    })
  }
  const date = dateFields(entity)[0]
  if (date) {
    candidates.push({
      key: `line:${date.name}`, icon: 'show_chart', label: t('{plural} over time', { plural }), blurb: t('Counted per month of {date}', { date: labelOf(date) }),
      widget: { kind: 'line', entity: name, groupBy: date.name, bucket: 'month' },
    })
  }
  const relation = (entity.relations ?? []).find(r => r.type === 'MANY_TO_ONE' && r.fieldName.trim())
  if (relation) {
    candidates.push({
      key: `top:${relation.fieldName}`, icon: 'format_list_numbered', label: t('Top {relation} by {plural}', { relation: relationLabel(relation).toLowerCase(), plural: plural.toLowerCase() }),
      blurb: t('The {targetEntity} records with the most {plural}', { targetEntity: relation.targetEntity, plural }),
      widget: { kind: 'top', entity: name, groupBy: relation.fieldName, limit: 5 },
    })
  }
  candidates.push({
    key: 'recent', icon: 'list', label: t('Latest {plural}', { plural: plural.toLowerCase() }), blurb: t('The newest rows, each opening its record'),
    widget: { kind: 'recent', entity: name, limit: 5 },
  })

  const widgets = dashboard.widgets ?? []
  if (widgets.length >= MAX_WIDGETS) return []
  const shown = new Set(widgets.map(w => widgetShape(w, context.entities.find(e => e.name.trim().toLowerCase() === (w.entity ?? '').trim().toLowerCase()))))
  const at = widgets.length
  return candidates
    .filter(c => !shown.has(widgetShape(c.widget, entity)))
    .filter(c => {
      const trial = pages.map((p, i) => (i === pageIndex ? { ...p, widgets: [...widgets, c.widget] } : p))
      const errors = validatePages(trial, context.entities, { scaffoldOpts: context.scaffoldOpts }).byPage[pageIndex] ?? {}
      return !Object.keys(errors).some(k => k === `widget.${at}` || k.startsWith(`widget.${at}.`))
    })
    .slice(0, limit)
}

/** Materializes a suggestion under a free id. */
export function pageFromSuggestion(s: PageSuggestion, taken: Iterable<string>): FullstackPageDef {
  const { idBase, ...rest } = JSON.parse(JSON.stringify(s.page)) as PageSuggestion['page']
  return { id: uniquePageId(slugify(idBase) || 'page', taken), ...rest }
}


// ── New pages, and a page moved to another type ─────────────────────────────

/** A new page of `type`, filled in with the first entities (and pages) that fit so it is valid on sight. */
export function blankPage(type: FullstackPageType, entities: FullstackEntityDef[], pages: FullstackPageDef[], pick?: string): FullstackPageDef {
  const taken = pages.map(p => p.id)
  const picked = pick != null ? entities.find(e => e.name === pick) : undefined
  const first = picked?.name ?? entities[0]?.name ?? ''
  const id = (base: string) => uniquePageId(slugify(base) || 'page', taken)
  switch (type) {
    case 'dashboard':
      return { id: id('dashboard'), type, widgets: entities.slice(0, 4).map(e => ({ kind: 'kpi', entity: e.name })) }
    case 'entity-list':
      return { id: id(first), type, entity: first }
    case 'tabs': {
      // Start from two pages that can be tabs — lists first — so the page is valid straight away.
      const picked = tabCandidates(pages).slice(0, 2)
      return { id: id('tabs'), type, title: 'Tabs', tabs: picked.map(p => ({ page: p.id })) }
    }
    case 'master-detail': {
      const pairs = masterDetailPairs(entities)
      const pair = pairs.find(p => pairKey(p) === pick) ?? pairs[0]
      return { id: id(pair?.parent ?? first), type, parent: pair?.parent ?? first, child: pair?.child, ...(pair?.via ? { via: pair.via } : {}), showParent: true }
    }
    case 'record':
      return { id: id(first), type, entity: first, hidden: true }
    case 'report': {
      // Prefer an entity that actually has something to chart, so the page is valid on sight.
      const e = picked ?? entities.find(x => chartableFields(x).length > 0) ?? entities[0]
      return { id: id(`${e?.name ?? 'report'}-report`), type, entity: e?.name ?? first, chart: {} }
    }
    case 'wizard': {
      // A writable entity, with its default steps spelled out so they can be edited.
      const e = picked ?? entities.find(x => !x.readOnly && askableFields(x).length > 0) ?? entities[0]
      return { id: id(`new-${e?.name ?? 'record'}`), type, entity: e?.name ?? first, title: `New ${e?.name ?? 'record'}`, steps: defaultWizardSteps(e) }
    }
    case 'form': {
      // A writable entity without a wizard or form of its own.
      const e = picked ?? entities.find(x => !x.readOnly && !pages.some(p => createsRows(p) && sameName(p.entity, x.name))) ?? entities[0]
      return { id: id(`new-${e?.name ?? 'record'}`), type, entity: e?.name ?? first, title: `New ${e?.name ?? 'record'}` }
    }
    case 'calendar':
    case 'board':
    case 'inbox':
    case 'import': {
      // The picked entity, else the first one the type fits.
      const e = picked ?? entities.find(x => !newTypeReason(type, x, pages)) ?? entities[0]
      return blankNewTypePage(type, e, entities, id)
    }
    case 'content':
    case 'search':
      return blankNewTypePage(type, undefined, entities, id)
    case 'tree': {
      // The picked entity, else the first one that points at itself.
      const e = picked ?? entities.find(x => !treeReason(x)) ?? entities[0]
      return { id: id(`${e?.name ?? 'rows'}-tree`), type, entity: e?.name ?? first, title: `${e?.name ?? 'Rows'} tree` }
    }
  }
}

/** One entity (or, for a master–detail page, one parent → child pair) a new page can be about. */
export interface NewPageChoice { value: string; label: string; reason?: string }

/** The key of a master–detail pair, as `blankPage`'s `pick` takes it. */
export const pairKey = (p: { parent: string; child: string; via?: string }) => `${p.parent}>${p.child}${p.via ? `.${p.via}` : ''}`

/**
 * What a new page of `type` can be about, each with the reason it cannot be when it cannot — the
 * rules `validatePages` (and the server) apply, so the gallery never adds a page that is wrong on
 * sight. `null` for the types that take no entity (dashboard, tabs).
 */
export function newPageChoices(type: FullstackPageType, entities: FullstackEntityDef[], pages: FullstackPageDef[]): NewPageChoice[] | null {
  const named = entities.filter(e => e.name.trim())
  const has = (type: FullstackPageType, name: string) => pages.some(p => p.type === type && p.entity?.trim().toLowerCase() === name.trim().toLowerCase())
  const one = (e: FullstackEntityDef, reason?: string): NewPageChoice => ({ value: e.name, label: e.name, ...(reason ? { reason } : {}) })
  switch (type) {
    case 'dashboard':
    case 'tabs':
      return null
    case 'entity-list':
      return named.map(e => one(e))
    case 'record':
      return named.map(e => one(e, !singlePk(e) ? t('Needs a single primary key') : has('record', e.name) ? t('Already has a record page') : undefined))
    case 'report':
      return named.map(e => one(e, reportGroupKeys(e).length === 0 ? t('Nothing to chart — no enum, boolean or date field, nor a relation') : undefined))
    case 'wizard':
      return named.map(e => one(e, e.readOnly ? t('Read-only — nothing to create')
        : askableFields(e).length === 0 ? t('No fields to ask for')
          : has('wizard', e.name) ? t('Already has a wizard')
            : has('form', e.name) ? t('Already has a form page') : undefined))
    case 'form':
      return named.map(e => one(e, e.readOnly ? t('Read-only — nothing to create')
        : has('form', e.name) ? t('Already has a form page')
          : has('wizard', e.name) ? t('Already has a wizard') : undefined))
    case 'master-detail':
      return masterDetailPairs(named).map(p => ({ value: pairKey(p), label: `${p.parent} → ${p.child}${p.via ? ` (${t('via {relation}', { relation: p.via })})` : ''}` }))
    case 'calendar':
    case 'board':
    case 'inbox':
    case 'import':
      return named.map(e => one(e, newTypeReason(type, e, pages)))
    case 'content':
    case 'search':
      return null
    case 'tree':
      return named.map(e => one(e, treeReason(e)))
  }
}

/** Why a new page of a type that takes no entity cannot be added, or undefined when it can. */
export function newPageTypeReason(type: FullstackPageType, entities: FullstackEntityDef[], pages: FullstackPageDef[]): string | undefined {
  return type === 'search' ? newSearchReason(entities, pages) : undefined
}

/** The pages a links widget can open: any but a record page (it needs a row) or a hidden page
 *  that is not a wizard (a hidden wizard is a route of its own). */
export function linkablePages(pages: FullstackPageDef[]): FullstackPageDef[] {
  return pages.filter(p => p.type !== 'record' && (!p.hidden || createsRows(p) || p.type === 'search'))
}

/** The pages a new tabs page can embed, lists first: not a tabs or record page, not already a tab. */
export function tabCandidates(pages: FullstackPageDef[]): FullstackPageDef[] {
  const free = pages.filter(p => p.type !== 'tabs' && p.type !== 'record' && pagesEmbedding(pages, p.id).length === 0)
  return [...free.filter(p => p.type === 'entity-list'), ...free.filter(p => p.type !== 'entity-list')]
}

/** Every parent → child pair a master-detail page can show: a MANY_TO_ONE from the child to a
 *  single-key parent in the model, with `via` set where the child has several such relations. */
export function masterDetailPairs(entities: FullstackEntityDef[]): { parent: string; child: string; via?: string }[] {
  const named = entities.filter(e => e.name.trim())
  const eq = (a: string | undefined, b: string) => a != null && a.trim().toLowerCase() === b.trim().toLowerCase()
  const out: { parent: string; child: string; via?: string }[] = []
  for (const child of named) {
    for (const r of child.relations ?? []) {
      if (r.type !== 'MANY_TO_ONE') continue
      const parent = named.find(e => eq(e.name, r.targetEntity))
      if (!parent || parent === child || !singlePk(parent)) continue
      if (out.some(p => p.parent === parent.name && p.child === child.name)) continue
      out.push({ parent: parent.name, child: child.name, ...(relationsTo(child, parent.name).length > 1 ? { via: r.fieldName } : {}) })
    }
  }
  return out
}

/**
 * A page changed to another type, keeping what the new type can use — its id, title, description,
 * roles, nav place and (where the type takes one) its entity and filter — and starting the rest
 * from `blankPage`. `dropped` names what had to go, so the editor can say so instead of wiping silently.
 */
export function retargetPage(page: FullstackPageDef, type: FullstackPageType, entities: FullstackEntityDef[],
                             pages: FullstackPageDef[]): { page: FullstackPageDef; dropped: string[] } {
  if (type === page.type) return { page, dropped: [] }
  const eq = (a: string | undefined, b: string | undefined) => a != null && b != null && a.trim().toLowerCase() === b.trim().toLowerCase()
  const named = entities.filter(e => e.name.trim())
  const base = blankPage(type, named, pages.filter(p => p.id !== page.id))
  const next: FullstackPageDef = { ...base, id: page.id }
  if (page.idLocked) next.idLocked = true
  if (page.title?.trim()) next.title = page.title
  if (page.description?.trim()) next.description = page.description
  if (page.roles?.length) next.roles = page.roles
  if (type === 'record') next.hidden = true
  else if (page.hidden) next.hidden = true
  else delete next.hidden
  if (inNav(next)) {
    if (page.group) next.group = page.group
    if (page.icon) next.icon = page.icon
  }

  // The entity follows where the new type can take it as the blank page would have picked it.
  const was = page.entity ?? page.parent
  const e = named.find(x => eq(x.name, was))
  if (e) {
    if (type === 'entity-list') next.entity = e.name
    else if (type === 'record' && singlePk(e)) next.entity = e.name
    else if (type === 'report' && chartableFields(e).length > 0) next.entity = e.name
    else if (type === 'wizard' && !e.readOnly && askableFields(e).length > 0) {
      next.entity = e.name
      next.steps = defaultWizardSteps(e)
      if (!page.title?.trim()) next.title = `New ${e.name}`
    } else if (type === 'form' && !e.readOnly) {
      next.entity = e.name
      if (!page.title?.trim()) next.title = `New ${e.name}`
    } else if ((type === 'calendar' || type === 'board' || type === 'inbox' || type === 'import') && !newTypeReason(type, e, pages.filter(p => p.id !== page.id))) {
      // The entity follows, with its own date / lane field.
      const { id: _id, title: _title, ...fitted } = blankNewTypePage(type, e, named, () => page.id)
      Object.assign(next, fitted)
    } else if (type === 'master-detail') {
      const pair = masterDetailPairs(named).find(p => eq(p.parent, e.name))
      if (pair) {
        next.parent = pair.parent
        next.child = pair.child
        if (pair.via) next.via = pair.via
        else delete next.via
      }
    }
  }
  if ((type === 'entity-list' || type === 'report' || type === 'calendar' || type === 'board') && page.presetFilter && eq(next.entity, was)) {
    const kept = keptPresetFilter(page.presetFilter, e)
    if (kept) next.presetFilter = kept
  }

  const dropped: string[] = []
  const lost = (had: unknown, has: unknown, label: string) => { if (had != null && has == null) dropped.push(label) }
  const nowEntity = next.entity ?? next.parent
  if (was && !eq(nowEntity, was)) dropped.push(t('entity'))
  lost(page.presetFilter, next.presetFilter, t('filter'))
  lost(page.columns, next.columns, t('columns'))
  lost(page.sort, next.sort, t('sort'))
  lost(page.view, next.view, t('view'))
  lost(page.pageSize, next.pageSize, t('page size'))
  if (type === 'entity-list' && page.hideActions?.length) next.hideActions = page.hideActions
  lost(page.hideActions, next.hideActions, t('hidden actions'))
  if (type === 'record' && page.printable) next.printable = true
  lost(page.printable, next.printable, t('Print button'))
  lost(page.widgets, next.widgets, t('widgets'))
  lost(page.dateRange, next.dateRange, t('period picker'))
  lost(page.refreshSeconds, next.refreshSeconds, t('auto-refresh'))
  lost(page.filters, next.filters, t('dashboard filters'))
  lost(page.tabs, next.tabs, t('tabs'))
  if (page.type === 'master-detail' && type !== 'master-detail') dropped.push(t('child list'))
  lost(page.chart ?? page.charts, next.chart ?? next.charts, t('charts'))
  lost(page.steps, next.steps, t('wizard steps'))
  lost(page.childTabs, next.childTabs, t('related lists'))
  lost(page.headerStats, next.headerStats, t('header numbers'))
  lost(page.endField, next.endField, t('end date'))
  lost(page.cardFields, next.cardFields, t('card fields'))
  lost(page.wipLimits, next.wipLimits, t('lane limits'))
  lost(page.body, next.body, t('text'))
  lost(page.entities, next.entities, t('searched entities'))
  if ((page.group || page.icon) && !inNav(next)) dropped.push(t('nav place'))
  return { page: next, dropped }
}

// ── Undo labels ──────────────────────────────────────────────────────────────

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

// ── Keeping settings across a kind / entity switch ──────────────────────────

/** Preset-filter entries that still apply to `entity` (a filterable enum/boolean with that value). */
export function keptPresetFilter(filter: Record<string, string> | undefined, entity: FullstackEntityDef | undefined): Record<string, string> | undefined {
  if (!filter) return undefined
  const presettable = presettableFields(entity)
  const kept: Record<string, string> = {}
  for (const [k, v] of Object.entries(filter)) {
    const f = presettable.find(x => x.name === k)
    if (f ? !presetValueProblem(f, v) : relationOfPresetKey(entity, k) != null) kept[k] = v
  }
  return Object.keys(kept).length ? kept : undefined
}

/**
 * A widget moved to another kind and/or entity, keeping every setting the new combination can
 * still use. `dropped` names what had to go, so the editor can say so instead of wiping silently.
 */
export function retargetWidget(widget: FullstackWidgetDef, patch: { kind?: FullstackWidgetDef['kind']; entity?: string },
                               entity: FullstackEntityDef | undefined, scaffoldOpts: string[] = []): { widget: FullstackWidgetDef; dropped: string[] } {
  const kind = patch.kind ?? widget.kind
  const next: FullstackWidgetDef = { ...widget, ...patch, kind }
  const dropped: string[] = []
  const drop = (keys: (keyof FullstackWidgetDef)[], label: string) => {
    if (keys.some(k => next[k] != null)) dropped.push(label)
    for (const k of keys) delete next[k]
  }
  if (kind === 'activity') {
    const kept: FullstackWidgetDef = { kind, entity: '', ...(next.title ? { title: next.title } : {}) }
    if (next.entities?.length) kept.entities = next.entities
    if (next.limit != null && next.limit >= MIN_ACTIVITY_LIMIT && next.limit <= MAX_RECENT_LIMIT) kept.limit = next.limit
    if (next.span != null && next.span !== defaultSpan(kind)) kept.span = next.span
    const lost = (['groupBy', 'agg', 'sortBy', 'compare', 'trend', 'target', 'presetFilter', 'dateField', 'series', 'columns', 'sort'] as const)
      .filter(k => next[k] != null)
    const dropped = lost.length ? [t('data settings')] : []
    if (next.drillTo != null) dropped.push(t('click target'))
    return { widget: kept, dropped }
  }
  if (next.entities != null) drop(['entities'], t('entities'))
  if (kind === 'text' || kind === 'links') {
    const kept: FullstackWidgetDef = { kind, entity: '', ...(next.title ? { title: next.title } : {}) }
    if (kind === 'text' && next.text) kept.text = next.text
    if (kind === 'links') kept.pages = next.pages ?? []
    if (next.span != null && next.span !== defaultSpan(kind)) kept.span = next.span
    const lost = (['groupBy', 'agg', 'limit', 'sortBy', 'compare', 'trend', 'target', 'presetFilter', 'dateField', 'series'] as const)
      .filter(k => next[k] != null)
    const dropped = lost.length ? [t('data settings')] : []
    if (next.drillTo != null) dropped.push(t('click target'))
    if (kind === 'links' && next.text != null) dropped.push(t('text'))
    if (kind === 'text' && next.pages != null) dropped.push(t('pages'))
    return { widget: kept, dropped }
  }
  if (next.text != null) drop(['text'], t('text'))
  if (next.pages != null) drop(['pages'], t('pages'))
  // The click target is a page of the old entity.
  if (next.drillTo != null && patch.entity != null && !sameName(patch.entity, widget.entity ?? '')) drop(['drillTo'], t('click target'))
  if (kind === 'list') {
    if (next.columns) {
      const keys = listColumns(entity, scaffoldOpts).map(c => c.key)
      const kept = next.columns.filter(k => keys.includes(k))
      if (kept.length < next.columns.length) dropped.push(t('columns'))
      if (kept.length) next.columns = kept
      else delete next.columns
    }
    if (next.sort && !sortableKeys(entity, scaffoldOpts).includes(next.sort.field)) drop(['sort'], t('sort'))
    if (next.limit != null && !LIST_WIDGET_LIMITS.includes(next.limit)) drop(['limit'], t('row limit'))
  } else {
    if (next.columns != null) drop(['columns'], t('columns'))
    if (next.sort != null) drop(['sort'], t('sort'))
  }
  if (next.groupBy != null) {
    const fits = kind === 'bar' || kind === 'donut' || kind === 'pivot' ? rankableKeys(entity).includes(next.groupBy)
      : kind === 'stacked' ? groupByFields(entity).some(f => f.name === next.groupBy)
      : kind === 'line' ? dateFields(entity).some(f => f.name === next.groupBy)
        : kind === 'top' ? rankableKeys(entity).includes(next.groupBy)
          : kind === 'funnel' ? funnelStageFields(entity).some(f => f.name === next.groupBy)
            : false
    if (!fits) drop(['groupBy'], t('group by'))
  }
  if (kind !== 'line') drop(['bucket'], t('bucket'))
  if (next.series != null && (kind === 'pivot'
    ? !rankableKeys(entity).includes(next.series) || next.series === next.groupBy
    : kind !== 'stacked' || !groupByFields(entity).some(f => f.name === next.series))) drop(['series'], t('split by'))
  if (kind === 'recent' || kind === 'list' || kind === 'timeInState') drop(['agg', 'field'], t('aggregate'))
  else if (kind === 'funnel' && next.agg && next.agg !== 'count' && next.agg !== 'sum') drop(['agg', 'field'], t('aggregate'))
  else if (next.field != null && !numericFields(entity).some(f => f.name === next.field)) drop(['agg', 'field'], t('aggregate'))
  if (kind !== 'recent' && kind !== 'top' && kind !== 'list') drop(['limit'], t('row limit'))
  if (next.sortBy != null && (kind !== 'recent' || !((entity?.fields ?? []).some(f => !f.primaryKey && f.name === next.sortBy)
    || (auditOn(entity, scaffoldOpts) && (next.sortBy === 'createdAt' || next.sortBy === 'updatedAt'))))) {
    drop(['sortBy'], t('sort'))
  }
  if (kind !== 'kpi') drop(['compare'], t('period comparison'))
  if (kind !== 'kpi') drop(['trend'], t('trend line'))
  if (kind === 'kpi' && next.trend && dateFields(entity).length === 0) drop(['trend'], t('trend line'))
  if (kind !== 'progress' && kind !== 'gauge') drop(['target'], t('target'))
  // Time in state reads the move log, which nothing here filters.
  if (kind === 'timeInState') {
    if (next.presetFilter && Object.keys(next.presetFilter).length > 0) drop(['presetFilter'], t('filter'))
    drop(['dateField'], t('period date'))
    drop(['drillTo'], t('click target'))
  }
  // A trend may name any date; the period picker only a filterable one.
  const dated = kind === 'kpi' && next.trend ? dateFields(entity) : filterableDateFields(entity)
  if (next.dateField != null && !dated.some(f => f.name === next.dateField)) drop(['dateField'], t('period date'))
  if (next.presetFilter) {
    const kept = keptPresetFilter(next.presetFilter, entity)
    if (Object.keys(kept ?? {}).length < Object.keys(next.presetFilter).length) dropped.push(t('filter'))
    if (kept) next.presetFilter = kept
    else delete next.presetFilter
  }
  if (next.span != null && next.span === defaultSpan(kind)) delete next.span
  return { widget: next, dropped }
}

/** A list page moved to another entity: the filter, columns, sort and view keep whatever the new
 *  entity also has; `dropped` names what had to go. */
export function retargetEntityList(page: FullstackPageDef, entity: FullstackEntityDef | undefined,
                                   scaffoldOpts: string[] = []): { patch: Partial<FullstackPageDef>; dropped: string[] } {
  const dropped: string[] = []
  const presetFilter = keptPresetFilter(page.presetFilter, entity)
  if (Object.keys(presetFilter ?? {}).length < Object.keys(page.presetFilter ?? {}).length) dropped.push(t('filter'))
  let columns = page.columns
  if (columns) {
    const keys = listColumns(entity, scaffoldOpts).map(c => c.key)
    const kept = columns.filter(k => keys.includes(k))
    if (kept.length < columns.length) dropped.push(t('columns'))
    columns = kept.length ? kept : undefined
  }
  let sort = page.sort
  if (sort && !sortableKeys(entity, scaffoldOpts).includes(sort.field)) {
    dropped.push(t('sort'))
    sort = undefined
  }
  let view = page.view
  if (view && !enabledListViews(entity).includes(view)) {
    dropped.push(t('view'))
    view = undefined
  }
  let detail = page.detail
  if (detail === 'side' && entity && !singlePk(entity)) {
    dropped.push(t('side pane'))
    detail = undefined
  }
  return { patch: { entity: entity?.name ?? page.entity, presetFilter, columns, sort, view, detail }, dropped }
}

/** A master-detail page moved to another parent: the child stays when it still relates to the new
 *  parent (a lone candidate is picked, as before), and the link when it is still one of the child's. */
export function retargetMasterDetail(page: FullstackPageDef, parent: string, entities: FullstackEntityDef[]): { patch: Partial<FullstackPageDef>; dropped: string[] } {
  const dropped: string[] = []
  const kids = entities.filter(e => relationsTo(e, parent).length > 0)
  let child = page.child
  if (child && !kids.some(e => e.name === child)) {
    dropped.push(t('child'))
    child = undefined
  }
  if (!child && kids.length === 1) child = kids[0].name
  let via = page.via
  if (via && !relationsTo(entities.find(e => e.name === child), parent).includes(via)) {
    dropped.push(t('linked-through relation'))
    via = undefined
  }
  return { patch: { parent, child, via }, dropped }
}

/** A master-detail page moved to another child: the link stays when the new child also has it. */
export function retargetMasterDetailChild(page: FullstackPageDef, child: string, entities: FullstackEntityDef[]): { patch: Partial<FullstackPageDef>; dropped: string[] } {
  const dropped: string[] = []
  let via = page.via
  if (via && !relationsTo(entities.find(e => e.name === child), page.parent).includes(via)) {
    dropped.push(t('linked-through relation'))
    via = undefined
  }
  // The child list's columns and sort named the old child's columns.
  if (page.columns) dropped.push(t('columns'))
  if (page.sort) dropped.push(t('sort'))
  return { patch: { child, via, columns: undefined, sort: undefined }, dropped }
}

/** A record page moved to another entity: its related lists and header numbers described the old
 *  entity's relations, so both go back to the defaults. */
export function retargetRecord(page: FullstackPageDef, entity: string): { patch: Partial<FullstackPageDef>; dropped: string[] } {
  const dropped: string[] = []
  if (page.childTabs != null) dropped.push(t('related lists'))
  if (page.headerStats != null) dropped.push(t('header numbers'))
  return { patch: { entity, childTabs: undefined, headerStats: undefined }, dropped }
}

/** A dashboard whose period picker is switched off: its widgets' period date and comparison go with it. */
export function stripDateRange(page: FullstackPageDef): { patch: Partial<FullstackPageDef>; dropped: string[] } {
  const widgets = page.widgets ?? []
  const dropped: string[] = []
  if (widgets.some(w => w.dateField)) dropped.push(t('period date'))
  if (widgets.some(w => w.compare)) dropped.push(t('period comparison'))
  return {
    patch: {
      dateRange: undefined,
      widgets: widgets.map(w => (w.dateField || w.compare ? { ...w, dateField: undefined, compare: undefined } : w)),
    },
    dropped,
  }
}

/** A report page moved to another entity: the charts and filter keep whatever the new entity has. */
export function retargetReport(page: FullstackPageDef, entity: FullstackEntityDef | undefined): { patch: Partial<FullstackPageDef>; dropped: string[] } {
  const dropped: string[] = []
  const chartable = chartableFields(entity)
  const numeric = numericFields(entity)
  const charts = reportCharts(page).map(c => {
    const n: FullstackChartDef = { ...c }
    if (n.groupBy != null && !chartable.some(f => f.name === n.groupBy) && !relationKeys(entity).includes(n.groupBy)) {
      dropped.push(t('group by'))
      delete n.groupBy
      delete n.bucket
    }
    if (n.bucket != null && n.groupBy != null && !dateFields(entity).some(f => f.name === n.groupBy)) delete n.bucket
    const by = n.groupBy ?? defaultReportGroupBy(entity)
    const overTime = !!by && dateFields(entity).some(f => f.name === by)
    // Stacking needs a second enum/boolean to split by.
    if (n.kind && (!chartKindsFor(overTime, !!by && relationKeys(entity).includes(by)).some(k => k.value === n.kind)
      || (n.kind === 'stacked' && !defaultChartSeries(entity, by)))) {
      dropped.push(t('chart kind'))
      delete n.kind
    }
    if (n.series != null && (n.kind !== 'stacked' || n.series === by || !groupByFields(entity).some(f => f.name === n.series))) {
      if (n.kind === 'stacked') dropped.push(t('series'))
      delete n.series
    }
    if (n.field != null && !numeric.some(f => f.name === n.field)) {
      dropped.push(t('aggregate'))
      delete n.agg
      delete n.field
    }
    return n
  })
  const presetFilter = keptPresetFilter(page.presetFilter, entity)
  if (Object.keys(presetFilter ?? {}).length < Object.keys(page.presetFilter ?? {}).length) dropped.push(t('filter'))
  return {
    patch: {
      entity: entity?.name ?? page.entity,
      presetFilter,
      ...(charts.length <= 1 ? { chart: charts[0] ?? {}, charts: undefined } : { charts, chart: undefined }),
    },
    dropped: [...new Set(dropped)],
  }
}

/** A wizard moved to another entity: steps keep the fields the new entity also has (by name), and
 *  whatever else it asks for is dealt into steps after them. Falls back to the default steps.
 *  `dropped` names what did not carry over — the step layout, or just some fields — like the
 *  other retarget helpers, so the editor can say so with an undo. */
export function retargetWizardSteps(steps: { title?: string; fields: string[] }[] | undefined, entity: FullstackEntityDef | undefined): { steps: { title?: string; fields: string[] }[]; dropped: string[] } {
  const askable = stepFields(entity).map(a => a.name)
  const asked = (steps ?? []).flatMap(s => s.fields)
  const kept = (steps ?? []).map(s => ({ ...s, fields: s.fields.filter(f => askable.includes(f)) })).filter(s => s.fields.length > 0)
  const keptCount = kept.flatMap(s => s.fields).length
  // Keep the old shape only when it still covers most of the new form; otherwise start over.
  if (keptCount * 2 < askable.length) return { steps: defaultWizardSteps(entity), dropped: asked.length > 0 ? [t('step layout')] : [] }
  const placed = new Set(kept.flatMap(s => s.fields))
  const rest = askable.filter(a => !placed.has(a))
  for (let i = 0; i < rest.length; i += DEFAULT_STEP_SIZE) {
    if (kept.length >= MAX_STEPS) {
      kept[kept.length - 1].fields.push(...rest.slice(i))
      break
    }
    kept.push({ fields: rest.slice(i, i + DEFAULT_STEP_SIZE) })
  }
  return { steps: kept, dropped: keptCount < asked.length ? [t('fields')] : [] }
}

// ── Server errors ────────────────────────────────────────────────────────────

/**
 * Finds the page a server-side 400 is about: FullstackPageValidator names a page as
 * `Page '<id>'…` or `pages[<i>]…`. Null when the message is not about a page of this layout.
 */
export function pageOfServerError(message: string, pages: FullstackPageDef[]): number | null {
  const byId = /Page '([^']+)'/.exec(message)
  if (byId) {
    const i = pages.findIndex(p => p.id === byId[1])
    if (i >= 0) return i
  }
  const byIndex = /pages\[(\d+)\]/.exec(message)
  if (byIndex) {
    const i = Number(byIndex[1])
    if (i < pages.length) return i
  }
  return null
}
