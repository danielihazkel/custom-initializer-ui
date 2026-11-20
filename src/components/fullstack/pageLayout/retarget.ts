import type { FullstackChartDef, FullstackEntityDef, FullstackPageDef, FullstackPageType, FullstackWidgetDef } from '../../../types'
import { t } from '../../../i18n'
import { blankNewTypePage, newTypeReason } from '../newPageTypes'
import { DEFAULT_STEP_SIZE, LIST_WIDGET_LIMITS, MAX_RECENT_LIMIT, MAX_STEPS } from './limits'
import { sameName, singlePk } from './entityHelpers'
import { auditOn, enabledListViews, listColumns, sortableKeys } from './listPresentation'
import { askableFields, defaultWizardSteps, stepFields } from './wizardFields'
import { chartableFields, chartKindsFor, dateFields, defaultChartSeries, defaultReportGroupBy, defaultSpan, filterableDateFields, funnelStageFields, groupByFields, MIN_ACTIVITY_LIMIT, numericFields, rankableKeys, relationKeys, reportCharts } from './dashboard'
import { inNav } from './nav'
import { presettableFields, presetValueProblem, relationOfPresetKey } from './presets'
import { relationsTo } from './childTabs'
import { blankPage, masterDetailPairs } from './newPages'

/**
 * Keeping what still fits when a page changes type or entity, or a widget its kind or entity —
 * and naming what had to be dropped, so the editor can say so and offer an undo.
 */

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
