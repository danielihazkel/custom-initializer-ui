import { useCallback, useEffect, useRef, useState } from 'react'
import type { PreviewResponse } from '../types'
import type { ProjectRequest } from '../utils/projectUtils'
import { readErrorBody } from '../utils/previewErrors'
import { forgetLivePreview, livePreviewFor, rememberLivePreview } from '../utils/livePreviewCache'

/**
 * The file dock's data: the files the current setup generates, kept current as the setup changes.
 *
 * It asks the backend by itself, so it is held to rules a button click is not:
 * - only while `enabled` (the dock is open) **and** the tab is visible — a closed dock or a
 *   background tab costs nothing;
 * - {@link LIVE_DEBOUNCE_MS} after the last change, with the call in flight aborted, so ticking
 *   five dependencies in a row is one request;
 * - never for a project it has already seen: the last few answers are kept by request key
 *   (`utils/livePreviewCache.ts`), so ticking a dependency off and on again is instant;
 * - with `X-Preview-Intent: live`, which keeps these out of the generation audit (see
 *   `GenerationAuditFilter` in the backend) — nobody asked for them.
 */
export const LIVE_DEBOUNCE_MS = 500
interface Shown {
  key: string
  preview: PreviewResponse
}

export interface LiveProjectTree {
  /** The files of the current setup — or of the last one that was fetched, while a newer is on its way. */
  current: Shown | null
  /** What was shown before `current`, to say what the last change did. */
  previous: Shown | null
  /** A request is waiting or in flight. */
  loading: boolean
  error: string | null
  /** Asks again now, cache or not. */
  refresh: () => void
}

export function useLiveProjectTree(request: ProjectRequest | null, enabled: boolean): LiveProjectTree {
  const [current, setCurrent] = useState<Shown | null>(null)
  const [previous, setPrevious] = useState<Shown | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  const [nonce, setNonce] = useState(0)
  const currentRef = useRef<Shown | null>(null)

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const show = useCallback((key: string, preview: PreviewResponse) => {
    const before = currentRef.current
    if (before?.key === key) return
    currentRef.current = { key, preview }
    setPrevious(before)
    setCurrent(currentRef.current)
  }, [])

  const key = request?.key ?? null
  const requestRef = useRef(request)
  requestRef.current = request

  useEffect(() => {
    if (!enabled || !visible || !key) {
      setLoading(false)
      return
    }
    const cached = livePreviewFor(key)
    if (cached) {
      setError(null)
      setLoading(false)
      show(key, cached)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      const req = requestRef.current
      if (!req) return
      try {
        const res = await fetch(req.url, {
          ...req.init,
          headers: { ...(req.init.headers as Record<string, string> | undefined), 'X-Preview-Intent': 'live' },
          signal: ctrl.signal,
        })
        if (ctrl.signal.aborted) return
        if (!res.ok) {
          const err = await readErrorBody(res)
          if (ctrl.signal.aborted) return
          setError(err.kind ? `${err.kind}: ${err.message}` : err.message)
          setLoading(false)
          return
        }
        const preview = await res.json() as PreviewResponse
        if (ctrl.signal.aborted) return
        rememberLivePreview(key, preview)
        setError(null)
        setLoading(false)
        show(key, preview)
      } catch (err) {
        if (ctrl.signal.aborted) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      }
    }, LIVE_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [enabled, visible, key, nonce, show])

  const refresh = useCallback(() => {
    if (key) forgetLivePreview(key)
    currentRef.current = null
    setNonce(n => n + 1)
  }, [key])

  return { current, previous, loading, error, refresh }
}
