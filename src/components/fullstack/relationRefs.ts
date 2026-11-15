import type { FullstackEntityDef } from '../../types'

const same = (a: string | undefined, b: string) => a != null && a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Relations name their target entity, so renaming an entity has to follow into every relation
 * that points at it — otherwise they are left aimed at a name that no longer exists and the
 * model stops validating ("relation targets unknown entity"). Returns the same array when
 * nothing pointed at `from`.
 */
export function renameEntityInRelations(
  entities: FullstackEntityDef[], from: string, to: string,
): FullstackEntityDef[] {
  if (!from.trim() || !to.trim() || from === to) return entities
  let changed = false
  const next = entities.map(entity => {
    if (!entity.relations?.some(r => same(r.targetEntity, from))) return entity
    changed = true
    return {
      ...entity,
      relations: entity.relations.map(r => (same(r.targetEntity, from) ? { ...r, targetEntity: to } : r)),
    }
  })
  return changed ? next : entities
}
