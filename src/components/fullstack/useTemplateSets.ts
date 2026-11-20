import { useCallback, useEffect, useRef, useState } from 'react'
import type { EntityTemplateSetSummary } from '../../types'

/**
 * The entity template sets the generator has (`GET /metadata/entity-template-sets`), for the
 * Fullstack tab's backend and frontend pickers: the list, whether it is loading, why it failed,
 * and a way to ask again.
 */
export function useTemplateSets() {
  const [availableSets, setAvailableSets] = useState<EntityTemplateSetSummary[]>([])
  const [setsLoading, setSetsLoading] = useState(true)
  const [setsError, setSetsError] = useState<string | null>(null)

  // Load the template-set list. Extracted so the inline Retry can re-run it; on failure
  // we keep the hardcoded fallback options (the screen stays usable) and surface a
  // persistent inline notice rather than a one-shot toast the user might miss.
  // Each call aborts the previous in-flight request (Retry while loading, or unmount), so a
  // slow earlier response can't land after a newer one or after the view is gone.
  const setsAbortRef = useRef<AbortController | null>(null)
  const loadTemplateSets = useCallback(() => {
    setsAbortRef.current?.abort()
    const controller = new AbortController()
    setsAbortRef.current = controller
    setSetsLoading(true)
    setSetsError(null)
    fetch('/metadata/entity-template-sets', { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: EntityTemplateSetSummary[]) => { if (!controller.signal.aborted) setAvailableSets(data) })
      .catch((err: Error) => { if (!controller.signal.aborted) setSetsError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setSetsLoading(false) })
  }, [])

  useEffect(() => {
    loadTemplateSets()
    return () => setsAbortRef.current?.abort()
  }, [loadTemplateSets])

  return { availableSets, setsLoading, setsError, loadTemplateSets }
}
