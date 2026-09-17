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

function writeList(key: string, list: FullstackPreset[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    /* quota exceeded — drop silently */
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Named presets + a rolling list of recently generated/explored models for the fullstack tab.
 *  Mirrors useFrontendPresets; both persist in localStorage. */
export function useFullstackPresets() {
  const [presets, setPresets] = useState<FullstackPreset[]>(() => readList(PRESETS_KEY))
  const [recents, setRecents] = useState<FullstackPreset[]>(() => readList(RECENTS_KEY))

  useEffect(() => { writeList(PRESETS_KEY, presets) }, [presets])
  useEffect(() => { writeList(RECENTS_KEY, recents) }, [recents])

  const savePreset = useCallback((name: string, snapshot: FullstackSnapshot): FullstackPreset => {
    const preset: FullstackPreset = {
      id: makeId(),
      name: name.trim() || 'Untitled preset',
      createdAt: Date.now(),
      snapshot,
    }
    setPresets(prev => [preset, ...prev])
    return preset
  }, [])

  const deletePreset = useCallback((id: string): void => {
    setPresets(prev => prev.filter(p => p.id !== id))
  }, [])

  const deleteRecent = useCallback((id: string): void => {
    setRecents(prev => prev.filter(r => r.id !== id))
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

  return { presets, recents, savePreset, deletePreset, deleteRecent, pushRecent }
}
