import { useState, useEffect, useCallback } from 'react'

async function adminFetch(method: string, url: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (res.status === 204 || res.headers.get('content-length') === '0') return null
  return res.json()
}

export interface UseAdminResourceResult<T> {
  items: T[]
  loading: boolean
  error: string | null
  create: (body: Omit<T, 'id'>) => Promise<void>
  update: (id: number, body: Partial<T>) => Promise<void>
  remove: (id: number) => Promise<void>
  reload: () => void
}

export function useAdminResource<T extends { id: number }>(path: string): UseAdminResourceResult<T> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState<number>(0)

  useEffect(() => {
    setLoading(true)
    fetch(path, { headers: { Accept: 'application/json' } })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
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

  const remove = useCallback(async (id: number): Promise<void> => {
    await adminFetch('DELETE', `${path}/${id}`)
    reload()
  }, [path, reload])

  return { items, loading, error, create, update, remove, reload }
}
