import { useCallback, useEffect, useState } from 'react'
import type { FeState } from './useFrontendState'

const PRESETS_KEY = 'frontendProjectPresets'
const RECENTS_KEY = 'frontendRecentProjects'
const RECENTS_MAX = 10

export interface FePreset {
  id: string
  name: string
  createdAt: number
  snapshot: FeState
}

function readList(key: string): FePreset[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeList(key: string, list: FePreset[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    /* quota exceeded — drop silently */
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function snapshotsEqual(a: FeState, b: FeState): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function useFrontendPresets() {
  const [presets, setPresets] = useState<FePreset[]>(() => readList(PRESETS_KEY))
  const [recents, setRecents] = useState<FePreset[]>(() => readList(RECENTS_KEY))

  useEffect(() => { writeList(PRESETS_KEY, presets) }, [presets])
  useEffect(() => { writeList(RECENTS_KEY, recents) }, [recents])

  const savePreset = useCallback((name: string, snapshot: FeState): FePreset => {
    const preset: FePreset = {
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

  const pushRecent = useCallback((snapshot: FeState): void => {
    setRecents(prev => {
      const last = prev[0]
      if (last && snapshotsEqual(last.snapshot, snapshot)) return prev
      const entry: FePreset = {
        id: makeId(),
        name: snapshot.form.projectName || 'untitled',
        createdAt: Date.now(),
        snapshot,
      }
      return [entry, ...prev].slice(0, RECENTS_MAX)
    })
  }, [])

  const clearRecents = useCallback((): void => { setRecents([]) }, [])

  return { presets, recents, savePreset, deletePreset, deleteRecent, pushRecent, clearRecents }
}
