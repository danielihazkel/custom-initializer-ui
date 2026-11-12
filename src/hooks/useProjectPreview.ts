import { useState, useCallback, useRef, useEffect } from 'react'
import type { PreviewError, PreviewResponse, ProjectFormValues, SqlByDep, OpenApiByDep, SoapByDep, EventsByDep } from '../types'
import { buildProjectRequest } from '../utils/projectUtils'
import { readErrorBody } from '../utils/previewErrors'

export function useProjectPreview() {
  const [preview,         setPreview]         = useState<PreviewResponse | null>(null)
  const [previousPreview, setPreviousPreview] = useState<PreviewResponse | null>(null)
  const previewRef = useRef<PreviewResponse | null>(null)
  const [loading, setLoading]                 = useState(false)
  const [error,   setError]                   = useState<PreviewError | null>(null)

  // Only the most recent request may touch state: a slower earlier response must
  // not overwrite a newer preview (or the previousPreview diff baseline), and
  // nothing may land after unmount.
  const reqIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => {
    reqIdRef.current += 1
    abortRef.current?.abort()
  }, [])

  const fetchPreview = useCallback(async (
    form: ProjectFormValues,
    selected: string[],
    selectedOptions: Record<string, string[]>,
    multiModule?: { enabled: boolean; modules: string[] },
    sqlByDep?: SqlByDep,
    openApiByDep?: OpenApiByDep,
    soapByDep?: SoapByDep,
    eventsByDep?: EventsByDep,
  ) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const reqId = ++reqIdRef.current
    const stale = () => reqId !== reqIdRef.current

    setLoading(true)
    setError(null)
    try {
      const request = buildProjectRequest(
        'preview', form, selected, selectedOptions, multiModule, sqlByDep, openApiByDep, soapByDep, eventsByDep)
      const res = await fetch(request.url, { ...request.init, signal: ctrl.signal })
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

  /** Opens the modal on a preview that is already in hand (the file dock's), without a request. */
  const showPreview = useCallback((data: PreviewResponse) => {
    // Whatever was in flight is superseded.
    reqIdRef.current += 1
    abortRef.current?.abort()
    setLoading(false)
    setError(null)
    if (previewRef.current !== data) {
      setPreviousPreview(previewRef.current)
      previewRef.current = data
    }
    setPreview(data)
  }, [])

  const clearPreview = useCallback(() => {
    setPreview(null)
    setError(null)
    // previousPreview is intentionally kept so the next fetch can diff against it
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { preview, previousPreview, loading, error, fetchPreview, showPreview, clearPreview, clearError }
}
