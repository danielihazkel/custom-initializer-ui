import type { FullstackEntityDef, FullstackFieldDef, FullstackUniqueKey } from '../../types'
import { LIMITS } from './schema'
import { t } from '../../i18n'

/** Mirrors FullstackRequestValidator.MAX_UNIQUE_KEYS / MAX_UNIQUE_KEY_FIELDS / MAX_HELP. */
export const MAX_UNIQUE_KEYS = LIMITS.maxUniqueKeys
export const MAX_UNIQUE_KEY_FIELDS = LIMITS.maxUniqueKeyFields
export const MAX_HELP = LIMITS.maxHelp
/** The most files a field that holds several may take (`maxFiles`). */
export const MAX_FILES = LIMITS.maxFiles

/** What a unique key may name: the entity's non-key fields (but long texts) and its many-to-one links. */
export function keyableMembers(entity: FullstackEntityDef): { name: string; label: string }[] {
  const out: { name: string; label: string }[] = []
  for (const f of entity.fields) {
    if (f.primaryKey || f.type === 'TEXT' || f.type === 'MARKDOWN') continue
    out.push({ name: f.name, label: f.label?.trim() || f.name })
  }
  for (const r of entity.relations ?? []) {
    if (r.type === 'MANY_TO_ONE') out.push({ name: r.fieldName, label: r.label?.trim() || r.fieldName })
  }
  return out
}

/**
 * An entity's unique keys after an edit: a renamed field or link (matched by uid) is renamed in
 * its key, one that is gone or can no longer be part of a key is dropped, and a key left with
 * fewer than two members is removed. Anything else stays as the user wrote it.
 */
export function syncUniqueKeys(before: FullstackEntityDef, after: FullstackEntityDef): FullstackEntityDef {
  if (!after.uniqueKeys?.length) return after
  const renamed = new Map<string, string>()
  for (const f of after.fields) {
    const was = f.uid ? before.fields.find(x => x.uid === f.uid) : undefined
    if (was && was.name !== f.name) renamed.set(was.name, f.name)
  }
  for (const r of after.relations ?? []) {
    const was = r.uid ? (before.relations ?? []).find(x => x.uid === r.uid) : undefined
    if (was && was.fieldName !== r.fieldName) renamed.set(was.fieldName, r.fieldName)
  }
  const allowed = new Set(keyableMembers(after).map(m => m.name))
  let changed = false
  const keys: FullstackUniqueKey[] = []
  for (const k of after.uniqueKeys) {
    const fields = k.fields.map(n => renamed.get(n) ?? n).filter(n => allowed.has(n))
    const differs = fields.length !== k.fields.length || fields.some((n, i) => n !== k.fields[i])
    if (differs) changed = true
    if (fields.length < 2 && k.fields.length >= 2) continue
    keys.push(differs ? { ...k, fields } : k)
  }
  if (!changed) return after
  return { ...after, uniqueKeys: keys.length ? keys : undefined }
}

/** Whether rows can differ in a member: an enum, a yes/no field or a patterned text cannot be varied by the demo data and tests. */
function varies(field: FullstackFieldDef | undefined): boolean {
  return field === undefined || (field.type !== 'ENUM' && field.type !== 'BOOLEAN' && !field.pattern)
}

/**
 * Why an entity's unique keys would be rejected (FullstackRequestValidator.parseUniqueKeys, and
 * checkComposition for a child edited inside its parent's form), or undefined.
 */
export function uniqueKeysProblem(entity: FullstackEntityDef, composedChild = false): string | undefined {
  const keys = entity.uniqueKeys ?? []
  if (keys.length === 0) return undefined
  if (entity.viewQuery?.trim()) return t('A SELECT-backed view cannot have unique keys')
  if (composedChild) return t('Rows edited inside their parent’s form cannot have a unique key: a save that replaces a row would clash with it')
  if (keys.length > MAX_UNIQUE_KEYS) return t('At most {max} unique keys', { max: MAX_UNIQUE_KEYS })
  const fields = new Map(entity.fields.map(f => [f.name.toLowerCase(), f]))
  const links = new Set((entity.relations ?? []).filter(r => r.type === 'MANY_TO_ONE').map(r => r.fieldName.toLowerCase()))
  const seen = new Set<string>()
  for (let i = 0; i < keys.length; i++) {
    const n = i + 1
    const names = keys[i].fields
    if (names.length < 2) return t('Unique key {n} needs two or more fields (one field is unique on its own — tick its Unique)', { n })
    if (names.length > MAX_UNIQUE_KEY_FIELDS) return t('Unique key {n} names more than {max} fields', { n, max: MAX_UNIQUE_KEY_FIELDS })
    const lower = names.map(x => x.trim().toLowerCase())
    for (const [j, key] of lower.entries()) {
      const field = fields.get(key)
      if (field) {
        if (field.primaryKey) return t('Unique key {n} includes the primary key “{field}”, which is unique already', { n, field: field.name })
        if (field.type === 'TEXT' || field.type === 'MARKDOWN') return t('Unique key {n} includes “{field}”, a long text, which a database cannot index', { n, field: field.name })
        if (field.maxFiles != null) return t('Unique key {n} includes “{field}”, which holds several files in a table of its own', { n, field: field.name })
      } else if (!links.has(key)) {
        return t('Unique key {n} names “{field}”, which is not one of its fields or many-to-one links', { n, field: names[j] })
      }
      if (lower.indexOf(key) !== j) return t('Unique key {n} names “{field}” twice', { n, field: names[j] })
    }
    if (!lower.some(key => varies(fields.get(key)))) {
      return t('Unique key {n} is over enums, yes/no fields and patterned texts only, which allow few distinct rows: add a field or link that tells rows apart', { n })
    }
    const set = [...lower].sort().join('\u0000')
    if (seen.has(set)) return t('Unique key {n} is over the same fields as another key', { n })
    seen.add(set)
  }
  return undefined
}
