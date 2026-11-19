import { useCallback, useState } from 'react'
import type { ProjectSnapshot, Toast } from '../../types'
// This hook is in the entry chunk: what an update does once asked is in ./backendUpdateActions,
// fetched on the click, and nothing here imports from '../fullstack/' (the layout engine).
import { readBackendBaseline, updateOffered, writeBackendBaseline, type BackendBaseline } from './backendBaseline'

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
  const [baseline, setBaseline] = useState<BackendBaseline | null>(readBackendBaseline)
  const [busy, setBusy] = useState(false)

  const remember = useCallback((next: BackendBaseline | null) => {
    setBaseline(next)
    writeBackendBaseline(next)
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
    const { parseBackendModel } = await import('./backendModel')
    const parsed = parseBackendModel(text)
    if ('error' in parsed) {
      notify({ message: `Couldn't import the model: ${parsed.error}`, type: 'error' })
      return false
    }
    apply(parsed.snapshot)
    remember({
      snapshot: parsed.snapshot, catalogHash: parsed.catalogHash, snapshotId: parsed.snapshotId,
      source: 'imported', at: Date.now(),
    })
    notify({
      message: `Opened ${parsed.snapshot.form.artifactId || 'the project'} — change it and choose Download update`,
      type: 'success',
    })
    return true
  }, [apply, notify, remember])

  /** Returns true when the update zip downloaded. Its code is fetched on the click (first-paint budget). */
  const downloadUpdate = useCallback(async (): Promise<boolean> => {
    if (!baseline) return false
    setBusy(true)
    try {
      const { downloadBackendUpdate } = await import('./backendUpdateActions')
      return await downloadBackendUpdate(baseline, current, notify, remember)
    } catch (err) {
      notify({ message: `Update failed: ${err instanceof Error ? err.message : String(err)}`, type: 'error' })
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
    offered: updateOffered(baseline, current),
    busy,
    rememberGenerated,
    importModel,
    downloadUpdate,
    markApplied,
    forget,
  }
}
