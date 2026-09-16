import { useState, useEffect } from 'react'
import type { InitializrMetadata, UseMetadataResult } from '../types'

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

/** Drop the memoised catalog (call after /admin/refresh or a config import). */
export function invalidateMetadata(): void {
  cached = null
}

export function useMetadata(): UseMetadataResult {
  const [metadata, setMetadata] = useState<InitializrMetadata | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getMetadata()
      .then(data => {
        if (cancelled) return
        setMetadata(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { metadata, loading, error }
}
