import type { FullstackEntityDef, FullstackFieldDef, FullstackRelationDef } from '../../types'

/**
 * Client-only identity for editor rows. Entities, fields and relations are edited positionally
 * (duplicate-in-place, remove, reorder), so index keys make React reuse the wrong DOM subtree
 * and transient state (expanded panels, <details>, caret) jumps rows. A stable `uid` fixes the
 * keys; it never leaves the browser — `stripUids` removes it before the request is posted.
 */
export function newUid(): string {
  const c = globalThis.crypto as Crypto | undefined
  return c?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function withFieldUid(f: FullstackFieldDef): FullstackFieldDef {
  return f.uid ? f : { ...f, uid: newUid() }
}

function withRelationUid(r: FullstackRelationDef): FullstackRelationDef {
  return r.uid ? r : { ...r, uid: newUid() }
}

/** Ensures every entity/field/relation carries a uid (used when hydrating from storage,
 *  defaults or an import result). Rows that already have one are returned as-is. */
export function withUids(entities: FullstackEntityDef[]): FullstackEntityDef[] {
  return entities.map(e => ({
    ...e,
    uid: e.uid ?? newUid(),
    fields: e.fields.map(withFieldUid),
    relations: e.relations?.map(withRelationUid),
  }))
}

/** Deep-copies an entity with fresh uids on every row — for the Duplicate action. */
export function cloneWithNewUids(e: FullstackEntityDef): FullstackEntityDef {
  return {
    ...e,
    uid: newUid(),
    fields: e.fields.map(f => ({ ...f, uid: newUid(), enumValues: f.enumValues ? [...f.enumValues] : undefined, enumLabels: f.enumLabels ? { ...f.enumLabels } : undefined })),
    relations: e.relations?.map(r => ({ ...r, uid: newUid() })),
    listViews: e.listViews ? [...e.listViews] : undefined,
    opts: e.opts ? { ...e.opts } : undefined,
  }
}

/** Removes the client-only props so the wire payload matches the backend DTOs exactly: the row
 *  uids, and `sourceSql` (the DDL an entity was imported from — shown on the card for the
 *  session, but the server discards it and it is large enough to blow the localStorage quota
 *  and the share-link length when carried along). */
export function stripUids(entities: FullstackEntityDef[]): FullstackEntityDef[] {
  return entities.map(({ uid: _e, sourceSql: _s, fields, relations, ...rest }) => ({
    ...rest,
    fields: fields.map(({ uid: _f, ...f }) => f),
    relations: relations?.map(({ uid: _r, ...r }) => r),
  }))
}

/** Rows that carry a client uid and a display name — entities, fields (`name`) and relations
 *  (`fieldName`) all fit once given a key accessor. */
function reconcileRows<T extends { uid?: string }>(current: readonly T[], restored: readonly T[], key: (row: T) => string): T[] {
  const norm = (row: T) => key(row).trim().toLowerCase()
  const used = new Set<number>()
  const matched: (number | undefined)[] = restored.map(row => {
    const name = norm(row)
    if (!name) return undefined
    const idx = current.findIndex((c, j) => !used.has(j) && norm(c) === name)
    if (idx < 0) return undefined
    used.add(idx)
    return idx
  })
  // Second pass: rows with no name match fall back to their old position, if it is still free.
  return restored.map((row, i) => {
    let idx = matched[i]
    if (idx === undefined && i < current.length && !used.has(i)) { idx = i; used.add(i) }
    return { ...row, uid: idx === undefined ? newUid() : current[idx].uid ?? newUid() }
  })
}

/** Re-stamps a restored (uid-less) entity list with the uids of the current one, so React keys —
 *  and everything keyed on them: collapsed cards, open panels, expanded field rows — survive an
 *  undo/redo. Match by trimmed, case-insensitive name first, then by position; the same for the
 *  fields and relations inside a matched entity. Anything unmatched gets a fresh uid. */
export function reconcileUids(current: FullstackEntityDef[], restored: FullstackEntityDef[]): FullstackEntityDef[] {
  const byUid = new Map(current.filter(e => e.uid).map(e => [e.uid!, e]))
  return reconcileRows(current, restored, e => e.name).map(e => {
    const match = e.uid ? byUid.get(e.uid) : undefined
    return {
      ...e,
      fields: reconcileRows(match?.fields ?? [], e.fields, f => f.name),
      relations: e.relations ? reconcileRows(match?.relations ?? [], e.relations, r => r.fieldName) : undefined,
    }
  })
}
