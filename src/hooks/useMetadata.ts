import { useState, useEffect, useCallback } from 'react'
import type { InitializrMetadata, UseMetadataResult } from '../types'
import { invalidateCatalog } from './catalogCache'

// One in-flight/resolved promise shared by every useMetadata() caller (App, the
// fullstack picker, the admin tabs) so the catalog is downloaded once per session.
let cached: Promise<InitializrMetadata> | null = null

/** The `code` of the backend's refusal when its access gate is on and the request did not come
 *  through the sign-in gateway (`UserInfoGateFilter.BLOCKED_CODE`). */
export const ACCESS_BLOCKED_CODE = 'USERINFO_REQUIRED'

/** The backend is up and refused this browser: there is no point asking again by itself. */
export class AccessBlockedError extends Error {
  constructor(detail?: string) {
    super(detail || 'Access is blocked')
    this.name = 'AccessBlockedError'
  }
}

/** A 403 is the gate's only when its body says so; any other 403 stays an ordinary failure. */
async function blockedBy(res: Response): Promise<AccessBlockedError | null> {
  if (res.status !== 403) return null
  try {
    const body = await res.json() as { code?: unknown; detail?: unknown }
    if (body?.code !== ACCESS_BLOCKED_CODE) return null
    return new AccessBlockedError(typeof body.detail === 'string' ? body.detail : undefined)
  } catch {
    return null
  }
}

export function getMetadata(): Promise<InitializrMetadata> {
  if (!cached) {
    const p = fetch('/metadata/client', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }).then(async res => {
      if (!res.ok) throw (await blockedBy(res)) ?? new Error(`HTTP ${res.status}`)
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
  const [blocked, setBlocked] = useState<boolean>(false)
  const [retrying, setRetrying] = useState<boolean>(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getMetadata()
      .then(data => {
        if (cancelled) return
        setMetadata(data)
        setError(null)
        setBlocked(false)
        setLoading(false)
        setRetrying(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setBlocked(err instanceof AccessBlockedError)
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

  return { metadata, loading, error, blocked, retrying, reload }
}
