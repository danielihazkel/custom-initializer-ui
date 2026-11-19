import type { FullstackAccess, FullstackAccessLevel, FullstackEntityDef, FullstackRowMode } from '../../types'
import { SCHEMA } from './schema'
import { t } from '../../i18n'

/**
 * An entity's access levels — who may read its rows and who may change them through the
 * generated API — the editor side of `EntityDefinition.Access` in the backend.
 *
 * With an ldap-auth dependency on the build (the template sets' default) every generated
 * endpoint is checked against the caller's roles; these two levels say which. The lists come from
 * the schema document (`accessLevels`, weakest first; `defaultAccess`), so the server's rule and
 * this file cannot drift: writing may not be open to more people than reading.
 */
export const ACCESS_LEVELS = SCHEMA.accessLevels as readonly FullstackAccessLevel[]

export const DEFAULT_ACCESS = SCHEMA.defaultAccess as Readonly<Required<FullstackAccess>>

/** Read in the site's language at the moment they are shown (getters). */
export const ACCESS_LEVEL_LABELS: Record<FullstackAccessLevel, string> = {
  get SIGNED_IN() { return t('Anyone signed in') },
  get USER() { return t('Users') },
  get ADMIN() { return t('Admins') },
}

/** The dependencies that put the role check on a generated backend. */
export const LDAP_DEPS = ['ldap-auth', 'ldap-auth-rest']

/** The level in force: what the entity says, else the default. */
export function readLevel(entity: Pick<FullstackEntityDef, 'access'>): FullstackAccessLevel {
  return entity.access?.read ?? DEFAULT_ACCESS.read
}

export function writeLevel(entity: Pick<FullstackEntityDef, 'access'>): FullstackAccessLevel {
  return entity.access?.write ?? DEFAULT_ACCESS.write
}

/**
 * What an edit leaves on the entity: a level equal to its default is not written, and no level
 * at all is `undefined` — so an entity nobody touched keeps the shape it had before access
 * levels existed (snapshots, share links, the request).
 */
export function cleanAccess(access: FullstackAccess | undefined): FullstackAccess | undefined {
  const cleaned: FullstackAccess = {}
  if (access?.read && access.read !== DEFAULT_ACCESS.read) cleaned.read = access.read
  if (access?.write && access.write !== DEFAULT_ACCESS.write) cleaned.write = access.write
  // Whose rows: no owners is no limit, and the default mode is not written.
  if (access?.owners?.length) {
    cleaned.owners = access.owners
    if (access.rows && access.rows !== DEFAULT_ROW_MODE) cleaned.rows = access.rows
  }
  return cleaned.read || cleaned.write || cleaned.owners ? cleaned : undefined
}

// ── whose rows (access.owners / access.rows) ────────────────────────────────

const ROW_ACCESS = SCHEMA.rowAccess as { modes: FullstackRowMode[]; defaultMode: FullstackRowMode; creator: string; maxOwners: number }

export const ROW_MODES: readonly FullstackRowMode[] = ROW_ACCESS.modes
export const DEFAULT_ROW_MODE = ROW_ACCESS.defaultMode
/** The owner that is whoever created the row (it needs the audit columns). */
export const CREATOR = ROW_ACCESS.creator
export const MAX_OWNERS = ROW_ACCESS.maxOwners

/** `ALL`: rows belong to nobody. Else the mode in force (owners without `rows` is the default mode). */
export function rowMode(entity: Pick<FullstackEntityDef, 'access'>): 'ALL' | FullstackRowMode {
  if (!entity.access?.owners?.length) return 'ALL'
  return entity.access.rows ?? DEFAULT_ROW_MODE
}

/** What can say whose a row is: the creator, and each stored text field that is not the key, computed or shown on a condition. */
export function ownerChoices(entity: FullstackEntityDef): { name: string; label: string }[] {
  const out = [{ name: CREATOR, label: t('Whoever created it') }]
  for (const f of entity.fields) {
    if (f.type !== 'STRING' || f.primaryKey || f.formula?.trim() || f.showWhen?.trim() || !f.name.trim()) continue
    out.push({ name: f.name, label: f.label?.trim() || f.name })
  }
  return out
}

/** The owners a model starts with when rows are first limited: the creator — or, on a read-only entity, its first text field. */
export function defaultOwners(entity: FullstackEntityDef): string[] {
  const choices = ownerChoices(entity)
  if (!entity.readOnly) return [CREATOR]
  return choices.length > 1 ? [choices[1].name] : []
}

/**
 * An entity's owners after an edit: a renamed field (matched by uid) is renamed there, one that
 * is gone or can no longer hold a user id is dropped — and with the last owner the row limit.
 */
export function syncAccess(before: FullstackEntityDef, after: FullstackEntityDef): FullstackEntityDef {
  const owners = after.access?.owners
  if (!owners?.length) return after
  const renamed = new Map<string, string>()
  for (const f of after.fields) {
    const was = f.uid ? before.fields.find(x => x.uid === f.uid) : undefined
    if (was && was.name !== f.name) renamed.set(was.name, f.name)
  }
  const allowed = new Set(ownerChoices(after).map(c => c.name))
  const next = owners.map(n => renamed.get(n) ?? n).filter(n => allowed.has(n))
  if (next.length === owners.length && next.every((n, i) => n === owners[i])) return after
  return { ...after, access: cleanAccess({ ...after.access, owners: next }) }
}

/** What the row rules need to know about the model around the entity. */
export interface RowAccessContext {
  /** The parent whose form edits this entity's rows (a composition), if any. */
  composedBy?: string
  /** Whether the entity turns the audit columns off for itself. */
  auditOff?: boolean
}

/** The server's rules, in its words: someone who may change a row has to be able to see it — and whose a row is. */
export function accessProblem(entity: FullstackEntityDef | Pick<FullstackEntityDef, 'access'>, context: RowAccessContext = {}): string | undefined {
  const levels = levelsProblem(entity)
  if (levels) return levels
  return 'fields' in entity ? rowAccessProblem(entity, context) : undefined
}

/** The rules of `access.owners` / `access.rows` (the server's `RowAccessRules`). */
export function rowAccessProblem(entity: FullstackEntityDef, context: RowAccessContext = {}): string | undefined {
  const access = entity.access
  const owners = access?.owners ?? []
  if (access?.rows && !ROW_MODES.includes(access.rows)) return t("Rows '{mode}' is not one of {modes}", { mode: access.rows, modes: ROW_MODES.join(', ') })
  if (owners.length === 0) return access?.rows ? t('Rows {mode} needs owners — who a row belongs to', { mode: access.rows }) : undefined
  if (owners.length > MAX_OWNERS) return t('At most {n} owners', { n: MAX_OWNERS })
  if (entity.viewQuery != null) return t('A SELECT-backed view has no rows of its own to belong to anyone')
  if (context.composedBy) return t("Its rows are part of '{parent}' (a composition) and follow that entity's owners — set them there", { parent: context.composedBy })
  const seen = new Set<string>()
  for (const raw of owners) {
    const name = raw.toLowerCase() === CREATOR.toLowerCase() ? CREATOR : raw
    if (seen.has(name.toLowerCase())) return t("Owner '{owner}' is named twice", { owner: name })
    seen.add(name.toLowerCase())
    if (name === CREATOR) continue
    const field = entity.fields.find(f => f.name.toLowerCase() === name.toLowerCase())
    if (!field) return t("Owner '{owner}' is not a field of this entity (an owner is the creator or a text field holding a user id)", { owner: name })
    if (field.type !== 'STRING') return t("Owner '{owner}' is {type}: a user id is kept in a STRING field", { owner: name, type: field.type })
    if (field.primaryKey) return t("Owner '{owner}' is the key, which names the row, not a user", { owner: name })
    if (field.formula?.trim()) return t("Owner '{owner}' is computed: an owner is a value somebody sets", { owner: name })
    if (field.showWhen?.trim()) return t("Owner '{owner}' has a show-when condition, which empties it while hidden", { owner: name })
  }
  const creator = seen.has(CREATOR.toLowerCase())
  const mode = rowMode(entity)
  if (readLevel(entity) === 'ADMIN') return t('Only admins read this entity, and admins are never limited — owners have nobody to limit')
  if (mode === 'OWN_WRITES' && writeLevel(entity) === 'ADMIN') return t('Only admins change this entity — set write to Users, or let users see only their own rows')
  if (entity.readOnly && mode === 'OWN_WRITES') return t('A read-only entity has no changes to limit to its owners')
  if (entity.readOnly && creator) return t('A read-only entity has no creator: the application creates none of its rows')
  if (creator && context.auditOff) return t('The creator as an owner needs the audit columns, which this entity turns off')
  const assignee = entity.workflow?.assigneeField
  if (assignee && owners.length === 1 && owners[0].toLowerCase() === assignee.toLowerCase()) {
    return t("The only owner is the workflow's assignee, which a new row never has — add the creator or another field")
  }
  return undefined
}

function levelsProblem(entity: Pick<FullstackEntityDef, 'access'>): string | undefined {
  const read = readLevel(entity)
  const write = writeLevel(entity)
  if (!ACCESS_LEVELS.includes(read)) return t("Read access '{level}' is not one of {levels}", { level: read, levels: ACCESS_LEVELS.join(', ') })
  if (!ACCESS_LEVELS.includes(write)) return t("Write access '{level}' is not one of {levels}", { level: write, levels: ACCESS_LEVELS.join(', ') })
  if (ACCESS_LEVELS.indexOf(write) < ACCESS_LEVELS.indexOf(read)) {
    return t('Write ({write}) cannot be open to more people than read ({read})', { write: ACCESS_LEVEL_LABELS[write], read: ACCESS_LEVEL_LABELS[read] })
  }
  return undefined
}

/** "read: anyone signed in · write: users" — for the closed Settings panel; nothing for the default. */
export function accessSummary(entity: Pick<FullstackEntityDef, 'access'>): string | undefined {
  if (!cleanAccess(entity.access)) return undefined
  const levels = t('read: {read} · write: {write}', {
    read: ACCESS_LEVEL_LABELS[readLevel(entity)].toLowerCase(), write: ACCESS_LEVEL_LABELS[writeLevel(entity)].toLowerCase(),
  })
  const mode = rowMode(entity)
  if (mode === 'ALL') return levels
  return `${levels} · ${mode === 'OWN' ? t('own rows only') : t('own rows to change')}`
}
