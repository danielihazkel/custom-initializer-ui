import type { FullstackEntityDef, FullstackFieldDef } from '../../types'
import { pluralize, toKebabCase } from './naming'

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
}

const isTemporal = (f: FullstackFieldDef) => f.type === 'LOCAL_DATE' || f.type === 'LOCAL_DATE_TIME'
const isNumeric = (f: FullstackFieldDef) => f.type === 'LONG' || f.type === 'INTEGER' || f.type === 'BIG_DECIMAL'

export function summarizeEntity(entity: FullstackEntityDef): EntitySummary {
  const name = entity.name.trim() || 'Entity'
  const readOnly = Boolean(entity.readOnly || entity.viewQuery)
  const path = `/api/${pluralize(toKebabCase(name))}`
  const verbs = readOnly ? ['GET'] : ['GET', 'POST', 'PUT', 'DELETE']

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

  return { path, verbs, views, search, filters }
}
