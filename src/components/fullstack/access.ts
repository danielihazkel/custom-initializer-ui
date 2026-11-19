import type { FullstackAccess, FullstackAccessLevel, FullstackEntityDef } from '../../types'
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
  return cleaned.read || cleaned.write ? cleaned : undefined
}

/** The server's rule, in its words: someone who may change a row has to be able to see it. */
export function accessProblem(entity: Pick<FullstackEntityDef, 'access'>): string | undefined {
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
  return t('read: {read} · write: {write}', {
    read: ACCESS_LEVEL_LABELS[readLevel(entity)].toLowerCase(), write: ACCESS_LEVEL_LABELS[writeLevel(entity)].toLowerCase(),
  })
}
