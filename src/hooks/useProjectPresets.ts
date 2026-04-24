import { useCallback, useEffect, useState } from 'react'
import type { ProjectPreset, ProjectSnapshot } from '../types'

const PRESETS_KEY = 'projectPresets'
const RECENTS_KEY = 'recentProjects'
const RECENTS_MAX = 10

function readList(key: string): ProjectPreset[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeList(key: string, list: ProjectPreset[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    /* quota exceeded — drop silently */
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function snapshotsEqual(a: ProjectSnapshot, b: ProjectSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function useProjectPresets() {
  const [presets, setPresets] = useState<ProjectPreset[]>(() => readList(PRESETS_KEY))
  const [recents, setRecents] = useState<ProjectPreset[]>(() => readList(RECENTS_KEY))

  useEffect(() => { writeList(PRESETS_KEY, presets) }, [presets])
  useEffect(() => { writeList(RECENTS_KEY, recents) }, [recents])

  const savePreset = useCallback((name: string, snapshot: ProjectSnapshot): ProjectPreset => {
    const preset: ProjectPreset = {
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

  const pushRecent = useCallback((snapshot: ProjectSnapshot): void => {
    setRecents(prev => {
      const last = prev[0]
      if (last && snapshotsEqual(last.snapshot, snapshot)) return prev
      const entry: ProjectPreset = {
        id: makeId(),
        name: snapshot.form.artifactId || 'untitled',
        createdAt: Date.now(),
        snapshot,
      }
      return [entry, ...prev].slice(0, RECENTS_MAX)
    })
  }, [])

  const clearRecents = useCallback((): void => { setRecents([]) }, [])

  return { presets, recents, savePreset, deletePreset, deleteRecent, pushRecent, clearRecents }
}
