import { useState, useCallback, useRef } from 'react'
import type { PreviewError, PreviewResponse } from '../types'
import { readErrorBody } from '../utils/previewErrors'
import { buildFrontendQuery, type FeState } from './useFrontendState'

export function useFrontendPreview() {
  const [preview,         setPreview]         = useState<PreviewResponse | null>(null)
  const [previousPreview, setPreviousPreview] = useState<PreviewResponse | null>(null)
  const previewRef = useRef<PreviewResponse | null>(null)
  const [loading, setLoading]                 = useState(false)
  const [error,   setError]                   = useState<PreviewError | null>(null)

  const fetchPreview = useCallback(async (state: FeState) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/frontend/starter.preview?${buildFrontendQuery(state)}`)
      if (!res.ok) {
        setError(await readErrorBody(res))
        return
      }
      const data = await res.json() as PreviewResponse
      setPreviousPreview(previewRef.current)
      previewRef.current = data
      setPreview(data)
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }, [])

  const clearPreview = useCallback(() => {
    setPreview(null)
    setError(null)
  }, [])

  return { preview, previousPreview, loading, error, fetchPreview, clearPreview }
}
