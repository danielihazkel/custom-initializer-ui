import type { FullstackChartDef, FullstackChartKind, FullstackDateRange, FullstackEntityDef, FullstackFieldDef, FullstackPageDef, FullstackWidgetDef } from '../../../types'
import { t } from '../../../i18n'
import { isDateType, isNumericType } from '../fieldTypes'
import { LIMITS } from '../schema'
import { sameName } from './entityHelpers'
import { linkablePages } from './pageKinds'
import { auditOn } from './listPresentation'

/**
 * Dashboard and report choices: what a widget or chart may group by, measure and plot over, the
 * defaults the generator resolves when a setting is left out, the dashboard's filters and
 * period, and why a widget kind cannot be had for an entity.
 */

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
