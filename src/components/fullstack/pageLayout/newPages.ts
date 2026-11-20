import type { FullstackEntityDef, FullstackFieldDef, FullstackPageDef, FullstackPageType, FullstackRelationDef } from '../../../types'
import { t } from '../../../i18n'
import { enumLabel } from '../enumLabels'
import { humanize, pluralize } from '../naming'
import { blankNewTypePage, newSearchReason, newTypeReason } from '../newPageTypes'
import { MAX_PAGES, MAX_TABS, MIN_TABS } from './limits'
import { sameName, singlePk, valuesOf } from './entityHelpers'
import { createsRows, tabCandidates } from './pageKinds'
import { askableFields, defaultWizardSteps } from './wizardFields'
import { chartableFields, reportGroupKeys } from './dashboard'
import { relationsTo } from './childTabs'
import { pageLabel, slugify, uniquePageId } from './labels'

/**
 * New pages: a blank page of a type (and what it can be about, or why not), duplicating one,
 * splitting a list into tabs by a field, and what the request carries of a page.
 */

/** An entity's many-to-one relations to itself: what a tree page can be drawn by. */
export function selfLinks(entity: FullstackEntityDef | undefined): FullstackRelationDef[] {
  if (!entity) return []
  const own = entity.name.trim().toLowerCase()
  return (entity.relations ?? []).filter(r => (r.type ?? 'MANY_TO_ONE') === 'MANY_TO_ONE' && r.targetEntity?.trim().toLowerCase() === own)
}

/** Why a tree page cannot be about `entity`, or undefined when it can. */
export function treeReason(entity: FullstackEntityDef): string | undefined {
  if (entity.fields.filter(f => f.primaryKey).length !== 1) return t('Needs a single primary key')
  return selfLinks(entity).length === 0 ? t('No relation to itself (a parent)') : undefined
}

/** A copy of `page` under a fresh id and a "(copy)" title; the caller places it. The copy's id
 *  is minted, so it follows the copy's title again. A copy of a tab-only page goes in the nav:
 *  nothing embeds the copy, so hidden it could never be reached. */
export function duplicatePage(page: FullstackPageDef, taken: Iterable<string>): FullstackPageDef {
  const copy = JSON.parse(JSON.stringify(page)) as FullstackPageDef
  copy.id = uniquePageId(`${page.id || 'page'}-copy`.slice(0, 40).replace(/-+$/, ''), taken)
  copy.title = `${pageLabel(page)} (copy)`
  delete copy.idLocked
  if (copy.hidden) delete copy.hidden
  return copy
}

/** The layout as a request carries it: without the editor-only `idLocked` marks. */
export function requestPages(pages: FullstackPageDef[]): FullstackPageDef[] {
  return pages.map(p => Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'idLocked')) as FullstackPageDef)
}

/** Why a list page cannot be split into tabs by `field`, or undefined when it can. */
export function splitDisabledReason(page: FullstackPageDef, field: FullstackFieldDef | undefined, pages: FullstackPageDef[]): string | undefined {
  if (!field) return t('Pick a field to split by')
  const values = valuesOf(field)
  if (page.presetFilter?.[field.name] != null) return t('This list is already filtered on {name}', { name: field.name })
  if (values.length < MIN_TABS) return t('{name} needs at least {min} values to split by', { name: field.name, min: MIN_TABS })
  if (values.length > MAX_TABS) return t('{name} has {n} values; a tabs page takes at most {max}', { name: field.name, n: values.length, max: MAX_TABS })
  if (pages.length + values.length + 1 > MAX_PAGES) return t('Splitting would take the layout past {max} pages', { max: MAX_PAGES })
  return undefined
}

/**
 * The "queue" pattern in one step: one hidden, preset-filtered copy of `page` per value of
 * `field` (its columns, sort, view and page size carried over), under a new tabs page that shows
 * them side by side — inserted right after `page`, which stays as it is.
 */
export function splitListByField(page: FullstackPageDef, field: FullstackFieldDef, pages: FullstackPageDef[]): FullstackPageDef[] {
  const index = pages.findIndex(p => p.id === page.id)
  const taken = new Set(pages.map(p => p.id))
  const mint = (base: string) => {
    const id = uniquePageId(slugify(base) || 'page', taken)
    taken.add(id)
    return id
  }
  const entity = page.entity ?? ''
  const values = valuesOf(field)
  const tabLabel = (value: string) => (field.type === 'BOOLEAN' ? (value === 'true' ? 'Yes' : 'No') : enumLabel(field, value))
  const lists: FullstackPageDef[] = values.map(value => ({
    id: mint(field.type === 'BOOLEAN' ? `${entity}-${field.name}-${value}` : `${entity}-${value}`),
    type: 'entity-list',
    entity,
    hidden: true,
    presetFilter: { ...page.presetFilter, [field.name]: value },
    ...(page.columns ? { columns: [...page.columns] } : {}),
    ...(page.sort ? { sort: { ...page.sort } } : {}),
    ...(page.view ? { view: page.view } : {}),
    ...(page.pageSize ? { pageSize: page.pageSize } : {}),
  }))
  const fieldLabel = (field.label?.trim() || humanize(field.name)).toLowerCase()
  const tabs: FullstackPageDef = {
    id: mint(`${page.id}-by-${field.name}`),
    type: 'tabs',
    // The source list's own title, else its nav label (the entity's plural, as the generator names it).
    title: `${page.title?.trim() || pluralize(entity)} by ${fieldLabel}`,
    ...(page.group ? { group: page.group } : {}),
    ...(page.icon ? { icon: page.icon } : {}),
    tabs: lists.map((list, i) => ({ page: list.id, title: tabLabel(values[i]) })),
  }
  const next = [...pages]
  next.splice(index + 1, 0, tabs, ...lists)
  return next
}

/** A new page of `type`, filled in with the first entities (and pages) that fit so it is valid on sight. */
export function blankPage(type: FullstackPageType, entities: FullstackEntityDef[], pages: FullstackPageDef[], pick?: string): FullstackPageDef {
  const taken = pages.map(p => p.id)
  const picked = pick != null ? entities.find(e => e.name === pick) : undefined
  const first = picked?.name ?? entities[0]?.name ?? ''
  const id = (base: string) => uniquePageId(slugify(base) || 'page', taken)
  switch (type) {
    case 'dashboard':
      return { id: id('dashboard'), type, widgets: entities.slice(0, 4).map(e => ({ kind: 'kpi', entity: e.name })) }
    case 'entity-list':
      return { id: id(first), type, entity: first }
    case 'tabs': {
      // Start from two pages that can be tabs — lists first — so the page is valid straight away.
      const picked = tabCandidates(pages).slice(0, 2)
      return { id: id('tabs'), type, title: 'Tabs', tabs: picked.map(p => ({ page: p.id })) }
    }
    case 'master-detail': {
      const pairs = masterDetailPairs(entities)
      const pair = pairs.find(p => pairKey(p) === pick) ?? pairs[0]
      return { id: id(pair?.parent ?? first), type, parent: pair?.parent ?? first, child: pair?.child, ...(pair?.via ? { via: pair.via } : {}), showParent: true }
    }
    case 'record':
      return { id: id(first), type, entity: first, hidden: true }
    case 'report': {
      // Prefer an entity that actually has something to chart, so the page is valid on sight.
      const e = picked ?? entities.find(x => chartableFields(x).length > 0) ?? entities[0]
      return { id: id(`${e?.name ?? 'report'}-report`), type, entity: e?.name ?? first, chart: {} }
    }
    case 'wizard': {
      // A writable entity, with its default steps spelled out so they can be edited.
      const e = picked ?? entities.find(x => !x.readOnly && askableFields(x).length > 0) ?? entities[0]
      return { id: id(`new-${e?.name ?? 'record'}`), type, entity: e?.name ?? first, title: `New ${e?.name ?? 'record'}`, steps: defaultWizardSteps(e) }
    }
    case 'form': {
      // A writable entity without a wizard or form of its own.
      const e = picked ?? entities.find(x => !x.readOnly && !pages.some(p => createsRows(p) && sameName(p.entity, x.name))) ?? entities[0]
      return { id: id(`new-${e?.name ?? 'record'}`), type, entity: e?.name ?? first, title: `New ${e?.name ?? 'record'}` }
    }
    case 'calendar':
    case 'board':
    case 'inbox':
    case 'import': {
      // The picked entity, else the first one the type fits.
      const e = picked ?? entities.find(x => !newTypeReason(type, x, pages)) ?? entities[0]
      return blankNewTypePage(type, e, entities, id)
    }
    case 'content':
    case 'search':
      return blankNewTypePage(type, undefined, entities, id)
    case 'tree': {
      // The picked entity, else the first one that points at itself.
      const e = picked ?? entities.find(x => !treeReason(x)) ?? entities[0]
      return { id: id(`${e?.name ?? 'rows'}-tree`), type, entity: e?.name ?? first, title: `${e?.name ?? 'Rows'} tree` }
    }
  }
}

/** One entity (or, for a master–detail page, one parent → child pair) a new page can be about. */
export interface NewPageChoice { value: string; label: string; reason?: string }

/** The key of a master–detail pair, as `blankPage`'s `pick` takes it. */
export const pairKey = (p: { parent: string; child: string; via?: string }) => `${p.parent}>${p.child}${p.via ? `.${p.via}` : ''}`

/**
 * What a new page of `type` can be about, each with the reason it cannot be when it cannot — the
 * rules `validatePages` (and the server) apply, so the gallery never adds a page that is wrong on
 * sight. `null` for the types that take no entity (dashboard, tabs).
 */
export function newPageChoices(type: FullstackPageType, entities: FullstackEntityDef[], pages: FullstackPageDef[]): NewPageChoice[] | null {
  const named = entities.filter(e => e.name.trim())
  const has = (type: FullstackPageType, name: string) => pages.some(p => p.type === type && p.entity?.trim().toLowerCase() === name.trim().toLowerCase())
  const one = (e: FullstackEntityDef, reason?: string): NewPageChoice => ({ value: e.name, label: e.name, ...(reason ? { reason } : {}) })
  switch (type) {
    case 'dashboard':
    case 'tabs':
      return null
    case 'entity-list':
      return named.map(e => one(e))
    case 'record':
      return named.map(e => one(e, !singlePk(e) ? t('Needs a single primary key') : has('record', e.name) ? t('Already has a record page') : undefined))
    case 'report':
      return named.map(e => one(e, reportGroupKeys(e).length === 0 ? t('Nothing to chart — no enum, boolean or date field, nor a relation') : undefined))
    case 'wizard':
      return named.map(e => one(e, e.readOnly ? t('Read-only — nothing to create')
        : askableFields(e).length === 0 ? t('No fields to ask for')
          : has('wizard', e.name) ? t('Already has a wizard')
            : has('form', e.name) ? t('Already has a form page') : undefined))
    case 'form':
      return named.map(e => one(e, e.readOnly ? t('Read-only — nothing to create')
        : has('form', e.name) ? t('Already has a form page')
          : has('wizard', e.name) ? t('Already has a wizard') : undefined))
    case 'master-detail':
      return masterDetailPairs(named).map(p => ({ value: pairKey(p), label: `${p.parent} → ${p.child}${p.via ? ` (${t('via {relation}', { relation: p.via })})` : ''}` }))
    case 'calendar':
    case 'board':
    case 'inbox':
    case 'import':
      return named.map(e => one(e, newTypeReason(type, e, pages)))
    case 'content':
    case 'search':
      return null
    case 'tree':
      return named.map(e => one(e, treeReason(e)))
  }
}

/** Why a new page of a type that takes no entity cannot be added, or undefined when it can. */
export function newPageTypeReason(type: FullstackPageType, entities: FullstackEntityDef[], pages: FullstackPageDef[]): string | undefined {
  return type === 'search' ? newSearchReason(entities, pages) : undefined
}

/** Every parent → child pair a master-detail page can show: a MANY_TO_ONE from the child to a
 *  single-key parent in the model, with `via` set where the child has several such relations. */
export function masterDetailPairs(entities: FullstackEntityDef[]): { parent: string; child: string; via?: string }[] {
  const named = entities.filter(e => e.name.trim())
  const eq = (a: string | undefined, b: string) => a != null && a.trim().toLowerCase() === b.trim().toLowerCase()
  const out: { parent: string; child: string; via?: string }[] = []
  for (const child of named) {
    for (const r of child.relations ?? []) {
      if (r.type !== 'MANY_TO_ONE') continue
      const parent = named.find(e => eq(e.name, r.targetEntity))
      if (!parent || parent === child || !singlePk(parent)) continue
      if (out.some(p => p.parent === parent.name && p.child === child.name)) continue
      out.push({ parent: parent.name, child: child.name, ...(relationsTo(child, parent.name).length > 1 ? { via: r.fieldName } : {}) })
    }
  }
  return out
}
