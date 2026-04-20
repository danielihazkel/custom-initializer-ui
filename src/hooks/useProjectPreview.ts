import { useState, useCallback, useRef } from 'react'
import type { PreviewResponse, ProjectFormValues, SqlByDep, OpenApiByDep } from '../types'

export function useProjectPreview() {
  const [preview,         setPreview]         = useState<PreviewResponse | null>(null)
  const [previousPreview, setPreviousPreview] = useState<PreviewResponse | null>(null)
  const previewRef = useRef<PreviewResponse | null>(null)
  const [loading, setLoading]                 = useState(false)
  const [error,   setError]                   = useState<string | null>(null)

  const fetchPreview = useCallback(async (
    form: ProjectFormValues,
    selected: string[],
    selectedOptions: Record<string, string[]>,
    multiModule?: { enabled: boolean; modules: string[] },
    sqlByDep?: SqlByDep,
    openApiByDep?: OpenApiByDep,
  ) => {
    setLoading(true)
    setError(null)
    try {
      const activeOpenApi = openApiByDep
        ? Object.fromEntries(Object.entries(openApiByDep).filter(([id]) => selected.includes(id)))
        : {}
      const hasOpenApi = Object.keys(activeOpenApi).length > 0

      const activeSql = sqlByDep
        ? Object.fromEntries(Object.entries(sqlByDep).filter(([id]) => selected.includes(id)))
        : {}
      const hasSql = Object.keys(activeSql).length > 0

      let data: PreviewResponse
      if (hasOpenApi) {
        const opts: Record<string, string[]> = {}
        for (const [depId, optIds] of Object.entries(selectedOptions)) {
          if (optIds.length > 0 && selected.includes(depId)) opts[depId] = optIds
        }
        const specByDep: Record<string, string> = {}
        const openApiOptionsBody: Record<string, {
          apiSubPackage: string
          dtoSubPackage: string
          clientSubPackage: string
          mode: string
          baseUrlProperty: string
        }> = {}
        for (const [depId, entry] of Object.entries(activeOpenApi)) {
          specByDep[depId] = entry.spec
          openApiOptionsBody[depId] = {
            apiSubPackage: entry.apiSubPackage,
            dtoSubPackage: entry.dtoSubPackage,
            clientSubPackage: entry.clientSubPackage,
            mode: entry.mode,
            baseUrlProperty: entry.baseUrlProperty,
          }
        }
        const body = {
          groupId: form.groupId,
          artifactId: form.artifactId,
          name: form.name,
          description: form.description,
          packageName: form.packageName,
          type: form.type,
          language: form.language,
          bootVersion: form.bootVersion,
          packaging: form.packaging,
          javaVersion: form.javaVersion,
          dependencies: selected,
          opts,
          specByDep,
          openApiOptions: openApiOptionsBody,
        }
        const res = await fetch('/starter-openapi.preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        data = await res.json() as PreviewResponse
      } else if (hasSql) {
        const opts: Record<string, string[]> = {}
        for (const [depId, optIds] of Object.entries(selectedOptions)) {
          if (optIds.length > 0 && selected.includes(depId)) opts[depId] = optIds
        }
        const sqlByDepBody: Record<string, string> = {}
        const sqlOptionsBody: Record<string, { subPackage: string; tables: { name: string; generateRepository: boolean }[] }> = {}
        for (const [depId, entry] of Object.entries(activeSql)) {
          sqlByDepBody[depId] = entry.sql
          sqlOptionsBody[depId] = {
            subPackage: entry.subPackage,
            tables: entry.tables.map(t => ({ name: t.name, generateRepository: t.generateRepository })),
          }
        }
        const body = {
          groupId: form.groupId,
          artifactId: form.artifactId,
          name: form.name,
          description: form.description,
          packageName: form.packageName,
          type: form.type,
          language: form.language,
          bootVersion: form.bootVersion,
          packaging: form.packaging,
          javaVersion: form.javaVersion,
          dependencies: selected,
          opts,
          sqlByDep: sqlByDepBody,
          sqlOptions: sqlOptionsBody,
        }
        const res = await fetch('/starter-sql.preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        data = await res.json() as PreviewResponse
      } else {
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
        data = await res.json() as PreviewResponse
      }
      setPreviousPreview(previewRef.current)
      previewRef.current = data
      setPreview(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const clearPreview = useCallback(() => {
    setPreview(null)
    setError(null)
    // previousPreview is intentionally kept so the next fetch can diff against it
  }, [])

  return { preview, previousPreview, loading, error, fetchPreview, clearPreview }
}
