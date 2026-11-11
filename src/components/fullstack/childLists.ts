import type { FullstackEntityDef, FullstackRelationDef } from '../../types'

/**
 * A ONE_TO_MANY reads a link the other side holds: `Order.lines` is the rows of `OrderLine` whose
 * `order` points at the order. These helpers answer "which of the target's MANY_TO_ONEs is that"
 * the way `FullstackRequestValidator.linkBehind` does — the one `mappedBy` names, else the only
 * one there is.
 */

const lower = (s: string | undefined) => (s ?? '').trim().toLowerCase()

/** The key of a (child, parent) pair in a link index. Entity names are identifiers, so `>` is free. */
export const linkKey = (child: string, parent: string) => `${lower(child)}>${lower(parent)}`

/** The MANY_TO_ONEs of `child` that point at `parent`, in the model's order. */
export function linksBetween(child: FullstackEntityDef | undefined, parent: string): string[] {
  if (!child || !parent.trim()) return []
  return (child.relations ?? [])
    .filter(r => r.type === 'MANY_TO_ONE' && r.fieldName.trim() && lower(r.targetEntity) === lower(parent))
    .map(r => r.fieldName.trim())
}

/**
 * Every (child, parent) pair's links as one string — cheap to compare, so a card that only needs
 * the links re-renders when a link changes and not on every keystroke elsewhere.
 */
export function linkIndexKey(entities: readonly FullstackEntityDef[]): string {
  const lines: string[] = []
  for (const child of entities) {
    if (!child.name.trim()) continue
    for (const r of child.relations ?? []) {
      if (r.type !== 'MANY_TO_ONE' || !r.fieldName.trim() || !r.targetEntity.trim()) continue
      lines.push(`${linkKey(child.name, r.targetEntity)}>${r.fieldName.trim()}`)
    }
  }
  return lines.join('\n')
}

export type LinkIndex = ReadonlyMap<string, readonly string[]>

export function parseLinkIndex(key: string): LinkIndex {
  const index = new Map<string, string[]>()
  for (const line of key ? key.split('\n') : []) {
    const at = line.lastIndexOf('>')
    const pair = line.slice(0, at)
    index.set(pair, [...(index.get(pair) ?? []), line.slice(at + 1)])
  }
  return index
}

export interface ResolvedLink {
  /** The link the list reads, in the target's own spelling. */
  mappedBy?: string
  /** Why there is none, and which control the message belongs under. */
  problem?: { on: 'targetEntity' | 'mappedBy'; message: string }
}

/** Which of `links` (the target's MANY_TO_ONEs to `owner`) a ONE_TO_MANY reads. */
export function resolveLink(rel: FullstackRelationDef, owner: string, links: readonly string[]): ResolvedLink {
  const target = rel.targetEntity.trim()
  const named = rel.mappedBy?.trim()
  if (named) {
    const found = links.find(l => lower(l) === lower(named))
    if (found) return { mappedBy: found }
    return { problem: { on: 'mappedBy', message: `${target} has no many-to-one '${named}' to ${owner.trim() || 'this entity'}` } }
  }
  if (links.length === 1) return { mappedBy: links[0] }
  if (links.length === 0) {
    return { problem: { on: 'targetEntity', message: `${target} has no many-to-one to ${owner.trim() || 'this entity'} — add that relation to ${target} first` } }
  }
  return { problem: { on: 'mappedBy', message: `${target} links here more than once — pick one: ${links.join(', ')}` } }
}

/**
 * A MANY_TO_ONE was renamed: the ONE_TO_MANYs that name it in `mappedBy` follow. Returns the same
 * array when none did.
 */
export function renameLinkInChildLists(
  entities: FullstackEntityDef[], child: string, from: string, to: string,
): FullstackEntityDef[] {
  if (!from.trim() || !to.trim() || from === to) return entities
  let changed = false
  const next = entities.map(entity => {
    const follows = (r: FullstackRelationDef) => r.type === 'ONE_TO_MANY'
      && lower(r.targetEntity) === lower(child) && lower(r.mappedBy) === lower(from)
    if (!entity.relations?.some(follows)) return entity
    changed = true
    return { ...entity, relations: entity.relations.map(r => (follows(r) ? { ...r, mappedBy: to } : r)) }
  })
  return changed ? next : entities
}
