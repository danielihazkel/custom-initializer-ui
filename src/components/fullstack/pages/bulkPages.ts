import type { FullstackPageDef, FullstackPageRole } from '../../../types'
import { canDuplicate, duplicatePage, inNav, removePageAt } from '../pageLayout'

/** Bulk page actions: each takes the layout and the picked page ids and returns the new layout,
 *  doing to every picked page what the page's own button does to one. */

const picked = (ids: string[]) => new Set(ids)

/** Hides the picked pages from the navigation (dropping their nav group and icon, as one hide
 *  does), or shows them again. A record page is never in the navigation, so it is left alone. */
export function setPagesHidden(pages: FullstackPageDef[], ids: string[], hidden: boolean): FullstackPageDef[] {
  const set = picked(ids)
  return pages.map(p => {
    if (!set.has(p.id) || p.type === 'record' || Boolean(p.hidden) === hidden) return p
    return hidden ? { ...p, hidden: true, group: undefined, icon: undefined } : { ...p, hidden: false }
  })
}

/** Puts the picked nav pages in one nav group (blank: no group). Pages out of the navigation take no group. */
export function setPagesGroup(pages: FullstackPageDef[], ids: string[], group: string): FullstackPageDef[] {
  const set = picked(ids)
  const name = group.trim()
  return pages.map(p => (set.has(p.id) && inNav(p) ? { ...p, group: name || undefined } : p))
}

/** Restricts the picked nav pages to roles (empty: everyone). The start page and pages out of the
 *  navigation are skipped — the validator refuses roles there. */
export function setPagesRoles(pages: FullstackPageDef[], ids: string[], roles: FullstackPageRole[]): FullstackPageDef[] {
  const set = picked(ids)
  const start = pages.find(inNav)?.id
  return pages.map(p => (set.has(p.id) && inNav(p) && p.id !== start ? { ...p, roles: roles.length ? [...roles] : undefined } : p))
}

/** A copy of each picked page that can be copied, right after its original. */
export function duplicatePages(pages: FullstackPageDef[], ids: string[]): FullstackPageDef[] {
  const set = picked(ids)
  const taken = pages.map(p => p.id)
  const out: FullstackPageDef[] = []
  for (const p of pages) {
    out.push(p)
    if (set.has(p.id) && canDuplicate(p)) {
      const copy = duplicatePage(p, taken)
      taken.push(copy.id)
      out.push(copy)
    }
  }
  return out
}

/** The layout without the picked pages, and without what pointed at them (tabs included). */
export function removePages(pages: FullstackPageDef[], ids: string[]): FullstackPageDef[] {
  let next = pages
  for (const id of ids) {
    const index = next.findIndex(p => p.id === id)
    if (index >= 0) next = removePageAt(next, index, true)
  }
  return next
}
