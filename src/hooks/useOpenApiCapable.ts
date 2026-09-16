import { useState, useEffect } from 'react'

export function useOpenApiCapable() {
  const [depIds, setDepIds] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  // Surfaced (not swallowed) so a failing endpoint is distinguishable from "no capable deps".
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/metadata/openapi-capable-deps')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setDepIds(Array.isArray(data) ? (data as string[]) : [])
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { depIds, loading, error }
}
