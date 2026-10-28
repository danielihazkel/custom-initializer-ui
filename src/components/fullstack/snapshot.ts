import type { FullstackEntityDef, FullstackNav, FullstackPageDef } from '../../types'
import { describePagesChange } from './pageLayout'
import { stripUids } from './uid'

export interface ProjectMeta {
  groupId: string
  artifactId: string
  /** Display name of the project; blank = the artifactId (the server's default). */
  name: string
  description: string
  version: string
  packaging: string
  packageName: string
  domainPackage: string
  bootVersion: string
  javaVersion: string
  dashboardTitle: string
  dashboardOverview: string
  /** Language of the generated app's own chrome strings (nav, buttons, dialogs). */
  locale: 'en' | 'he'
  /** Department id ({{department}} in both halves' templates); '' = the server's default. */
  department: string
}

export const DEFAULT_PROJECT_META: ProjectMeta = {
  groupId: 'com.menora',
  artifactId: 'demo',
  name: '',
  description: '',
  version: '',
  packaging: 'jar',
  packageName: 'com.menora.demo',
  domainPackage: '',
  bootVersion: '3.2.1',
  javaVersion: '21',
  dashboardTitle: '',
  dashboardOverview: '',
  locale: 'en',
  department: '',
}

/** Fills in keys that older presets, share links and localStorage entries predate, so a model
 *  saved before a setting existed still loads with that setting at its default. */
export function normalizeMeta(meta: Partial<ProjectMeta> | undefined | null): ProjectMeta {
  const merged = { ...DEFAULT_PROJECT_META, ...(meta ?? {}) }
  if (merged.locale !== 'he') merged.locale = 'en'
  return merged
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
  /** Frontend page layout. Absent/empty = the classic shell; optional so older snapshots load
   *  (and compare equal to a layout-free editor). */
  pages?: FullstackPageDef[]
  /** The generated shell's navigation for the layout. Absent = a sidebar whose sections do not fold. */
  nav?: FullstackNav
  /** Editor-only: keys of the layout warnings the user dismissed (`LayoutWarning.key`). Never sent
   *  to the generator; kept in the model so a dismissal travels with exports and team models. */
  dismissedWarnings?: string[]
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
    ...(s.pages && s.pages.length > 0 ? { pages: JSON.parse(JSON.stringify(s.pages)) as FullstackPageDef[] } : {}),
    ...(s.nav && (s.nav.style || s.nav.collapsibleGroups) ? { nav: { ...s.nav } } : {}),
    ...(s.dismissedWarnings && s.dismissedWarnings.length > 0 ? { dismissedWarnings: [...s.dismissedWarnings] } : {}),
  }
}

// Snapshots are detached and never changed once made (see makeSnapshot), so each one is
// serialized once: the editor compares the live snapshot against the undo burst, the last
// preview, the last generate, the baseline and every preset/recent on each edit.
const snapshotJson = new WeakMap<FullstackSnapshot, string>()

/** The snapshot's JSON, computed once per snapshot object. */
export function snapshotKey(s: FullstackSnapshot): string {
  let json = snapshotJson.get(s)
  if (json === undefined) {
    json = JSON.stringify(s)
    snapshotJson.set(s, json)
  }
  return json
}

export function snapshotsEqual(a: FullstackSnapshot, b: FullstackSnapshot): boolean {
  return a === b || snapshotKey(a) === snapshotKey(b)
}

/** A short human label for the difference between two snapshots — the undo history's entry
 *  names for edits recorded automatically (typing, toggles) rather than through an explicit,
 *  already-labelled action. Names the first thing that differs. */
export function describeSnapshotChange(prev: FullstackSnapshot, next: FullstackSnapshot): string {
  if (prev.entities.length < next.entities.length) return 'Added an entity'
  if (prev.entities.length > next.entities.length) return 'Removed an entity'
  if (isReordered(prev.entities, next.entities)) return 'Reordered entities'
  for (let i = 0; i < next.entities.length; i++) {
    const a = prev.entities[i]; const b = next.entities[i]
    if (JSON.stringify(a) === JSON.stringify(b)) continue
    const name = (b.name || a.name).trim() || 'an entity'
    if (a.name !== b.name && a.fields === b.fields) return `Renamed ${name}`
    if (a.fields.length < b.fields.length) return `Added a field to ${name}`
    if (a.fields.length > b.fields.length) return `Removed a field from ${name}`
    if (isReordered(a.fields, b.fields)) return `Reordered fields of ${name}`
    if (isReordered(a.relations ?? [], b.relations ?? [])) return `Reordered relations of ${name}`
    return `Edited ${name}`
  }
  if (JSON.stringify(prev.meta) !== JSON.stringify(next.meta)) return 'Edited project settings'
  if (JSON.stringify(prev.selectedDeps) !== JSON.stringify(next.selectedDeps)) return 'Changed dependencies'
  if (JSON.stringify(prev.scaffoldOpts) !== JSON.stringify(next.scaffoldOpts)) return 'Changed options'
  if (prev.backendSet !== next.backendSet || prev.frontendSet !== next.frontendSet) return 'Changed template set'
  if (prev.colorPalette !== next.colorPalette) return 'Changed colour palette'
  if (JSON.stringify(prev.nav ?? {}) !== JSON.stringify(next.nav ?? {})) return 'Changed the navigation'
  if (JSON.stringify(prev.pages ?? []) !== JSON.stringify(next.pages ?? [])) return describePagesChange(prev.pages ?? [], next.pages ?? [])
  const da = prev.dismissedWarnings ?? []; const db = next.dismissedWarnings ?? []
  if (db.length > da.length) return db.length - da.length === 1 ? 'Dismissed a warning' : 'Dismissed warnings'
  if (db.length < da.length) return da.length - db.length === 1 ? 'Restored a warning' : 'Restored warnings'
  return 'Edit'
}

/** Which *thing* differs between two snapshots, as a stable string — the undo recorder only
 *  coalesces a burst of rapid edits while they keep hitting the same key, so ticking three boxes
 *  on three fields within a second stays three undo steps. Uids are stripped from snapshots, so
 *  rows are addressed by position: `e0.f2`, `e1.r0`, `e1` (its own props), `entities` (add /
 *  remove / reorder), `meta.locale`, `deps`, `opts`, `sets`, `palette`. */
export function snapshotChangeKey(prev: FullstackSnapshot, next: FullstackSnapshot): string {
  if (prev.entities.length !== next.entities.length || isReordered(prev.entities, next.entities)) return 'entities'
  for (let i = 0; i < next.entities.length; i++) {
    const a = prev.entities[i]; const b = next.entities[i]
    if (JSON.stringify(a) === JSON.stringify(b)) continue
    if (a.fields.length !== b.fields.length || isReordered(a.fields, b.fields)) return `e${i}.fields`
    for (let j = 0; j < b.fields.length; j++) {
      if (JSON.stringify(a.fields[j]) !== JSON.stringify(b.fields[j])) return `e${i}.f${j}`
    }
    const ra = a.relations ?? []; const rb = b.relations ?? []
    if (ra.length !== rb.length || isReordered(ra, rb)) return `e${i}.relations`
    for (let j = 0; j < rb.length; j++) {
      if (JSON.stringify(ra[j]) !== JSON.stringify(rb[j])) return `e${i}.r${j}`
    }
    return `e${i}`
  }
  const ma = prev.meta as unknown as Record<string, unknown>
  const mb = next.meta as unknown as Record<string, unknown>
  for (const k of new Set([...Object.keys(ma), ...Object.keys(mb)])) {
    if (ma[k] !== mb[k]) return `meta.${k}`
  }
  if (JSON.stringify(prev.selectedDeps) !== JSON.stringify(next.selectedDeps)) return 'deps'
  if (JSON.stringify(prev.scaffoldOpts) !== JSON.stringify(next.scaffoldOpts)) return 'opts'
  if (prev.backendSet !== next.backendSet || prev.frontendSet !== next.frontendSet) return 'sets'
  if (prev.colorPalette !== next.colorPalette) return 'palette'
  if (JSON.stringify(prev.nav ?? {}) !== JSON.stringify(next.nav ?? {})) return 'nav'
  const pa = prev.pages ?? []; const pb = next.pages ?? []
  if (pa.length !== pb.length || isReordered(pa, pb)) return 'pages'
  for (let i = 0; i < pb.length; i++) {
    if (JSON.stringify(pa[i]) !== JSON.stringify(pb[i])) return `p${i}`
  }
  if (JSON.stringify(prev.dismissedWarnings ?? []) !== JSON.stringify(next.dismissedWarnings ?? [])) return 'dismissed'
  return 'none'
}

/** Same rows in a different order (arrow buttons or drag-and-drop) — nothing added, removed or edited. */
function isReordered(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length || a.length < 2) return false
  const sa = a.map(x => JSON.stringify(x)); const sb = b.map(x => JSON.stringify(x))
  if (sa.join(' ') === sb.join(' ')) return false
  return [...sa].sort().join(' ') === [...sb].sort().join(' ')
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
    && (s.pages === undefined || Array.isArray(s.pages))
    && (s.nav === undefined || (typeof s.nav === 'object' && s.nav !== null))
    && (s.dismissedWarnings === undefined || (Array.isArray(s.dismissedWarnings) && s.dismissedWarnings.every(k => typeof k === 'string')))
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

/** Marker of a generated zip's `menora-model.json` that holds the request itself (it was sent
 *  without the editor's snapshot — by curl, say): `{ format, request }`. */
export const REQUEST_MODEL_FORMAT = 'menora-fullstack-request/1'

const META_KEYS: (keyof ProjectMeta)[] = [
  'groupId', 'artifactId', 'name', 'description', 'version', 'packaging', 'packageName', 'domainPackage',
  'bootVersion', 'javaVersion', 'dashboardTitle', 'dashboardOverview', 'locale', 'department',
]

/** The editor model a `/starter-fullstack.zip` request describes: its flat project fields become
 *  `meta`, `dependencies` / `opts.scaffold` / the template sets the editor's selections. A request
 *  that named no dependencies leaves the editor with none selected. */
export function snapshotFromRequest(request: Record<string, unknown>): FullstackSnapshot {
  const meta: Partial<ProjectMeta> = {}
  for (const key of META_KEYS) {
    const value = request[key]
    if (typeof value === 'string') (meta as Record<string, string>)[key] = value
  }
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  const opts = request.opts && typeof request.opts === 'object' ? request.opts as Record<string, unknown> : {}
  return makeSnapshot({
    meta: normalizeMeta(meta),
    entities: Array.isArray(request.entities) ? request.entities as FullstackEntityDef[] : [],
    selectedDeps: strings(request.dependencies),
    scaffoldOpts: strings(opts.scaffold),
    backendSet: typeof request.backendTemplateSet === 'string' ? request.backendTemplateSet : 'spring-jpa-crud',
    frontendSet: typeof request.frontendTemplateSet === 'string' ? request.frontendTemplateSet : 'react-tailwind-crud',
    ...(typeof request.colorPalette === 'string' ? { colorPalette: request.colorPalette } : {}),
    ...(Array.isArray(request.pages) ? { pages: request.pages as FullstackPageDef[] } : {}),
    ...(request.nav && typeof request.nav === 'object' ? { nav: request.nav as FullstackNav } : {}),
  })
}

/** Parses an exported file (or a bare snapshot pasted from elsewhere, or a generated zip's
 *  `menora-model.json` in either of its shapes). Returns a plain snapshot without the file-level
 *  marker fields, or an error message for the user. */
export function parseExportedModel(text: string): { snapshot: FullstackSnapshot } | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'Not valid JSON' }
  }
  if (parsed && typeof parsed === 'object' && (parsed as { format?: unknown }).format === REQUEST_MODEL_FORMAT) {
    const request = (parsed as { request?: unknown }).request
    if (!request || typeof request !== 'object' || !Array.isArray((request as { entities?: unknown }).entities)) {
      return { error: 'Not a fullstack model file (the request in it has no entities)' }
    }
    return { snapshot: snapshotFromRequest(request as Record<string, unknown>) }
  }
  if (!isSnapshot(parsed)) {
    return { error: 'Not a fullstack model file (expected meta, entities, selectedDeps, scaffoldOpts, backendSet, frontendSet)' }
  }
  const { format: _format, exportedAt: _at, ...rest } = parsed as Partial<ExportedModel> & FullstackSnapshot
  return { snapshot: makeSnapshot(rest) }
}
