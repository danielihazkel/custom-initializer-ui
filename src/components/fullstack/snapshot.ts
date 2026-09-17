import type { FullstackEntityDef } from '../../types'
import { stripUids } from './uid'

export interface ProjectMeta {
  groupId: string
  artifactId: string
  packageName: string
  domainPackage: string
  bootVersion: string
  javaVersion: string
  dashboardTitle: string
  dashboardOverview: string
}

/** Everything the fullstack editor holds, minus the client-only row uids — the unit that presets,
 *  recents, the undo stack, share links and JSON export/import carry. */
export interface FullstackSnapshot {
  meta: ProjectMeta
  entities: FullstackEntityDef[]
  selectedDeps: string[]
  scaffoldOpts: string[]
  backendSet: string
  frontendSet: string
  /** Seeded colour-palette id for the generated frontend. Absent/blank = the frontend set's
   *  default palette (the backend resolves it). Optional so older presets and links still load. */
  colorPalette?: string
}

/** Builds a detached snapshot (uids stripped, arrays copied) so later edits never mutate it. */
export function makeSnapshot(s: FullstackSnapshot): FullstackSnapshot {
  return {
    meta: { ...s.meta },
    entities: stripUids(s.entities),
    selectedDeps: [...s.selectedDeps],
    scaffoldOpts: [...s.scaffoldOpts],
    backendSet: s.backendSet,
    frontendSet: s.frontendSet,
    ...(s.colorPalette ? { colorPalette: s.colorPalette } : {}),
  }
}

export function snapshotsEqual(a: FullstackSnapshot, b: FullstackSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Minimal shape check for data that arrived from storage, a URL or an imported file. */
export function isSnapshot(v: unknown): v is FullstackSnapshot {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return typeof s.meta === 'object' && s.meta !== null
    && Array.isArray(s.entities)
    && Array.isArray(s.selectedDeps)
    && Array.isArray(s.scaffoldOpts)
    && typeof s.backendSet === 'string'
    && typeof s.frontendSet === 'string'
    && (s.colorPalette === undefined || typeof s.colorPalette === 'string')
}

/** Marker written into exported files so a stray JSON document is recognisable as a model. */
export const EXPORT_FORMAT = 'menora-fullstack-model/1'

/** The on-disk form of {@link FullstackSnapshot}: the snapshot plus a format marker. */
export interface ExportedModel extends FullstackSnapshot {
  format: typeof EXPORT_FORMAT
  exportedAt: string
}

export function toExportedModel(snapshot: FullstackSnapshot): ExportedModel {
  return { format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), ...makeSnapshot(snapshot) }
}

/** Parses an exported file (or a bare snapshot pasted from elsewhere). Returns a plain snapshot
 *  without the file-level marker fields, or an error message for the user. */
export function parseExportedModel(text: string): { snapshot: FullstackSnapshot } | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'Not valid JSON' }
  }
  if (!isSnapshot(parsed)) {
    return { error: 'Not a fullstack model file (expected meta, entities, selectedDeps, scaffoldOpts, backendSet, frontendSet)' }
  }
  const { format: _format, exportedAt: _at, ...rest } = parsed as Partial<ExportedModel> & FullstackSnapshot
  return { snapshot: makeSnapshot(rest) }
}
