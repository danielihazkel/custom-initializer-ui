import { useState, type MutableRefObject } from 'react'
import type { FullstackStarterRequest, Toast } from '../../types'
import { requestFromSnapshot, type FullstackSnapshot } from './snapshot'
import {
  countsOf, describeCounts, describeUpdateBase, readBaseline, requestKey, schemaVersionOf, sideOfPath, updateRequest, writeBaseline,
  type UpdateBaseline,
} from './updateBaseline'
import { snapshotHeader } from '../../utils/updateCounts'
import { describeServerTarget, type ServerIssue, type ServerTarget } from './serverIssue'
import { readErrorBody } from '../../utils/previewErrors'
import { downloadBlob } from '../../utils/download'
import { t } from '../../i18n'

export interface ProjectUpdateOptions {
  currentSnapshot: FullstackSnapshot
  snapshotRef: MutableRefObject<FullstackSnapshot>
  /** Stamped with the model a preview is being built from. */
  previewSnapshotRef: MutableRefObject<FullstackSnapshot | null>
  artifactId: string
  /** False (after saying why and jumping there) while the model has problems. */
  validateBeforeSubmit: () => boolean
  buildBody: () => FullstackStarterRequest
  /** Fetches what both models generate and opens the preview on the difference. */
  fetchComparison: (base: FullstackStarterRequest, target: FullstackStarterRequest) => unknown
  /** Puts a server's refusal on the entity, field or page it names. */
  showServerIssue: (issue: ServerIssue) => ServerTarget | null
  setToast: (toast: Toast) => void
}

/**
 * Updating a project that already exists: the model the project in hand was generated from (see
 * updateBaseline.ts) and, while the editor's model differs from it, the difference — previewed,
 * or downloaded as a patch (`POST /starter-fullstack.patch`) instead of a fresh zip.
 */
export function useProjectUpdate({
  currentSnapshot, snapshotRef, previewSnapshotRef, artifactId, validateBeforeSubmit, buildBody, fetchComparison,
  showServerIssue, setToast,
}: ProjectUpdateOptions) {
  const [baseline, setBaselineState] = useState<UpdateBaseline | null>(() => readBaseline())
  const [updating, setUpdating] = useState(false)
  // What the open preview's Download does: a fresh project, or the update it is showing.
  const [previewIsUpdate, setPreviewIsUpdate] = useState(false)
  function setBaseline(next: UpdateBaseline | null) {
    setBaselineState(next)
    writeBaseline(next)
  }

  function previewUpdate() {
    if (!baseline || !validateBeforeSubmit()) return
    previewSnapshotRef.current = currentSnapshot
    setPreviewIsUpdate(true)
    void fetchComparison(requestFromSnapshot(baseline.snapshot), buildBody())
  }

  /** Returns true when the update zip downloaded. */
  async function downloadUpdate(): Promise<boolean> {
    if (!baseline || !validateBeforeSubmit()) return false
    setUpdating(true)
    try {
      const res = await fetch('/starter-fullstack.patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequest(baseline, snapshotRef.current)),
      })
      if (!res.ok) {
        const failure = await readErrorBody(res)
        const where = sideOfPath(failure.path)
        if (where.side === 'base') {
          // Nothing in the editor to point at: it is the stored model that no longer generates.
          setToast({ message: t('The model the project was generated from is no longer accepted: {error}', { error: failure.message }), type: 'error' })
          return false
        }
        const issue: ServerIssue = { message: failure.message, path: where.path }
        const target = showServerIssue(issue)
        setToast({
          message: target && target.kind !== 'setting'
            ? t('Update failed — the server rejected {what}', { what: describeServerTarget(target) })
            : t('Update failed: {error}', { error: issue.message }),
          type: 'error',
        })
        return false
      }
      const counts = countsOf(res.headers)
      downloadBlob(await res.blob(), `${artifactId || 'project'}-update.zip`)
      // What the project becomes once applied: Mark as applied starts the next update from it.
      const result = snapshotHeader(res.headers)
      if (result) {
        setBaseline({
          ...baseline,
          pendingUpdate: {
            snapshotId: result, request: requestKey(snapshotRef.current),
            schemaVersion: schemaVersionOf(res.headers.get('X-Schema-Version')),
          },
        })
      }
      setToast({
        message: t('Update downloaded ({what}) — UPDATE.md inside says how to apply it', { what: describeCounts(counts) + describeUpdateBase(res.headers) }),
        type: 'success',
      })
      return true
    } catch (err) {
      setToast({ message: t('Update failed: {error}', { error: err instanceof Error ? err.message : String(err) }), type: 'error' })
      return false
    } finally {
      setUpdating(false)
    }
  }

  return { baseline, setBaseline, updating, previewIsUpdate, setPreviewIsUpdate, previewUpdate, downloadUpdate }
}
