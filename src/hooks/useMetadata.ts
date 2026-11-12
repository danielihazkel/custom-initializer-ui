import { useState, useEffect, useCallback } from 'react'
import type { InitializrMetadata, UseMetadataResult } from '../types'
import { invalidateCatalog } from './catalogCache'

// One in-flight/resolved promise shared by every useMetadata() caller (App, the
// fullstack picker, the admin tabs) so the catalog is downloaded once per session.
let cached: Promise<InitializrMetadata> | null = null

export function getMetadata(): Promise<InitializrMetadata> {
  if (!cached) {
    const p = fetch('/metadata/client', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<InitializrMetadata>
    })
    // A failed load must not be memoised — the next mount/retry refetches.
    p.catch(() => { if (cached === p) cached = null })
    cached = p
  }
  return cached
}

/** Drop the memoised catalog (call after /admin/refresh or a config import) — and the cached
 *  catalog lists with it. */
export function invalidateMetadata(): void {
  cached = null
  invalidateCatalog()
}

export function useMetadata(): UseMetadataResult {
  const [metadata, setMetadata] = useState<InitializrMetadata | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<boolean>(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getMetadata()
      .then(data => {
        if (cancelled) return
        setMetadata(data)
        setError(null)
        setLoading(false)
        setRetrying(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
        setRetrying(false)
      })
    return () => { cancelled = true }
  }, [attempt])

  // A failed load is not memoised (see getMetadata), so asking again refetches.
  const reload = useCallback(() => {
    setRetrying(true)
    setAttempt(n => n + 1)
  }, [])

  return { metadata, loading, error, retrying, reload }
}
