import { useCallback, useEffect, useRef } from 'react'
import type { FullstackEntityDef, FullstackNav, FullstackPageDef } from '../../types'
import { stripUids } from './uid'
import { DEFAULT_PROJECT_META, makeSnapshot, normalizeMeta, type FullstackSnapshot, type ProjectMeta } from './snapshot'
import { draftHasUnsavedWork } from './shareGuard'
import { readShareFromLocation } from './shareLink'
import { readStoredPresetSnapshots } from '../../hooks/useFullstackPresets'
import type { ExampleModel } from './examples'

/**
 * Where the Fullstack tab keeps its draft in this browser, and what it starts from: the
 * localStorage keys, the writes that never throw, the stock model, and the choice between a
 * share link and the stored draft. Used by `FullstackView` and the hooks beside it.
 */

export const DEFAULT_META: ProjectMeta = DEFAULT_PROJECT_META

export const DEFAULT_ENTITIES: FullstackEntityDef[] = [
  {
    name: 'User',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true, generated: true },
      { name: 'email', type: 'STRING', required: true, unique: true, length: 200 },
      { name: 'fullName', type: 'STRING', required: true, length: 120 },
      { name: 'active', type: 'BOOLEAN' },
    ],
  },
]

// localStorage keys — namespaced so they don't collide with the Backend/Frontend tabs.
export const LS = {
  meta: 'fullstack:meta',
  nav: 'fullstack:nav',
  dismissed: 'fullstack:dismissedWarnings',
  entities: 'fullstack:entities',
  deps: 'fullstack:deps',
  backendSet: 'fullstack:backendSet',
  frontendSet: 'fullstack:frontendSet',
  opts: 'fullstack:opts',
  palette: 'fullstack:palette',
  pages: 'fullstack:pages',
  collapsed: 'fullstack:collapsed',
  setup: 'fullstack:setup',
  graph: 'fullstack:graph',
  density: 'fullstack:density',
} as const

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

/** localStorage write that never throws: a model carrying imported `sourceSql` can exceed the
 *  quota, and an exception from inside a persist effect would take the whole view down on every
 *  keystroke. Losing the refresh-restore is the acceptable failure — but a visible one: the
 *  caller tracks the returned flag and the sticky bar says the draft is no longer being saved. */
export function persist(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** Calls `write(value)` whenever `value` changes — at once when nothing was written in the last
 *  `ms`, else once per `ms` while the edits keep coming — and always on pagehide and unmount, so a
 *  reload or a tab switch never loses the last keystrokes. The entity list and the layout are
 *  serialized whole, which on every keystroke made typing in a big model stutter. Returns a
 *  flush for callers that need the latest value on disk right now. */
export function usePersistThrottled<T>(value: T, write: (value: T) => void, ms = 400): () => void {
  const latest = useRef({ value, write })
  latest.current = { value, write }
  const pending = useRef(false)
  const lastWrite = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (!pending.current) return
    pending.current = false
    lastWrite.current = Date.now()
    latest.current.write(latest.current.value)
  }, [])
  useEffect(() => {
    pending.current = true
    if (timer.current) return
    const wait = lastWrite.current + ms - Date.now()
    if (wait <= 0) flush()
    else timer.current = setTimeout(flush, wait)
  }, [value, ms, flush])
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, [flush])
  return flush
}

/** The stock entity model, normalized like a snapshot so "still untouched" is a plain compare. */
export const DEFAULT_ENTITIES_JSON = JSON.stringify(stripUids(DEFAULT_ENTITIES))

/** The options a new model starts with: its tests (an API test per entity, form-check and list tests). */
export const DEFAULT_SCAFFOLD_OPTS: string[] = ['tests']

/** A load that replaces the editor's model, held while the user confirms it. */
export type PendingLoad =
  | { kind: 'example'; example: ExampleModel }
  | { kind: 'preset'; snapshot: FullstackSnapshot }
  | { kind: 'shared'; snapshot: FullstackSnapshot }

/** The draft as localStorage holds it, in snapshot form — what a share link would replace. */
function readStoredSnapshot(): FullstackSnapshot {
  const item = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
  return makeSnapshot({
    meta: normalizeMeta(loadJson<Partial<ProjectMeta>>(LS.meta, DEFAULT_META)),
    entities: loadJson<FullstackEntityDef[]>(LS.entities, DEFAULT_ENTITIES),
    selectedDeps: loadJson<string[]>(LS.deps, []),
    scaffoldOpts: loadJson<string[]>(LS.opts, DEFAULT_SCAFFOLD_OPTS),
    backendSet: item(LS.backendSet) ?? 'spring-jpa-crud',
    frontendSet: item(LS.frontendSet) ?? 'react-tailwind-crud',
    colorPalette: item(LS.palette) ?? '',
    pages: loadJson<FullstackPageDef[]>(LS.pages, []),
    nav: loadJson<FullstackNav | null>(LS.nav, null) ?? undefined,
    dismissedWarnings: loadJson<string[]>(LS.dismissed, []),
  })
}

/** What the editor starts from. A share link (?fs=…) beats localStorage — that is the whole point
 *  of the link — unless the stored draft holds unsaved work (shareGuard.ts): then the draft loads
 *  and the link waits in a confirm dialog as `pendingShared`. */
export function resolveInitialModel(): { shared: FullstackSnapshot | null; pendingShared: FullstackSnapshot | null } {
  const link = readShareFromLocation()
  if (!link) return { shared: null, pendingShared: null }
  const linked = makeSnapshot({ ...link, meta: normalizeMeta(link.meta) })
  if (!draftHasUnsavedWork(readStoredSnapshot(), linked, readStoredPresetSnapshots(), DEFAULT_ENTITIES_JSON)) {
    return { shared: link, pendingShared: null }
  }
  return { shared: null, pendingShared: linked }
}

/** Adds or clears `key` in the failed-writes set, returning the same set when nothing changed. */
export function trackPersist(prev: ReadonlySet<string>, key: string, ok: boolean): ReadonlySet<string> {
  if (ok === !prev.has(key)) return prev
  const next = new Set(prev)
  if (ok) next.delete(key)
  else next.add(key)
  return next
}
