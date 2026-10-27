import type { SqlDialects } from '../types'
import { useCatalog } from './catalogCache'

const NO_DIALECTS: SqlDialects = {}
const asDialects = (data: unknown): SqlDialects => ((data && typeof data === 'object') ? (data as SqlDialects) : {})

export function useSqlDialects() {
  // `error` is surfaced (not swallowed) so a failing endpoint is distinguishable from "no dialects configured".
  const { data, loading, error } = useCatalog<SqlDialects>('/metadata/sql-dialects', NO_DIALECTS, asDialects)
  return { dialects: data, loading, error }
}
