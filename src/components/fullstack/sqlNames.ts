import type { FullstackEntityDef } from '../../types'
import { pluralize, toSnakeCase } from './naming'
import { SCHEMA } from './schema'

/**
 * The table and column names a model maps to, and which of them the generator has to quote for
 * the project's database — the backend's `SchemaNames` and `sql/SqlKeywords`, mirrored so the
 * editor can say so before Generate. The word lists come from the schema document
 * (`names.sqlReservedWords`, `names.sqlSystemColumns`), by database dependency.
 */

/** The database a project's names are written for — the backend's `SchemaDialect.of`. */
export function databaseOf(deps: readonly string[]): string {
  return ['postgresql', 'oracle', 'mssql', 'db2'].find(dep => deps.includes(dep)) ?? 'h2'
}

export const DATABASE_LABELS: Readonly<Record<string, string>> = {
  h2: 'H2', postgresql: 'PostgreSQL', oracle: 'Oracle', mssql: 'SQL Server', db2: 'DB2',
}

const RESERVED = SCHEMA.names.sqlReservedWords as Record<string, readonly string[]>
const SYSTEM = SCHEMA.names.sqlSystemColumns as Record<string, readonly string[]>
const reservedSets = new Map<string, ReadonlySet<string>>()

function wordsOf(lists: Record<string, readonly string[]>, database: string, cache?: Map<string, ReadonlySet<string>>): ReadonlySet<string> {
  const hit = cache?.get(database)
  if (hit) return hit
  const set = new Set(lists[database] ?? [])
  cache?.set(database, set)
  return set
}

/** `"x"`, `` `x` `` or `[x]`: a name the model spells in exact case. */
export function isQuotedName(name: string): boolean {
  return /^(".*"|`.*`|\[.*\])$/.test(name.trim())
}

/** Whether a bare `name` is a keyword on `database`, so the generator writes it quoted. */
export function isKeywordOn(name: string, database: string): boolean {
  const bare = name.trim()
  return bare !== '' && !isQuotedName(bare) && wordsOf(RESERVED, database, reservedSets).has(bare.toUpperCase())
}

/** Whether `name` is a column every table of `database` already has (no column can be named so). */
export function isSystemColumnOn(name: string, database: string): boolean {
  return wordsOf(SYSTEM, database).has(name.trim().replace(/^["`[]|["`\]]$/g, '').toUpperCase())
}

/** An entity's table as the model names it: its own `tableName`, else the snake plural of its name. */
export function tableOf(entity: FullstackEntityDef): string {
  return entity.tableName?.trim() || pluralize(toSnakeCase(entity.name.trim()))
}

/**
 * Whether the generator writes `name` in quotes for `database`: the model quoted it, or it is a
 * keyword there. SQL written into a mapping (a link's label, a parent's count of its rows) cannot
 * name such a table or column of another entity.
 */
export function needsQuotes(name: string, database: string): boolean {
  return isQuotedName(name) || isKeywordOn(name, database)
}
