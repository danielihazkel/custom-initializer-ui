import type {
  FullstackAgg,
  FullstackChartDef,
  FullstackChildTabDef,
  FullstackDateRange,
  FullstackEntityDef,
  FullstackFieldDef,
  FullstackListView,
  FullstackNavIcon,
  FullstackPageDef,
  FullstackPageRole,
  FullstackPageType,
  FullstackWidgetDef,
} from '../../types'
import { humanize, pluralize } from './naming'
import { enumLabel } from './enumLabels'
import { summarizeEntity } from './summary'

/**
 * The frontend page layout (`pages`) model: validation, the summary lines the editor shows, and
 * the two bulk operations (seed a layout from the entities, follow an entity rename).
 *
 * The checks mirror FullstackPageValidator so a broken layout shows up here, on the offending
 * control, instead of as a 400 on Generate.
 */

export const PAGE_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
export const MAX_PAGES = 30
export const MAX_WIDGETS = 24
export const MIN_TABS = 2
export const MAX_TABS = 6
export const MAX_CHILD_TABS = MAX_TABS - 1
export const MAX_RECENT_LIMIT = 20
export const MAX_GROUP = 40
export const MAX_SPAN = 4
export const MAX_CHARTS = 4
export const MAX_STEPS = 8
export const DEFAULT_STEP_SIZE = 4
export const MAX_HEADER_STATS = 4
export const MAX_TEXT = 2000
/** The pages one links widget can open. */
export const MAX_LINKS = 8
/** A list widget's rows per page: the pager's own sizes that fit a card. */
export const LIST_WIDGET_LIMITS = [10, 20]
/** The rows-per-page choices the generated pager offers — what a list page may open on. */
export const LIST_PAGE_SIZES = [10, 20, 50, 100]
export const DEFAULT_PAGE_SIZE = 20
export const LIST_VIEWS: { value: FullstackListView; label: string; icon: string }[] = [
  { value: 'table', label: 'Table', icon: 'table' },
  { value: 'cards', label: 'Cards', icon: 'grid_view' },
  { value: 'kanban', label: 'Board', icon: 'view_kanban' },
  { value: 'calendar', label: 'Calendar', icon: 'calendar_month' },
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
    .map(f => ({ key: f.name, label: f.label?.trim() || humanize(f.name), sortable: true, kind: 'field' as const }))
  for (const r of entity.relations ?? []) {
    if (r.type === 'MANY_TO_ONE' && r.fieldName.trim()) out.push({ key: r.fieldName, label: humanize(r.fieldName), sortable: false, kind: 'relation' })
  }
  if (auditOn(entity, scaffoldOpts)) {
    out.push({ key: 'createdAt', label: 'Created', sortable: true, kind: 'audit' }, { key: 'updatedAt', label: 'Updated', sortable: true, kind: 'audit' })
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
  if (view === 'kanban' && readOnly) return 'Kanban needs a writable entity'
  if (view === 'kanban' && !entity.fields.some(f => f.type === 'ENUM' || f.type === 'BOOLEAN')) return 'Kanban needs an enum or boolean field'
  if (view === 'calendar' && !entity.fields.some(f => f.type === 'LOCAL_DATE' || f.type === 'LOCAL_DATE_TIME')) return 'Calendar needs a date field'
  return `Not ticked in the list views of ${entity.name}`
}

/** What a wizard step can ask for: every field but a generated key, then the MANY_TO_ONE
 *  relations (by field name) — what the entity's form shows. */
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
  const names = askableFields(entity).map(f => f.name)
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
export function chartControl(index: number, key: 'groupBy' | 'bucket' | 'field'): string {
  return `${index === 0 ? 'chart' : `chart${index + 1}`}.${key}`
}

/** What a top list can rank by: a groupable field, or a MANY_TO_ONE relation (its field name). */
export function rankableKeys(entity: FullstackEntityDef | undefined): string[] {
  return [
    ...groupableFields(entity).map(f => f.name),
    ...(entity?.relations ?? []).filter(r => r.type === 'MANY_TO_ONE').map(r => r.fieldName),
  ]
}

/** What a top list ranks by when it names nothing: the first enum, else boolean, else relation. */
export function defaultTopGroupBy(entity: FullstackEntityDef | undefined): string | undefined {
  return defaultBarGroupBy(entity) ?? (entity?.relations ?? []).find(r => r.type === 'MANY_TO_ONE')?.fieldName
}

/** The dashboard period picker's options, in the order the generated picker shows them. */
export const DATE_RANGES: { value: FullstackDateRange; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'This year' },
  { value: '12m', label: 'Last 12 months' },
]

/** Grid columns a widget takes when it names none: a tile one, a chart or list two, a launcher the row. */
export function defaultSpan(kind: FullstackWidgetDef['kind']): number {
  return kind === 'kpi' || kind === 'progress' ? 1 : kind === 'links' || kind === 'list' ? 4 : 2
}

/** What a stacked chart splits by when no series is named: the next enum/boolean after `groupBy`. */
export function defaultSeries(entity: FullstackEntityDef | undefined, groupBy: string | undefined): string | undefined {
  return groupableFields(entity).find(f => f.name !== groupBy)?.name
}

/** The nav icons a page may pick (the generated app draws the lucide icon; the editor shows the
 *  Material Symbol that looks like it). */
export const NAV_ICONS: Record<FullstackNavIcon, { symbol: string; label: string }> = {
  LayoutDashboard: { symbol: 'dashboard', label: 'Dashboard' },
  Table2: { symbol: 'table', label: 'Table' },
  Layers: { symbol: 'layers', label: 'Layers' },
  PanelLeft: { symbol: 'vertical_split', label: 'Split panel' },
  BarChart3: { symbol: 'bar_chart', label: 'Chart' },
  ListChecks: { symbol: 'checklist', label: 'Checklist' },
  Users: { symbol: 'group', label: 'People' },
  ShoppingCart: { symbol: 'shopping_cart', label: 'Cart' },
  Package: { symbol: 'package_2', label: 'Package' },
  Ticket: { symbol: 'confirmation_number', label: 'Ticket' },
  Inbox: { symbol: 'inbox', label: 'Inbox' },
  Calendar: { symbol: 'calendar_month', label: 'Calendar' },
  FileText: { symbol: 'description', label: 'Document' },
  Settings: { symbol: 'settings', label: 'Settings' },
  Truck: { symbol: 'local_shipping', label: 'Truck' },
  Wallet: { symbol: 'account_balance_wallet', label: 'Wallet' },
  Building2: { symbol: 'apartment', label: 'Building' },
  Tag: { symbol: 'sell', label: 'Tag' },
  Star: { symbol: 'star', label: 'Star' },
  Wand2: { symbol: 'auto_fix_high', label: 'Wand' },
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

/** What the generated app can group or preset-filter by: a filterable, non-key enum/boolean field. */
export function groupableFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? []).filter(f => !f.primaryKey && f.filterable !== false && (f.type === 'ENUM' || f.type === 'BOOLEAN'))
}

/** What a time series can be bucketed over: a non-key date column. */
export function dateFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? []).filter(f => !f.primaryKey && (f.type === 'LOCAL_DATE' || f.type === 'LOCAL_DATE_TIME'))
}

/** What the dashboard period can limit: a filterable, non-key date (the list's own date filter). */
export function filterableDateFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return dateFields(entity).filter(f => f.filterable !== false)
}

// ── Preset filters ──────────────────────────────────────────────────────────

/** The periods a date field can be preset to, ending on the day the app is opened. */
export const PRESET_PERIODS: { value: string; label: string }[] = [
  { value: 'last:7d', label: 'Last 7 days' },
  { value: 'last:30d', label: 'Last 30 days' },
  { value: 'last:90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'This year' },
  { value: '12m', label: 'Last 12 months' },
]

/** How a field is preset: a pick of its values, a date period or range, or a number range. */
export type PresetKind = 'choice' | 'date' | 'number'

export function presetKind(f: FullstackFieldDef): PresetKind {
  if (f.type === 'LOCAL_DATE' || f.type === 'LOCAL_DATE_TIME') return 'date'
  if (f.type === 'LONG' || f.type === 'INTEGER' || f.type === 'BIG_DECIMAL') return 'number'
  return 'choice'
}

/** Every field a list, report or widget can be preset on: filterable enum/boolean, date and number fields. */
export function presettableFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? []).filter(f => !f.primaryKey && f.filterable !== false
    && (f.type === 'ENUM' || f.type === 'BOOLEAN' || presetKind(f) !== 'choice'))
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
  if (!v) return 'needs a value'
  switch (presetKind(f)) {
    case 'choice':
      if (f.type === 'BOOLEAN') return v === 'true' || v === 'false' ? undefined : 'expected true or false'
      return (f.enumValues ?? []).includes(v) ? undefined : `“${v}” is not one of the values of ${f.name}`
    case 'date': {
      if (PRESET_PERIODS.some(p => p.value === v.toLowerCase())) return undefined
      const range = parsePresetRange(v)
      if (!range) return 'needs a period or a date range (from..to)'
      if (!range.from && !range.to) return 'a range needs a from or a to'
      const ok = (d: string) => ISO_DAY.test(d) || (f.type === 'LOCAL_DATE_TIME' && ISO_DATE_TIME.test(d))
      if ((range.from && !ok(range.from)) || (range.to && !ok(range.to))) return 'dates must be yyyy-mm-dd'
      if (range.from && range.to && range.from > range.to) return 'from is after to'
      return undefined
    }
    case 'number': {
      const range = parsePresetRange(v)
      if (!range) return 'needs a number range (min..max)'
      if (!range.from && !range.to) return 'a range needs a min or a max'
      if ((range.from && !Number.isFinite(Number(range.from))) || (range.to && !Number.isFinite(Number(range.to)))) return 'min and max must be numbers'
      if (range.from && range.to && Number(range.from) > Number(range.to)) return 'min is above max'
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

/** A preset as the generated UI would say it: "Placed on: last 30 days", "Total: 100 – 500", "Status: Open". */
export function describePresetValue(f: FullstackFieldDef, value: string): string {
  const period = PRESET_PERIODS.find(p => p.value === value.trim().toLowerCase())
  if (period) return period.label.toLowerCase()
  const range = presetKind(f) === 'choice' ? null : parsePresetRange(value)
  if (range) {
    if (range.from && range.to) return `${range.from} – ${range.to}`
    return range.from ? `≥ ${range.from}` : `≤ ${range.to}`
  }
  return value
}

/** The date a widget's period applies to: its own, else the entity's first filterable one. */
export function widgetDateField(w: FullstackWidgetDef, entity: FullstackEntityDef | undefined): string | undefined {
  return w.dateField || filterableDateFields(entity)[0]?.name
}

/** What sum/avg/min/max can reduce: a non-key numeric column. */
export function numericFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? [])
    .filter(f => !f.primaryKey && (f.type === 'LONG' || f.type === 'INTEGER' || f.type === 'BIG_DECIMAL'))
}

/** What a report can group by: an enum/boolean draws bars, a date draws a line. */
export function chartableFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return [...groupableFields(entity), ...dateFields(entity)]
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

/** The child's MANY_TO_ONE fields pointing at `parent`, in declaration order. */
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
  issues: { page?: number; field?: string; summary: string; fix?: PageFix }[]
  count: number
  /** Advice, not errors: the layout generates, but with a dead end the user probably did not mean
   *  (a hidden page nothing opens, a chart nothing drills from, a default that was capped). Never
   *  counted, never blocks Generate. */
  warnings: { page?: number; field?: string; summary: string; fix?: PageFix }[]
  /** Page index → how many of the warnings are about it. */
  warningsByPage: Record<number, number>
}

interface Issue {
  page?: number
  field?: string
  /** Shown on the control. */
  message: string
  /** Shown in the problem list, naming the page. */
  summary: string
  fix?: PageFix
}

const singlePk = (e: FullstackEntityDef) => e.fields.filter(f => f.primaryKey).length === 1

/** What the page checks need beyond the layout: whether an LDAP auth dependency (ldap-auth-rest or ldap-auth) is selected
 *  (page roles need one). Omitted, that check is skipped. */
export interface PageLayoutContext {
  ldapAuth?: boolean
  /** The project-wide scaffold opts: a list page may show or sort by the audit columns only with
   *  `audit` among them (or overridden on the entity). Omitted: no audit columns. */
  scaffoldOpts?: string[]
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
  const warnings = collectWarnings(pages, entities)
  const warningsByPage: Record<number, number> = {}
  for (const w of warnings) if (w.page != null) warningsByPage[w.page] = (warningsByPage[w.page] ?? 0) + 1
  return {
    byPage,
    general,
    problems: issues.map(i => i.summary),
    issues: issues.map(({ page, field, summary, fix }) => ({ page, field, summary, ...(fix ? { fix } : {}) })),
    count: issues.length,
    warnings: warnings.map(({ page, field, summary, fix }) => ({ page, field, summary, ...(fix ? { fix } : {}) })),
    warningsByPage,
  }
}

/** The dead ends a valid layout can still have — what the generated app silently does nothing
 *  about. Each names the page and, where one repair is obvious, offers it. */
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
    label: `Add a ${pluralize(e.name)} list page`,
    apply: all => [...all, { id: uniquePageId(slugify(pluralize(e.name)), all.map(p => p.id)), type: 'entity-list', entity: e.name }],
  } : undefined)
  const addRecordPage = (e: FullstackEntityDef): PageFix | undefined => (room ? {
    label: `Add a ${e.name} record page`,
    apply: all => [...all, { id: uniquePageId(slugify(e.name), all.map(p => p.id)), type: 'record', entity: e.name, hidden: true }],
  } : undefined)
  const seen = new Set<string>()

  pages.forEach((page, index) => {
    const label = pageLabel(page)
    const where = `Page “${label}”`
    const warn = (field: string, summary: string, fix?: PageFix) => {
      // One chart dead end per page and entity, not one per widget.
      if (seen.has(summary)) return
      seen.add(summary)
      out.push({ page: index, field, message: '', summary, ...(fix ? { fix } : {}) })
    }

    if (page.hidden && page.type !== 'record' && page.type !== 'wizard' && pagesEmbedding(pages, page.id).length === 0) {
      warn('page', `${where} is hidden but no tabs page embeds it, so nothing opens it`,
        patchPage(index, `Show “${label}” in the navigation`, p => ({ ...p, hidden: false })))
    }
    if ((page.roles?.length ?? 0) > 0 && page.hidden && page.type !== 'wizard') {
      warn('roles', `${where} is restricted to roles, but it is out of the navigation, so the roles never apply`,
        patchPage(index, `Drop the roles of “${label}”`, p => ({ ...p, roles: undefined })))
    }
    if (page.type === 'dashboard') {
      const dateless: number[] = []
      ;(page.widgets ?? []).forEach((w, wi) => {
        const e = entityOf(w.entity)
        if (!e || w.kind === 'text' || w.kind === 'links' || w.kind === 'list') return
        const chart = w.kind === 'bar' || w.kind === 'donut' || w.kind === 'stacked' || w.kind === 'top' || w.kind === 'line'
        if (chart && !visibleList(e.name)) {
          warn(`widget.${wi}`, `${where}: clicking a bar of the ${e.name} chart goes nowhere — ${e.name} has no list page in the navigation`, addListPage(e))
        }
        if (w.kind === 'recent' && singlePk(e) && !recordPage(e.name)) {
          warn(`widget.${wi}`, `${where}: the recent ${e.name} rows open nothing — ${e.name} has no record page`, addRecordPage(e))
        }
        if (page.dateRange && !widgetDateField(w, e)) dateless.push(wi)
      })
      if (page.dateRange && dateless.length > 0) {
        warn(`widget.${dateless[0]}`, `${where}: ${dateless.length === 1 ? 'one widget has' : `${dateless.length} widgets have`} no date, so the period picker does not limit ${dateless.length === 1 ? 'it' : 'them'}`)
      }
    }
    if (page.type === 'report') {
      const e = entityOf(page.entity)
      if (e && !visibleList(e.name)) {
        warn('entity', `${where}: clicking a bar of the chart goes nowhere — ${e.name} has no list page in the navigation`, addListPage(e))
      }
    }
    if (page.type === 'record') {
      const e = entityOf(page.entity)
      if (!e) return
      const related = entities.filter(o => o.name.trim() && relationsTo(o, e.name).length > 0)
      if (page.childTabs == null && related.length > MAX_CHILD_TABS) {
        warn('childTabs', `${where} shows only the first ${MAX_CHILD_TABS} of its ${related.length} related lists`,
          patchPage(index, `Choose the first ${MAX_CHILD_TABS} related lists`, p => ({ ...p, childTabs: related.slice(0, MAX_CHILD_TABS).map(o => o.name) })))
      }
      const tabs = page.childTabs ? page.childTabs.map(childTabEntity) : related.map(o => o.name)
      if (page.headerStats == null && tabs.length > MAX_HEADER_STATS) {
        warn('headerStats', `${where} shows only the first ${MAX_HEADER_STATS} of its ${tabs.length} header numbers`,
          patchPage(index, `Choose the first ${MAX_HEADER_STATS} header numbers`, p => ({ ...p, headerStats: tabs.slice(0, MAX_HEADER_STATS).map(child => ({ child })) })))
      }
    }
  })
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
    if (roles.some(r => !PAGE_ROLES.includes(r))) add('unknown role', `${where} names an unknown role`)
    else if (page === start) add('the start page is open to everyone', `${where} is the start page, so it cannot be restricted to roles`)
    else if (tabbed.has(page.id)) add('restrict the tabs page instead', `${where} is a tab, so it cannot be restricted to roles`)
    else if (context.ldapAuth === false) add('needs ldap-auth-rest or ldap-auth', `${where} is restricted to roles, which need an LDAP auth dependency (ldap-auth-rest or ldap-auth)`)
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
function checkPresetFilter(filter: Record<string, string> | undefined, e: FullstackEntityDef, add: AddIssue, where: string,
                           control: (field: string) => string = field => `presetFilter.${field}`): void {
  const presettable = presettableFields(e)
  for (const [field, value] of Object.entries(filter ?? {})) {
    const f = e.fields.find(x => x.name === field)
    if (!f) {
      add(control(field), `${e.name} no longer has “${field}”`,
        `${where} filters on “${field}”, which ${e.name} no longer has`)
    } else if (!presettable.includes(f)) {
      add(control(field), 'only a filterable enum, boolean, date or number field can be preset',
        `${where} filters on “${field}”, which is not a filterable enum, boolean, date or number field`)
    } else {
      const problem = presetValueProblem(f, value)
      if (problem) add(control(field), problem, `${where} filters ${field} on “${value}”, which ${problem.replace(/^needs/, 'is not valid: needs')}`)
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
      ? [{ field: 'chart.field', message: 'a count takes no field', summary: `counts rows, so it takes no field` }]
      : []
  }
  if (!field) {
    return [{ field: 'chart.field', message: `${agg} needs a numeric field of ${e.name}`,
      summary: `reduces ${e.name} with ${agg} but names no numeric field` }]
  }
  if (!numericFields(e).some(f => f.name === field)) {
    return [{ field: 'chart.field', message: `${e.name} has no numeric field “${field}”`,
      summary: `reduces “${field}”, which is not a numeric field of ${e.name}` }]
  }
  return []
}

/** How a list page opens: known columns (none twice), a sortable sort, an offered view, a pager size. */
function checkListPresentation(page: FullstackPageDef, e: FullstackEntityDef, add: AddIssue, where: string, scaffoldOpts: string[]): void {
  const isAudit = (key: string) => key === 'createdAt' || key === 'updatedAt'
  if (page.columns) {
    if (page.columns.length === 0) add('columns', 'needs at least one column', `${where} shows no columns`)
    const keys = listColumns(e, scaffoldOpts).map(c => c.key)
    const seen = new Set<string>()
    for (const key of page.columns) {
      if (!keys.includes(key)) {
        add('columns', isAudit(key) ? `“${key}” needs the audit option on ${e.name}` : `${e.name} has no “${key}” column`,
          isAudit(key) ? `${where} shows “${key}”, which needs the audit scaffold option on ${e.name}`
            : `${where} shows “${key}”, which is not a column of ${e.name}`)
      } else if (seen.has(key)) add('columns', `“${key}” is listed twice`, `${where} lists the “${key}” column twice`)
      seen.add(key)
    }
  }
  if (page.detail != null) {
    if (!['drawer', 'side', 'record'].includes(page.detail)) add('detail', 'must be drawer, side or record', `${where} opens rows in “${page.detail}”, which is not drawer, side or record`)
    else if (page.detail === 'side' && !singlePk(e)) add('detail', 'a side pane needs a single-key entity', `${where} opens rows in a side pane, but ${e.name} has a composite key`)
  }
  if (page.sort) {
    const key = page.sort.field
    if (!key?.trim()) add('sort', 'needs a column', `${where} sorts by no column`)
    else if (!sortableKeys(e, scaffoldOpts).includes(key)) {
      add('sort', isAudit(key) ? `“${key}” needs the audit option on ${e.name}` : `${e.name} cannot sort by “${key}”`,
        isAudit(key) ? `${where} sorts by “${key}”, which needs the audit scaffold option on ${e.name}`
          : `${where} sorts by “${key}”, which ${e.name} cannot sort by`)
    }
    if (page.sort.dir && page.sort.dir !== 'asc' && page.sort.dir !== 'desc') {
      add('sort', 'direction must be asc or desc', `${where} has a sort direction that is neither asc nor desc`)
    }
  }
  if (page.view) {
    if (!LIST_VIEWS.some(v => v.value === page.view)) add('view', `“${page.view}” is not a list view`, `${where} opens as “${page.view}”, which is not a list view`)
    else if (!enabledListViews(e).includes(page.view)) {
      const reason = viewDisabledReason(e, page.view)
      add('view', reason ?? `${e.name} does not offer it`,
        `${where} opens as ${page.view}, which ${e.name} does not offer${reason ? ` (${reason.charAt(0).toLowerCase()}${reason.slice(1)})` : ''}`)
    }
  }
  if (page.pageSize != null && !LIST_PAGE_SIZES.includes(page.pageSize)) {
    add('pageSize', `must be ${LIST_PAGE_SIZES.join(', ')}`, `${where} opens with ${page.pageSize} rows per page, which the pager does not offer`)
  }
}

function collect(pages: FullstackPageDef[], entities: FullstackEntityDef[], scaffoldOpts: string[] = []): Issue[] {
  if (pages.length === 0) return []
  const issues: Issue[] = []
  const byLower = new Map(entities.map(e => [e.name.trim().toLowerCase(), e]))
  const entityOf = (name: string | undefined) => (name ? byLower.get(name.trim().toLowerCase()) : undefined)
  const typeById = new Map(pages.map(p => [p.id, p.type]))
  const seenIds = new Set<string>()
  const recordEntities = new Map<string, string>()
  const wizardEntities = new Map<string, string>()

  if (pages.length > MAX_PAGES) {
    issues.push({ message: '', summary: `A layout can have at most ${MAX_PAGES} pages` })
  }

  // The fixes: a stale reference is removed (the page, or just the widget / tab / tile that holds
  // it), an ambiguous link takes the first relation, a wizard asks for what it forgot.
  const removePage = (index: number): PageFix => ({
    label: `Remove the “${pageLabel(pages[index])}” page`,
    apply: all => dropTabsTo(all.filter((_, i) => i !== index), all[index]?.id ?? ''),
  })
  const patchPage = (index: number, label: string, patch: (page: FullstackPageDef) => FullstackPageDef): PageFix => ({
    label,
    apply: all => all.map((p, i) => (i === index ? patch(p) : p)),
  })

  pages.forEach((page, index) => {
    const where = `Page “${page.title || page.id || index + 1}”`
    const add = (field: string, message: string, summary = `${where} ${message}`, fix?: PageFix) =>
      issues.push({ page: index, field, message, summary, ...(fix ? { fix } : {}) })

    if (!page.id.trim()) add('id', 'needs an id')
    else if (!PAGE_ID.test(page.id) || page.id.length > 40) {
      add('id', 'must be lower-case words joined by “-”', `${where} has an invalid id “${page.id}”`)
    } else if (seenIds.has(page.id)) add('id', 'is already used', `Two pages share the id “${page.id}”`)
    seenIds.add(page.id)
    if ((page.title ?? '').length > 80) add('title', 'is longer than 80 characters')
    if ((page.description ?? '').length > 300) add('description', 'is longer than 300 characters')
    if (page.group?.trim() || page.icon) {
      if (!inNav(page)) {
        add(page.group?.trim() ? 'group' : 'icon', 'only applies to a page in the navigation',
          `${where} is not in the navigation, so it takes no nav ${page.group?.trim() ? 'group' : 'icon'}`)
      }
      if ((page.group ?? '').trim().length > MAX_GROUP) add('group', `is longer than ${MAX_GROUP} characters`)
      if (page.icon && !(page.icon in NAV_ICONS)) add('icon', `“${page.icon}” is not a nav icon`)
    }

    switch (page.type) {
      case 'entity-list': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? `“${page.entity}” is no longer an entity` : 'needs an entity',
            page.entity ? `${where} lists “${page.entity}”, which is no longer an entity` : `${where} lists no entity`,
            page.entity ? removePage(index) : undefined)
          break
        }
        checkPresetFilter(page.presetFilter, e, add, where)
        checkListPresentation(page, e, add, where, scaffoldOpts)
        if (page.detail === 'record' && !pages.some(p => p.type === 'record' && p.entity?.trim().toLowerCase() === e.name.trim().toLowerCase())) {
          add('detail', `needs a record page for ${e.name}`, `${where} opens rows on a record page, but ${e.name} has none`,
            singlePk(e) && pages.length < MAX_PAGES ? {
              label: `Add a ${e.name} record page`,
              apply: all => [...all, { id: uniquePageId(slugify(e.name), all.map(p => p.id)), type: 'record', entity: e.name, hidden: true }],
            } : undefined)
        }
        break
      }
      case 'dashboard': {
        const widgets = page.widgets ?? []
        if (widgets.length === 0) add('widgets', 'needs at least one widget')
        if (widgets.length > MAX_WIDGETS) add('widgets', `has more than ${MAX_WIDGETS} widgets`)
        widgets.forEach((w, wi) => {
          if (w.kind === 'text') {
            if (!w.text?.trim()) add(`widget.${wi}`, 'needs some text', `${where} has an empty text widget`)
            else if (w.text.length > MAX_TEXT) add(`widget.${wi}`, `is longer than ${MAX_TEXT} characters`, `${where} has a text widget over ${MAX_TEXT} characters`)
            return
          }
          if (w.kind === 'links') {
            const ids = w.pages ?? []
            const dropLink = (id: string) => patchPage(index, `Drop the link to “${id}”`,
              p => ({ ...p, widgets: (p.widgets ?? []).map((x, j) => (j === wi ? { ...x, pages: (x.pages ?? []).filter(k => k !== id) } : x)) }))
            if (ids.length === 0) add(`widget.${wi}`, 'needs at least one page to open', `${where} has a links widget that opens no page`)
            else if (ids.length > MAX_LINKS) add(`widget.${wi}`, `opens more than ${MAX_LINKS} pages`, `${where} has a links widget over ${MAX_LINKS} pages`)
            ids.forEach((id, li) => {
              const target = pages.find(p => p.id === id)
              if (!target) add(`widget.${wi}`, `no page “${id}”`, `${where} links to the missing page “${id}”`, dropLink(id))
              else if (target.type === 'record') {
                add(`widget.${wi}`, `“${pageLabel(target)}” opens from a row, not a link`, `${where} links to the record page “${pageLabel(target)}”, which opens from a row`, dropLink(id))
              } else if (target.hidden && target.type !== 'wizard') {
                add(`widget.${wi}`, `“${pageLabel(target)}” is hidden, so a link cannot open it`, `${where} links to “${pageLabel(target)}”, which is hidden from the navigation`, dropLink(id))
              } else if (ids.indexOf(id) !== li) add(`widget.${wi}`, `links to “${pageLabel(target)}” twice`, `${where} links to “${pageLabel(target)}” twice`)
            })
            return
          }
          const e = entityOf(w.entity)
          if (!e) {
            add(`widget.${wi}`, w.entity ? `“${w.entity}” is no longer an entity` : 'needs an entity',
              `${where} has a widget for “${w.entity}”, which is no longer an entity`,
              !w.entity ? undefined
                : widgets.length === 1 ? removePage(index)
                  : patchPage(index, `Remove widget ${wi + 1}`, p => ({ ...p, widgets: (p.widgets ?? []).filter((_, j) => j !== wi) })))
            return
          }
          if (w.kind === 'list') {
            // The same presentation rules as a list page, reported on the widget.
            checkListPresentation({ id: page.id, type: 'entity-list', entity: e.name, columns: w.columns, sort: w.sort }, e,
              (_field, message, summary, fix) => add(`widget.${wi}`, message, summary, fix), where, scaffoldOpts)
            if (w.limit != null && !LIST_WIDGET_LIMITS.includes(w.limit)) {
              add(`widget.${wi}`, `shows ${LIST_WIDGET_LIMITS.join(' or ')} rows`, `${where} embeds a list of ${w.limit} rows (${LIST_WIDGET_LIMITS.join(' or ')})`)
            }
            checkPresetFilter(w.presetFilter, e, add, where, field => `widget.${wi}.presetFilter.${field}`)
            return
          }
          if (w.series && w.kind !== 'stacked') {
            add(`widget.${wi}`, 'only a stacked chart takes a series', `${where} splits a ${w.kind} widget by a series`)
          }
          if (w.kind === 'stacked') {
            const by = w.groupBy ?? defaultBarGroupBy(e)
            const series = w.series ?? defaultSeries(e, by)
            if (w.series && !groupableFields(e).some(f => f.name === w.series)) {
              add(`widget.${wi}`, `${e.name} has no enum or boolean field “${w.series}”`,
                `${where} splits ${e.name} by “${w.series}”, which it no longer has`)
            } else if (!series || series === by) {
              add(`widget.${wi}`, 'needs a second enum or boolean field to split by',
                `${where} has a stacked chart of ${e.name}, which has no second enum or boolean field to split by`)
            }
          }
          if (w.kind === 'bar' || w.kind === 'donut' || w.kind === 'stacked') {
            const groupable = groupableFields(e)
            if (w.groupBy && !groupable.some(f => f.name === w.groupBy)) {
              add(`widget.${wi}`, `${e.name} has no enum or boolean field “${w.groupBy}”`,
                `${where} groups ${e.name} by “${w.groupBy}”, which it no longer has`)
            } else if (!w.groupBy && groupable.length === 0) {
              add(`widget.${wi}`, `${e.name} has no enum or boolean field to group by`,
                `${where} charts ${e.name}, which has no enum or boolean field to group by`)
            }
          }
          if (w.kind === 'line') {
            const dates = dateFields(e)
            if (w.groupBy && !dates.some(f => f.name === w.groupBy)) {
              add(`widget.${wi}`, `${e.name} has no date field “${w.groupBy}”`,
                `${where} plots ${e.name} over “${w.groupBy}”, which is not one of its date fields`)
            } else if (!w.groupBy && dates.length === 0) {
              add(`widget.${wi}`, `${e.name} has no date field to plot over time`,
                `${where} plots ${e.name} over time, but it has no date field`)
            }
          }
          if (w.kind === 'top') {
            const ranks = rankableKeys(e)
            if (w.groupBy && !ranks.some(k => k.toLowerCase() === w.groupBy!.toLowerCase())) {
              add(`widget.${wi}`, `${e.name} has no enum, boolean or relation “${w.groupBy}”`,
                `${where} ranks ${e.name} by “${w.groupBy}”, which it no longer has`)
            } else if (!w.groupBy && ranks.length === 0) {
              add(`widget.${wi}`, `${e.name} has no enum, boolean or relation to rank by`,
                `${where} ranks ${e.name}, which has nothing to rank by`)
            }
          }
          if (w.kind === 'progress') {
            const target = Number(w.target)
            if (!w.target?.trim()) {
              add(`widget.${wi}`, 'needs a target', `${where} has a progress tile without a target`)
            } else if (!Number.isFinite(target) || target <= 0) {
              add(`widget.${wi}`, 'the target must be a number above 0', `${where} has a progress target of “${w.target}”`)
            }
          }
          if (w.compare) {
            if (w.kind !== 'kpi') {
              add(`widget.${wi}`, 'only a number tile compares periods', `${where} compares periods on a ${w.kind} widget`)
            } else if (!page.dateRange || !widgetDateField(w, e)) {
              add(`widget.${wi}`, 'comparing needs the period picker and a filterable date',
                `${where} compares periods, but ${!page.dateRange ? 'has no period picker' : `${e.name} has no filterable date`}`)
            }
          }
          if (w.bucket && w.kind !== 'line') {
            add(`widget.${wi}`, 'only a trend takes a bucket', `${where} buckets a ${w.kind} widget`)
          }
          for (const issue of aggIssues(w.kind === 'recent' ? undefined : w.agg, w.field, e, w.kind === 'recent')) {
            add(`widget.${wi}`, issue.message, `${where} ${issue.summary}`)
          }
          if (w.kind === 'recent' && (w.agg || w.field)) {
            add(`widget.${wi}`, 'a recent list shows rows, not an aggregate',
              `${where} asks a recent list for an aggregate`)
          }
          if ((w.kind === 'recent' || w.kind === 'top') && w.limit != null && (w.limit < 1 || w.limit > MAX_RECENT_LIMIT)) {
            add(`widget.${wi}`, `between 1 and ${MAX_RECENT_LIMIT} rows`,
              `${where} shows a ${w.kind} list of ${w.limit} rows (1–${MAX_RECENT_LIMIT})`)
          }
          if (w.span != null && (!Number.isInteger(w.span) || w.span < 1 || w.span > MAX_SPAN)) {
            add(`widget.${wi}`, `spans 1 to ${MAX_SPAN} columns`, `${where} has a widget ${w.span} columns wide (1–${MAX_SPAN})`)
          }
          if (w.sortBy) {
            if (w.kind !== 'recent') {
              add(`widget.${wi}`, 'only a recent list takes a sort', `${where} sorts a ${w.kind} widget`)
            } else if (!e.fields.some(f => f.name === w.sortBy)) {
              add(`widget.${wi}`, `${e.name} has no field “${w.sortBy}”`,
                `${where} sorts ${e.name} by “${w.sortBy}”, which it no longer has`)
            }
          }
          checkPresetFilter(w.presetFilter, e, add, `${where} has a widget that`, field => `widget.${wi}.presetFilter.${field}`)
          if (w.dateField) {
            if (!page.dateRange) {
              add(`widget.${wi}`, 'a date field needs the dashboard’s period picker',
                `${where} limits a widget by “${w.dateField}”, but has no period picker`)
            } else if (!filterableDateFields(e).some(f => f.name === w.dateField)) {
              add(`widget.${wi}`, `${e.name} has no filterable date field “${w.dateField}”`,
                `${where} limits ${e.name} by “${w.dateField}”, which is not one of its filterable date fields`)
            }
          }
        })
        if (page.dateRange) {
          if (!DATE_RANGES.some(r => r.value === page.dateRange)) {
            add('dateRange', `“${page.dateRange}” is not a period`)
          } else if (widgets.length > 0 && !widgets.some(w => widgetDateField(w, entityOf(w.entity)))) {
            add('dateRange', 'no widget counts an entity with a filterable date',
              `${where} has a period picker, but none of its widgets has a date for it to limit`)
          }
        }
        break
      }
      case 'tabs': {
        if (!page.title?.trim()) add('title', 'needs a title (there is no entity to name it after)')
        const tabs = page.tabs ?? []
        if (tabs.length < MIN_TABS || tabs.length > MAX_TABS) {
          add('tabs', `needs between ${MIN_TABS} and ${MAX_TABS} tabs`)
        }
        const seenTabs = new Set<string>()
        tabs.forEach((tab, ti) => {
          const targetType = typeById.get(tab.page)
          if (!targetType) {
            add(`tab.${ti}`, tab.page ? `no page with id “${tab.page}”` : 'needs a page',
              `${where} has a tab for the missing page “${tab.page}”`)
          } else if (targetType === 'tabs' || targetType === 'record') {
            add(`tab.${ti}`, `a tab cannot embed a ${targetType} page`,
              `${where} has a tab embedding the ${targetType} page “${tab.page}”`)
          } else if (seenTabs.has(tab.page)) {
            add(`tab.${ti}`, 'is already a tab of this page', `${where} has “${tab.page}” as a tab twice`)
          }
          seenTabs.add(tab.page)
        })
        break
      }
      case 'master-detail': {
        const parent = entityOf(page.parent)
        const child = entityOf(page.child)
        if (!parent) {
          add('parent', page.parent ? `“${page.parent}” is no longer an entity` : 'needs a parent entity',
            `${where} lists “${page.parent ?? ''}”, which is no longer an entity`,
            page.parent ? removePage(index) : undefined)
        } else if (!singlePk(parent)) {
          add('parent', `${parent.name} has a composite key`,
            `${where} lists ${parent.name}, which has a composite key`)
        }
        if (!child) {
          add('child', page.child ? `“${page.child}” is no longer an entity` : 'needs a child entity',
            `${where} shows “${page.child ?? ''}”, which is no longer an entity`,
            page.child ? removePage(index) : undefined)
        } else if (parent) {
          const candidates = relationsTo(child, parent.name)
          if (candidates.length === 0) {
            add('child', `${child.name} has no relation to ${parent.name}`,
              `${where} shows ${child.name}, which has no relation to ${parent.name}`)
          } else if (page.via && !candidates.some(c => c.toLowerCase() === page.via!.toLowerCase())) {
            add('via', `“${page.via}” is not a relation to ${parent.name}`,
              `${where} links through “${page.via}”, which is not a relation of ${child.name} to ${parent.name}`)
          } else if (!page.via && candidates.length > 1) {
            add('via', 'pick the relation to link through',
              `${where} must say which of the relations of ${child.name} to ${parent.name} it links through`,
              patchPage(index, `Link through “${candidates[0]}”`, p => ({ ...p, via: candidates[0] })))
          }
        }
        break
      }
      case 'report': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? `“${page.entity}” is no longer an entity` : 'needs an entity',
            page.entity ? `${where} reports on “${page.entity}”, which is no longer an entity`
              : `${where} reports on no entity`,
            page.entity ? removePage(index) : undefined)
          break
        }
        const charts = reportCharts(page)
        if (page.chart && page.charts?.length) {
          add('chart.groupBy', 'has both a chart and a list of charts', `${where} sets both “chart” and “charts”`)
        }
        if (charts.length > MAX_CHARTS) add('chart.groupBy', `has more than ${MAX_CHARTS} charts`)
        const chartable = chartableFields(e)
        charts.forEach((chart, ci) => {
          const which = charts.length > 1 ? `${where} (chart ${ci + 1})` : where
          // The grouping the chart resolves to: the named field, else the generator's default.
          const groupName = chart.groupBy ?? defaultReportGroupBy(e)
          const grouped = groupName ? e.fields.find(f => f.name === groupName) : undefined
          if (chart.groupBy && !chartable.some(f => f.name === chart.groupBy) && !relationKeys(e).includes(chart.groupBy)) {
            add(chartControl(ci, 'groupBy'), `${e.name} has no enum, boolean or date field, or relation, “${chart.groupBy}”`,
              `${which} groups by “${chart.groupBy}”, which is not an enum, boolean or date field, or a relation, of ${e.name}`)
          } else if (!chart.groupBy && chartable.length === 0) {
            add(chartControl(ci, 'groupBy'), `${e.name} has no enum, boolean or date field to group by`,
              `${which} reports on ${e.name}, which has no enum, boolean or date field to group by`)
          }
          const overTime = grouped ? dateFields(e).some(f => f.name === grouped.name) : false
          if (chart.bucket && !overTime) {
            add(chartControl(ci, 'bucket'), 'a bucket applies to a date grouping',
              `${which} buckets by ${chart.bucket}, but it does not group over a date`)
          }
          for (const issue of aggIssues(chart.agg, chart.field, e, false)) {
            add(chartControl(ci, 'field'), issue.message, `${which} ${issue.summary}`)
          }
        })
        checkPresetFilter(page.presetFilter, e, add, where)
        break
      }
      case 'record': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? `“${page.entity}” is no longer an entity` : 'needs an entity',
            `${where} opens “${page.entity ?? ''}”, which is no longer an entity`,
            page.entity ? removePage(index) : undefined)
          break
        }
        if (!singlePk(e)) {
          add('entity', `${e.name} has a composite key`,
            `${where} opens ${e.name}, which has a composite key and cannot be addressed by one id`)
        }
        const already = recordEntities.get(e.name)
        if (already) {
          add('entity', `${e.name} already has the record page “${already}”`,
            `${where} is a second record page for ${e.name}`)
        }
        recordEntities.set(e.name, page.id)
        const seenChildren = new Set<string>()
        const childTabs = page.childTabs ?? []
        childTabs.forEach((tab, ci) => {
          const name = childTabEntity(tab)
          const via = childTabVia(tab)
          const child = entityOf(name)
          if (!child) {
            add(`childTab.${ci}`, `“${name}” is no longer an entity`,
              `${where} has a tab for “${name}”, which is no longer an entity`,
              patchPage(index, `Remove the ${name} tab`, p => ({ ...p, childTabs: (p.childTabs ?? []).filter((_, j) => j !== ci) })))
          } else if (relationsTo(child, e.name).length === 0) {
            add(`childTab.${ci}`, `${child.name} has no relation to ${e.name}`,
              `${where} has a tab for ${child.name}, which has no relation to ${e.name}`)
          } else if (seenChildren.has(child.name)) {
            add(`childTab.${ci}`, 'is already a tab', `${where} has ${child.name} as a tab twice`)
          } else if (via && !relationsTo(child, e.name).includes(via)) {
            add(`childTab.${ci}`, `${child.name} has no relation “${via}” to ${e.name}`,
              `${where} links ${child.name} through “${via}”, which is not one of its relations to ${e.name}`)
          }
          if (child) seenChildren.add(child.name)
        })
        if (childTabs.length > MAX_CHILD_TABS) add('childTabs', `has more than ${MAX_CHILD_TABS} related lists`)
        const stats = page.headerStats ?? []
        if (stats.length > MAX_HEADER_STATS) add('headerStats', `has more than ${MAX_HEADER_STATS} header tiles`)
        stats.forEach((s, si) => {
          const child = entityOf(s.child)
          if (!child) {
            add(`headerStat.${si}`, `“${s.child}” is no longer an entity`,
              `${where} has a header tile for “${s.child}”, which is no longer an entity`,
              patchPage(index, `Remove the ${s.title || s.child} tile`, p => ({ ...p, headerStats: (p.headerStats ?? []).filter((_, j) => j !== si) })))
          } else if (relationsTo(child, e.name).length === 0) {
            add(`headerStat.${si}`, `${child.name} has no relation to ${e.name}`,
              `${where} has a header tile for ${child.name}, which has no relation to ${e.name}`)
          } else if (s.via && !relationsTo(child, e.name).includes(s.via)) {
            add(`headerStat.${si}`, `${child.name} has no relation “${s.via}” to ${e.name}`,
              `${where} has a header tile linked through “${s.via}”, which is not a relation of ${child.name} to ${e.name}`)
          } else {
            for (const issue of aggIssues(s.agg, s.field, child, false)) {
              add(`headerStat.${si}`, issue.message, `${where} has a header tile that ${issue.summary}`)
            }
          }
        })
        break
      }
      case 'wizard': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? `“${page.entity}” is no longer an entity` : 'needs an entity',
            `${where} creates “${page.entity ?? ''}”, which is no longer an entity`,
            page.entity ? removePage(index) : undefined)
          break
        }
        if (e.readOnly) add('entity', `${e.name} is read-only`, `${where} creates ${e.name}, which is read-only`)
        const already = wizardEntities.get(e.name)
        if (already) add('entity', `${e.name} already has the wizard “${already}”`, `${where} is a second wizard for ${e.name}`)
        wizardEntities.set(e.name, page.id)
        const askable = askableFields(e)
        const steps = page.steps ?? []
        if (steps.length > MAX_STEPS) add('steps', `has more than ${MAX_STEPS} steps`)
        const asked = new Set<string>()
        steps.forEach((step, si) => {
          if (step.fields.length === 0) add(`step.${si}`, 'asks for nothing', `${where} has an empty step ${si + 1}`)
          for (const name of step.fields) {
            if (!askable.some(a => a.name === name)) {
              add(`step.${si}`, `${e.name} has no field “${name}”`, `${where} asks for “${name}”, which ${e.name} no longer has`)
            } else if (asked.has(name)) {
              add(`step.${si}`, `“${name}” is already asked for`, `${where} asks for “${name}” twice`)
            }
            asked.add(name)
          }
        })
        if (steps.length > 0) {
          const missing = askable.filter(a => a.required && !asked.has(a.name)).map(a => a.name)
          if (missing.length > 0) {
            add('steps', `never asks for ${missing.map(m => `“${m}”`).join(', ')}, which ${missing.length === 1 ? 'is' : 'are'} required`,
              undefined,
              patchPage(index, `Add ${missing.join(', ')} to the last step`, p => {
                const next = [...(p.steps ?? [])]
                if (next.length === 0) return p
                const last = next[next.length - 1]
                const asked = new Set(next.flatMap(s => s.fields))
                next[next.length - 1] = { ...last, fields: [...last.fields, ...missing.filter(m => !asked.has(m))] }
                return { ...p, steps: next }
              }))
          }
        }
        if (askable.length === 0) add('entity', `${e.name} has no field to ask for`)
        break
      }
    }
  })

  if (!pages.some(p => !p.hidden && p.type !== 'record')) {
    issues.push({ message: '', summary: 'Every page is hidden — at least one must be in the navigation' })
  }
  return issues
}

/** One line describing what a page shows. */
export function describePage(page: FullstackPageDef, pages: FullstackPageDef[]): string {
  switch (page.type) {
    case 'entity-list': {
      const parts = [`${page.entity} list`]
      if (page.view) parts.push(LIST_VIEWS.find(v => v.value === page.view)?.label.toLowerCase() ?? page.view)
      if (page.columns?.length) parts.push(`${page.columns.length} column${page.columns.length === 1 ? '' : 's'}`)
      if (page.sort?.field) parts.push(`by ${page.sort.field} ${page.sort.dir === 'desc' ? '↓' : '↑'}`)
      if (page.detail === 'side') parts.push('side pane')
      else if (page.detail) parts.push(`rows open in the ${page.detail}`)
      const filter = Object.entries(page.presetFilter ?? {}).map(([k, v]) => `${k} = ${v}`).join(', ')
      if (filter) parts.push(`filtered on ${filter}`)
      return parts.join(' · ')
    }
    case 'dashboard': {
      const counts = { kpi: 0, bar: 0, donut: 0, stacked: 0, line: 0, recent: 0, top: 0, progress: 0, text: 0, links: 0, list: 0 }
      for (const w of page.widgets ?? []) if (w.kind in counts) counts[w.kind]++
      const parts = [
        counts.kpi && `${counts.kpi} tile${counts.kpi === 1 ? '' : 's'}`,
        counts.progress && `${counts.progress} target${counts.progress === 1 ? '' : 's'}`,
        counts.bar && `${counts.bar} breakdown chart${counts.bar === 1 ? '' : 's'}`,
        counts.donut && `${counts.donut} donut${counts.donut === 1 ? '' : 's'}`,
        counts.stacked && `${counts.stacked} stacked chart${counts.stacked === 1 ? '' : 's'}`,
        counts.line && `${counts.line} trend${counts.line === 1 ? '' : 's'}`,
        counts.top && `${counts.top} top list${counts.top === 1 ? '' : 's'}`,
        counts.recent && `${counts.recent} recent list${counts.recent === 1 ? '' : 's'}`,
        counts.text && `${counts.text} note${counts.text === 1 ? '' : 's'}`,
        counts.links && `${counts.links} link panel${counts.links === 1 ? '' : 's'}`,
        counts.list && `${counts.list} embedded list${counts.list === 1 ? '' : 's'}`,
      ].filter(Boolean)
      return parts.join(' · ') || 'No widgets'
    }
    case 'tabs':
      return (page.tabs ?? [])
        .map(tab => tab.title || pages.find(p => p.id === tab.page)?.title || tab.page)
        .join(' | ')
    case 'master-detail':
      return `${page.parent ?? '?'} → ${page.child ?? '?'}${page.via ? ` via ${page.via}` : ''}`
    case 'report': {
      const charts = reportCharts(page)
      const chart = charts[0]
      const by = chart.groupBy ?? 'its first enum, boolean or date field'
      const how = !chart.agg || chart.agg === 'count' ? 'row count' : `${chart.agg} of ${chart.field}`
      const more = charts.length > 1 ? ` · +${charts.length - 1} chart${charts.length === 2 ? '' : 's'}` : ''
      return `${page.entity ?? '?'} · ${how} by ${by}${chart.bucket ? ` per ${chart.bucket}` : ''}${more}`
    }
    case 'wizard': {
      const steps = page.steps?.length
      return `${page.entity ?? '?'} · ${steps ? `${steps} step${steps === 1 ? '' : 's'}` : 'default steps'} and a review`
    }
    case 'record': {
      const tabs = page.childTabs
      const related = tabs == null ? 'its related lists' : tabs.length === 0 ? 'no related lists'
        : tabs.map(tab => (childTabVia(tab) ? `${childTabEntity(tab)} (${childTabVia(tab)})` : childTabEntity(tab))).join(', ')
      return `One ${page.entity ?? '?'} · ${related}`
    }
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
 * starting point users then rearrange.
 */
export function seedLayout(entities: FullstackEntityDef[]): FullstackPageDef[] {
  const named = entities.filter(e => e.name.trim())
  if (named.length === 0) return []
  const ids = new Set<string>()
  const take = (base: string) => {
    const id = uniquePageId(slugify(base), ids)
    ids.add(id)
    return id
  }
  const dashboard: FullstackPageDef = {
    id: take('dashboard'),
    type: 'dashboard',
    widgets: [
      ...named.map(e => ({ kind: 'kpi' as const, entity: e.name })),
      ...named.filter(e => groupableFields(e).length > 0).map(e => ({ kind: 'bar' as const, entity: e.name })),
      { kind: 'recent' as const, entity: named[0].name },
    ],
  }
  return [dashboard, ...named.map(e => ({ id: take(e.name), type: 'entity-list' as const, entity: e.name }))]
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
    if (next.widgets) next.widgets = next.widgets.map(w => (same(w.entity) ? { ...w, entity: to } : w))
    if (next.childTabs) next.childTabs = next.childTabs.map(tab => (same(childTabEntity(tab)) ? childTab(to, childTabVia(tab)) : tab))
    if (next.headerStats) next.headerStats = next.headerStats.map(s => (same(s.child) ? { ...s, child: to } : s))
    return next
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
    return next
  })
}

/** What each page type is, for the "Add page" gallery. */
export const PAGE_TYPE_META: Record<FullstackPageType, { icon: string; label: string; blurb: string }> = {
  dashboard: { icon: 'dashboard', label: 'Dashboard', blurb: 'Count tiles, breakdown charts and recent rows.' },
  'entity-list': { icon: 'table_rows', label: 'List', blurb: 'One entity’s table, optionally filtered to start with.' },
  tabs: { icon: 'tab', label: 'Tabs', blurb: 'Two to six other pages side by side as tabs.' },
  'master-detail': { icon: 'vertical_split', label: 'Master–detail', blurb: 'A parent list beside the selected parent’s rows.' },
  record: { icon: 'article', label: 'Record', blurb: 'One row opened from a list, with its related lists as tabs.' },
  report: { icon: 'monitoring', label: 'Report', blurb: 'Filters, charts and grouped totals, with a CSV export.' },
  wizard: { icon: 'auto_fix_high', label: 'Wizard', blurb: 'A create form split into steps, with a review before saving.' },
}

// ── Defaults the generator resolves ─────────────────────────────────────────

const nonKey = (e: FullstackEntityDef | undefined) => (e?.fields ?? []).filter(f => !f.primaryKey)
const isDate = (f: FullstackFieldDef) => f.type === 'LOCAL_DATE' || f.type === 'LOCAL_DATE_TIME'

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
export function widgetKindDisabledReason(kind: FullstackWidgetDef['kind'], entity: FullstackEntityDef | undefined): string | undefined {
  if (kind === 'text' || kind === 'links') return undefined
  if (!entity) return 'Pick an entity first'
  const name = entity.name.trim() || 'This entity'
  switch (kind) {
    case 'bar':
    case 'donut':
      return groupableFields(entity).length > 0 ? undefined : `${name} has no enum or boolean field to break down by`
    case 'stacked':
      return groupableFields(entity).length > 1 ? undefined : `${name} needs two enum or boolean fields to stack`
    case 'line':
      return dateFields(entity).length > 0 ? undefined : `${name} has no date field to plot over`
    case 'top':
      return rankableKeys(entity).length > 0 ? undefined : `${name} has no enum, boolean or relation to rank by`
    default:
      return undefined
  }
}

/** A new widget of `kind` on `entity`, pre-filled with what the validator insists on so it is
 *  valid on sight; what the generator defaults (group by, date, series) stays implicit. */
export function newWidget(kind: FullstackWidgetDef['kind'], entity: string, pages: FullstackPageDef[] = []): FullstackWidgetDef {
  switch (kind) {
    case 'text': return { kind, entity: '', text: 'Note' }
    case 'links': return { kind, entity: '', pages: linkablePages(pages).slice(0, 4).map(p => p.id) }
    case 'progress': return { kind, entity, target: '100' }
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
  return resolved ? `Default (${labelOf(resolved)})` : `Default (first ${looksFor})`
}

// ── Page references (tabs point at pages by id) ─────────────────────────────

/** Follows a page id change into every tab that embeds the page. */
export function renamePageIdInPages(pages: FullstackPageDef[], from: string, to: string): FullstackPageDef[] {
  if (!from || from === to) return pages
  let changed = false
  const next = pages.map(page => {
    if (page.widgets?.some(w => w.pages?.includes(from))) {
      changed = true
      page = { ...page, widgets: page.widgets.map(w => (w.pages?.includes(from) ? { ...w, pages: w.pages.map(id => (id === from ? to : id)) } : w)) }
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

/** Drops the tabs and links pointing at `id` (the page is being removed). */
export function dropTabsTo(pages: FullstackPageDef[], id: string): FullstackPageDef[] {
  return pages.map(page => {
    if (page.widgets?.some(w => w.pages?.includes(id))) {
      page = { ...page, widgets: page.widgets.map(w => (w.pages?.includes(id) ? { ...w, pages: w.pages.filter(k => k !== id) } : w)) }
    }
    return page.tabs?.some(t => t.page === id) ? { ...page, tabs: page.tabs.filter(t => t.page !== id) } : page
  })
}

/** Follows a relation rename on `child` into the master-detail pages that link through it. */
export function renameRelationInPages(pages: FullstackPageDef[], child: string, from: string, to: string): FullstackPageDef[] {
  if (!child || !from || !to || from === to) return pages
  // `child` is the entity that owns the relation.
  const isChild = (name: string | undefined) => name != null && name.trim().toLowerCase() === child.trim().toLowerCase()
  let changed = false
  const next = pages.map(page => {
    if (page.type === 'entity-list' && isChild(page.entity) && page.columns?.includes(from)) {
      changed = true
      return { ...page, columns: page.columns.map(k => (k === from ? to : k)) }
    }
    if (page.type === 'wizard' && isChild(page.entity) && page.steps?.some(step => step.fields.includes(from))) {
      changed = true
      return { ...page, steps: page.steps.map(step => ({ ...step, fields: step.fields.map(name => (name === from ? to : name)) })) }
    }
    if (page.type === 'report' && isChild(page.entity) && reportCharts(page).some(c => c.groupBy === from)) {
      changed = true
      const follow = (c: FullstackChartDef) => (c.groupBy === from ? { ...c, groupBy: to } : c)
      return { ...page, ...(page.charts?.length ? { charts: page.charts.map(follow) } : { chart: follow(page.chart ?? {}) }) }
    }
    if (page.type === 'dashboard' && page.widgets?.some(w => w.kind === 'top' && isChild(w.entity) && w.groupBy === from)) {
      changed = true
      return { ...page, widgets: page.widgets.map(w => (w.kind === 'top' && isChild(w.entity) && w.groupBy === from ? { ...w, groupBy: to } : w)) }
    }
    if (page.type === 'record' && (page.childTabs?.some(t => isChild(childTabEntity(t)) && childTabVia(t) === from)
      || page.headerStats?.some(s => isChild(s.child) && s.via === from))) {
      changed = true
      return {
        ...page,
        childTabs: page.childTabs?.map(t => (isChild(childTabEntity(t)) && childTabVia(t) === from ? childTab(childTabEntity(t), to) : t)),
        headerStats: page.headerStats?.map(s => (isChild(s.child) && s.via === from ? { ...s, via: to } : s)),
      }
    }
    if (page.type !== 'master-detail' || !isChild(page.child) || page.via !== from) return page
    changed = true
    return { ...page, via: to }
  })
  return changed ? next : pages
}

/** A copy of `page` under a fresh id and a "(copy)" title; the caller places it. The copy's id
 *  is minted, so it follows the copy's title again. */
export function duplicatePage(page: FullstackPageDef, taken: Iterable<string>): FullstackPageDef {
  const copy = JSON.parse(JSON.stringify(page)) as FullstackPageDef
  copy.id = uniquePageId(`${page.id || 'page'}-copy`.slice(0, 40).replace(/-+$/, ''), taken)
  copy.title = `${pageLabel(page)} (copy)`
  delete copy.idLocked
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
  if (!field) return 'Pick a field to split by'
  const values = valuesOf(field)
  if (page.presetFilter?.[field.name] != null) return `This list is already filtered on ${field.name}`
  if (values.length < MIN_TABS) return `${field.name} needs at least ${MIN_TABS} values to split by`
  if (values.length > MAX_TABS) return `${field.name} has ${values.length} values; a tabs page takes at most ${MAX_TABS}`
  if (pages.length + values.length + 1 > MAX_PAGES) return `Splitting would take the layout past ${MAX_PAGES} pages`
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
        blurb: `Pick a ${parent.name} on the left, see its ${child.name} rows on the right.`,
        page: { idBase: parent.name, type: 'master-detail', parent: parent.name, child: child.name, ...(via ? { via } : {}) },
      })
    }
  }
  for (const parent of named) {
    if (!singlePk(parent) || !named.some(c => c !== parent && relationsTo(c, parent.name).length > 0)) continue
    if (pages.some(p => p.type === 'record' && sameName(p.entity, parent.name))) continue
    out.push({
      key: `record:${parent.name}`,
      icon: PAGE_TYPE_META.record.icon,
      label: `${parent.name} record`,
      blurb: `Open one ${parent.name} with its related lists as tabs.`,
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
        label: `${e.name} board`,
        blurb: `${e.name} rows as cards, a lane per ${lane} — drag one to move it.`,
        page: { idBase: `${e.name}-board`, type: 'entity-list', entity: e.name, title: `${e.name} board`, view: 'kanban' },
      })
    }
    if (views.includes('calendar') && !hasListIn('calendar')) {
      const date = e.fields.find(f => f.type === 'LOCAL_DATE' || f.type === 'LOCAL_DATE_TIME')?.name ?? 'date'
      out.push({
        key: `calendar:${e.name}`,
        icon: 'calendar_month',
        label: `${e.name} calendar`,
        blurb: `${e.name} rows on a month grid, by ${date}.`,
        page: { idBase: `${e.name}-calendar`, type: 'entity-list', entity: e.name, title: `${e.name} calendar`, view: 'calendar' },
      })
    }
  }
  for (const e of named) {
    const groupBy = defaultBarGroupBy(e)
    if (!groupBy || !groupableFields(e).some(f => f.name === groupBy)) continue
    if (pages.some(p => p.type === 'report' && sameName(p.entity, e.name))) continue
    const number = numericFields(e)[0]
    out.push({
      key: `report:${e.name}`,
      icon: PAGE_TYPE_META.report.icon,
      label: number ? `${e.name}: ${number.name} by ${groupBy}` : `${e.name} by ${groupBy}`,
      blurb: 'Filters, a chart and grouped totals.',
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
      label: `${e.name} trends`,
      blurb: `A dashboard with ${e.name} counted per month.`,
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
    if (pages.some(p => p.type === 'wizard' && sameName(p.entity, e.name))) continue
    out.push({
      key: `wizard:${e.name}`,
      icon: PAGE_TYPE_META.wizard.icon,
      label: `New ${e.name} wizard`,
      blurb: `${askableFields(e).length} fields is a long form — ask for them step by step.`,
      page: { idBase: `new-${e.name}`, type: 'wizard', entity: e.name, title: `New ${e.name}`, steps: defaultWizardSteps(e) },
    })
  }
  return out.slice(0, limit)
}

/** Materializes a suggestion under a free id. */
export function pageFromSuggestion(s: PageSuggestion, taken: Iterable<string>): FullstackPageDef {
  const { idBase, ...rest } = JSON.parse(JSON.stringify(s.page)) as PageSuggestion['page']
  return { id: uniquePageId(slugify(idBase) || 'page', taken), ...rest }
}


// ── New pages, and a page moved to another type ─────────────────────────────

/** A new page of `type`, filled in with the first entities (and pages) that fit so it is valid on sight. */
export function blankPage(type: FullstackPageType, entities: FullstackEntityDef[], pages: FullstackPageDef[]): FullstackPageDef {
  const taken = pages.map(p => p.id)
  const first = entities[0]?.name ?? ''
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
      const pair = masterDetailPairs(entities)[0]
      return { id: id(pair?.parent ?? first), type, parent: pair?.parent ?? first, child: pair?.child, ...(pair?.via ? { via: pair.via } : {}) }
    }
    case 'record':
      return { id: id(first), type, entity: first, hidden: true }
    case 'report': {
      // Prefer an entity that actually has something to chart, so the page is valid on sight.
      const e = entities.find(x => chartableFields(x).length > 0) ?? entities[0]
      return { id: id(`${e?.name ?? 'report'}-report`), type, entity: e?.name ?? first, chart: {} }
    }
    case 'wizard': {
      // A writable entity, with its default steps spelled out so they can be edited.
      const e = entities.find(x => !x.readOnly && askableFields(x).length > 0) ?? entities[0]
      return { id: id(`new-${e?.name ?? 'record'}`), type, entity: e?.name ?? first, title: `New ${e?.name ?? 'record'}`, steps: defaultWizardSteps(e) }
    }
  }
}

/** The pages a links widget can open: any but a record page (it needs a row) or a hidden page
 *  that is not a wizard (a hidden wizard is a route of its own). */
export function linkablePages(pages: FullstackPageDef[]): FullstackPageDef[] {
  return pages.filter(p => p.type !== 'record' && (!p.hidden || p.type === 'wizard'))
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
  if ((type === 'entity-list' || type === 'report') && page.presetFilter && eq(next.entity, was)) {
    const kept = keptPresetFilter(page.presetFilter, e)
    if (kept) next.presetFilter = kept
  }

  const dropped: string[] = []
  const lost = (had: unknown, has: unknown, label: string) => { if (had != null && has == null) dropped.push(label) }
  const nowEntity = next.entity ?? next.parent
  if (was && !eq(nowEntity, was)) dropped.push('entity')
  lost(page.presetFilter, next.presetFilter, 'filter')
  lost(page.columns, next.columns, 'columns')
  lost(page.sort, next.sort, 'sort')
  lost(page.view, next.view, 'view')
  lost(page.pageSize, next.pageSize, 'page size')
  lost(page.widgets, next.widgets, 'widgets')
  lost(page.dateRange, next.dateRange, 'period picker')
  lost(page.tabs, next.tabs, 'tabs')
  if (page.type === 'master-detail' && type !== 'master-detail') dropped.push('child list')
  lost(page.chart ?? page.charts, next.chart ?? next.charts, 'charts')
  lost(page.steps, next.steps, 'wizard steps')
  lost(page.childTabs, next.childTabs, 'related lists')
  lost(page.headerStats, next.headerStats, 'header numbers')
  if ((page.group || page.icon) && !inNav(next)) dropped.push('nav place')
  return { page: next, dropped }
}

// ── Undo labels ──────────────────────────────────────────────────────────────

/** A short name for what changed between two layouts — the undo history's entry label. */
export function describePagesChange(prev: FullstackPageDef[], next: FullstackPageDef[]): string {
  if (prev.length === 0 && next.length > 0) return 'Started a page layout'
  if (next.length === 0 && prev.length > 0) return 'Switched to the classic page layout'
  if (next.length > prev.length) {
    const added = next.filter(n => !prev.some(p => p.id === n.id))
    if (added.length > 1) return `Added ${added.length} pages (“${pageLabel(added[0])}”…)`
    return `Added the “${pageLabel(added[0] ?? next[next.length - 1])}” page`
  }
  if (next.length < prev.length) {
    const gone = prev.find(p => !next.some(n => n.id === p.id))
    return gone ? `Removed the “${pageLabel(gone)}” page` : 'Removed a page'
  }
  const key = (p: FullstackPageDef) => JSON.stringify(p)
  if (prev.map(key).sort().join('\n') === next.map(key).sort().join('\n')) return 'Reordered pages'
  // Every change is the same group name becoming another: the nav strip's rename.
  const changed = next.map((b, i) => [prev[i], b] as const).filter(([a, b]) => key(a) !== key(b))
  if (changed.length > 0 && changed.every(([a, b]) => a.id === b.id && key({ ...a, group: b.group }) === key(b))) {
    const from = changed[0][0].group
    const to = changed[0][1].group
    if (from && changed.every(([a, b]) => a.group === from && b.group === to) && (changed.length > 1 || !to)) {
      return to ? `Renamed the “${from}” group to “${to}”` : `Ungrouped the “${from}” pages`
    }
  }
  for (let i = 0; i < next.length; i++) {
    const a = prev[i]; const b = next[i]
    if (key(a) === key(b)) continue
    const name = pageLabel(b)
    if (a.type !== b.type) return `Changed “${name}” to a ${PAGE_TYPE_META[b.type].label.toLowerCase()} page`
    if (a.title !== b.title || a.id !== b.id) return `Renamed the “${name}” page`
    const wa = a.widgets ?? []; const wb = b.widgets ?? []
    if (wb.length > wa.length) return `Added a widget to “${name}”`
    if (wb.length < wa.length) return `Removed a widget from “${name}”`
    const ta = a.tabs ?? []; const tb = b.tabs ?? []
    if (tb.length > ta.length) return `Added a tab to “${name}”`
    if (tb.length < ta.length) return `Removed a tab from “${name}”`
    if (Boolean(a.hidden) !== Boolean(b.hidden)) {
      return b.hidden ? `Hid “${name}” from the navigation` : `Showed “${name}” in the navigation`
    }
    return `Edited the “${name}” page`
  }
  return 'Changed page layout'
}

// ── Keeping settings across a kind / entity switch ──────────────────────────

/** Preset-filter entries that still apply to `entity` (a filterable enum/boolean with that value). */
export function keptPresetFilter(filter: Record<string, string> | undefined, entity: FullstackEntityDef | undefined): Record<string, string> | undefined {
  if (!filter) return undefined
  const presettable = presettableFields(entity)
  const kept: Record<string, string> = {}
  for (const [k, v] of Object.entries(filter)) {
    const f = presettable.find(x => x.name === k)
    if (f && !presetValueProblem(f, v)) kept[k] = v
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
  if (kind === 'text' || kind === 'links') {
    const kept: FullstackWidgetDef = { kind, entity: '', ...(next.title ? { title: next.title } : {}) }
    if (kind === 'text' && next.text) kept.text = next.text
    if (kind === 'links') kept.pages = next.pages ?? []
    if (next.span != null && next.span !== defaultSpan(kind)) kept.span = next.span
    const lost = (['groupBy', 'agg', 'limit', 'sortBy', 'compare', 'target', 'presetFilter', 'dateField', 'series'] as const)
      .filter(k => next[k] != null)
    const dropped = lost.length ? ['data settings'] : []
    if (kind === 'links' && next.text != null) dropped.push('text')
    if (kind === 'text' && next.pages != null) dropped.push('pages')
    return { widget: kept, dropped }
  }
  if (next.text != null) drop(['text'], 'text')
  if (next.pages != null) drop(['pages'], 'pages')
  if (kind === 'list') {
    if (next.columns) {
      const keys = listColumns(entity, scaffoldOpts).map(c => c.key)
      const kept = next.columns.filter(k => keys.includes(k))
      if (kept.length < next.columns.length) dropped.push('columns')
      if (kept.length) next.columns = kept
      else delete next.columns
    }
    if (next.sort && !sortableKeys(entity, scaffoldOpts).includes(next.sort.field)) drop(['sort'], 'sort')
    if (next.limit != null && !LIST_WIDGET_LIMITS.includes(next.limit)) drop(['limit'], 'row limit')
  } else {
    if (next.columns != null) drop(['columns'], 'columns')
    if (next.sort != null) drop(['sort'], 'sort')
  }
  if (next.groupBy != null) {
    const fits = kind === 'bar' || kind === 'donut' || kind === 'stacked' ? groupableFields(entity).some(f => f.name === next.groupBy)
      : kind === 'line' ? dateFields(entity).some(f => f.name === next.groupBy)
        : kind === 'top' ? rankableKeys(entity).includes(next.groupBy)
          : false
    if (!fits) drop(['groupBy'], 'group by')
  }
  if (kind !== 'line') drop(['bucket'], 'bucket')
  if (next.series != null && (kind !== 'stacked' || !groupableFields(entity).some(f => f.name === next.series))) drop(['series'], 'split by')
  if (kind === 'recent' || kind === 'list') drop(['agg', 'field'], 'aggregate')
  else if (next.field != null && !numericFields(entity).some(f => f.name === next.field)) drop(['agg', 'field'], 'aggregate')
  if (kind !== 'recent' && kind !== 'top' && kind !== 'list') drop(['limit'], 'row limit')
  if (next.sortBy != null && (kind !== 'recent' || !(entity?.fields ?? []).some(f => !f.primaryKey && f.name === next.sortBy))) {
    drop(['sortBy'], 'sort')
  }
  if (kind !== 'kpi') drop(['compare'], 'period comparison')
  if (kind !== 'progress') drop(['target'], 'target')
  if (next.dateField != null && !filterableDateFields(entity).some(f => f.name === next.dateField)) drop(['dateField'], 'period date')
  if (next.presetFilter) {
    const kept = keptPresetFilter(next.presetFilter, entity)
    if (Object.keys(kept ?? {}).length < Object.keys(next.presetFilter).length) dropped.push('filter')
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
  if (Object.keys(presetFilter ?? {}).length < Object.keys(page.presetFilter ?? {}).length) dropped.push('filter')
  let columns = page.columns
  if (columns) {
    const keys = listColumns(entity, scaffoldOpts).map(c => c.key)
    const kept = columns.filter(k => keys.includes(k))
    if (kept.length < columns.length) dropped.push('columns')
    columns = kept.length ? kept : undefined
  }
  let sort = page.sort
  if (sort && !sortableKeys(entity, scaffoldOpts).includes(sort.field)) {
    dropped.push('sort')
    sort = undefined
  }
  let view = page.view
  if (view && !enabledListViews(entity).includes(view)) {
    dropped.push('view')
    view = undefined
  }
  let detail = page.detail
  if (detail === 'side' && entity && !singlePk(entity)) {
    dropped.push('side pane')
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
    dropped.push('child')
    child = undefined
  }
  if (!child && kids.length === 1) child = kids[0].name
  let via = page.via
  if (via && !relationsTo(entities.find(e => e.name === child), parent).includes(via)) {
    dropped.push('linked-through relation')
    via = undefined
  }
  return { patch: { parent, child, via }, dropped }
}

/** A master-detail page moved to another child: the link stays when the new child also has it. */
export function retargetMasterDetailChild(page: FullstackPageDef, child: string, entities: FullstackEntityDef[]): { patch: Partial<FullstackPageDef>; dropped: string[] } {
  const dropped: string[] = []
  let via = page.via
  if (via && !relationsTo(entities.find(e => e.name === child), page.parent).includes(via)) {
    dropped.push('linked-through relation')
    via = undefined
  }
  return { patch: { child, via }, dropped }
}

/** A record page moved to another entity: its related lists and header numbers described the old
 *  entity's relations, so both go back to the defaults. */
export function retargetRecord(page: FullstackPageDef, entity: string): { patch: Partial<FullstackPageDef>; dropped: string[] } {
  const dropped: string[] = []
  if (page.childTabs != null) dropped.push('related lists')
  if (page.headerStats != null) dropped.push('header numbers')
  return { patch: { entity, childTabs: undefined, headerStats: undefined }, dropped }
}

/** A dashboard whose period picker is switched off: its widgets' period date and comparison go with it. */
export function stripDateRange(page: FullstackPageDef): { patch: Partial<FullstackPageDef>; dropped: string[] } {
  const widgets = page.widgets ?? []
  const dropped: string[] = []
  if (widgets.some(w => w.dateField)) dropped.push('period date')
  if (widgets.some(w => w.compare)) dropped.push('period comparison')
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
      dropped.push('group by')
      delete n.groupBy
      delete n.bucket
    }
    if (n.bucket != null && n.groupBy != null && !dateFields(entity).some(f => f.name === n.groupBy)) delete n.bucket
    if (n.field != null && !numeric.some(f => f.name === n.field)) {
      dropped.push('aggregate')
      delete n.agg
      delete n.field
    }
    return n
  })
  const presetFilter = keptPresetFilter(page.presetFilter, entity)
  if (Object.keys(presetFilter ?? {}).length < Object.keys(page.presetFilter ?? {}).length) dropped.push('filter')
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
  const askable = askableFields(entity).map(a => a.name)
  const asked = (steps ?? []).flatMap(s => s.fields)
  const kept = (steps ?? []).map(s => ({ ...s, fields: s.fields.filter(f => askable.includes(f)) })).filter(s => s.fields.length > 0)
  const keptCount = kept.flatMap(s => s.fields).length
  // Keep the old shape only when it still covers most of the new form; otherwise start over.
  if (keptCount * 2 < askable.length) return { steps: defaultWizardSteps(entity), dropped: asked.length > 0 ? ['step layout'] : [] }
  const placed = new Set(kept.flatMap(s => s.fields))
  const rest = askable.filter(a => !placed.has(a))
  for (let i = 0; i < rest.length; i += DEFAULT_STEP_SIZE) {
    if (kept.length >= MAX_STEPS) {
      kept[kept.length - 1].fields.push(...rest.slice(i))
      break
    }
    kept.push({ fields: rest.slice(i, i + DEFAULT_STEP_SIZE) })
  }
  return { steps: kept, dropped: keptCount < asked.length ? ['fields'] : [] }
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
