import { useState, useEffect } from 'react'
import type { InitializrMetadata, UseMetadataResult } from '../types'

export function useMetadata(): UseMetadataResult {
  const [metadata, setMetadata] = useState<InitializrMetadata | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const rand = Math.random().toString(36).slice(2)
    fetch(`/metadata/client?r=${rand}`, { headers: { Accept: 'application/json' } })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        setMetadata(data as InitializrMetadata)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return { metadata, loading, error }
}
