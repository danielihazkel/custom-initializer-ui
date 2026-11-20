import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProjectSnapshot, Toast } from '../../types'
// This hook is in the entry chunk, and little else of the update is: the baseline's reader and
// its comparison (./backendBaseline) are fetched when there is a baseline to read or keep, what
// an update does once asked (./backendUpdateActions) on the click, and nothing here imports from
// '../fullstack/' (the layout engine).
import type { BackendBaseline } from './backendBaseline'
import { t } from '../../i18n'

const loadBaseline = () => import('./backendBaseline')
type BaselineStore = Awaited<ReturnType<typeof loadBaseline>>

/**
 * The Backend tab's memory of the project it last generated or imported, and what it can do with
 * it: reopen a project from its `menora-model.json`, and download an update for it once the model
 * has changed (`POST /starter.patch`).
 */
export function useBackendUpdate(
  current: ProjectSnapshot,
  apply: (snapshot: ProjectSnapshot) => void,
  notify: (toast: Toast) => void,
) {
  const [baseline, setBaseline] = useState<BackendBaseline | null>(null)
  const [store, setStore] = useState<BaselineStore | null>(null)
  const [busy, setBusy] = useState(false)
  // Set once something was kept in this visit: the stored baseline, read later, must not undo it.
  const kept = useRef(false)

  // A browser that has kept no project — most first visits — fetches nothing here. The key is
  // backendBaseline's BACKEND_BASELINE_KEY, spelled out so that module stays unfetched.
  useEffect(() => {
    try {
      if (localStorage.getItem('backend:baseline') === null) return
    } catch {
      return
    }
    let live = true
    void loadBaseline().then(m => {
      if (!live) return
      setStore(() => m)
      if (!kept.current) setBaseline(m.readBackendBaseline())
    })
    return () => { live = false }
  }, [])

  const remember = useCallback((next: BackendBaseline | null) => {
    kept.current = true
    setBaseline(next)
    void loadBaseline().then(m => {
      setStore(() => m)
      m.writeBackendBaseline(next)
    })
  }, [])

  /** A project was just generated from this model: later changes are updates of it. */
  const rememberGenerated = useCallback((snapshot: ProjectSnapshot, snapshotId?: string) => {
    remember({ snapshot, ...(snapshotId ? { snapshotId } : {}), source: 'generated', at: Date.now() })
  }, [remember])

  /**
   * Opens a project's `menora-model.json`. Resolves to false (and says why) when the text is not
   * one. The reader is fetched on the import (first-paint budget).
   */
  const importModel = useCallback(async (text: string): Promise<boolean> => {
    const { importBackendModel } = await import('./backendUpdateActions')
    return importBackendModel(text, apply, notify, remember)
  }, [apply, notify, remember])

  /** Returns true when the update zip downloaded. Its code is fetched on the click (first-paint budget). */
  const downloadUpdate = useCallback(async (): Promise<boolean> => {
    if (!baseline) return false
    setBusy(true)
    try {
      const { downloadBackendUpdate } = await import('./backendUpdateActions')
      return await downloadBackendUpdate(baseline, current, notify, remember)
    } catch (err) {
      notify({ message: t('Update failed: {error}', { error: err instanceof Error ? err.message : String(err) }), type: 'error' })
      return false
    } finally {
      setBusy(false)
    }
  }, [baseline, current, notify, remember])

  /** The team applied the update: the project now matches the current model. */
  const markApplied = useCallback(() => {
    // The project's own model file now carries today's catalog hash, which is not known here.
    if (!baseline) {
      remember({ snapshot: current, source: 'generated', at: Date.now() })
      return
    }
    void import('./backendUpdateActions').then(m => remember(m.appliedBackendBaseline(baseline, current)))
  }, [baseline, current, remember])

  const forget = useCallback(() => remember(null), [remember])

  return {
    baseline,
    /** The same project, with a model that has since changed. */
    offered: store ? store.updateOffered(baseline, current) : false,
    busy,
    rememberGenerated,
    importModel,
    downloadUpdate,
    markApplied,
    forget,
  }
}
