import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { defaultSearchEntities } from './newPageTypes'
import { childTabEntity, relationsTo } from './pageLayout'

/**
 * Where the generated app goes when a part of a page is clicked — what the layout designer's Play
 * mode follows. The pages are resolved the way the generator resolves them
 * (`EntityScaffoldContext.PageLinks`): an entity's record page, its first visible list page (what a
 * drill-down opens), its "home" (that list, else a visible master–detail over it, else a visible
 * tabs page embedding one of those) and its wizard. Every target is a page index, or null where
 * the generated app stays on the page (a quick-look drawer, a form drawer…).
 */
export interface PagePlayLinks {
  /** A row of the page's own list (an entity list, a calendar or board card): its record page. */
  row: number | null
  /** Why a row opens no page, when it does not ("opens in a drawer"). */
  rowNote?: string
  /** New on the page's list: the entity's wizard (null: the form drawer). */
  create: number | null
  /** A record page's Back: the entity's home. */
  back: number | null
  /** A wizard's Save: the new row's record page, else the entity's home. */
  afterSave: number | null
  /** A report's chart: the entity's list page, filtered by the clicked group. */
  drill: number | null
  /** Per widget (by index): the card's click (drill-down or View all), its rows, its link tiles. */
  widgets: { open: number | null; rows: number | null; tiles: (number | null)[] }[]
  /** A master–detail's child rows, or each related tab of a record page (in tab order). */
  childRows: (number | null)[]
  /** A search page's groups (in group order): where a match opens. */
  groups: (number | null)[]
  /** Content page links, by page id. */
  pageIds: Map<string, number>
}

const lower = (name: string | undefined) => (name ?? '').trim().toLowerCase()

/** The generator's page lookups by (lower-cased) entity name. */
export function pageLinks(pages: FullstackPageDef[]) {
  const record = new Map<string, number>()
  const list = new Map<string, number>()
  const wizard = new Map<string, number>()
  const home = new Map<string, number>()
  const byId = new Map(pages.map((p, i) => [p.id, i]))
  pages.forEach((p, i) => {
    if (p.type === 'record') record.set(lower(p.entity), i)
    if (p.type === 'wizard') wizard.set(lower(p.entity), i)
    if (p.type === 'entity-list' && !p.hidden && !list.has(lower(p.entity))) list.set(lower(p.entity), i)
  })
  for (const [e, i] of list) home.set(e, i)
  pages.forEach((p, i) => {
    if (p.type === 'master-detail' && !p.hidden && !home.has(lower(p.parent))) home.set(lower(p.parent), i)
  })
  pages.forEach((p, i) => {
    if (p.type !== 'tabs' || p.hidden) return
    for (const tab of p.tabs ?? []) {
      const target = pages[byId.get(tab.page) ?? -1]
      if (target?.type === 'entity-list' && !home.has(lower(target.entity))) home.set(lower(target.entity), i)
      if (target?.type === 'master-detail' && !home.has(lower(target.parent))) home.set(lower(target.parent), i)
    }
  })
  const of = (map: Map<string, number>) => (entity: string | undefined): number | null => map.get(lower(entity)) ?? null
  return { recordOf: of(record), listOf: of(list), wizardOf: of(wizard), homeOf: of(home), byId }
}

/** Every page's click targets, index-aligned with the layout. */
export function buildPlayLinks(pages: FullstackPageDef[], entities: FullstackEntityDef[]): PagePlayLinks[] {
  const links = pageLinks(pages)
  const named = entities.filter(e => e.name.trim())
  const entityOf = (name: string | undefined) => named.find(e => lower(e.name) === lower(name))
  const pageAt = (id: string | undefined) => (id == null ? null : links.byId.get(id) ?? null)

  return pages.map(page => {
    const base: PagePlayLinks = {
      row: null, create: null, back: null, afterSave: null, drill: null,
      widgets: [], childRows: [], groups: [], pageIds: links.byId,
    }
    switch (page.type) {
      case 'entity-list': {
        const record = links.recordOf(page.entity)
        // Absent: the record page when there is one, else the drawer (the side pane is drawn).
        const opensRecord = page.detail === 'record' || (page.detail == null && record != null)
        return {
          ...base,
          row: opensRecord ? record : null,
          rowNote: page.detail === 'side' ? 'Rows open in the pane beside the list' : opensRecord ? undefined : 'Rows open in a quick-look drawer — add a record page to open a page',
          create: links.wizardOf(page.entity),
        }
      }
      case 'calendar':
      case 'board': {
        const record = links.recordOf(page.entity)
        return { ...base, row: record, rowNote: record == null ? 'A card opens in a quick-look drawer' : undefined, create: links.wizardOf(page.entity) }
      }
      case 'master-detail':
        return { ...base, childRows: [links.recordOf(page.child)], create: links.wizardOf(page.child) }
      case 'record': {
        const e = entityOf(page.entity)
        const related = page.childTabs?.map(childTabEntity)
          ?? named.filter(c => relationsTo(c, e?.name).length > 0).map(c => c.name).slice(0, 5)
        return { ...base, back: links.homeOf(page.entity), childRows: related.map(name => links.recordOf(name)) }
      }
      case 'wizard':
        return { ...base, afterSave: links.recordOf(page.entity) ?? links.homeOf(page.entity) }
      case 'report':
        return { ...base, drill: links.listOf(page.entity) }
      case 'search': {
        const names = page.entities ?? defaultSearchEntities(named)
        return { ...base, groups: names.filter(n => entityOf(n)).map(n => links.recordOf(n) ?? links.listOf(n)) }
      }
      case 'dashboard':
        return {
          ...base,
          widgets: (page.widgets ?? []).map(w => ({
            // A chart, tile or ranked row drills into the entity's list (or the widget's own page);
            // an embedded list's View all opens the entity's home.
            open: w.kind === 'list' ? links.homeOf(w.entity) : pageAt(w.drillTo) ?? links.listOf(w.entity),
            rows: links.recordOf(w.entity),
            tiles: (w.pages ?? []).map(id => pageAt(id)),
          })),
        }
      default:
        return base
    }
  })
}
