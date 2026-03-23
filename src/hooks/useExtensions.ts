import { useState, useEffect } from 'react'
import type { DependencyExtensions, UseExtensionsResult } from '../types'

export function useExtensions(): UseExtensionsResult {
  const [extensions, setExtensions] = useState<DependencyExtensions>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/metadata/extensions')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        setExtensions(data as DependencyExtensions)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return { extensions, loading, error }
}
