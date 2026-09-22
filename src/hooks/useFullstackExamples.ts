import { useEffect, useState } from 'react'
import type { ExampleModel } from '../types'

export const FULLSTACK_EXAMPLES_URL = '/metadata/fullstack/examples'

// One in-flight/resolved promise per page load, like useDepartments.
let cached: Promise<ExampleModel[]> | null = null

export function getFullstackExamples(): Promise<ExampleModel[]> {
  if (!cached) {
    const p = fetch(FULLSTACK_EXAMPLES_URL, { cache: 'no-store' }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<ExampleModel[]>
    })
    // A failed load must not be memoised — the next mount refetches.
    p.catch(() => { if (cached === p) cached = null })
    cached = p
  }
  return cached
}

/** Drop the memoised list (the admin Fullstack Examples tab calls this after a write). */
export function invalidateFullstackExamples(): void {
  cached = null
}

/** The admin-managed "Start from → Examples" models for the Fullstack tab. */
export function useFullstackExamples(): { examples: ExampleModel[]; loading: boolean; error: string | null } {
  const [examples, setExamples] = useState<ExampleModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getFullstackExamples()
      .then(list => { if (!cancelled) { setExamples(list); setLoading(false) } })
      .catch((err: Error) => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  return { examples, loading, error }
}
