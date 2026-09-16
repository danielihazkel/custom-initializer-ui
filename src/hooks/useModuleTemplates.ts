import { useState, useEffect } from 'react'
import type { ModuleTemplate } from '../types'

export interface UseModuleTemplatesResult {
  modules: ModuleTemplate[]
  loading: boolean
  error: string | null
}

export function useModuleTemplates(): UseModuleTemplatesResult {
  const [modules, setModules] = useState<ModuleTemplate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/metadata/module-templates')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setModules(data as ModuleTemplate[])
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { modules, loading, error }
}
