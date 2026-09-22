import type { FullstackEntityDef, FullstackFieldDef, FullstackPageDef, FullstackPageType } from '../../types'

/**
 * The frontend page layout (`pages`) model: validation, the summary lines the editor shows, and
 * the two bulk operations (seed a layout from the entities, follow an entity rename).
 *
 * The checks mirror FullstackPageValidator so a broken layout shows up here, on the offending
 * control, instead of as a 400 on Generate.
 */

export const PAGE_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
export const MAX_PAGES = 30
export const MAX_WIDGETS = 24
export const MIN_TABS = 2
export const MAX_TABS = 6
export const MAX_CHILD_TABS = MAX_TABS - 1
export const MAX_RECENT_LIMIT = 20

/** What the generated app can group or preset-filter by: a filterable, non-key enum/boolean field. */
export function groupableFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? []).filter(f => !f.primaryKey && f.filterable !== false && (f.type === 'ENUM' || f.type === 'BOOLEAN'))
}

/** The child's MANY_TO_ONE fields pointing at `parent`, in declaration order. */
export function relationsTo(child: FullstackEntityDef | undefined, parent: string | undefined): string[] {
  if (!child || !parent) return []
  return (child.relations ?? [])
    .filter(r => r.type === 'MANY_TO_ONE' && r.targetEntity.trim().toLowerCase() === parent.trim().toLowerCase())
    .map(r => r.fieldName)
}

export interface PageLayoutValidation {
  /** Page index → control name → message, for the inline errors in the editor. */
  byPage: Record<number, Record<string, string>>
  /** Problems that belong to the layout as a whole. */
  general: string[]
  /** Everything, as sentences naming the page — what the caller counts as errors. */
  problems: string[]
  count: number
}

interface Issue {
  page?: number
  field?: string
  /** Shown on the control. */
  message: string
  /** Shown in the problem list, naming the page. */
  summary: string
}

const singlePk = (e: FullstackEntityDef) => e.fields.filter(f => f.primaryKey).length === 1

export function validatePages(pages: FullstackPageDef[], entities: FullstackEntityDef[]): PageLayoutValidation {
  const issues = collect(pages, entities)
  const byPage: Record<number, Record<string, string>> = {}
  const general: string[] = []
  for (const issue of issues) {
    if (issue.page == null) general.push(issue.summary)
    else {
      const fields = (byPage[issue.page] ??= {})
      // First message per control wins: it is the one that explains the rest.
      fields[issue.field ?? 'page'] ??= issue.message
    }
  }
  return { byPage, general, problems: issues.map(i => i.summary), count: issues.length }
}

/** Flat problem sentences — the layout summary and the error count read these. */
export function pageLayoutProblems(pages: FullstackPageDef[], entities: FullstackEntityDef[]): string[] {
  return validatePages(pages, entities).problems
}

function collect(pages: FullstackPageDef[], entities: FullstackEntityDef[]): Issue[] {
  if (pages.length === 0) return []
  const issues: Issue[] = []
  const byLower = new Map(entities.map(e => [e.name.trim().toLowerCase(), e]))
  const entityOf = (name: string | undefined) => (name ? byLower.get(name.trim().toLowerCase()) : undefined)
  const typeById = new Map(pages.map(p => [p.id, p.type]))
  const seenIds = new Set<string>()
  const recordEntities = new Map<string, string>()

  if (pages.length > MAX_PAGES) {
    issues.push({ message: '', summary: `A layout can have at most ${MAX_PAGES} pages` })
  }

  pages.forEach((page, index) => {
    const where = `Page “${page.title || page.id || index + 1}”`
    const add = (field: string, message: string, summary = `${where} ${message}`) =>
      issues.push({ page: index, field, message, summary })

    if (!page.id.trim()) add('id', 'needs an id')
    else if (!PAGE_ID.test(page.id) || page.id.length > 40) {
      add('id', 'must be lower-case words joined by “-”', `${where} has an invalid id “${page.id}”`)
    } else if (seenIds.has(page.id)) add('id', 'is already used', `Two pages share the id “${page.id}”`)
    seenIds.add(page.id)
    if ((page.title ?? '').length > 80) add('title', 'is longer than 80 characters')
    if ((page.description ?? '').length > 300) add('description', 'is longer than 300 characters')

    switch (page.type) {
      case 'entity-list': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? `“${page.entity}” is no longer an entity` : 'needs an entity',
            page.entity ? `${where} lists “${page.entity}”, which is no longer an entity` : `${where} lists no entity`)
          break
        }
        const groupable = groupableFields(e)
        for (const [field, value] of Object.entries(page.presetFilter ?? {})) {
          const f = e.fields.find(x => x.name === field)
          if (!f) {
            add(`presetFilter.${field}`, `${e.name} no longer has “${field}”`,
              `${where} filters on “${field}”, which ${e.name} no longer has`)
          } else if (!groupable.includes(f)) {
            add(`presetFilter.${field}`, 'only a filterable enum or boolean field can be preset',
              `${where} filters on “${field}”, which is not a filterable enum or boolean field`)
          } else if (f.type === 'ENUM' && !(f.enumValues ?? []).includes(value)) {
            add(`presetFilter.${field}`, `“${value}” is not one of the values of ${f.name}`,
              `${where} filters ${field} on “${value}”, which is not one of its values`)
          }
        }
        break
      }
      case 'dashboard': {
        const widgets = page.widgets ?? []
        if (widgets.length === 0) add('widgets', 'needs at least one widget')
        if (widgets.length > MAX_WIDGETS) add('widgets', `has more than ${MAX_WIDGETS} widgets`)
        widgets.forEach((w, wi) => {
          const e = entityOf(w.entity)
          if (!e) {
            add(`widget.${wi}`, w.entity ? `“${w.entity}” is no longer an entity` : 'needs an entity',
              `${where} has a widget for “${w.entity}”, which is no longer an entity`)
            return
          }
          if (w.kind === 'bar') {
            const groupable = groupableFields(e)
            if (w.groupBy && !groupable.some(f => f.name === w.groupBy)) {
              add(`widget.${wi}`, `${e.name} has no enum or boolean field “${w.groupBy}”`,
                `${where} groups ${e.name} by “${w.groupBy}”, which it no longer has`)
            } else if (!w.groupBy && groupable.length === 0) {
              add(`widget.${wi}`, `${e.name} has no enum or boolean field to group by`,
                `${where} charts ${e.name}, which has no enum or boolean field to group by`)
            }
          }
          if (w.kind === 'recent' && w.limit != null && (w.limit < 1 || w.limit > MAX_RECENT_LIMIT)) {
            add(`widget.${wi}`, `between 1 and ${MAX_RECENT_LIMIT} rows`,
              `${where} shows a recent list of ${w.limit} rows (1–${MAX_RECENT_LIMIT})`)
          }
        })
        break
      }
      case 'tabs': {
        if (!page.title?.trim()) add('title', 'needs a title (there is no entity to name it after)')
        const tabs = page.tabs ?? []
        if (tabs.length < MIN_TABS || tabs.length > MAX_TABS) {
          add('tabs', `needs between ${MIN_TABS} and ${MAX_TABS} tabs`)
        }
        const seenTabs = new Set<string>()
        tabs.forEach((tab, ti) => {
          const targetType = typeById.get(tab.page)
          if (!targetType) {
            add(`tab.${ti}`, tab.page ? `no page with id “${tab.page}”` : 'needs a page',
              `${where} has a tab for the missing page “${tab.page}”`)
          } else if (targetType === 'tabs' || targetType === 'record') {
            add(`tab.${ti}`, `a tab cannot embed a ${targetType} page`,
              `${where} has a tab embedding the ${targetType} page “${tab.page}”`)
          } else if (seenTabs.has(tab.page)) {
            add(`tab.${ti}`, 'is already a tab of this page', `${where} has “${tab.page}” as a tab twice`)
          }
          seenTabs.add(tab.page)
        })
        break
      }
      case 'master-detail': {
        const parent = entityOf(page.parent)
        const child = entityOf(page.child)
        if (!parent) {
          add('parent', page.parent ? `“${page.parent}” is no longer an entity` : 'needs a parent entity',
            `${where} lists “${page.parent ?? ''}”, which is no longer an entity`)
        } else if (!singlePk(parent)) {
          add('parent', `${parent.name} has a composite key`,
            `${where} lists ${parent.name}, which has a composite key`)
        }
        if (!child) {
          add('child', page.child ? `“${page.child}” is no longer an entity` : 'needs a child entity',
            `${where} shows “${page.child ?? ''}”, which is no longer an entity`)
        } else if (parent) {
          const candidates = relationsTo(child, parent.name)
          if (candidates.length === 0) {
            add('child', `${child.name} has no relation to ${parent.name}`,
              `${where} shows ${child.name}, which has no relation to ${parent.name}`)
          } else if (page.via && !candidates.some(c => c.toLowerCase() === page.via!.toLowerCase())) {
            add('via', `“${page.via}” is not a relation to ${parent.name}`,
              `${where} links through “${page.via}”, which is not a relation of ${child.name} to ${parent.name}`)
          } else if (!page.via && candidates.length > 1) {
            add('via', 'pick the relation to link through',
              `${where} must say which of the relations of ${child.name} to ${parent.name} it links through`)
          }
        }
        break
      }
      case 'record': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? `“${page.entity}” is no longer an entity` : 'needs an entity',
            `${where} opens “${page.entity ?? ''}”, which is no longer an entity`)
          break
        }
        if (!singlePk(e)) {
          add('entity', `${e.name} has a composite key`,
            `${where} opens ${e.name}, which has a composite key and cannot be addressed by one id`)
        }
        const already = recordEntities.get(e.name)
        if (already) {
          add('entity', `${e.name} already has the record page “${already}”`,
            `${where} is a second record page for ${e.name}`)
        }
        recordEntities.set(e.name, page.id)
        const seenChildren = new Set<string>()
        const childTabs = page.childTabs ?? []
        childTabs.forEach((name, ci) => {
          const child = entityOf(name)
          if (!child) {
            add(`childTab.${ci}`, `“${name}” is no longer an entity`,
              `${where} has a tab for “${name}”, which is no longer an entity`)
          } else if (relationsTo(child, e.name).length === 0) {
            add(`childTab.${ci}`, `${child.name} has no relation to ${e.name}`,
              `${where} has a tab for ${child.name}, which has no relation to ${e.name}`)
          } else if (seenChildren.has(child.name)) {
            add(`childTab.${ci}`, 'is already a tab', `${where} has ${child.name} as a tab twice`)
          }
          if (child) seenChildren.add(child.name)
        })
        if (childTabs.length > MAX_CHILD_TABS) add('childTabs', `has more than ${MAX_CHILD_TABS} related lists`)
        break
      }
    }
  })

  if (!pages.some(p => !p.hidden && p.type !== 'record')) {
    issues.push({ message: '', summary: 'Every page is hidden — at least one must be in the navigation' })
  }
  return issues
}

/** One line describing what a page shows. */
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
    case 'master-detail':
      return `${page.parent ?? '?'} → ${page.child ?? '?'}${page.via ? ` via ${page.via}` : ''}`
    case 'record': {
      const tabs = page.childTabs
      const related = tabs == null ? 'its related lists' : tabs.length === 0 ? 'no related lists' : tabs.join(', ')
      return `One ${page.entity ?? '?'} · ${related}`
    }
  }
}

/** Nav label as the generated app shows it (mirrors the backend defaults). */
export function pageLabel(page: FullstackPageDef): string {
  if (page.title) return page.title
  if (page.type === 'dashboard') return 'Dashboard'
  if (page.type === 'master-detail') return page.parent ?? page.id
  return page.entity ?? page.id
}

/** A page slug from free text: "Order lines" → "order-lines". */
export function slugify(text: string): string {
  const slug = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return /^[a-z]/.test(slug) ? slug.replace(/-+$/, '') : ''
}

/** `base`, `base-2`, `base-3`… — the first id not already in `taken`. */
export function uniquePageId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const seed = base || 'page'
  if (!used.has(seed)) return seed
  for (let n = 2; ; n++) {
    const candidate = `${seed}-${n}`
    if (!used.has(candidate)) return candidate
  }
}

/**
 * The layout that matches the classic shell: a dashboard (one count tile per entity, a chart per
 * entity that can be grouped, the latest rows of the first one) plus a list page per entity — the
 * starting point users then rearrange.
 */
export function seedLayout(entities: FullstackEntityDef[]): FullstackPageDef[] {
  const named = entities.filter(e => e.name.trim())
  if (named.length === 0) return []
  const ids = new Set<string>()
  const take = (base: string) => {
    const id = uniquePageId(slugify(base), ids)
    ids.add(id)
    return id
  }
  const dashboard: FullstackPageDef = {
    id: take('dashboard'),
    type: 'dashboard',
    widgets: [
      ...named.map(e => ({ kind: 'kpi' as const, entity: e.name })),
      ...named.filter(e => groupableFields(e).length > 0).map(e => ({ kind: 'bar' as const, entity: e.name })),
      { kind: 'recent' as const, entity: named[0].name },
    ],
  }
  return [dashboard, ...named.map(e => ({ id: take(e.name), type: 'entity-list' as const, entity: e.name }))]
}

/** Follows an entity rename through every reference a layout can hold. */
export function renameEntityInPages(pages: FullstackPageDef[], from: string, to: string): FullstackPageDef[] {
  if (!from || !to || from === to) return pages
  const same = (name: string | undefined) => name != null && name.trim().toLowerCase() === from.trim().toLowerCase()
  return pages.map(page => {
    const next: FullstackPageDef = { ...page }
    if (same(next.entity)) next.entity = to
    if (same(next.parent)) next.parent = to
    if (same(next.child)) next.child = to
    if (next.widgets) next.widgets = next.widgets.map(w => (same(w.entity) ? { ...w, entity: to } : w))
    if (next.childTabs) next.childTabs = next.childTabs.map(name => (same(name) ? to : name))
    return next
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
    if (next.widgets) {
      next.widgets = next.widgets.map(w => (isEntity(w.entity) && w.groupBy === from ? { ...w, groupBy: to } : w))
    }
    return next
  })
}

/** What each page type is, for the "Add page" gallery. */
export const PAGE_TYPE_META: Record<FullstackPageType, { icon: string; label: string; blurb: string }> = {
  dashboard: { icon: 'dashboard', label: 'Dashboard', blurb: 'Count tiles, breakdown charts and recent rows.' },
  'entity-list': { icon: 'table_rows', label: 'List', blurb: 'One entity’s table, optionally filtered to start with.' },
  tabs: { icon: 'tab', label: 'Tabs', blurb: 'Two to six other pages side by side as tabs.' },
  'master-detail': { icon: 'vertical_split', label: 'Master–detail', blurb: 'A parent list beside the selected parent’s rows.' },
  record: { icon: 'article', label: 'Record', blurb: 'One row opened from a list, with its related lists as tabs.' },
}
