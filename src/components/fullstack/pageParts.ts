import type { FullstackChartDef, FullstackChildTabDef, FullstackEntityDef, FullstackPageDef } from '../../types'
import { fieldLabel } from './uiPreview'
import {
  MAX_CHARTS, MAX_CHILD_TABS, MAX_HEADER_STATS, MAX_STEPS, MAX_TABS, PAGE_TYPE_META,
  askableFields, childTabEntity, dateFields, defaultWizardSteps, pageLabel, relationKeys,
  relationsTo, reportCharts, reportGroupKeys,
} from './pageLayout'

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
  return page.headerStats ?? childTabsOf(page, entities).slice(0, MAX_HEADER_STATS).map(t => ({ child: childTabEntity(t) }))
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
      const full = tabs.length >= MAX_TABS ? `A tabs page holds at most ${MAX_TABS} pages` : undefined
      return [{
        slot: 'tab',
        label: 'Pages to embed',
        hint: 'Drop on the tab strip — or drag a page from the strip above',
        cards: tabTargets(pages, page).map(p => ({
          key: `tab:${p.id}`,
          part: { kind: 'tab', page: p.id },
          label: pageLabel(p),
          blurb: `${PAGE_TYPE_META[p.type]?.label ?? p.type} · #/${p.id}`,
          icon: PAGE_TYPE_META[p.type]?.icon ?? 'web_asset',
          reason: tabs.some(t => t.page === p.id) ? 'Already a tab here' : full,
        })),
      }]
    }
    case 'report': {
      const charts = reportCharts(page)
      const full = charts.length >= MAX_CHARTS ? `A report has at most ${MAX_CHARTS} charts` : undefined
      const dates = new Set(dateFields(entity).map(f => f.name))
      const relations = new Set(relationKeys(entity))
      return [{
        slot: 'chart',
        label: entity ? `Charts of ${entityLabel(entity)}` : 'Charts',
        hint: 'Drop beside a chart on the report',
        cards: reportGroupKeys(entity).map(key => {
          const shown = charts.some(c => c.groupBy === key)
          const how = dates.has(key) ? 'A trend over' : relations.has(key) ? 'Totals per' : 'Bars by'
          return {
            key: `chart:${key}`,
            part: { kind: 'chart', groupBy: key },
            label: `By ${keyText(entity, key)}`,
            blurb: `${how} ${keyText(entity, key).toLowerCase()}${shown ? ' · already charted' : ''}`,
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
      const tabsFull = tabs.length >= MAX_CHILD_TABS ? `A record page has at most ${MAX_CHILD_TABS} related tabs` : undefined
      const statsFull = stats.length >= MAX_HEADER_STATS ? `A record page has at most ${MAX_HEADER_STATS} header numbers` : undefined
      return [
        {
          slot: 'child-tab',
          label: 'Related lists',
          hint: 'Drop on the tabs under the record',
          cards: related.map(e => ({
            key: `child-tab:${e.name}`,
            part: { kind: 'child-tab', entity: e.name },
            label: entityLabel(e),
            blurb: `A tab of the ${entityLabel(e).toLowerCase()} rows linked to it`,
            icon: 'tab',
            reason: tabs.includes(e.name) ? 'Already a tab here' : tabsFull,
          })),
        },
        {
          slot: 'header-stat',
          label: 'Header numbers',
          hint: 'Drop on the numbers above the tabs',
          cards: related.map(e => ({
            key: `header-stat:${e.name}`,
            part: { kind: 'header-stat', entity: e.name },
            label: `Count of ${entityLabel(e)}`,
            blurb: `How many ${entityLabel(e).toLowerCase()} rows link to it`,
            icon: 'tag',
            reason: stats.some(s => s.child === e.name && !s.agg && !s.via) ? 'Already counted' : statsFull,
          })),
        },
      ]
    }
    case 'wizard': {
      const steps = wizardStepsOf(page, entities)
      return [{
        slot: 'step-field',
        label: entity ? `Fields of ${entityLabel(entity)}` : 'Fields',
        hint: 'Drop on a step to ask for it there',
        cards: askableFields(entity).map(a => {
          const step = steps.findIndex(s => s.fields.includes(a.name))
          return {
            key: `step-field:${a.name}`,
            part: { kind: 'step-field', field: a.name },
            label: keyText(entity, a.name),
            blurb: `${step < 0 ? 'Not asked yet' : `Step ${step + 1}`}${a.required ? ' · required' : ''}${a.relation ? ' · picker' : ''}`,
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
  if (!page) return { reason: 'No page to drop on' }
  const where = `“${pageLabel(page)}”`
  if (!(PAGE_SLOTS[page.type] ?? []).includes(part.kind)) return { reason: `That does not go on ${where}` }
  const entity = entities.find(e => e.name === page.entity)
  switch (part.kind) {
    case 'tab': {
      const tabs = page.tabs ?? []
      const target = tabTargets(pages, page).find(p => p.id === part.page)
      if (!target) return { reason: part.page === page.id ? 'A tabs page cannot be one of its own tabs' : 'A tabs page embeds lists, dashboards, reports and the like — not a tabs or record page' }
      if (tabs.some(t => t.page === part.page)) return { reason: `${pageLabel(target)} is already a tab of ${where}` }
      if (tabs.length >= MAX_TABS) return { reason: `A tabs page holds at most ${MAX_TABS} pages` }
      return { patch: { tabs: insert(tabs, { page: part.page }, at) }, label: `Added “${pageLabel(target)}” as a tab of ${where}` }
    }
    case 'chart': {
      if (!reportGroupKeys(entity).includes(part.groupBy)) return { reason: `${entity ? entityLabel(entity) : 'The report'} has no ${part.groupBy} to chart` }
      const charts = reportCharts(page)
      if (charts.length >= MAX_CHARTS) return { reason: `A report has at most ${MAX_CHARTS} charts` }
      const next: FullstackChartDef[] = insert(charts, { groupBy: part.groupBy }, at)
      return { patch: { charts: next, chart: undefined }, label: `Added a chart by ${keyText(entity, part.groupBy).toLowerCase()} to ${where}` }
    }
    case 'child-tab': {
      const child = entities.find(e => e.name === part.entity)
      if (!child || relationsTo(child, page.entity).length === 0) return { reason: `${part.entity} has no link to ${page.entity ?? 'this record'}` }
      const tabs = childTabsOf(page, entities)
      if (tabs.some(t => childTabEntity(t) === part.entity)) return { reason: `${entityLabel(child)} is already a tab of ${where}` }
      if (tabs.length >= MAX_CHILD_TABS) return { reason: `A record page has at most ${MAX_CHILD_TABS} related tabs` }
      return { patch: { childTabs: insert(tabs, part.entity, at) }, label: `Added the ${entityLabel(child)} tab to ${where}` }
    }
    case 'header-stat': {
      const child = entities.find(e => e.name === part.entity)
      if (!child || relationsTo(child, page.entity).length === 0) return { reason: `${part.entity} has no link to ${page.entity ?? 'this record'}` }
      const stats = headerStatsOf(page, entities)
      if (stats.length >= MAX_HEADER_STATS) return { reason: `A record page has at most ${MAX_HEADER_STATS} header numbers` }
      return { patch: { headerStats: insert(stats, { child: part.entity }, at) }, label: `Added a count of ${entityLabel(child)} to ${where}` }
    }
    case 'step-field': {
      if (!askableFields(entity).some(a => a.name === part.field)) return { reason: `The wizard does not ask for ${part.field}` }
      const steps = wizardStepsOf(page, entities)
      const to = at == null ? steps.length - 1 : at
      if (to < 0 || to > steps.length) return { reason: 'No such step' }
      if (to === steps.length && steps.length >= MAX_STEPS) return { reason: `A wizard has at most ${MAX_STEPS} steps` }
      const from = steps.findIndex(s => s.fields.includes(part.field))
      if (from === to) return { reason: `${keyText(entity, part.field)} is already asked for in step ${to + 1}` }
      const grown = to === steps.length ? [...steps, { fields: [] }] : steps
      const moved = grown.map((s, i) => ({ ...s, fields: i === to ? [...s.fields, part.field] : s.fields.filter(f => f !== part.field) }))
      // A step the field leaves empty would ask for nothing (a validation error): it goes.
      const next = moved.filter((s, i) => s.fields.length > 0 || i === to)
      const label = `${from < 0 ? 'Asked for' : 'Moved'} ${keyText(entity, part.field)} ${to === steps.length ? 'into a new step' : `to step ${next.indexOf(moved[to]) + 1}`} of ${where}`
      return { patch: { steps: next }, label }
    }
  }
}
