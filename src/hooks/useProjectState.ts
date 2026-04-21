import { useState, useEffect, useCallback } from 'react'
import { parseUrlParams, defaultForm } from '../utils/projectUtils'
import type { InitializrMetadata, ProjectFormValues, ProjectSnapshot, StarterTemplate, SqlByDep, SqlWizardEntry, OpenApiByDep, OpenApiWizardEntry } from '../types'

export const STORAGE_KEYS = {
  FORM_VALUES: 'formValues',
  SELECTED_DEPS: 'selectedDeps',
  SELECTED_OPTIONS: 'selectedOptions',
  MULTI_MODULE: 'multiModuleEnabled',
  SELECTED_MODULES: 'selectedModules',
  SQL_BY_DEP: 'sqlByDep',
  OPENAPI_BY_DEP: 'openApiByDep',
} as const

function normalizeOpenApiByDep(raw: unknown): OpenApiByDep {
  if (!raw || typeof raw !== 'object') return {}
  const out: OpenApiByDep = {}
  for (const [depId, value] of Object.entries(raw as Record<string, Partial<OpenApiWizardEntry>>)) {
    if (!value || typeof value !== 'object') continue
    out[depId] = {
      spec: value.spec ?? '',
      apiSubPackage: value.apiSubPackage ?? 'api',
      dtoSubPackage: value.dtoSubPackage ?? 'dto',
      clientSubPackage: value.clientSubPackage ?? 'client',
      mode: value.mode ?? 'CONTROLLERS',
      baseUrlProperty: value.baseUrlProperty ?? 'openapi.client.base-url',
    }
  }
  return out
}

export function useProjectState(metadata: InitializrMetadata | null) {
  const [initialUrlParams] = useState(() => parseUrlParams())

  const [form, setForm] = useState<ProjectFormValues>(() => {
    if (initialUrlParams) return { ...defaultForm(null), ...initialUrlParams.form }
    const saved = localStorage.getItem(STORAGE_KEYS.FORM_VALUES)
    return saved ? JSON.parse(saved) : defaultForm(null)
  })

  const [selected, setSelected] = useState<string[]>(() => {
    if (initialUrlParams) return initialUrlParams.selected
    const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_DEPS)
    return saved ? JSON.parse(saved) : []
  })

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>(() => {
    if (initialUrlParams) return initialUrlParams.selectedOptions
    const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_OPTIONS)
    return saved ? JSON.parse(saved) : {}
  })

  const [initialized, setInitialized] = useState<boolean>(false)
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)

  const [multiModuleEnabled, setMultiModuleEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MULTI_MODULE)
    return saved === 'true'
  })

  const [selectedModules, setSelectedModules] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_MODULES)
    return saved ? JSON.parse(saved) : []
  })

  const [sqlByDep, setSqlByDep] = useState<SqlByDep>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SQL_BY_DEP)
    return saved ? JSON.parse(saved) : {}
  })

  const [openApiByDep, setOpenApiByDep] = useState<OpenApiByDep>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.OPENAPI_BY_DEP)
    return saved ? normalizeOpenApiByDep(JSON.parse(saved)) : {}
  })

  // Persist form state to localStorage
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.FORM_VALUES, JSON.stringify(form)) }, [form])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SELECTED_DEPS, JSON.stringify(selected)) }, [selected])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SELECTED_OPTIONS, JSON.stringify(selectedOptions)) }, [selectedOptions])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.MULTI_MODULE, String(multiModuleEnabled)) }, [multiModuleEnabled])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SELECTED_MODULES, JSON.stringify(selectedModules)) }, [selectedModules])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SQL_BY_DEP, JSON.stringify(sqlByDep)) }, [sqlByDep])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.OPENAPI_BY_DEP, JSON.stringify(openApiByDep)) }, [openApiByDep])

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
      if (!localStorage.getItem(STORAGE_KEYS.FORM_VALUES) && !hasUrl) {
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
        setSqlByDep(prev => {
          const next = { ...prev }
          for (const id of removed) delete next[id]
          return next
        })
        setOpenApiByDep(prev => {
          const next = { ...prev }
          for (const id of removed) delete next[id]
          return next
        })
      }
      return newSelected
    })
    setActiveTemplate(null)
  }, [])

  const handleSqlByDepChange = useCallback((depId: string, entry: SqlWizardEntry | null) => {
    setSqlByDep(prev => {
      const next = { ...prev }
      if (entry === null) delete next[depId]
      else next[depId] = entry
      return next
    })
  }, [])

  const handleOpenApiByDepChange = useCallback((depId: string, entry: OpenApiWizardEntry | null) => {
    setOpenApiByDep(prev => {
      const next = { ...prev }
      if (entry === null) delete next[depId]
      else next[depId] = entry
      return next
    })
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
      setSqlByDep({})
      setOpenApiByDep({})
      return
    }
    setSqlByDep({})
    setOpenApiByDep({})
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

  const applySnapshot = useCallback((snapshot: ProjectSnapshot) => {
    setForm(structuredClone(snapshot.form))
    setSelected(structuredClone(snapshot.selected))
    setSelectedOptions(structuredClone(snapshot.selectedOptions))
    setSqlByDep(structuredClone(snapshot.sqlByDep))
    setOpenApiByDep(normalizeOpenApiByDep(structuredClone(snapshot.openApiByDep ?? {})))
    setMultiModuleEnabled(snapshot.multiModuleEnabled)
    setSelectedModules(structuredClone(snapshot.selectedModules))
    setActiveTemplate(null)
  }, [])

  return {
    form,
    selected,
    selectedOptions,
    sqlByDep,
    openApiByDep,
    multiModuleEnabled,
    selectedModules,
    activeTemplate,
    setMultiModuleEnabled,
    setSelectedModules,
    handleFormChange,
    handleDepsChange,
    handleOptionsChange,
    handleSqlByDepChange,
    handleOpenApiByDepChange,
    handleTemplateSelect,
    applySnapshot,
    setActiveTemplate,
  }
}
