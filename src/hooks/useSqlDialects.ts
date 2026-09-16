import { useState, useEffect } from 'react'
import type { SqlDialects } from '../types'

export function useSqlDialects() {
  const [dialects, setDialects] = useState<SqlDialects>({})
  const [loading, setLoading] = useState<boolean>(true)
  // Surfaced (not swallowed) so a failing endpoint is distinguishable from "no dialects configured".
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/metadata/sql-dialects')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setDialects((data && typeof data === 'object') ? (data as SqlDialects) : {})
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { dialects, loading, error }
}
