import { useCallback, useEffect, useState } from 'react'
import type { ProjectSnapshot, TeamPresetSummary } from '../types'
import { parseProjectSnapshot } from '../utils/backendShare'

export const TEAM_PRESETS_URL = '/metadata/backend/presets'

/** A failed team-preset call, with the HTTP status so callers can treat 409 (name taken) specially. */
export class TeamPresetError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'TeamPresetError'
  }
}

async function failure(res: Response): Promise<TeamPresetError> {
  const body = await res.json().catch(() => null) as { error?: string; detail?: string } | null
  return new TeamPresetError(body?.detail || body?.error || `HTTP ${res.status}`, res.status)
}

/**
 * Saves a Backend-tab setup for the team. A plain function, not part of the hook, so the presets
 * strip can import this module only when someone saves for the team (the strip is first-paint
 * code; this module is not).
 */
export async function saveTeamPreset(name: string, snapshot: ProjectSnapshot): Promise<TeamPresetSummary> {
  const res = await fetch(TEAM_PRESETS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, snapshot }),
  })
  if (!res.ok) throw await failure(res)
  return await res.json() as TeamPresetSummary
}

/**
 * Backend-tab setups shared through the server, for the presets strip's "Team" tab — the
 * Backend tab's counterpart of the Fullstack tab's team models. Unlike `useProjectPresets`
 * (this browser's localStorage) they are visible to everyone who opens the generator, wizard
 * documents and modules included. `reloadKey` refetches the list when it changes (after a save).
 */
export function useTeamPresets(reloadKey: number = 0) {
  const [presets, setPresets] = useState<TeamPresetSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(TEAM_PRESETS_URL)
      if (!res.ok) throw await failure(res)
      setPresets(await res.json() as TeamPresetSummary[])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh, reloadKey])

  const remove = useCallback(async (id: number): Promise<void> => {
    const res = await fetch(`${TEAM_PRESETS_URL}/${id}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw await failure(res)
    setPresets(prev => prev.filter(p => p.id !== id))
  }, [])

  const load = useCallback(async (id: number): Promise<ProjectSnapshot> => {
    const res = await fetch(`${TEAM_PRESETS_URL}/${id}`)
    if (!res.ok) throw await failure(res)
    const body = await res.json() as { snapshot?: unknown }
    const snapshot = parseProjectSnapshot(body.snapshot)
    if (!snapshot) throw new TeamPresetError("This team preset can't be loaded: it is not a Backend-tab setup", 422)
    return snapshot
  }, [])

  return { presets, loading, error, refresh, remove, load }
}
