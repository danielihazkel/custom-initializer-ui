import { useState, useCallback, useRef } from 'react'
import type { FullstackStarterRequest, PreviewError, PreviewResponse } from '../types'
import { readErrorBody } from '../utils/previewErrors'

export function useFullstackPreview() {
  const [preview,         setPreview]         = useState<PreviewResponse | null>(null)
  const [previousPreview, setPreviousPreview] = useState<PreviewResponse | null>(null)
  const previewRef = useRef<PreviewResponse | null>(null)
  const [loading, setLoading]                 = useState(false)
  const [error,   setError]                   = useState<PreviewError | null>(null)

  const fetchPreview = useCallback(async (body: FullstackStarterRequest) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/starter-fullstack.preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
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
