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
    fetch('/metadata/module-templates')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        setModules(data as ModuleTemplate[])
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return { modules, loading, error }
}
