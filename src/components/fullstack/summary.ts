import type { FullstackEntityDef, FullstackEntityOptKey, FullstackFieldDef } from '../../types'
import { pluralize, toKebabCase } from './naming'

/** Whether each per-entity scaffold override can take effect on this entity, mirroring the
 *  `*Applicable` derivations in `EntityScaffoldContext.buildEntityContext`: audit/soft delete/bulk
 *  ops need a writable, table-backed entity; soft delete and the bulk ops also need a single-column
 *  key; bulk edit needs at least one editable field. The backend drops an inapplicable flag
 *  silently, so the editor uses this to warn when an override is switched On for nothing. */
export type EntityOptApplicability = Record<FullstackEntityOptKey, { applicable: boolean; reason?: string }>

export function entityOptApplicability(entity: FullstackEntityDef): EntityOptApplicability {
  const mutable = !entity.readOnly && !entity.viewQuery?.trim()
  const composite = entity.fields.filter(f => f.primaryKey).length > 1
  const editable = entity.fields.some(f => !f.primaryKey && !f.readOnly)
  const readOnlyReason = entity.viewQuery?.trim() ? 'SELECT-backed view' : 'read-only entity'
  const gate = (...checks: [boolean, string][]) => {
    const failed = checks.find(([ok]) => !ok)
    return failed ? { applicable: false, reason: failed[1] } : { applicable: true }
  }
  return {
    audit: gate([mutable, readOnlyReason]),
    softDelete: gate([mutable, readOnlyReason], [!composite, 'composite primary key']),
    csvExport: { applicable: true },
    bulkDelete: gate([mutable, readOnlyReason], [!composite, 'composite primary key']),
    bulkUpdate: gate([mutable, readOnlyReason], [!composite, 'composite primary key'], [editable, 'no editable field']),
    tests: { applicable: true },
  }
}

/**
 * What the generator will produce for one entity, derived client-side from the same rules
 * `EntityScaffoldContext` applies (search = STRING/TEXT unless opted out; filters = non-PK
 * enum/boolean/date/numeric unless opted out; kanban lanes = first ENUM else first BOOLEAN;
 * calendar = first date field). Shown on the entity card so the effect of the Search/Filter
 * checkboxes and the view picker is visible without generating.
 */
export interface EntitySummary {
  /** e.g. `/api/order-items` */
  path: string
  /** HTTP verbs the controller will expose. */
  verbs: string[]
  /** Enabled list views in generated order, with the driving field where one applies. */
  views: { name: string; by?: string }[]
  /** Field names that feed the text-search box. */
  search: string[]
  /** Field names that get a filter control (relation FKs included, as `<field>Id`). */
  filters: string[]
  /** Every REST endpoint the controller will expose, given the project-wide opts and this
   *  entity's overrides (only the ones that can actually apply to it). */
  endpoints: { method: string; path: string }[]
  /** The scaffold opts that resolve to "on" for this entity and can take effect on it. */
  opts: FullstackEntityOptKey[]
}

const isTemporal = (f: FullstackFieldDef) => f.type === 'LOCAL_DATE' || f.type === 'LOCAL_DATE_TIME'
const isNumeric = (f: FullstackFieldDef) => f.type === 'LONG' || f.type === 'INTEGER' || f.type === 'BIG_DECIMAL'

export function summarizeEntity(entity: FullstackEntityDef, projectOpts: string[] = []): EntitySummary {
  const name = entity.name.trim() || 'Entity'
  // A ticked "SELECT-backed view" (even while its query is still blank) is a view in the editor.
  const readOnly = Boolean(entity.readOnly) || entity.viewQuery != null
  const path = `/api/${pluralize(toKebabCase(name))}`
  const verbs = readOnly ? ['GET'] : ['GET', 'POST', 'PUT', 'DELETE']

  // Endpoints: the base CRUD set, plus what the resolved (override ?? project) opts add — an opt
  // the entity can't carry (see entityOptApplicability) is left out, as the generator does.
  const applicability = entityOptApplicability(entity)
  const optOn = (k: FullstackEntityOptKey) => (entity.opts?.[k] ?? projectOpts.includes(k)) && applicability[k].applicable
  const pks = entity.fields.filter(f => f.primaryKey)
  const idPath = pks.length > 1 ? pks.map(f => `{${f.name.trim() || 'key'}}`).join('/') : '{id}'
  const endpoints: { method: string; path: string }[] = [{ method: 'GET', path }, { method: 'GET', path: `${path}/${idPath}` }]
  if (!readOnly) endpoints.push({ method: 'POST', path }, { method: 'PUT', path: `${path}/${idPath}` }, { method: 'DELETE', path: `${path}/${idPath}` })
  if (optOn('csvExport')) endpoints.push({ method: 'GET', path: `${path}/export.csv` })
  if (optOn('softDelete')) endpoints.push({ method: 'POST', path: `${path}/{id}/restore` })
  if (optOn('bulkDelete')) endpoints.push({ method: 'DELETE', path: `${path}/bulk` })
  if (optOn('bulkUpdate')) endpoints.push({ method: 'PATCH', path: `${path}/bulk` })
  const opts = (['audit', 'softDelete', 'csvExport', 'bulkDelete', 'bulkUpdate', 'tests'] as FullstackEntityOptKey[]).filter(optOn)

  const breakdown = entity.fields.find(f => f.type === 'ENUM') ?? entity.fields.find(f => f.type === 'BOOLEAN')
  const calendar = entity.fields.find(isTemporal)
  const requested: string[] = entity.listViews ?? (entity.listView ? [entity.listView] : ['table'])
  const views = requested.flatMap<{ name: string; by?: string }>(v => {
    if (v === 'kanban') return breakdown && !readOnly ? [{ name: 'kanban', by: breakdown.name }] : []
    if (v === 'calendar') return calendar ? [{ name: 'calendar', by: calendar.name }] : []
    return [{ name: v }]
  })
  if (views.length === 0) views.push({ name: 'table' })

  const search = entity.fields
    .filter(f => (f.type === 'STRING' || f.type === 'TEXT') && f.searchable !== false)
    .map(f => f.name)
  const filters = entity.fields
    .filter(f => !f.primaryKey && f.filterable !== false
      && (f.type === 'ENUM' || f.type === 'BOOLEAN' || isTemporal(f) || isNumeric(f)))
    .map(f => f.name)
  for (const r of entity.relations ?? []) if (r.fieldName.trim()) filters.push(`${r.fieldName.trim()}Id`)

  return { path, verbs, views, search, filters, endpoints, opts }
}
