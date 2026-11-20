import type { FullstackChildTabDef, FullstackEntityDef, FullstackListSort, FullstackPageDef } from '../../../types'
import { t } from '../../../i18n'
import { numericFields } from './dashboard'

/**
 * A record page's related lists and header numbers: reading and writing a child tab in either
 * of its spellings, and which of a child's links lead to the record's entity.
 */

/** The entity a record page's tab lists. */
export function childTabEntity(tab: FullstackChildTabDef): string {
  return typeof tab === 'string' ? tab : tab.entity
}

/** The relation a record page's tab links through, when one is named. */
export function childTabVia(tab: FullstackChildTabDef): string | undefined {
  return typeof tab === 'string' ? undefined : tab.via
}

/** A tab entry in its shortest spelling: the bare entity unless a relation is named. */
export function childTab(entity: string, via?: string): FullstackChildTabDef {
  return via ? { entity, via } : entity
}

/** A related-list tab with some of its parts changed, keeping the rest (its columns and sort);
 *  a tab left with only its entity is written as the bare name. */
export function withChildTab(tab: FullstackChildTabDef, patch: { entity?: string; via?: string; columns?: string[]; sort?: FullstackListSort }): FullstackChildTabDef {
  const next: Record<string, unknown> = { ...(typeof tab === 'string' ? { entity: tab } : tab), ...patch }
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k]
  return Object.keys(next).length === 1 ? (next.entity as string) : (next as Exclude<FullstackChildTabDef, string>)
}

/** The columns and sort a related-list tab opens with (none: the list's defaults). */
export function childTabPresentation(tab: FullstackChildTabDef): { columns?: string[]; sort?: FullstackListSort } {
  return typeof tab === 'string' ? {} : { columns: tab.columns, sort: tab.sort }
}

/** The child's MANY_TO_ONE fields pointing at `parent`, in declaration order. */
type HeaderStat = NonNullable<FullstackPageDef['headerStats']>[number]

/** A record page's header tile moved to another related entity: it keeps its title, its measure
 *  when the new entity has the same numeric field, and its link when that relation also points at
 *  the record's entity. `dropped` names what did not fit, for the editor's notice. */
export function retargetHeaderStat(stat: HeaderStat, child: FullstackEntityDef | undefined, recordEntity: string | undefined): { stat: HeaderStat; dropped: string[] } {
  const next: HeaderStat = { child: child?.name ?? '' }
  const dropped: string[] = []
  if (stat.agg && stat.agg !== 'count') {
    if (stat.field && numericFields(child).some(f => f.name === stat.field)) {
      next.agg = stat.agg
      next.field = stat.field
    } else dropped.push(t('measure'))
  } else if (stat.agg) next.agg = stat.agg
  if (stat.via) {
    if (relationsTo(child, recordEntity).includes(stat.via)) next.via = stat.via
    else dropped.push(t('link'))
  }
  if (stat.title) next.title = stat.title
  return { stat: next, dropped }
}

export function relationsTo(child: FullstackEntityDef | undefined, parent: string | undefined): string[] {
  if (!child || !parent) return []
  return (child.relations ?? [])
    .filter(r => r.type === 'MANY_TO_ONE' && r.targetEntity.trim().toLowerCase() === parent.trim().toLowerCase())
    .map(r => r.fieldName)
}
