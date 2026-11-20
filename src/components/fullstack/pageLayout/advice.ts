import type { FullstackEntityDef, FullstackPageDef, FullstackPageType } from '../../../types'
import { t, tn } from '../../../i18n'
import { pluralize } from '../naming'
import { MAX_CHILD_TABS, MAX_HEADER_STATS, MAX_PAGES } from './limits'
import { singlePk } from './entityHelpers'
import { createsRows, pagesEmbedding } from './pageKinds'
import { widgetDateField } from './dashboard'
import { childTabEntity, relationsTo } from './childTabs'
import type { Issue, PageFix } from './validate'
import { pageLabel, slugify, uniquePageId } from './labels'

/**
 * Advice: what is allowed but probably not meant (a crowded menu, a page nothing leads to, an
 * entity no page creates). It never blocks Generate; each warning says where and, where it can,
 * how to fix it.
 */

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
export function collectWarnings(pages: FullstackPageDef[], entities: FullstackEntityDef[]): Issue[] {
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
