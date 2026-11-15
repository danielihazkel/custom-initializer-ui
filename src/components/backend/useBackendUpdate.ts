import { useCallback, useState } from 'react'
import type { ProjectSnapshot, Toast } from '../../types'
import { downloadBlob } from '../../utils/projectUtils'
// Not from '../fullstack/updateBaseline': that module imports the layout engine, and this hook is
// in the entry chunk.
import { countsOf, describeCounts } from '../../utils/updateCounts'
import {
  backendUpdateRequest, readBackendBaseline, updateOffered, writeBackendBaseline, type BackendBaseline,
} from './backendBaseline'
import { parseBackendModel } from './backendModel'

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
  const rememberGenerated = useCallback((snapshot: ProjectSnapshot) => {
    remember({ snapshot, source: 'generated', at: Date.now() })
  }, [remember])

  /** Opens a project's `menora-model.json`. Returns false (and says why) when the text is not one. */
  const importModel = useCallback((text: string): boolean => {
    const parsed = parseBackendModel(text)
    if ('error' in parsed) {
      notify({ message: `Couldn't import the model: ${parsed.error}`, type: 'error' })
      return false
    }
    apply(parsed.snapshot)
    remember({ snapshot: parsed.snapshot, catalogHash: parsed.catalogHash, source: 'imported', at: Date.now() })
    notify({
      message: `Opened ${parsed.snapshot.form.artifactId || 'the project'} — change it and choose Download update`,
      type: 'success',
    })
    return true
  }, [apply, notify, remember])

  /** Returns true when the update zip downloaded. */
  const downloadUpdate = useCallback(async (): Promise<boolean> => {
    if (!baseline) return false
    setBusy(true)
    try {
      const res = await fetch('/starter.patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendUpdateRequest(baseline, current)),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { detail?: string; error?: string; side?: string }
        const reason = body.detail || body.error || `the server answered ${res.status}`
        notify({
          // Nothing on screen to fix when it is the stored model that no longer generates.
          message: body.side === 'base'
            ? `The model the project was generated from is no longer accepted: ${reason}`
            : `Update failed: ${reason}`,
          type: 'error',
        })
        return false
      }
      const counts = countsOf(res.headers)
      downloadBlob(await res.blob(), `${current.form.artifactId || 'project'}-update.zip`)
      notify({ message: `Update downloaded (${describeCounts(counts)}) — UPDATE.md inside says how to apply it`, type: 'success' })
      return true
    } catch (err) {
      notify({ message: `Update failed: ${err instanceof Error ? err.message : String(err)}`, type: 'error' })
      return false
    } finally {
      setBusy(false)
    }
  }, [baseline, current, notify])

  /** The team applied the update: the project now matches the current model. */
  const markApplied = useCallback(() => {
    // The project's own model file now carries today's catalog hash, which is not known here.
    remember({ snapshot: current, source: baseline?.source ?? 'generated', at: Date.now() })
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
