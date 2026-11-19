import type { ProjectSnapshot } from '../../types'
import { requestOfSnapshot } from './backendRequest'

/**
 * The model an existing backend project was generated from — the "before" of an update.
 *
 * Generating again would overwrite whatever a team has since changed in the code. An update
 * instead asks the server what the model change does (`POST /starter.patch` with the baseline
 * and the current model) and gets a patch to merge. The baseline is the model as it was when the
 * project was last generated here, or the `menora-model.json` of a project imported on the
 * Backend tab. The fullstack counterpart is `fullstack/updateBaseline.ts`.
 */
export interface BackendBaseline {
  snapshot: ProjectSnapshot
  /** `generator.catalogHash` of the project's model file, when known: lets the update's notes say
   *  whether the catalog is still the one the project was generated with. */
  catalogHash?: string
  /** `generator.snapshot` of the project's model file (the `X-Snapshot` of its download): the
   *  server kept those files, so an update starts from them and brings the generator's fixes too. */
  snapshotId?: string
  /** The last update downloaded: what the project becomes once it is applied, for *Mark as applied*.
   *  `request` is the model it was made for. */
  pendingUpdate?: { snapshotId: string; request: string }
  /** Where it came from, for the panel's wording. */
  source: 'generated' | 'imported'
  /** When it was set (epoch ms). */
  at: number
}

export const BACKEND_BASELINE_KEY = 'backend:baseline'

export function readBackendBaseline(): BackendBaseline | null {
  try {
    const raw = localStorage.getItem(BACKEND_BASELINE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BackendBaseline>
    const s = parsed.snapshot
    if (!s || typeof s !== 'object' || !s.form || !Array.isArray(s.selected)) return null
    return {
      snapshot: s,
      catalogHash: typeof parsed.catalogHash === 'string' ? parsed.catalogHash : undefined,
      snapshotId: snapshotIdOf(parsed.snapshotId),
      // Checked where it is used (backendUpdateActions.appliedBackendBaseline), off the entry chunk.
      pendingUpdate: parsed.pendingUpdate,
      source: parsed.source === 'imported' ? 'imported' : 'generated',
      at: typeof parsed.at === 'number' ? parsed.at : 0,
    }
  } catch {
    return null
  }
}

/** Returns false when the browser refused the write (private mode, quota): the baseline then
 *  lives for this visit only. */
export function writeBackendBaseline(baseline: BackendBaseline | null): boolean {
  try {
    if (baseline) localStorage.setItem(BACKEND_BASELINE_KEY, JSON.stringify(baseline))
    else localStorage.removeItem(BACKEND_BASELINE_KEY)
    return true
  } catch {
    return false
  }
}

/** The body of `POST /starter.patch`. */
export function backendUpdateRequest(baseline: BackendBaseline, current: ProjectSnapshot) {
  return {
    base: requestOfSnapshot(baseline.snapshot),
    target: requestOfSnapshot(current),
    ...(baseline.catalogHash ? { baseCatalogHash: baseline.catalogHash } : {}),
    ...(baseline.snapshotId ? { baseSnapshot: baseline.snapshotId } : {}),
  }
}

/** A snapshot id as the server writes them, else undefined. */
export function snapshotIdOf(value: unknown): string | undefined {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : undefined
}

/**
 * Whether an update is on offer: the same project (its artifact has not been renamed — that is
 * another project) whose model has since changed.
 */
export function updateOffered(baseline: BackendBaseline | null, current: ProjectSnapshot): boolean {
  if (!baseline) return false
  if (baseline.snapshot.form.artifactId.trim() !== current.form.artifactId.trim()) return false
  return JSON.stringify(requestOfSnapshot(baseline.snapshot)) !== JSON.stringify(requestOfSnapshot(current))
}
