import type { ProjectSnapshot, Toast } from '../../types'
import { downloadBlob } from '../../utils/projectUtils'
import { countsOf, describeCounts, describeUpdateBase, snapshotHeader } from '../../utils/updateCounts'
import { backendUpdateRequest, type BackendBaseline } from './backendBaseline'
import { requestOfSnapshot } from './backendRequest'
import { t } from '../../i18n'

/**
 * What the Backend tab does with an update once asked — loaded on that click, not at first paint
 * (`useBackendUpdate` imports this module dynamically; the entry chunk has a budget).
 */

/** The key a pending update is matched by: the request the current model sends. */
export function backendRequestKey(snapshot: ProjectSnapshot): string {
  return JSON.stringify(requestOfSnapshot(snapshot))
}

/**
 * The baseline once the downloaded update is applied: the current model, and — when the update
 * was made for exactly this model — the files the server kept for its result.
 */
export function appliedBackendBaseline(baseline: BackendBaseline, current: ProjectSnapshot): BackendBaseline {
  // As stored: read back unchecked (the entry chunk has a budget), so checked here.
  const pending = baseline.pendingUpdate as { snapshotId?: unknown; request?: unknown } | undefined
  const snapshotId = pending && typeof pending.snapshotId === 'string' && /^[0-9a-f]{64}$/.test(pending.snapshotId)
    && pending.request === backendRequestKey(current) ? pending.snapshotId : undefined
  return { snapshot: current, source: baseline.source, at: Date.now(), ...(snapshotId ? { snapshotId } : {}) }
}

/** `POST /starter.patch` and the download. Returns true when the update zip downloaded. */
export async function downloadBackendUpdate(
  baseline: BackendBaseline,
  current: ProjectSnapshot,
  notify: (toast: Toast) => void,
  remember: (next: BackendBaseline) => void,
): Promise<boolean> {
  try {
    const res = await fetch('/starter.patch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendUpdateRequest(baseline, current)),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { detail?: string; error?: string; side?: string }
      const reason = body.detail || body.error || t('the server answered {status}', { status: res.status })
      notify({
        // Nothing on screen to fix when it is the stored model that no longer generates.
        message: body.side === 'base'
          ? t('The model the project was generated from is no longer accepted: {reason}', { reason })
          : t('Update failed: {error}', { error: reason }),
        type: 'error',
      })
      return false
    }
    const counts = countsOf(res.headers)
    downloadBlob(await res.blob(), `${current.form.artifactId || 'project'}-update.zip`)
    // What the project becomes once applied: Mark as applied starts the next update from it.
    const result = snapshotHeader(res.headers)
    if (result) remember({ ...baseline, pendingUpdate: { snapshotId: result, request: backendRequestKey(current) } })
    notify({
      message: t('Update downloaded ({what}) — UPDATE.md inside says how to apply it', { what: `${describeCounts(counts)}${describeUpdateBase(res.headers)}` }),
      type: 'success',
    })
    return true
  } catch (err) {
    notify({ message: t('Update failed: {error}', { error: err instanceof Error ? err.message : String(err) }), type: 'error' })
    return false
  }
}
