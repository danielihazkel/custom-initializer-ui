import { useCallback, useEffect, useState } from 'react'
import { isSnapshot, snapshotsEqual, type FullstackSnapshot } from '../components/fullstack/snapshot'

const PRESETS_KEY = 'fullstackProjectPresets'
const RECENTS_KEY = 'fullstackRecentProjects'
const RECENTS_MAX = 10

export interface FullstackPreset {
  id: string
  name: string
  createdAt: number
  snapshot: FullstackSnapshot
}

function readList(key: string): FullstackPreset[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((p): p is FullstackPreset => !!p && typeof p === 'object' && isSnapshot((p as FullstackPreset).snapshot))
      : []
  } catch {
    return []
  }
}

/** Returns false when the write failed (quota exceeded / storage disabled) so the caller can say
 *  so instead of reporting a save that only exists in memory. */
function writeList(key: string, list: FullstackPreset[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

/** Every snapshot kept in this browser (presets + recents), read synchronously from storage — for
 *  the share-link guard, which runs inside the view's state initialisers before the hook has. */
export function readStoredPresetSnapshots(): FullstackSnapshot[] {
  return [...readList(PRESETS_KEY), ...readList(RECENTS_KEY)].map(p => p.snapshot)
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Named presets + a rolling list of recently generated/explored models for the fullstack tab.
 *  Mirrors useFrontendPresets; both persist in localStorage. `persistFailed` is true once a write
 *  has been refused — the lists still work for the session, they just won't survive a refresh. */
export function useFullstackPresets() {
  const [presets, setPresets] = useState<FullstackPreset[]>(() => readList(PRESETS_KEY))
  const [recents, setRecents] = useState<FullstackPreset[]>(() => readList(RECENTS_KEY))
  const [persistFailed, setPersistFailed] = useState(false)

  useEffect(() => { setPersistFailed(!writeList(PRESETS_KEY, presets)) }, [presets])
  useEffect(() => { if (!writeList(RECENTS_KEY, recents)) setPersistFailed(true) }, [recents])

  /** Saves a preset. `persisted` is false when localStorage refused the write — the preset is
   *  still listed for this session. */
  const savePreset = useCallback((name: string, snapshot: FullstackSnapshot): { preset: FullstackPreset; persisted: boolean } => {
    const preset: FullstackPreset = {
      id: makeId(),
      name: name.trim() || 'Untitled preset',
      createdAt: Date.now(),
      snapshot,
    }
    const next = [preset, ...presets]
    const persisted = writeList(PRESETS_KEY, next)
    setPresets(next)
    return { preset, persisted }
  }, [presets])

  /** Removes a preset and hands it back with its position, so an "Undo" can put it back. */
  const deletePreset = useCallback((id: string): { preset: FullstackPreset; index: number } | null => {
    const index = presets.findIndex(p => p.id === id)
    if (index < 0) return null
    const preset = presets[index]
    setPresets(prev => prev.filter(p => p.id !== id))
    return { preset, index }
  }, [presets])

  /** Re-inserts a deleted preset at its old position (or the end if the list shrank). */
  const restorePreset = useCallback((preset: FullstackPreset, index: number): void => {
    setPresets(prev => {
      if (prev.some(p => p.id === preset.id)) return prev
      const next = [...prev]
      next.splice(Math.min(index, next.length), 0, preset)
      return next
    })
  }, [])

  /** Removes a recent and hands it back with its position, so an "Undo" can put it back. */
  const deleteRecent = useCallback((id: string): { preset: FullstackPreset; index: number } | null => {
    const index = recents.findIndex(r => r.id === id)
    if (index < 0) return null
    const preset = recents[index]
    setRecents(prev => prev.filter(r => r.id !== id))
    return { preset, index }
  }, [recents])

  /** Re-inserts a deleted recent at its old position (or the end if the list shrank). */
  const restoreRecent = useCallback((preset: FullstackPreset, index: number): void => {
    setRecents(prev => {
      if (prev.some(r => r.id === preset.id)) return prev
      const next = [...prev]
      next.splice(Math.min(index, next.length), 0, preset)
      return next
    })
  }, [])

  const pushRecent = useCallback((snapshot: FullstackSnapshot): void => {
    setRecents(prev => {
      const last = prev[0]
      if (last && snapshotsEqual(last.snapshot, snapshot)) return prev
      const entry: FullstackPreset = {
        id: makeId(),
        name: snapshot.meta.artifactId || 'untitled',
        createdAt: Date.now(),
        snapshot,
      }
      return [entry, ...prev].slice(0, RECENTS_MAX)
    })
  }, [])

  return { presets, recents, persistFailed, savePreset, deletePreset, restorePreset, deleteRecent, restoreRecent, pushRecent }
}
