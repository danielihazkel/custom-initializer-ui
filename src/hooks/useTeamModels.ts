import { useCallback, useEffect, useState } from 'react'
import type { TeamModelSummary } from '../types'
import { parseExportedModel, toExportedModel, type FullstackSnapshot } from '../components/fullstack/snapshot'

export const TEAM_MODELS_URL = '/metadata/fullstack/models'

/** A failed team-model call, with the HTTP status so callers can treat 409 (name taken) specially. */
export class TeamModelError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'TeamModelError'
  }
}

async function failure(res: Response): Promise<TeamModelError> {
  const body = await res.json().catch(() => null) as { error?: string; detail?: string } | null
  return new TeamModelError(body?.detail || body?.error || `HTTP ${res.status}`, res.status)
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/**
 * Fullstack models shared through the server, for the presets strip's "Team" tab. Unlike
 * `useFullstackPresets` (this browser's localStorage) these are visible to everyone who opens the
 * generator. The stored document is the same `menora-fullstack-model/1` shape the JSON export
 * writes, so a file, a share link and a team model are interchangeable.
 */
export function useTeamModels() {
  const [models, setModels] = useState<TeamModelSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(TEAM_MODELS_URL)
      if (!res.ok) throw await failure(res)
      setModels(await res.json() as TeamModelSummary[])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const save = useCallback(async (name: string, description: string, snapshot: FullstackSnapshot): Promise<TeamModelSummary> => {
    const res = await fetch(TEAM_MODELS_URL, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ name, description: description.trim() || undefined, snapshot: toExportedModel(snapshot) }),
    })
    if (!res.ok) throw await failure(res)
    const summary = await res.json() as TeamModelSummary
    setModels(prev => [summary, ...prev.filter(m => m.id !== summary.id)])
    return summary
  }, [])

  const update = useCallback(async (id: number, name: string, description: string, snapshot: FullstackSnapshot): Promise<TeamModelSummary> => {
    const res = await fetch(`${TEAM_MODELS_URL}/${id}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ name, description: description.trim() || undefined, snapshot: toExportedModel(snapshot) }),
    })
    if (!res.ok) throw await failure(res)
    const summary = await res.json() as TeamModelSummary
    setModels(prev => [summary, ...prev.filter(m => m.id !== summary.id)])
    return summary
  }, [])

  const remove = useCallback(async (id: number): Promise<void> => {
    const res = await fetch(`${TEAM_MODELS_URL}/${id}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw await failure(res)
    setModels(prev => prev.filter(m => m.id !== id))
  }, [])

  const load = useCallback(async (id: number): Promise<FullstackSnapshot> => {
    const res = await fetch(`${TEAM_MODELS_URL}/${id}`)
    if (!res.ok) throw await failure(res)
    const body = await res.json() as { snapshot?: unknown }
    // Same validation as an imported file: shape-check and strip the file-level marker fields.
    const parsed = parseExportedModel(JSON.stringify(body.snapshot ?? null))
    if ('error' in parsed) throw new TeamModelError(`This team model can't be loaded: ${parsed.error}`, 422)
    return parsed.snapshot
  }, [])

  return { models, loading, error, refresh, save, update, remove, load }
}
