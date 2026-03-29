import { useState, useCallback } from 'react'
import type { PreviewResponse, ProjectFormValues } from '../types'

export function useProjectPreview() {
  const [preview, setPreview]   = useState<PreviewResponse | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState<string | null>(null)

  const fetchPreview = useCallback(async (
    form: ProjectFormValues,
    selected: string[],
    selectedOptions: Record<string, string[]>,
    multiModule?: { enabled: boolean; modules: string[] }
  ) => {
    setLoading(true)
    setError(null)
    try {
      const isMultiModule = multiModule?.enabled && multiModule.modules.length > 0
      const url = new URL(
        isMultiModule ? '/starter-multimodule.preview' : '/starter.preview',
        window.location.origin
      )
      url.searchParams.set('type',        form.type)
      url.searchParams.set('language',    form.language)
      url.searchParams.set('bootVersion', form.bootVersion)
      url.searchParams.set('groupId',     form.groupId)
      url.searchParams.set('artifactId',  form.artifactId)
      url.searchParams.set('name',        form.name)
      url.searchParams.set('description', form.description)
      url.searchParams.set('packageName', form.packageName)
      url.searchParams.set('packaging',   form.packaging)
      url.searchParams.set('javaVersion', form.javaVersion)
      if (isMultiModule) {
        url.searchParams.set('modules', multiModule!.modules.join(','))
      }
      if (selected.length > 0) {
        url.searchParams.set('dependencies', selected.join(','))
      }
      for (const [depId, optIds] of Object.entries(selectedOptions)) {
        if (optIds.length > 0 && selected.includes(depId)) {
          url.searchParams.set(`opts-${depId}`, optIds.join(','))
        }
      }
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPreview(await res.json() as PreviewResponse)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const clearPreview = useCallback(() => {
    setPreview(null)
    setError(null)
  }, [])

  return { preview, loading, error, fetchPreview, clearPreview }
}
