import type { FullstackStarterRequest } from '../../types'
import { t } from '../../i18n'

/**
 * The model's tables as SQL (`POST /starter-fullstack.ddl`) and created on a schema source an admin
 * allowed it for (`POST /starter-fullstack.create-tables`) — backend `FullstackStarterController`,
 * `fullstack/schema/SchemaInstaller`. The script is the project's Flyway baseline (`V1__init.sql`).
 */

/** The databases a script can be written for, in the order the picker shows them. */
export const SCHEMA_DIALECTS = ['H2', 'POSTGRESQL', 'ORACLE', 'MSSQL', 'DB2'] as const
export type SchemaDialectId = typeof SCHEMA_DIALECTS[number]

export const SCHEMA_DIALECT_LABELS: Record<SchemaDialectId, string> = {
  H2: 'H2', POSTGRESQL: 'PostgreSQL', ORACLE: 'Oracle', MSSQL: 'SQL Server', DB2: 'DB2',
}

/**
 * The database the project's own dependencies select — the backend's `SchemaDialect.of`: the first
 * of PostgreSQL, Oracle, SQL Server and DB2 among them, else H2.
 */
export function projectDialect(deps: readonly string[]): SchemaDialectId {
  for (const [dep, dialect] of [['postgresql', 'POSTGRESQL'], ['oracle', 'ORACLE'], ['mssql', 'MSSQL'], ['db2', 'DB2']] as const) {
    if (deps.includes(dep)) return dialect
  }
  return 'H2'
}

export interface DdlResult {
  dialect: SchemaDialectId
  label: string
  sql: string
  tables: string[]
  projectDialect: SchemaDialectId
  flyway: boolean
}

export interface CreateTablesResult {
  dialect: string
  label: string
  schema: string
  sql: string
  tables: string[]
  statements: number
  created: string[]
  checked: boolean
  /** A failure rolls back (PostgreSQL, SQL Server); elsewhere a failed run drops what it made. */
  transactional: boolean
  projectDialect: SchemaDialectId
  flyway: boolean
}

/** A refusal or failure, in the server's words; `existing` lists the tables in the way (a 409). */
export class DatabaseError extends Error {
  status: number
  title: string
  path?: string
  existing: string[]
  constructor(status: number, title: string, detail: string, path?: string, existing: string[] = []) {
    super(detail)
    this.status = status
    this.title = title
    this.path = path
    this.existing = existing
  }
}

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new DatabaseError(0, t('Connection error'), t('The server could not be reached.'))
  }
  if (!res.ok) {
    const b = await res.json().catch(() => null) as
      { error?: string; detail?: string; path?: string; existing?: unknown } | null
    const existing = Array.isArray(b?.existing) ? b!.existing.filter((x): x is string => typeof x === 'string') : []
    throw new DatabaseError(res.status, b?.error ?? `HTTP ${res.status}`, b?.detail ?? t('The request failed.'),
      typeof b?.path === 'string' ? b.path : undefined, existing)
  }
  return res.json() as Promise<T>
}

export const fetchModelDdl = (request: FullstackStarterRequest, dialect: SchemaDialectId, signal?: AbortSignal) =>
  post<DdlResult>(`/starter-fullstack.ddl?dialect=${dialect}`, request, signal)

export const createModelTables = (request: FullstackStarterRequest, source: string, schema: string, check: boolean) =>
  post<CreateTablesResult>('/starter-fullstack.create-tables', { request, source, schema, check })

/** `orders-schema-postgresql.sql` */
export function ddlFileName(artifactId: string, dialect: SchemaDialectId): string {
  return `${artifactId.trim() || 'model'}-schema-${dialect.toLowerCase()}.sql`
}
