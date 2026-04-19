import { useEffect, useState, useCallback } from 'react'
import { getAuthHeaders, handle401 } from './useAdminResource'
import type { ActivitySummary, GenerationEvent } from '../types'

export function useActivity(days = 30, limit = 50) {
  const [summary, setSummary] = useState<ActivitySummary | null>(null)
  const [recent, setRecent] = useState<GenerationEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const headers: HeadersInit = { Accept: 'application/json', ...getAuthHeaders() }
    Promise.all([
      fetch(`/admin/activity/summary?days=${days}`, { headers })
        .then(res => { handle401(res); if (!res.ok) throw new Error(`summary ${res.status}`); return res.json() as Promise<ActivitySummary> }),
      fetch(`/admin/activity/recent?limit=${limit}`, { headers })
        .then(res => { handle401(res); if (!res.ok) throw new Error(`recent ${res.status}`); return res.json() as Promise<GenerationEvent[]> }),
    ])
      .then(([s, r]) => {
        if (cancelled) return
        setSummary(s)
        setRecent(r)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [days, limit, tick])

  return { summary, recent, loading, error, reload }
}
