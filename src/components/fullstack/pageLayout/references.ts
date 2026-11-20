import type { FullstackChartDef, FullstackPageDef, FullstackWidgetDef } from '../../../types'
import { humanizeConstant } from '../enumLabels'
import { renameEntityInNewPages, renameEnumValueInNewPages, renameFieldInNewPages, renamePageIdInBody, renameRelationInNewPages } from '../newPageTypes'
import { sameName } from './entityHelpers'
import { readsEntity, reportCharts } from './dashboard'
import { childTabEntity, childTabVia, withChildTab } from './childTabs'

/**
 * Keeping a layout's references true: an entity, field, relation, enum value or page id that is
 * renamed is renamed wherever the layout names it, and a removed page leaves the tabs and links
 * that pointed at it.
 */

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
