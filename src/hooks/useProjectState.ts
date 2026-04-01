import { useState, useEffect, useCallback } from 'react'
import { parseUrlParams, defaultForm } from '../utils/projectUtils'
import type { InitializrMetadata, ProjectFormValues, StarterTemplate } from '../types'

export function useProjectState(metadata: InitializrMetadata | null) {
  const [form, setForm] = useState<ProjectFormValues>(() => {
    const url = parseUrlParams()
    if (url) return { ...defaultForm(null), ...url.form }
    const saved = localStorage.getItem('formValues')
    return saved ? JSON.parse(saved) : defaultForm(null)
  })

  const [selected, setSelected] = useState<string[]>(() => {
    const url = parseUrlParams()
    if (url) return url.selected
    const saved = localStorage.getItem('selectedDeps')
    return saved ? JSON.parse(saved) : []
  })

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>(() => {
    const url = parseUrlParams()
    if (url) return url.selectedOptions
    const saved = localStorage.getItem('selectedOptions')
    return saved ? JSON.parse(saved) : {}
  })

  const [initialized, setInitialized] = useState<boolean>(false)
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)

  const [multiModuleEnabled, setMultiModuleEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('multiModuleEnabled')
    return saved === 'true'
  })

  const [selectedModules, setSelectedModules] = useState<string[]>(() => {
    const saved = localStorage.getItem('selectedModules')
    return saved ? JSON.parse(saved) : []
  })

  // Persist form state to localStorage
  useEffect(() => { localStorage.setItem('formValues', JSON.stringify(form)) }, [form])
  useEffect(() => { localStorage.setItem('selectedDeps', JSON.stringify(selected)) }, [selected])
  useEffect(() => { localStorage.setItem('selectedOptions', JSON.stringify(selectedOptions)) }, [selectedOptions])
  useEffect(() => { localStorage.setItem('multiModuleEnabled', String(multiModuleEnabled)) }, [multiModuleEnabled])
  useEffect(() => { localStorage.setItem('selectedModules', JSON.stringify(selectedModules)) }, [selectedModules])

  // Sync form state into the URL so the page is shareable
  useEffect(() => {
    if (!initialized) return
    const p = new URLSearchParams()
    p.set('groupId', form.groupId)
    p.set('artifactId', form.artifactId)
    p.set('name', form.name)
    p.set('description', form.description)
    p.set('packageName', form.packageName)
    p.set('bootVersion', form.bootVersion)
    p.set('language', form.language)
    p.set('type', form.type)
    p.set('packaging', form.packaging)
    p.set('javaVersion', form.javaVersion)
    if (selected.length > 0) p.set('dependencies', selected.join(','))
    for (const [depId, optIds] of Object.entries(selectedOptions)) {
      if (optIds.length > 0 && selected.includes(depId)) {
        p.set(`opts-${depId}`, optIds.join(','))
      }
    }
    window.history.replaceState(null, '', '?' + p.toString())
  }, [form, selected, selectedOptions, initialized])

  // Apply server defaults on first metadata load (only if no saved form and no URL params)
  useEffect(() => {
    if (metadata && !initialized) {
      const p = new URLSearchParams(window.location.search)
      const hasUrl = p.has('groupId') || p.has('dependencies')
      if (!localStorage.getItem('formValues') && !hasUrl) {
        setForm(defaultForm(metadata))
      } else {
        setForm(prev => ({
          ...prev,
          bootVersion: prev.bootVersion || metadata.bootVersion?.default || '',
          javaVersion: prev.javaVersion || metadata.javaVersion?.default || '21',
        }))
      }
      setInitialized(true)
    }
  }, [metadata, initialized])

  // Remove saved dependencies that no longer exist in the catalog
  useEffect(() => {
    if (metadata && initialized && selected.length > 0) {
      const validIds = new Set(
        metadata.dependencies.values.flatMap(g => g.values.map(d => d.id))
      )
      const filtered = selected.filter(id => validIds.has(id))
      if (filtered.length !== selected.length) {
        setSelected(filtered)
      }
    }
  }, [metadata, initialized, selected])

  const handleFormChange = useCallback((updates: Partial<ProjectFormValues>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }, [])

  const handleDepsChange = useCallback((newSelected: string[]) => {
    setSelected(prevSelected => {
      const removed = prevSelected.filter(id => !newSelected.includes(id))
      if (removed.length > 0) {
        setSelectedOptions(prev => {
          const next = { ...prev }
          for (const id of removed) delete next[id]
          return next
        })
      }
      return newSelected
    })
    setActiveTemplate(null)
  }, [])

  const handleOptionsChange = useCallback((depId: string, optIds: string[]) => {
    setSelectedOptions(prev => ({ ...prev, [depId]: optIds }))
    setActiveTemplate(null)
  }, [])

  const handleTemplateSelect = useCallback((template: StarterTemplate | null) => {
    if (!template) {
      setActiveTemplate(null)
      setSelected([])
      setSelectedOptions({})
      return
    }
    setActiveTemplate(template.id)
    setSelected(template.dependencies.map(d => d.depId))
    const opts: Record<string, string[]> = {}
    for (const dep of template.dependencies) {
      if (dep.subOptions.length > 0) {
        opts[dep.depId] = dep.subOptions
      }
    }
    setSelectedOptions(opts)
    const formUpdates: Partial<ProjectFormValues> = {}
    if (template.bootVersion) formUpdates.bootVersion = template.bootVersion
    if (template.javaVersion) formUpdates.javaVersion = template.javaVersion
    if (template.packaging) formUpdates.packaging = template.packaging
    if (Object.keys(formUpdates).length > 0) {
      setForm(prev => ({ ...prev, ...formUpdates }))
    }
  }, [])

  return {
    form,
    selected,
    selectedOptions,
    multiModuleEnabled,
    selectedModules,
    activeTemplate,
    setMultiModuleEnabled,
    setSelectedModules,
    handleFormChange,
    handleDepsChange,
    handleOptionsChange,
    handleTemplateSelect,
    setActiveTemplate,
  }
}
