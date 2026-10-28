import { useEffect, useRef, useState } from 'react'
import type { FullstackStarterRequest, PreviewFile } from '../types'
import { readErrorBody } from '../utils/previewErrors'
import { payloadFromPreview } from './payload'
import type { AppPayload } from './protocol'

/** How long the model must sit still before the app is generated again. */
export const APP_PREVIEW_DEBOUNCE_MS = 500

/** The last few apps generated, by request: leaving Play and coming back does not ask again. */
const cache = new Map<string, AppPayload>()
const CACHE_SIZE = 4

export interface AppPreview {
  app: AppPayload | null
  /** A newer app is being generated (the last one stays on screen meanwhile). */
  loading: boolean
  /** Why the last request failed — the generator's own message for a 400. */
  error: string | null
  /** The app on screen was generated from an older request than the one asked for. */
  stale: boolean
}

/**
 * The generated frontend for `request`, as the preview runtime takes it: `POST
 * /starter-fullstack.preview?assets=true`, asked again a moment after each change. Null asks
 * nothing (and keeps what is shown).
 */
export function useAppPreview(request: FullstackStarterRequest | null, debounceMs = APP_PREVIEW_DEBOUNCE_MS): AppPreview {
  const key = request ? JSON.stringify(request) : null
  const [state, setState] = useState<{ key: string | null; app: AppPayload | null; error: string | null }>(() => ({
    key,
    app: key ? cache.get(key) ?? null : null,
    error: null,
  }))
  const [loading, setLoading] = useState(false)
  const shown = useRef(state.app != null)
  shown.current = state.app != null

  useEffect(() => {
    if (key == null) return
    const hit = cache.get(key)
    if (hit) {
      setState({ key, app: hit, error: null })
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch('/starter-fullstack.preview?assets=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: key,
          signal: ctrl.signal,
        })
        if (!res.ok) {
          const err = await readErrorBody(res)
          if (!ctrl.signal.aborted) setState(prev => ({ ...prev, error: err.message }))
          return
        }
        const data = await res.json() as { files?: PreviewFile[] }
        const app = payloadFromPreview(data.files ?? [])
        if (ctrl.signal.aborted) return
        if (!app) {
          setState(prev => ({ ...prev, error: 'The generator returned no frontend for this model.' }))
          return
        }
        cache.set(key, app)
        if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string)
        setState({ key, app, error: null })
      } catch (e) {
        if (ctrl.signal.aborted) return
        setState(prev => ({ ...prev, error: e instanceof Error ? e.message : String(e) }))
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, shown.current ? debounceMs : 0)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [key, debounceMs])

  return { app: state.app, loading, error: state.error, stale: state.app != null && state.key !== key }
}

/** Test hook: forget the cached apps. */
export function clearAppPreviewCache() {
  cache.clear()
}
