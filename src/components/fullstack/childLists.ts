import type { FullstackEntityDef, FullstackRelationDef } from '../../types'
import { t } from '../../i18n'

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
    return { problem: { on: 'mappedBy', message: t("{target} has no many-to-one '{link}' to {owner}", { target, link: named, owner: owner.trim() || t('this entity') }) } }
  }
  if (links.length === 1) return { mappedBy: links[0] }
  if (links.length === 0) {
    return { problem: { on: 'targetEntity', message: t('{target} has no many-to-one to {owner} — add that relation to {target} first', { target, owner: owner.trim() || t('this entity') }) } }
  }
  return { problem: { on: 'mappedBy', message: t('{target} links here more than once — pick one: {links}', { target, links: links.join(', ') }) } }
}

/**
 * Why `rel` — a ONE_TO_MANY of `parent` that reads `mappedBy` — cannot be a composition, or
 * undefined when it can. A composition makes the rows part of the parent (edited in its form,
 * saved and removed with it), which only works for a child that is plainly a row of its parent:
 * the rules of `FullstackRequestValidator.checkComposition`, in the same order.
 */
export function compositionProblem(
  parent: FullstackEntityDef, rel: FullstackRelationDef, mappedBy: string, entities: readonly FullstackEntityDef[],
): string | undefined {
  const child = entities.find(e => lower(e.name) === lower(rel.targetEntity))
  if (!child) return undefined
  const childName = child.name.trim()
  if (lower(childName) === lower(parent.name)) return t('An entity cannot be composed of its own rows')
  if (parent.readOnly || parent.viewQuery !== undefined) return t('{parent} is read-only, so it has no form to edit the rows in', { parent: parent.name.trim() })
  if (child.readOnly || child.viewQuery !== undefined) return t('{child} is read-only: its rows cannot be saved', { child: childName })
  const keys = child.fields.filter(f => f.primaryKey)
  if (keys.length !== 1 || !keys[0].generated) return t('{child} needs a single generated key (a new row gets its id from the database)', { child: childName })
  const link = (child.relations ?? []).find(r => r.type === 'MANY_TO_ONE' && lower(r.fieldName) === lower(mappedBy))
  if (link && !link.required) return t("'{link}' on {child} must be required (a composed row always belongs to its {parent})", { link: link.fieldName.trim(), child: childName, parent: parent.name.trim() })
  if (child.workflow) return t("{child} has a workflow: its rows change by their own moves, not with a parent's save", { child: childName })
  const attachment = child.fields.find(f => f.type === 'FILE' || f.type === 'IMAGE')
  if (attachment) return t("{child} has an attachment field ('{field}'), which a row of a parent's form cannot upload", { child: childName, field: attachment.name })
  if ((child.relations ?? []).some(r => r.type !== 'MANY_TO_ONE')) return t("{child} has lists of its own, which a row of a parent's form cannot edit", { child: childName })
  // A row has one owner: the first composition of the child, in the model's order, is it.
  for (const other of entities) {
    for (const r of other.relations ?? []) {
      if (r.type !== 'ONE_TO_MANY' || !r.composition || lower(r.targetEntity) !== lower(childName)) continue
      if (other === parent && r === rel) return undefined
      return t('{child} is already composed by {owner}: a row has one owner', { child: childName, owner: `${other.name.trim()}.${r.fieldName.trim()}` })
    }
  }
  return undefined
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
