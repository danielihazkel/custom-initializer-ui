import { useState, useEffect, useCallback } from 'react'

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('adminToken')
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

function handle401(res: Response): Response {
  if (res.status === 401) {
    sessionStorage.removeItem('adminToken')
    window.location.reload()
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

export interface UseAdminResourceResult<T> {
  items: T[]
  loading: boolean
  error: string | null
  create: (body: Omit<T, 'id'>) => Promise<void>
  update: (id: number, body: Partial<T>) => Promise<void>
  remove: (id: number, force?: boolean) => Promise<void>
  reload: () => void
}

export function useAdminResource<T extends { id: number }>(path: string): UseAdminResourceResult<T> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState<number>(0)

  useEffect(() => {
    setLoading(true)
    fetch(path, { headers: { Accept: 'application/json', ...getAuthHeaders() } })
      .then(res => { handle401(res); if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
      .then((data: T[]) => { setItems(data); setLoading(false) })
      .catch((err: Error) => { setError(err.message); setLoading(false) })
  }, [path, tick])

  const reload = useCallback(() => setTick(t => t + 1), [])

  const create = useCallback(async (body: Omit<T, 'id'>): Promise<void> => {
    await adminFetch('POST', path, body)
    reload()
  }, [path, reload])

  const update = useCallback(async (id: number, body: Partial<T>): Promise<void> => {
    await adminFetch('PUT', `${path}/${id}`, body)
    reload()
  }, [path, reload])

  const remove = useCallback(async (id: number, force?: boolean): Promise<void> => {
    const url = force ? `${path}/${id}?force=true` : `${path}/${id}`
    await adminFetch('DELETE', url)
    reload()
  }, [path, reload])

  return { items, loading, error, create, update, remove, reload }
}
