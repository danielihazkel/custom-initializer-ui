import { useState, useEffect } from 'react'
import type { DependencyExtensions, UseExtensionsResult } from '../types'

export function useExtensions(): UseExtensionsResult {
  const [extensions, setExtensions] = useState<DependencyExtensions>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/metadata/extensions')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setExtensions(data as DependencyExtensions)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { extensions, loading, error }
}
