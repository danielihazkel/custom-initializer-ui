import type { FullstackEntityDef, FullstackFieldDef, FullstackPageDef, FullstackWidgetDef } from '../../types'
import { pluralize } from './naming'
import {
  MAX_PAGES,
  askableFields,
  chartableFields,
  dateFields,
  groupableFields,
  masterDetailPairs,
  relationsTo,
  slugify,
  splitDisabledReason,
  splitListByField,
  uniquePageId,
} from './pageLayout'

/**
 * Whole layouts to start from, built from the model's own entities — the shapes teams keep
 * rebuilding by hand (a work queue, a reporting desk, a parent/child browser, an admin console).
 * Each is valid on sight (pinned by layoutTemplates.test.ts); one the model cannot fill says why.
 */
export interface LayoutTemplate {
  key: string
  icon: string
  label: string
  blurb: string
  /** Why the model cannot fill this template; the pages otherwise. */
  build: (entities: FullstackEntityDef[]) => { pages: FullstackPageDef[] } | { reason: string }
}

const singlePk = (e: FullstackEntityDef) => e.fields.filter(f => f.primaryKey).length === 1

/** Mints ids once each, in order, from the names given. */
function idMaker() {
  const taken = new Set<string>()
  return (base: string) => {
    const id = uniquePageId(slugify(base) || 'page', taken)
    taken.add(id)
    return id
  }
}

/** Record pages for the single-key entities others link to — where a row of them opens. */
function recordPages(entities: FullstackEntityDef[], id: (base: string) => string): FullstackPageDef[] {
  return entities
    .filter(e => singlePk(e) && entities.some(c => relationsTo(c, e.name).length > 0))
    .map(e => ({ id: id(e.name), type: 'record' as const, entity: e.name, hidden: true }))
}

/** One list page per entity, under a nav group. */
function listPages(entities: FullstackEntityDef[], id: (base: string) => string, group?: string): FullstackPageDef[] {
  return entities.map(e => ({ id: id(pluralize(e.name)), type: 'entity-list' as const, entity: e.name, ...(group ? { group } : {}) }))
}

/** The field a queue splits into tabs: an enum (else boolean) with 2–6 values. */
function queueField(e: FullstackEntityDef): FullstackFieldDef | undefined {
  const ok = (f: FullstackFieldDef) => !splitDisabledReason({ id: 'x', type: 'entity-list', entity: e.name }, f, [])
  const fields = groupableFields(e)
  return fields.find(f => f.type === 'ENUM' && ok(f)) ?? fields.find(ok)
}

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    key: 'work-queue',
    icon: 'inbox',
    label: 'Work queue',
    blurb: 'A status overview, then one tab per status of the busiest entity — for tickets, orders, requests.',
    build: entities => {
      const e = entities.find(x => queueField(x))
      if (!e) return { reason: 'Needs an entity with an enum or boolean field of 2 to 6 values to split by' }
      const field = queueField(e)!
      const id = idMaker()
      const overview: FullstackPageDef = {
        id: id('overview'), type: 'dashboard', title: 'Overview',
        widgets: [
          { kind: 'kpi', entity: e.name },
          { kind: 'donut', entity: e.name, groupBy: field.name },
          ...(dateFields(e).length ? [{ kind: 'line' as const, entity: e.name, span: 2 }] : []),
          { kind: 'recent', entity: e.name, span: 4 },
        ],
      }
      const list: FullstackPageDef = { id: id(pluralize(e.name)), type: 'entity-list', entity: e.name }
      const others = entities.filter(x => x !== e)
      // splitListByField mints its own ids against the pages it is given, so hand it the rest first.
      const records = recordPages(entities, id)
      // The queued rows open somewhere: its own record page, even when nothing links to it.
      if (singlePk(e) && !records.some(r => r.entity === e.name)) records.push({ id: id(e.name), type: 'record', entity: e.name, hidden: true })
      const rest = [...listPages(others, id, others.length ? 'Reference' : undefined), ...records]
      const pages = splitListByField(list, field, [overview, list, ...rest])
      return { pages }
    },
  },
  {
    key: 'reporting',
    icon: 'monitoring',
    label: 'Reporting',
    blurb: 'A dashboard of totals and trends, a report page per chartable entity, and the lists they drill into.',
    build: entities => {
      const chartable = entities.filter(e => chartableFields(e).length > 0)
      if (chartable.length === 0) return { reason: 'Needs an entity with an enum, boolean or date field to chart' }
      const id = idMaker()
      const widgets: FullstackWidgetDef[] = []
      for (const e of chartable.slice(0, 4)) widgets.push({ kind: 'kpi', entity: e.name })
      for (const e of chartable.slice(0, 3)) {
        if (dateFields(e).length) widgets.push({ kind: 'line', entity: e.name, span: 2 })
        if (groupableFields(e).length) widgets.push({ kind: 'bar', entity: e.name, span: 2 })
      }
      const dashboard: FullstackPageDef = { id: id('dashboard'), type: 'dashboard', title: 'Dashboard', widgets }
      const reports = chartable.map(e => ({ id: id(`${e.name}-report`), type: 'report' as const, entity: e.name, title: `${e.name} report`, group: 'Reports', chart: {} }))
      return { pages: [dashboard, ...reports, ...listPages(entities, id, 'Data')] }
    },
  },
  {
    key: 'browser',
    icon: 'vertical_split',
    label: 'Parent–child browser',
    blurb: 'A master–detail page per parent, a record page for each, and every entity’s list.',
    build: entities => {
      const pairs = masterDetailPairs(entities)
      if (pairs.length === 0) return { reason: 'Needs a many-to-one relation between two entities' }
      const id = idMaker()
      const byParent = pairs.filter((p, i) => pairs.findIndex(q => q.parent === p.parent) === i).slice(0, 4)
      const browsers = byParent.map(p => ({
        id: id(pluralize(p.parent)), type: 'master-detail' as const, parent: p.parent, child: p.child,
        ...(p.via ? { via: p.via } : {}), showParent: true,
      }))
      return { pages: [...browsers, ...listPages(entities, id, 'All data'), ...recordPages(entities, id)] }
    },
  },
  {
    key: 'admin',
    icon: 'admin_panel_settings',
    label: 'Admin console',
    blurb: 'A launcher dashboard, grouped lists, record pages, and a step-by-step form for the largest entity.',
    build: entities => {
      if (entities.length === 0) return { reason: 'Needs an entity' }
      const id = idMaker()
      const lists = listPages(entities, id, 'Data')
      const big = [...entities].filter(e => !e.readOnly && askableFields(e).length >= 5)
        .sort((a, b) => askableFields(b).length - askableFields(a).length)[0]
      const wizard: FullstackPageDef[] = big
        ? [{ id: id(`new-${big.name}`), type: 'wizard', entity: big.name, title: `New ${big.name}`, group: 'Create' }]
        : []
      const home: FullstackPageDef = {
        id: id('home'), type: 'dashboard', title: 'Home',
        widgets: [
          { kind: 'links', entity: '', title: 'Go to', pages: [...lists, ...wizard].slice(0, 8).map(p => p.id), span: 4 },
          ...entities.slice(0, 4).map(e => ({ kind: 'kpi' as const, entity: e.name })),
        ],
      }
      return { pages: [home, ...lists, ...wizard, ...recordPages(entities, id)] }
    },
  },
]

/** A template filled from the model, capped like any layout; `reason` when it cannot be. */
export function buildLayoutTemplate(template: LayoutTemplate, entities: FullstackEntityDef[]): { pages: FullstackPageDef[] } | { reason: string } {
  const named = entities.filter(e => e.name.trim())
  if (named.length === 0) return { reason: 'Name an entity first' }
  const built = template.build(named)
  if ('reason' in built) return built
  if (built.pages.length > MAX_PAGES) return { reason: `Would take more than ${MAX_PAGES} pages` }
  return built
}

// ── Page templates (saved by the user, per browser) ─────────────────────────

const PAGE_TEMPLATES_KEY = 'fullstack:pageTemplates'
export interface PageTemplate { name: string; page: FullstackPageDef }

export function readPageTemplates(): PageTemplate[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PAGE_TEMPLATES_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((t): t is PageTemplate => !!t && typeof t === 'object' && typeof (t as PageTemplate).name === 'string' && !!(t as PageTemplate).page) : []
  } catch {
    return []
  }
}

/** Saves `page` under `name` (replacing a template of that name). False when storage refused. */
export function savePageTemplate(name: string, page: FullstackPageDef): boolean {
  const { idLocked: _locked, ...rest } = page
  void _locked
  const next = [...readPageTemplates().filter(t => t.name !== name), { name, page: JSON.parse(JSON.stringify(rest)) as FullstackPageDef }]
  try {
    localStorage.setItem(PAGE_TEMPLATES_KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

export function deletePageTemplate(name: string): void {
  try {
    localStorage.setItem(PAGE_TEMPLATES_KEY, JSON.stringify(readPageTemplates().filter(t => t.name !== name)))
  } catch { /* preference only */ }
}

/** A saved page placed in a layout: a fresh id, and — a tabs page's or a links widget's — no
 *  references to pages this layout does not have. */
export function pageFromTemplate(t: PageTemplate, pages: FullstackPageDef[]): FullstackPageDef {
  const page = JSON.parse(JSON.stringify(t.page)) as FullstackPageDef
  const ids = new Set(pages.map(p => p.id))
  page.id = uniquePageId(slugify(page.title || t.name) || 'page', ids)
  if (page.tabs) page.tabs = page.tabs.filter(tab => ids.has(tab.page))
  if (page.widgets) page.widgets = page.widgets.map(w => (w.kind === 'links' ? { ...w, pages: (w.pages ?? []).filter(p => ids.has(p)) } : w))
  return page
}
