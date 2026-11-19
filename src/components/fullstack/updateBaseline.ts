import type { FullstackStarterRequest } from '../../types'
import { makeSnapshot, requestFromSnapshot, toExportedModel, type FullstackSnapshot } from './snapshot'

/**
 * The model an existing project was generated from — the "before" of an update.
 *
 * Generating again would overwrite whatever a team has since changed in the code. An update
 * instead asks the server what the model change does (`POST /starter-fullstack.patch` with the
 * baseline and the current model) and gets a patch to merge. The baseline is the model as it was
 * when the project was last generated here, or the `menora-model.json` of a project imported
 * into the editor.
 */
export interface UpdateBaseline {
  snapshot: FullstackSnapshot
  /** `generator.templatesHash` of the project's model file, when known: lets the update's notes
   *  say whether the templates are still the ones the project was generated with. */
  templatesHash?: string
  /** `generator.snapshot` of the project's model file (the `X-Snapshot` of its download): the
   *  server kept those files, so an update starts from them and brings the generator's fixes too. */
  snapshotId?: string
  /** `generator.schemaVersion` of the project's model file (`X-Schema-Version` of its download): which
   *  version of the generator's own tables its database has, so an update's migration brings them up. */
  schemaVersion?: number
  /** The last update downloaded: what the project becomes once it is applied, for *Mark as applied*.
   *  `request` is the model it was made for (a later edit makes it another project). */
  pendingUpdate?: { snapshotId: string; request: string; schemaVersion?: number }
  /** Where it came from, for the panel's wording. */
  source: 'generated' | 'imported'
  /** When it was set (epoch ms). */
  at: number
}

const SNAPSHOT_ID = /^[0-9a-f]{64}$/

/** A snapshot id as the server writes them, else undefined. */
export function snapshotIdOf(value: unknown): string | undefined {
  return typeof value === 'string' && SNAPSHOT_ID.test(value) ? value : undefined
}

/** The key a pending update is matched by: the request the current model sends. */
export function requestKey(snapshot: FullstackSnapshot): string {
  return JSON.stringify(requestFromSnapshot(snapshot))
}

/**
 * The baseline once the downloaded update is applied: the current model, and — when the update
 * was made for exactly this model — the files the server kept for its result.
 */
export function appliedBaseline(baseline: UpdateBaseline, current: FullstackSnapshot): UpdateBaseline {
  const pending = baseline.pendingUpdate
  const applies = !!pending && pending.request === requestKey(current)
  return {
    snapshot: current, source: baseline.source, at: Date.now(),
    // The update was made by this release: its tables are this release's (the version it named).
    ...(applies ? { snapshotId: pending.snapshotId, ...(pending.schemaVersion ? { schemaVersion: pending.schemaVersion } : {}) } : {}),
  }
}

export const BASELINE_KEY = 'fullstack:baseline'

export function readBaseline(): UpdateBaseline | null {
  try {
    const raw = localStorage.getItem(BASELINE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<UpdateBaseline>
    const s = parsed.snapshot
    if (!s || typeof s !== 'object' || !Array.isArray(s.entities) || !s.meta) return null
    const pending = parsed.pendingUpdate
    return {
      snapshot: makeSnapshot(s),
      templatesHash: typeof parsed.templatesHash === 'string' ? parsed.templatesHash : undefined,
      snapshotId: snapshotIdOf(parsed.snapshotId),
      schemaVersion: schemaVersionOf(parsed.schemaVersion),
      ...(pending && snapshotIdOf(pending.snapshotId) && typeof pending.request === 'string'
        ? { pendingUpdate: { snapshotId: pending.snapshotId, request: pending.request, schemaVersion: schemaVersionOf(pending.schemaVersion) } } : {}),
      source: parsed.source === 'imported' ? 'imported' : 'generated',
      at: typeof parsed.at === 'number' ? parsed.at : 0,
    }
  } catch {
    return null
  }
}

/** Returns false when the browser refused the write (private mode, quota): the baseline then
 *  lives for this visit only. */
export function writeBaseline(baseline: UpdateBaseline | null): boolean {
  try {
    if (baseline) localStorage.setItem(BASELINE_KEY, JSON.stringify(baseline))
    else localStorage.removeItem(BASELINE_KEY)
    return true
  } catch {
    return false
  }
}

/** One side of an update: the request, with the editor's own model for its `menora-model.json`. */
function sideOf(snapshot: FullstackSnapshot): FullstackStarterRequest & { editorModel: unknown } {
  return { ...requestFromSnapshot(snapshot), editorModel: toExportedModel(snapshot) }
}

/** The body of `POST /starter-fullstack.patch`. */
export function updateRequest(baseline: UpdateBaseline, current: FullstackSnapshot) {
  return {
    base: sideOf(baseline.snapshot),
    target: sideOf(current),
    ...(baseline.templatesHash ? { baseTemplatesHash: baseline.templatesHash } : {}),
    ...(baseline.snapshotId ? { baseSnapshot: baseline.snapshotId } : {}),
    ...(baseline.schemaVersion ? { baseSchemaVersion: baseline.schemaVersion } : {}),
  }
}

/** A schema version as the server writes it (a positive whole number), else undefined. */
export function schemaVersionOf(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : undefined
}

// The counts live in a module without editor imports (the Backend tab reads them at first paint);
// re-exported here for the callers on this tab.
export { countsOf, describeCounts, describeUpdateBase, type UpdateCounts } from '../../utils/updateCounts'

/**
 * A server problem with an update names the model it is in: `base.entities[0]…` or
 * `target.entities[0]…`. Returns the side and the path as the editor knows it.
 */
export function sideOfPath(path: string | undefined): { side: 'base' | 'target' | null; path?: string } {
  for (const side of ['base', 'target'] as const) {
    if (path === side) return { side }
    if (path?.startsWith(`${side}.`)) return { side, path: path.slice(side.length + 1) }
  }
  return { side: null, path }
}
