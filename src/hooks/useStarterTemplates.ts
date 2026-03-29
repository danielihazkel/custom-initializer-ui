import { useState, useEffect } from 'react'
import type { StarterTemplate } from '../types'

export interface UseStarterTemplatesResult {
  templates: StarterTemplate[]
  loading: boolean
  error: string | null
}

export function useStarterTemplates(): UseStarterTemplatesResult {
  const [templates, setTemplates] = useState<StarterTemplate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/metadata/starter-templates')
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
  }, [])

  return { templates, loading, error }
}
