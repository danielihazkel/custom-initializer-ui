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
 *  recents, the undo stack and share links carry. */
export interface FullstackSnapshot {
  meta: ProjectMeta
  entities: FullstackEntityDef[]
  selectedDeps: string[]
  scaffoldOpts: string[]
  backendSet: string
  frontendSet: string
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
  }
}

export function snapshotsEqual(a: FullstackSnapshot, b: FullstackSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Minimal shape check for data that arrived from storage or a URL. */
export function isSnapshot(v: unknown): v is FullstackSnapshot {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return typeof s.meta === 'object' && s.meta !== null
    && Array.isArray(s.entities)
    && Array.isArray(s.selectedDeps)
    && Array.isArray(s.scaffoldOpts)
    && typeof s.backendSet === 'string'
    && typeof s.frontendSet === 'string'
}
