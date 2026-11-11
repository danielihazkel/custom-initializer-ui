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
  /** Where it came from, for the panel's wording. */
  source: 'generated' | 'imported'
  /** When it was set (epoch ms). */
  at: number
}

export const BASELINE_KEY = 'fullstack:baseline'

export function readBaseline(): UpdateBaseline | null {
  try {
    const raw = localStorage.getItem(BASELINE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<UpdateBaseline>
    const s = parsed.snapshot
    if (!s || typeof s !== 'object' || !Array.isArray(s.entities) || !s.meta) return null
    return {
      snapshot: makeSnapshot(s),
      templatesHash: typeof parsed.templatesHash === 'string' ? parsed.templatesHash : undefined,
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
  }
}

export interface UpdateCounts {
  added: number
  changed: number
  deleted: number
}

/** What the update's response headers say it holds. */
export function countsOf(headers: Headers): UpdateCounts {
  const n = (name: string) => Number.parseInt(headers.get(name) ?? '', 10) || 0
  return { added: n('X-Update-Added'), changed: n('X-Update-Changed'), deleted: n('X-Update-Deleted') }
}

export function describeCounts(c: UpdateCounts): string {
  const parts = [
    c.added ? `${c.added} added` : '',
    c.changed ? `${c.changed} changed` : '',
    c.deleted ? `${c.deleted} removed` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : 'nothing changed'
}

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
