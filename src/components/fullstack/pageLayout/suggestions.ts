import type { FullstackEntityDef, FullstackFieldDef, FullstackListView, FullstackPageDef, FullstackWidgetDef } from '../../../types'
import { t } from '../../../i18n'
import { isDateType } from '../fieldTypes'
import { humanize, pluralize, relationLabel } from '../naming'
import { MAX_WIDGETS } from './limits'
import { sameName, singlePk } from './entityHelpers'
import { createsRows } from './pageKinds'
import { enabledListViews } from './listPresentation'
import { askableFields, defaultWizardSteps } from './wizardFields'
import { dateFields, defaultBarGroupBy, defaultLineGroupBy, defaultTopGroupBy, groupableFields, groupByFields, numericFields } from './dashboard'
import { relationsTo } from './childTabs'
import { validatePages } from './validate'
import { PAGE_TYPE_META, slugify, uniquePageId } from './labels'

/**
 * Suggestions: pages worth adding to this model (the "Add page" gallery) and widgets worth
 * adding to this dashboard (the designer's library), each one valid as suggested.
 */

export interface PageSuggestion {
  key: string
  icon: string
  label: string
  blurb: string
  /** The page to add; `idBase` becomes its id once made unique. */
  page: Omit<FullstackPageDef, 'id'> & { idBase: string }
}

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
