import { useState, useEffect, useCallback, useMemo } from 'react'

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('adminToken')
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

/**
 * Fired on `window` when an admin request comes back 401 (stale token after a backend
 * restart, logout in another tab, ...). `AdminPage` listens and drops back to the login
 * form in place. This used to be a `window.location.reload()`, which sent the user to the
 * Backend tab (the Config view has no URL representation) and forced a second login.
 */
export const ADMIN_UNAUTHORIZED_EVENT = 'admin-unauthorized'

function handle401(res: Response): Response {
  if (res.status === 401) {
    sessionStorage.removeItem('adminToken')
    invalidateAdminCache()
    window.dispatchEvent(new Event(ADMIN_UNAUTHORIZED_EVENT))
  }
  return res
}

export class AdminApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

async function adminFetch(method: string, url: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = { ...getAuthHeaders() }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const res = handle401(await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }))
  if (!res.ok) {
    let errorBody: unknown = null
    try { errorBody = await res.json() } catch { /* ignore */ }
    throw new AdminApiError(res.status, errorBody)
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return null
  return res.json()
}

export { getAuthHeaders, handle401, adminFetch }

// ---------------------------------------------------------------------------
// List cache — one GET per list URL per admin session. Admin tabs unmount on
// every tab switch, so without this each switch re-downloaded the whole catalog.
// Invalidated by this hook's own mutations/reload, and by invalidateAdminCache()
// after global actions (refresh, import).
// ---------------------------------------------------------------------------
const listCache = new Map<string, Promise<unknown[]>>()

export function invalidateAdminCache(prefix?: string): void {
  if (!prefix) {
    listCache.clear()
    return
  }
  for (const key of Array.from(listCache.keys())) {
    if (key === prefix || key.startsWith(prefix + '?') || key.startsWith(prefix + '/')) {
      listCache.delete(key)
    }
  }
}

function fetchList<T>(url: string): Promise<T[]> {
  let p = listCache.get(url)
  if (!p) {
    const req = fetch(url, { headers: { Accept: 'application/json', ...getAuthHeaders() } })
      .then(res => {
        handle401(res)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<unknown[]>
      })
    // Never memoise a failure — the next mount/reload must retry.
    req.catch(() => { if (listCache.get(url) === req) listCache.delete(url) })
    listCache.set(url, req)
    p = req
  }
  return p as Promise<T[]>
}

export interface UseAdminResourceOptions {
  /** Query parameters for the list GET only. Mutations always use the bare path. */
  query?: Record<string, string | number>
}

export interface UseAdminResourceResult<T> {
  items: T[]
  loading: boolean
  error: string | null
  create: (body: Omit<T, 'id'>) => Promise<void>
  update: (id: number, body: Partial<T>) => Promise<void>
  remove: (id: number, force?: boolean) => Promise<void>
  reload: () => void
}

function buildListUrl(path: string, query?: Record<string, string | number>): string {
  if (!query) return path
  const qp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) qp.set(k, String(v))
  const qs = qp.toString()
  return qs ? `${path}?${qs}` : path
}

export function useAdminResource<T extends { id: number }>(
  path: string,
  opts?: UseAdminResourceOptions,
): UseAdminResourceResult<T> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState<number>(0)

  // Stable key for the query object so the effect doesn't refire on identity churn.
  const queryKey = opts?.query ? JSON.stringify(opts.query) : ''
  const listUrl = useMemo(
    () => buildListUrl(path, queryKey ? (JSON.parse(queryKey) as Record<string, string | number>) : undefined),
    [path, queryKey],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchList<T>(listUrl)
      .then(data => {
        if (cancelled) return
        setItems(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [listUrl, tick])

  const reload = useCallback(() => {
    listCache.delete(listUrl)
    setTick(t => t + 1)
  }, [listUrl])

  const create = useCallback(async (body: Omit<T, 'id'>): Promise<void> => {
    await adminFetch('POST', path, body)
    invalidateAdminCache(path)
    reload()
  }, [path, reload])

  const update = useCallback(async (id: number, body: Partial<T>): Promise<void> => {
    await adminFetch('PUT', `${path}/${id}`, body)
    invalidateAdminCache(path)
    reload()
  }, [path, reload])

  const remove = useCallback(async (id: number, force?: boolean): Promise<void> => {
    const url = force ? `${path}/${id}?force=true` : `${path}/${id}`
    await adminFetch('DELETE', url)
    invalidateAdminCache(path)
    reload()
  }, [path, reload])

  return { items, loading, error, create, update, remove, reload }
}
