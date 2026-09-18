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
    fields: e.fields.map(f => ({ ...f, uid: newUid(), enumValues: f.enumValues ? [...f.enumValues] : undefined })),
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
