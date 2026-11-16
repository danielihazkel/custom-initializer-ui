import { useEffect, useState, useCallback } from 'react'
import { getAuthHeaders, handle401 } from './useAdminResource'
import type { ActivityEventsPage, ActivityFilter, ActivitySummary } from '../types'

export const EMPTY_ACTIVITY_FILTER: ActivityFilter = {
  from: '', to: '', kind: '', action: '', status: '', department: '', username: '', q: '',
}

/** The filter as query parameters, empty fields left out. */
export function activityQuery(filter: ActivityFilter, extra: Record<string, string | number> = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value.trim()) params.set(key, value.trim())
  }
  for (const [key, value] of Object.entries(extra)) params.set(key, String(value))
  const query = params.toString()
  return query ? `?${query}` : ''
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = handle401(await fetch(url, { headers: { Accept: 'application/json', ...getAuthHeaders() }, signal }))
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail ?? `${res.status}`)
  }
  return res.json() as Promise<T>
}

/** A period's summary of the generation audit. */
export function useActivity(days = 30) {
  const [summary, setSummary] = useState<ActivitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    getJson<ActivitySummary>(`/admin/activity/summary?days=${days}`, controller.signal)
      .then(s => { setSummary(s); setLoading(false) })
      .catch((err: Error) => {
        if (controller.signal.aborted) return
        setError(err.message)
        setLoading(false)
      })
    return () => controller.abort()
  }, [days, tick])

  return { summary, loading, error, reload }
}

/** One page of the audit's events, filtered. */
export function useActivityEvents(filter: ActivityFilter, page: number, size: number, tick: number) {
  const [data, setData] = useState<ActivityEventsPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const query = activityQuery(filter, { page, size })

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    // A text filter is typed: wait for the typing to stop.
    const handle = setTimeout(() => {
      getJson<ActivityEventsPage>(`/admin/activity/events${query}`, controller.signal)
        .then(p => { setData(p); setLoading(false) })
        .catch((err: Error) => {
          if (controller.signal.aborted) return
          setError(err.message)
          setLoading(false)
        })
    }, 250)
    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [query, tick])

  return { data, loading, error }
}

/** Downloads the filtered events as CSV (the admin token travels in a header, so not a plain link). */
export async function downloadActivityCsv(filter: ActivityFilter): Promise<void> {
  const res = handle401(await fetch(`/admin/activity/events.csv${activityQuery(filter)}`, { headers: getAuthHeaders() }))
  if (!res.ok) throw new Error(`${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'generation-activity.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
