import { useCallback, useEffect, useState } from 'react'

// The read-only catalog lists (compatibility rules, starter templates, the frontend catalog, SQL
// dialects, …) are fetched once per session and shared, like `getMetadata()`: every tab used to
// fetch its own copies again each time it was opened, some of them twice. Any admin write and
// /admin/refresh or an import clear the cache (see `invalidateCatalog`), so an edit made in
// Config still shows the next time a tab opens.

interface Entry {
  promise: Promise<unknown>
  /** Set once the request succeeded, so a remounting tab renders the data at once. */
  value?: unknown
  done?: boolean
}

const cache = new Map<string, Entry>()

export function fetchCatalog<T>(url: string): Promise<T> {
  let entry = cache.get(url)
  if (!entry) {
    const promise = fetch(url, { headers: { Accept: 'application/json' } }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<unknown>
    })
    const created: Entry = { promise }
    promise.then(
      value => { created.value = value; created.done = true },
      // A failed load is not memoised — the next mount/retry asks again.
      () => { if (cache.get(url) === created) cache.delete(url) },
    )
    cache.set(url, created)
    entry = created
  }
  return entry.promise as Promise<T>
}

/** Drops every cached catalog list — after an admin write, /admin/refresh or an import. */
export function invalidateCatalog(): void {
  cache.clear()
}

/** One cached catalog list: `data` is `fallback` until it arrives (`map` shapes the raw JSON). */
export function useCatalog<T>(url: string, fallback: T, map: (raw: unknown) => T = raw => raw as T) {
  const resolved = cache.get(url)
  const [state, setState] = useState<{ url: string; data: T; loading: boolean; error: string | null }>(() =>
    resolved?.done
      ? { url, data: map(resolved.value), loading: false, error: null }
      : { url, data: fallback, loading: true, error: null })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const entry = cache.get(url)
    if (entry?.done) {
      setState(prev => (prev.url === url && !prev.loading && !prev.error ? prev : { url, data: map(entry.value), loading: false, error: null }))
      return
    }
    setState(prev => ({ url, data: prev.url === url ? prev.data : fallback, loading: true, error: null }))
    fetchCatalog<unknown>(url)
      .then(raw => { if (!cancelled) setState({ url, data: map(raw), loading: false, error: null }) })
      .catch((err: Error) => { if (!cancelled) setState(prev => ({ ...prev, url, loading: false, error: err.message })) })
    return () => { cancelled = true }
    // `fallback`/`map` are per-call literals; the URL (and a retry) decide when to fetch.
  }, [url, tick])

  const reload = useCallback(() => {
    cache.delete(url)
    setTick(t => t + 1)
  }, [url])

  return { data: state.data, loading: state.loading, error: state.error, reload }
}
