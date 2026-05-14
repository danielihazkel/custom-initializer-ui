import { useState, useEffect } from 'react'
import type { StarterTemplate } from '../types'

export interface UseStarterTemplatesResult {
  templates: StarterTemplate[]
  loading: boolean
  error: string | null
}

export type ProjectKind = 'BACKEND' | 'FRONTEND'

export function useStarterTemplates(projectKind?: ProjectKind): UseStarterTemplatesResult {
  const [templates, setTemplates] = useState<StarterTemplate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = projectKind
      ? `/metadata/starter-templates?projectKind=${projectKind}`
      : '/metadata/starter-templates'
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        setTemplates(data as StarterTemplate[])
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [projectKind])

  return { templates, loading, error }
}
