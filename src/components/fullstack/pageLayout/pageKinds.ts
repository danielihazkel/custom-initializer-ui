import type { FullstackPageDef, FullstackPageType } from '../../../types'

/**
 * What kind of page a page is, for the areas that only need to know that: whether it creates
 * rows, may be duplicated, can be linked to or embedded as a tab, and which pages embed it.
 */

/** The tabs pages that embed the page with `id`. */
export function pagesEmbedding(pages: FullstackPageDef[], id: string): FullstackPageDef[] {
  return pages.filter(p => p.type === 'tabs' && (p.tabs ?? []).some(t => t.page === id))
}

/** Page types a layout holds at most one of (per entity, or at all): a copy would be invalid
 *  the moment it was made, so the editor does not offer to duplicate them. */
const SINGLE_PAGE_TYPES: ReadonlySet<FullstackPageType> = new Set<FullstackPageType>(['record', 'wizard', 'form', 'import', 'search'])

/** Whether `page` creates its entity's rows (a wizard or a form) — a route of its own even when
 *  hidden, since New, a calendar's day and a record's Edit open it. */
export const createsRows = (page: FullstackPageDef): boolean => page.type === 'wizard' || page.type === 'form'

/** Whether the editor offers to duplicate `page`. */
export const canDuplicate = (page: FullstackPageDef): boolean => !SINGLE_PAGE_TYPES.has(page.type)

/** The pages a links widget can open: any but a record page (it needs a row) or a hidden page
 *  that is not a wizard (a hidden wizard is a route of its own). */
export function linkablePages(pages: FullstackPageDef[]): FullstackPageDef[] {
  return pages.filter(p => p.type !== 'record' && (!p.hidden || createsRows(p) || p.type === 'search'))
}

/** The pages a new tabs page can embed, lists first: not a tabs or record page, not already a tab. */
export function tabCandidates(pages: FullstackPageDef[]): FullstackPageDef[] {
  const free = pages.filter(p => p.type !== 'tabs' && p.type !== 'record' && pagesEmbedding(pages, p.id).length === 0)
  return [...free.filter(p => p.type === 'entity-list'), ...free.filter(p => p.type !== 'entity-list')]
}
