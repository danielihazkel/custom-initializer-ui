import type { FullstackChartDef, FullstackChildTabDef, FullstackEntityDef, FullstackPageDef } from '../../types'
import { fieldLabel } from './uiPreview'
import {
  MAX_CHARTS, MAX_CHILD_TABS, MAX_HEADER_STATS, MAX_STEPS, MAX_TABS, MAX_TITLE, PAGE_TYPE_META,
  stepFields, childTabEntity, dateFields, defaultWizardSteps, pageLabel, relationKeys,
  relationsTo, reportCharts, reportGroupKeys,
} from './pageLayout'
import { t } from '../../i18n'

/**
 * A part of a page that the layout designer drags onto the canvas, besides a dashboard widget:
 * another page as a tab, a report chart, a record page's related list or header number, a wizard
 * field. `at` on a drop is the index it takes (a wizard field: the step it moves into, the step
 * count for a new step).
 */
export type PagePart =
  | { kind: 'tab'; page: string }
  | { kind: 'chart'; groupBy: string }
  | { kind: 'child-tab'; entity: string }
  | { kind: 'header-stat'; entity: string }
  | { kind: 'step-field'; field: string }

export type PartSlot = PagePart['kind']

/** The parts each page type takes. */
export const PAGE_SLOTS: Partial<Record<FullstackPageDef['type'], PartSlot[]>> = {
  tabs: ['tab'],
  report: ['chart'],
  record: ['child-tab', 'header-stat'],
  wizard: ['step-field'],
}

export interface PartCard {
  key: string
  part: PagePart
  label: string
  blurb: string
  icon: string
  /** Why it cannot go on the page now (already there, or the page is full). */
  reason?: string
}

export interface PartGroup {
  slot: PartSlot
  label: string
  /** Where on the canvas the cards drop. */
  hint: string
  cards: PartCard[]
}

const entityLabel = (e: FullstackEntityDef) => e.label?.trim() || e.name

const keyText = (entity: FullstackEntityDef | undefined, key: string) => {
  const field = entity?.fields.find(f => f.name === key)
  return field ? fieldLabel(field) : fieldLabel({ name: key })
}

/** The pages a tabs page can embed: anything but itself, another tabs page or a record page. */
function tabTargets(pages: FullstackPageDef[], page: FullstackPageDef): FullstackPageDef[] {
  return pages.filter(p => p !== page && p.id && p.type !== 'tabs' && p.type !== 'record')
}

/** A record page's related tabs as the generator reads them: named, else every related entity. */
function childTabsOf(page: FullstackPageDef, entities: FullstackEntityDef[]): FullstackChildTabDef[] {
  return page.childTabs ?? entities.filter(e => relationsTo(e, page.entity).length > 0).map(e => e.name)
}

/** A record page's header numbers as drawn: named, else a count per related tab (four at most). */
function headerStatsOf(page: FullstackPageDef, entities: FullstackEntityDef[]): NonNullable<FullstackPageDef['headerStats']> {
  return page.headerStats ?? childTabsOf(page, entities).slice(0, MAX_HEADER_STATS).map(tab => ({ child: childTabEntity(tab) }))
}

/** A wizard's steps as the generator deals them: named, else four fields to a step. */
export function wizardStepsOf(page: FullstackPageDef, entities: FullstackEntityDef[]): { title?: string; fields: string[] }[] {
  return page.steps ?? defaultWizardSteps(entities.find(e => e.name === page.entity))
}

/** The library's cards for the page on the canvas, by the slot they drop into. */
export function pageParts(pages: FullstackPageDef[], index: number, entities: FullstackEntityDef[]): PartGroup[] {
  const page = pages[index]
  if (!page) return []
  const entity = entities.find(e => e.name === page.entity)
  switch (page.type) {
    case 'tabs': {
      const tabs = page.tabs ?? []
      const full = tabs.length >= MAX_TABS ? t('A tabs page holds at most {max} pages', { max: MAX_TABS }) : undefined
      return [{
        slot: 'tab',
        label: t('Pages to embed'),
        hint: t('Drop on the tab strip — or drag a page from the strip above'),
        cards: tabTargets(pages, page).map(p => ({
          key: `tab:${p.id}`,
          part: { kind: 'tab', page: p.id },
          label: pageLabel(p),
          blurb: `${PAGE_TYPE_META[p.type]?.label ?? p.type} · #/${p.id}`,
          icon: PAGE_TYPE_META[p.type]?.icon ?? 'web_asset',
          reason: tabs.some(tab => tab.page === p.id) ? t('Already a tab here') : full,
        })),
      }]
    }
    case 'report': {
      const charts = reportCharts(page)
      const full = charts.length >= MAX_CHARTS ? t('A report has at most {max} charts', { max: MAX_CHARTS }) : undefined
      const dates = new Set(dateFields(entity).map(f => f.name))
      const relations = new Set(relationKeys(entity))
      return [{
        slot: 'chart',
        label: entity ? t('Charts of {entity}', { entity: entityLabel(entity) }) : t('Charts'),
        hint: t('Drop beside a chart on the report'),
        cards: reportGroupKeys(entity).map(key => {
          const shown = charts.some(c => c.groupBy === key)
          const field = keyText(entity, key).toLowerCase()
          const how = dates.has(key) ? t('A trend over {field}', { field }) : relations.has(key) ? t('Totals per {field}', { field }) : t('Bars by {field}', { field })
          return {
            key: `chart:${key}`,
            part: { kind: 'chart', groupBy: key },
            label: t('By {field}', { field: keyText(entity, key) }),
            blurb: `${how}${shown ? ` · ${t('already charted')}` : ''}`,
            icon: dates.has(key) ? 'show_chart' : relations.has(key) ? 'account_tree' : 'bar_chart',
            reason: full,
          }
        }),
      }]
    }
    case 'record': {
      const related = entities.filter(e => relationsTo(e, page.entity).length > 0)
      const tabs = childTabsOf(page, entities).map(childTabEntity)
      const stats = headerStatsOf(page, entities)
      const tabsFull = tabs.length >= MAX_CHILD_TABS ? t('A record page has at most {max} related tabs', { max: MAX_CHILD_TABS }) : undefined
      const statsFull = stats.length >= MAX_HEADER_STATS ? t('A record page has at most {max} header numbers', { max: MAX_HEADER_STATS }) : undefined
      return [
        {
          slot: 'child-tab',
          label: t('Related lists'),
          hint: t('Drop on the tabs under the record'),
          cards: related.map(e => ({
            key: `child-tab:${e.name}`,
            part: { kind: 'child-tab', entity: e.name },
            label: entityLabel(e),
            blurb: t('A tab of the {entity} rows linked to it', { entity: entityLabel(e).toLowerCase() }),
            icon: 'tab',
            reason: tabs.includes(e.name) ? t('Already a tab here') : tabsFull,
          })),
        },
        {
          slot: 'header-stat',
          label: t('Header numbers'),
          hint: t('Drop on the numbers above the tabs'),
          cards: related.map(e => ({
            key: `header-stat:${e.name}`,
            part: { kind: 'header-stat', entity: e.name },
            label: t('Count of {entity}', { entity: entityLabel(e) }),
            blurb: t('How many {entity} rows link to it', { entity: entityLabel(e).toLowerCase() }),
            icon: 'tag',
            reason: stats.some(s => s.child === e.name && !s.agg && !s.via) ? t('Already counted') : statsFull,
          })),
        },
      ]
    }
    case 'wizard': {
      const steps = wizardStepsOf(page, entities)
      return [{
        slot: 'step-field',
        label: entity ? t('Fields of {entity}', { entity: entityLabel(entity) }) : t('Fields'),
        hint: t('Drop on a step to ask for it there'),
        cards: stepFields(entity).map(a => {
          const step = steps.findIndex(s => s.fields.includes(a.name))
          return {
            key: `step-field:${a.name}`,
            part: { kind: 'step-field', field: a.name },
            label: keyText(entity, a.name),
            blurb: `${step < 0 ? t('Not asked yet') : t('Step {n}', { n: step + 1 })}${a.required ? ` · ${t('required')}` : ''}${a.relation ? ` · ${t('picker')}` : ''}`,
            icon: a.relation ? 'link' : 'text_fields',
          }
        }),
      }]
    }
    default:
      return []
  }
}

export type PlacedPart = { patch: Partial<FullstackPageDef>; label: string } | { reason: string }

const insert = <T,>(list: T[], item: T, at: number | undefined): T[] => {
  const next = [...list]
  next.splice(at == null ? next.length : Math.max(0, Math.min(at, next.length)), 0, item)
  return next
}

/**
 * Puts `part` on page `index` at `at` (default: the end): the page patch and an undo label, or why
 * it cannot go there. The rules are the inspector's — the caps, and nothing shown twice.
 */
export function placePart(pages: FullstackPageDef[], index: number, entities: FullstackEntityDef[], part: PagePart, at?: number): PlacedPart {
  const page = pages[index]
  if (!page) return { reason: t('No page to drop on') }
  const where = `“${pageLabel(page)}”`
  if (!(PAGE_SLOTS[page.type] ?? []).includes(part.kind)) return { reason: t('That does not go on {where}', { where }) }
  const entity = entities.find(e => e.name === page.entity)
  switch (part.kind) {
    case 'tab': {
      const tabs = page.tabs ?? []
      const target = tabTargets(pages, page).find(p => p.id === part.page)
      if (!target) return { reason: part.page === page.id ? t('A tabs page cannot be one of its own tabs') : t('A tabs page embeds lists, dashboards, reports and the like — not a tabs or record page') }
      if (tabs.some(tab => tab.page === part.page)) return { reason: t('{page} is already a tab of {where}', { page: pageLabel(target), where }) }
      if (tabs.length >= MAX_TABS) return { reason: t('A tabs page holds at most {max} pages', { max: MAX_TABS }) }
      return { patch: { tabs: insert(tabs, { page: part.page }, at) }, label: t('Added “{page}” as a tab of {where}', { page: pageLabel(target), where }) }
    }
    case 'chart': {
      if (!reportGroupKeys(entity).includes(part.groupBy)) return { reason: t('{entity} has no {field} to chart', { entity: entity ? entityLabel(entity) : t('The report'), field: part.groupBy }) }
      const charts = reportCharts(page)
      if (charts.length >= MAX_CHARTS) return { reason: t('A report has at most {max} charts', { max: MAX_CHARTS }) }
      const next: FullstackChartDef[] = insert(charts, { groupBy: part.groupBy }, at)
      return { patch: { charts: next, chart: undefined }, label: t('Added a chart by {field} to {where}', { field: keyText(entity, part.groupBy).toLowerCase(), where }) }
    }
    case 'child-tab': {
      const child = entities.find(e => e.name === part.entity)
      if (!child || relationsTo(child, page.entity).length === 0) return { reason: t('{entity} has no link to {record}', { entity: part.entity, record: page.entity ?? t('this record') }) }
      const tabs = childTabsOf(page, entities)
      if (tabs.some(tab => childTabEntity(tab) === part.entity)) return { reason: t('{entity} is already a tab of {where}', { entity: entityLabel(child), where }) }
      if (tabs.length >= MAX_CHILD_TABS) return { reason: t('A record page has at most {max} related tabs', { max: MAX_CHILD_TABS }) }
      return { patch: { childTabs: insert(tabs, part.entity, at) }, label: t('Added the {entity} tab to {where}', { entity: entityLabel(child), where }) }
    }
    case 'header-stat': {
      const child = entities.find(e => e.name === part.entity)
      if (!child || relationsTo(child, page.entity).length === 0) return { reason: t('{entity} has no link to {record}', { entity: part.entity, record: page.entity ?? t('this record') }) }
      const stats = headerStatsOf(page, entities)
      if (stats.length >= MAX_HEADER_STATS) return { reason: t('A record page has at most {max} header numbers', { max: MAX_HEADER_STATS }) }
      return { patch: { headerStats: insert(stats, { child: part.entity }, at) }, label: t('Added a count of {entity} to {where}', { entity: entityLabel(child), where }) }
    }
    case 'step-field': {
      if (!stepFields(entity).some(a => a.name === part.field)) return { reason: t('The wizard does not ask for {field}', { field: part.field }) }
      const steps = wizardStepsOf(page, entities)
      const to = at == null ? steps.length - 1 : at
      if (to < 0 || to > steps.length) return { reason: t('No such step') }
      if (to === steps.length && steps.length >= MAX_STEPS) return { reason: t('A wizard has at most {max} steps', { max: MAX_STEPS }) }
      const from = steps.findIndex(s => s.fields.includes(part.field))
      if (from === to) return { reason: t('{field} is already asked for in step {n}', { field: keyText(entity, part.field), n: to + 1 }) }
      const grown = to === steps.length ? [...steps, { fields: [] }] : steps
      const moved = grown.map((s, i) => ({ ...s, fields: i === to ? [...s.fields, part.field] : s.fields.filter(f => f !== part.field) }))
      // A step the field leaves empty would ask for nothing (a validation error): it goes.
      const next = moved.filter((s, i) => s.fields.length > 0 || i === to)
      const field = keyText(entity, part.field)
      const n = next.indexOf(moved[to]) + 1
      const label = from < 0
        ? (to === steps.length ? t('Asked for {field} into a new step of {where}', { field, where }) : t('Asked for {field} to step {n} of {where}', { field, n, where }))
        : (to === steps.length ? t('Moved {field} into a new step of {where}', { field, where }) : t('Moved {field} to step {n} of {where}', { field, n, where }))
      return { patch: { steps: next }, label }
    }
  }
}

/**
 * A title renamed on the canvas — a widget's (`widget.N.title`), a tab's (`tabs.N.title`), a
 * wizard step's (`steps.N.title`) or a record header number's (`headerStats.N.title`): the page
 * patch and an undo label, or why not. A blank title goes back to the default. A wizard's dealt
 * steps and a record's default numbers are written out first, as a drop onto them is.
 * (The page's own title is `retitle`'s, which keeps the id in step.)
 */
export function renamePart(pages: FullstackPageDef[], index: number, entities: FullstackEntityDef[], control: string, value: string): PlacedPart {
  const page = pages[index]
  if (!page) return { reason: t('No page to rename on') }
  const m = /^(widget|tabs|steps|headerStats)\.(\d+)\.title$/.exec(control)
  if (!m) return { reason: t('That cannot be renamed here') }
  const at = Number(m[2])
  const title = value.trim().slice(0, MAX_TITLE) || undefined
  const where = `“${pageLabel(page)}”`
  const said = title ? `“${title}”` : t('its default')
  const retitled = <T extends { title?: string }>(list: T[]): T[] => list.map((item, i) => (i === at ? { ...item, title } : item))
  switch (m[1]) {
    case 'widget': {
      const widgets = page.widgets ?? []
      if (!widgets[at]) return { reason: t('No such widget') }
      return { patch: { widgets: retitled(widgets) }, label: t('Renamed widget {n} of {where} to {title}', { n: at + 1, where, title: said }) }
    }
    case 'tabs': {
      const tabs = page.tabs ?? []
      if (!tabs[at]) return { reason: t('No such tab') }
      return { patch: { tabs: retitled(tabs) }, label: t('Renamed tab {n} of {where} to {title}', { n: at + 1, where, title: said }) }
    }
    case 'steps': {
      const steps = wizardStepsOf(page, entities)
      if (!steps[at]) return { reason: t('No such step') }
      return { patch: { steps: retitled(steps) }, label: t('Renamed step {n} of {where} to {title}', { n: at + 1, where, title: said }) }
    }
    default: {
      const stats = headerStatsOf(page, entities)
      if (!stats[at]) return { reason: t('No such number') }
      return { patch: { headerStats: retitled(stats) }, label: t('Renamed header number {n} of {where} to {title}', { n: at + 1, where, title: said }) }
    }
  }
}
