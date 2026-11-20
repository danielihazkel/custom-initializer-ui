import { useEffect, useRef, useState } from 'react'
import type { FullstackEntityDef, FullstackNav, FullstackPageDef } from '../../types'
import type { EditorDensity } from './EntitiesEditor'
import { normalizeMeta, type ProjectMeta } from './snapshot'
import { DEFAULT_META, LS, loadJson, persist, trackPersist, usePersistThrottled } from './fullstackStorage'

/** What the Fullstack tab keeps in this browser: the model, and how the editor was left. */
export interface PersistedState {
  meta: ProjectMeta
  entities: FullstackEntityDef[]
  selectedDeps: string[]
  backendSet: string
  frontendSet: string
  scaffoldOpts: string[]
  colorPalette: string
  pages: FullstackPageDef[]
  nav: FullstackNav | undefined
  dismissedWarnings: string[]
  collapsed: Set<string>
  showGraph: boolean
  setupOpen: boolean
  density: EditorDensity
}

/**
 * Keeps the Fullstack tab's draft in localStorage as it changes, says when the browser has
 * stopped taking it (`persistFailed`), and notices a different draft saved by another tab
 * (`externalDraft`) instead of letting the last tab to type win silently.
 */
export function useModelPersistence({
  meta, entities, selectedDeps, backendSet, frontendSet, scaffoldOpts, colorPalette, pages, nav, dismissedWarnings,
  collapsed, showGraph, setupOpen, density,
}: PersistedState) {
  // The localStorage keys whose last write was refused (quota / disabled). Tracked per key: the
  // entity list is what blows the quota, and a later *successful* write of the small meta key
  // must not hide the notice while the model itself is still unsaved. Non-empty = the draft is no
  // longer being saved, so the sticky bar says so and leaving the page asks first.
  const [persistFailedKeys, setPersistFailedKeys] = useState<ReadonlySet<string>>(() => new Set())
  // What this tab last wrote for the entity list, so a `storage` event from another tab can be
  // told apart from the echo of our own write.
  const lastWrittenEntitiesRef = useRef<string | null>(null)
  // Another tab saved a different draft under the same keys — held until the user picks a side.
  const [externalDraft, setExternalDraft] = useState<{ meta: ProjectMeta; entities: FullstackEntityDef[] } | null>(null)

  // Persist form state so a refresh doesn't lose the user's work (mirrors useProjectState).
  // The model itself (meta + entities) is what matters for the storage-full notice; the small
  // UI-state keys just try their luck.
  usePersistThrottled(meta, m => setPersistFailedKeys(prev => trackPersist(prev, LS.meta, persist(LS.meta, JSON.stringify(m)))))
  // `sourceSql` (the imported DDL) stays in memory only: it is the one prop big enough to blow
  // the quota, and the server discards it anyway. The uids do persist — `collapsed` keys on them.
  const flushEntities = usePersistThrottled(entities, list => {
    const json = JSON.stringify(list.map(({ sourceSql: _s, ...e }) => e))
    lastWrittenEntitiesRef.current = json
    setPersistFailedKeys(prev => trackPersist(prev, LS.entities, persist(LS.entities, json)))
  })
  // Two tabs on this page share the draft keys, and the last one to type used to win silently.
  // A write we did not make ourselves surfaces as a banner with both drafts on offer — never an
  // automatic merge.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== LS.entities || e.newValue == null || e.newValue === lastWrittenEntitiesRef.current) return
      try {
        const theirs = JSON.parse(e.newValue) as FullstackEntityDef[]
        if (!Array.isArray(theirs)) return
        setExternalDraft({ meta: normalizeMeta(loadJson<Partial<ProjectMeta>>(LS.meta, DEFAULT_META)), entities: theirs })
      } catch { /* not ours to interpret */ }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  useEffect(() => { persist(LS.deps, JSON.stringify(selectedDeps)) }, [selectedDeps])
  useEffect(() => { persist(LS.backendSet, backendSet) }, [backendSet])
  useEffect(() => { persist(LS.frontendSet, frontendSet) }, [frontendSet])
  useEffect(() => { persist(LS.opts, JSON.stringify(scaffoldOpts)) }, [scaffoldOpts])
  useEffect(() => { persist(LS.palette, colorPalette) }, [colorPalette])
  usePersistThrottled(pages, ps => { persist(LS.pages, JSON.stringify(ps)) })
  useEffect(() => { persist(LS.nav, JSON.stringify(nav ?? null)) }, [nav])
  useEffect(() => { persist(LS.dismissed, JSON.stringify(dismissedWarnings)) }, [dismissedWarnings])
  useEffect(() => { persist(LS.collapsed, JSON.stringify([...collapsed])) }, [collapsed])
  useEffect(() => { persist(LS.graph, JSON.stringify(showGraph)) }, [showGraph])
  useEffect(() => { persist(LS.setup, setupOpen ? 'open' : 'closed') }, [setupOpen])
  useEffect(() => { persist(LS.density, density) }, [density])

  return { persistFailed: persistFailedKeys.size > 0, flushEntities, lastWrittenEntitiesRef, externalDraft, setExternalDraft }
}
