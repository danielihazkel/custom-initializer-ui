import { useCallback, useEffect, useState } from 'react'
import type { FullstackPageDef, FullstackWidgetDef, TeamTemplate } from '../types'

export const TEAM_TEMPLATES_URL = '/metadata/fullstack/templates'

/** A failed team-template call, with the HTTP status (409: the name is taken). */
export class TeamTemplateError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'TeamTemplateError'
  }
}

async function failure(res: Response): Promise<TeamTemplateError> {
  const body = await res.json().catch(() => null) as { error?: string; detail?: string } | null
  return new TeamTemplateError(body?.detail || body?.error || `HTTP ${res.status}`, res.status)
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

const isTemplate = (t: unknown): t is TeamTemplate =>
  !!t && typeof t === 'object' && typeof (t as TeamTemplate).id === 'number' && typeof (t as TeamTemplate).name === 'string'
  && ((t as TeamTemplate).kind === 'page' || (t as TeamTemplate).kind === 'widget')
  && !!(t as TeamTemplate).content && typeof (t as TeamTemplate).content === 'object'

export type TeamShare = { kind: 'page'; name: string; content: FullstackPageDef } | { kind: 'widget'; name: string; content: FullstackWidgetDef }

/**
 * The layout designer's team templates: pages and widgets saved on the server for everyone, next
 * to this browser's "My templates" / "My widgets". Listed once when the designer opens. Sharing
 * under a name the team already has (same kind, ignoring case) replaces that template.
 */
export function useTeamTemplates() {
  const [templates, setTemplates] = useState<TeamTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(TEAM_TEMPLATES_URL)
      if (!res.ok) throw await failure(res)
      const body = await res.json() as unknown
      setTemplates(Array.isArray(body) ? body.filter(isTemplate) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  /** The team's template of this kind and name, if there is one. */
  const find = useCallback((kind: TeamTemplate['kind'], name: string) =>
    templates.find(t => t.kind === kind && t.name.toLowerCase() === name.trim().toLowerCase()), [templates])

  const share = useCallback(async (item: TeamShare): Promise<{ template: TeamTemplate; replaced: boolean }> => {
    const existing = find(item.kind, item.name)
    const res = await fetch(existing ? `${TEAM_TEMPLATES_URL}/${existing.id}` : TEAM_TEMPLATES_URL, {
      method: existing ? 'PUT' : 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ kind: item.kind, name: existing?.name ?? item.name.trim(), description: existing?.description ?? undefined, content: item.content }),
    })
    if (!res.ok) throw await failure(res)
    const template = await res.json() as TeamTemplate
    setTemplates(prev => [template, ...prev.filter(t => t.id !== template.id)])
    return { template, replaced: Boolean(existing) }
  }, [find])

  const remove = useCallback(async (id: number): Promise<void> => {
    const res = await fetch(`${TEAM_TEMPLATES_URL}/${id}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw await failure(res)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }, [])

  return { templates, loading, error, refresh, find, share, remove }
}

export type TeamTemplates = ReturnType<typeof useTeamTemplates>
