import type { FullstackEntityDef, FullstackPageDef } from '../../types'

/**
 * The frontend page layout (`pages`) against the current entity model. Pages are not edited in
 * this tab yet — they arrive with an example, a preset or a shared link — but the entities they
 * point at can be renamed or deleted afterwards. These checks mirror the reference rules of
 * FullstackPageValidator so the break shows here instead of as a 400 on Generate.
 */
export function pageLayoutProblems(pages: FullstackPageDef[], entities: FullstackEntityDef[]): string[] {
  if (pages.length === 0) return []
  const problems: string[] = []
  const byLower = new Map(entities.map(e => [e.name.trim().toLowerCase(), e]))
  const ids = new Set(pages.map(p => p.id))
  const entity = (name: string | undefined) => (name ? byLower.get(name.trim().toLowerCase()) : undefined)

  for (const page of pages) {
    const where = `Page “${page.title || page.id}”`
    if (page.type === 'entity-list') {
      const e = entity(page.entity)
      if (!e) {
        problems.push(`${where} lists ${page.entity ? `“${page.entity}”, which is no longer an entity` : 'no entity'}`)
        continue
      }
      for (const field of Object.keys(page.presetFilter ?? {})) {
        if (!e.fields.some(f => f.name === field)) problems.push(`${where} filters on “${field}”, which ${e.name} no longer has`)
      }
    } else if (page.type === 'dashboard') {
      for (const w of page.widgets ?? []) {
        const e = entity(w.entity)
        if (!e) problems.push(`${where} has a widget for “${w.entity}”, which is no longer an entity`)
        else if (w.groupBy && !e.fields.some(f => f.name === w.groupBy)) {
          problems.push(`${where} groups ${e.name} by “${w.groupBy}”, which it no longer has`)
        }
      }
    } else if (page.type === 'tabs') {
      for (const tab of page.tabs ?? []) {
        if (!ids.has(tab.page)) problems.push(`${where} has a tab for the missing page “${tab.page}”`)
      }
    }
  }
  if (!pages.some(p => !p.hidden)) problems.push('Every page is hidden — at least one must be in the navigation')
  return problems
}

/** One line describing what a page shows, for the read-only layout list. */
export function describePage(page: FullstackPageDef, pages: FullstackPageDef[]): string {
  switch (page.type) {
    case 'entity-list': {
      const filter = Object.entries(page.presetFilter ?? {}).map(([k, v]) => `${k} = ${v}`).join(', ')
      return filter ? `${page.entity} list · filtered on ${filter}` : `${page.entity} list`
    }
    case 'dashboard': {
      const counts = { kpi: 0, bar: 0, recent: 0 }
      for (const w of page.widgets ?? []) counts[w.kind]++
      const parts = [
        counts.kpi && `${counts.kpi} count tile${counts.kpi === 1 ? '' : 's'}`,
        counts.bar && `${counts.bar} breakdown chart${counts.bar === 1 ? '' : 's'}`,
        counts.recent && `${counts.recent} recent list${counts.recent === 1 ? '' : 's'}`,
      ].filter(Boolean)
      return parts.join(' · ') || 'No widgets'
    }
    case 'tabs':
      return (page.tabs ?? [])
        .map(tab => tab.title || pages.find(p => p.id === tab.page)?.title || tab.page)
        .join(' | ')
  }
}

/** Nav label as the generated app shows it (mirrors the backend defaults). */
export function pageLabel(page: FullstackPageDef): string {
  if (page.title) return page.title
  if (page.type === 'dashboard') return 'Dashboard'
  return page.entity ?? page.id
}
