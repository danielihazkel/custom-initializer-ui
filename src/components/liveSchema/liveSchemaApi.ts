import { useCatalog } from '../../hooks/catalogCache'
import { t } from '../../i18n'

/**
 * The live schema endpoints (backend `config/LiveSchemaController`): read a database's schema
 * through an admin's source or a connection typed in by hand. A typed password is sent with each
 * call and kept nowhere — not in state that outlives the drawer, never in storage.
 */

export interface LiveSource {
  name: string
  dialect: string
  description?: string | null
  defaultSchema?: string | null
  /** An admin allowed creating a fullstack model's tables on this source. */
  createTables?: boolean
}

export interface LiveSchemaOptions {
  sources: LiveSource[]
  typedConnections: boolean
  /** Dialect id → whether its driver is installed on the server. */
  drivers: Record<string, boolean>
  defaultPorts: Record<string, number>
  maxTables: number
}

/** Either an admin source by name, or the parts of a database typed in. */
export interface LiveConnection {
  source?: string
  dialect?: string
  host?: string
  port?: number
  database?: string
  library?: string
  user?: string
  password?: string
  trustServerCertificate?: boolean
}

export interface LiveTableRef { name: string; kind: 'TABLE' | 'VIEW' }

export interface LiveReadRequest {
  connection: LiveConnection
  schema: string
  tables: string[]
  qualify: boolean
}

export interface LiveDdl {
  dialect: string
  sql: string
  tables: number
  views: number
  warnings: string[]
}

export class LiveSchemaError extends Error {
  status: number
  title: string
  constructor(status: number, title: string, detail: string) {
    super(detail)
    this.status = status
    this.title = title
  }
}

const NO_OPTIONS: LiveSchemaOptions = { sources: [], typedConnections: false, drivers: {}, defaultPorts: {}, maxTables: 300 }

export function useLiveSchemaOptions() {
  const { data, loading, error } = useCatalog<LiveSchemaOptions>('/metadata/live-schema/options', NO_OPTIONS,
    raw => ({ ...NO_OPTIONS, ...(raw && typeof raw === 'object' ? raw as Partial<LiveSchemaOptions> : {}) }))
  return { options: data, loading, error }
}

export const DIALECT_LABELS: Record<string, string> = {
  POSTGRESQL: 'PostgreSQL', MSSQL: 'SQL Server', ORACLE: 'Oracle', DB2: 'DB2 for IBM i', H2: 'H2',
}

export async function postLive<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
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
    throw new LiveSchemaError(0, t('Connection error'), t('The server could not be reached.'))
  }
  if (!res.ok) {
    const b = await res.json().catch(() => null) as { error?: string; detail?: string } | null
    throw new LiveSchemaError(res.status, b?.error ?? `HTTP ${res.status}`, b?.detail ?? t('The request failed.'))
  }
  return res.json() as Promise<T>
}

export const fetchSchemas = (connection: LiveConnection, signal?: AbortSignal) =>
  postLive<{ schemas: string[]; defaultSchema: string | null }>('/metadata/live-schema/schemas', { connection }, signal)

export const fetchTables = (connection: LiveConnection, schema: string, signal?: AbortSignal) =>
  postLive<{ tables: LiveTableRef[]; truncated: boolean }>('/metadata/live-schema/tables', { connection, schema }, signal)

export const fetchDdl = (req: LiveReadRequest) => postLive<LiveDdl>('/metadata/live-schema/ddl', req)
