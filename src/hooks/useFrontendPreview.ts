import { useState, useCallback, useRef, useEffect } from 'react'
import type { PreviewError, PreviewResponse } from '../types'
import { readErrorBody } from '../utils/previewErrors'
import { buildFrontendQuery, type FeState } from './useFrontendState'

export function useFrontendPreview() {
  const [preview,         setPreview]         = useState<PreviewResponse | null>(null)
  const [previousPreview, setPreviousPreview] = useState<PreviewResponse | null>(null)
  const previewRef = useRef<PreviewResponse | null>(null)
  const [loading, setLoading]                 = useState(false)
  const [error,   setError]                   = useState<PreviewError | null>(null)

  // Only the latest request may touch state (see useProjectPreview).
  const reqIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => {
    reqIdRef.current += 1
    abortRef.current?.abort()
  }, [])

  const fetchPreview = useCallback(async (state: FeState) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const reqId = ++reqIdRef.current
    const stale = () => reqId !== reqIdRef.current

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/frontend/starter.preview?${buildFrontendQuery(state)}`, { signal: ctrl.signal })
      if (!res.ok) {
        const err = await readErrorBody(res)
        if (!stale()) setError(err)
        return
      }
      const data = await res.json() as PreviewResponse
      if (stale()) return
      setPreviousPreview(previewRef.current)
      previewRef.current = data
      setPreview(data)
    } catch (err) {
      if (stale() || (err instanceof Error && err.name === 'AbortError')) return
      setError({ message: err instanceof Error ? err.message : String(err) })
    } finally {
      if (!stale()) setLoading(false)
    }
  }, [])

  const clearPreview = useCallback(() => {
    setPreview(null)
    setError(null)
  }, [])

  return { preview, previousPreview, loading, error, fetchPreview, clearPreview }
}
