import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { parseUrlParams, defaultForm, captureSnapshot } from '../utils/projectUtils'
import { BACKEND_SHARE_PARAM, MAX_BACKEND_SHARE_LENGTH, carriesMoreThanParams, encodeBackendShare, readBackendShare } from '../utils/backendShare'
import { readJson, readString, writeJson, writeString } from '../utils/storage'
import type { InitializrMetadata, ProjectFormValues, ProjectSnapshot, StarterTemplate, SqlByDep, SqlWizardEntry, OpenApiByDep, OpenApiWizardEntry, SoapByDep, SoapWizardEntry, EventsByDep, EventsWizardEntry } from '../types'

const PERSIST_DEBOUNCE_MS = 300

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
      // Kept only when set, like the drawer saves them.
      ...(value.clientKind === 'restClient' ? { clientKind: 'restClient' as const } : {}),
      ...(value.copySpec === true ? { copySpec: true } : {}),
      ...(value.apiStyle === 'interfaces' ? { apiStyle: 'interfaces' as const } : {}),
    }
  }
  return out
}

function normalizeEventsByDep(raw: unknown): EventsByDep {
  if (!raw || typeof raw !== 'object') return {}
  const out: EventsByDep = {}
  for (const [depId, value] of Object.entries(raw as Record<string, Partial<EventsWizardEntry>>)) {
    if (!value || typeof value !== 'object') continue
    out[depId] = {
      spec: value.spec ?? '',
      subPackage: value.subPackage ?? 'events',
      payloadSubPackage: value.payloadSubPackage ?? 'events.model',
      groupId: value.groupId ?? '',
      channels: Array.isArray(value.channels)
        ? value.channels
            .filter(c => c && typeof c.name === 'string')
            .map(c => ({ name: c.name, produce: c.produce === true, consume: c.consume === true }))
        : [],
      generateTests: value.generateTests === true,
    }
  }
  return out
}

function normalizeSoapByDep(raw: unknown): SoapByDep {
  if (!raw || typeof raw !== 'object') return {}
  const out: SoapByDep = {}
  for (const [depId, value] of Object.entries(raw as Record<string, Partial<SoapWizardEntry>>)) {
    if (!value || typeof value !== 'object') continue
    out[depId] = {
      wsdl: value.wsdl ?? '',
      endpointSubPackage: value.endpointSubPackage ?? 'endpoint',
      clientSubPackage: value.clientSubPackage ?? 'client',
      payloadSubPackage: value.payloadSubPackage ?? 'generated',
      mode: value.mode ?? 'ENDPOINTS',
      baseUrlProperty: value.baseUrlProperty ?? 'soap.client.base-url',
      contextPath: value.contextPath ?? '/ws',
    }
  }
  return out
}

function asStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
}

function asOptionsMap(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[k] = asStringArray(v)
  return out
}

/**
 * Everything the lazy initializers need, computed exactly once per mount.
 * Reading localStorage again later is unreliable because the persist effect
 * writes on mount — which is what previously made the "no saved form" branch
 * unreachable so server defaults were never applied.
 */
function readInitial() {
  const url = parseUrlParams()
  const hadStoredForm = readString('formValues') !== null
  // What the plain parameters cannot carry (modules, wizard documents), when the link has it.
  // The plain parameters still give the form, dependencies and options, so a link edited by hand
  // means what it says; a wizard entry is kept only for a dependency the link selects.
  const shared = url ? readBackendShare() : null
  const keep = <V,>(map: Record<string, V>): Record<string, V> =>
    Object.fromEntries(Object.entries(map).filter(([depId]) => url?.selected.includes(depId)))
  const extras = shared && url ? {
    multiModuleEnabled: shared.multiModuleEnabled,
    selectedModules: shared.selectedModules,
    sqlByDep: keep(shared.sqlByDep),
    openApiByDep: keep(shared.openApiByDep),
    soapByDep: keep(shared.soapByDep),
    eventsByDep: keep(shared.eventsByDep ?? {}),
  } : null
  return { url, hadStoredForm, extras }
}

export function useProjectState(metadata: InitializrMetadata | null, active: boolean = true) {
  const [init] = useState(readInitial)
  const { url, extras } = init

  const [form, setForm] = useState<ProjectFormValues>(() => {
    if (url) return { ...defaultForm(null), ...url.form }
    // Merge over defaults so a saved form from an older shape can't leave a field undefined.
    return { ...defaultForm(null), ...readJson<Partial<ProjectFormValues>>('formValues', {}) }
  })

  const [selected, setSelected] = useState<string[]>(() =>
    url ? url.selected : asStringArray(readJson<unknown>('selectedDeps', [])))

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>(() =>
    url ? url.selectedOptions : asOptionsMap(readJson<unknown>('selectedOptions', {})))

  const [initialized, setInitialized] = useState<boolean>(false)
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)

  // A shared link describes the whole project: never mix in this browser's
  // leftover wizard payloads / multi-module selection, which would silently
  // change what gets generated. What it has of them comes from its `bs`.
  const [multiModuleEnabled, setMultiModuleEnabled] = useState<boolean>(() =>
    url ? (extras?.multiModuleEnabled ?? false) : readString('multiModuleEnabled') === 'true')

  const [selectedModules, setSelectedModules] = useState<string[]>(() =>
    url ? (extras?.selectedModules ?? []) : asStringArray(readJson<unknown>('selectedModules', [])))

  const [sqlByDep, setSqlByDep] = useState<SqlByDep>(() =>
    url ? (extras?.sqlByDep ?? {}) : readJson<SqlByDep>('sqlByDep', {}))

  const [openApiByDep, setOpenApiByDep] = useState<OpenApiByDep>(() =>
    normalizeOpenApiByDep(url ? (extras?.openApiByDep ?? {}) : readJson<unknown>('openApiByDep', {})))

  const [soapByDep, setSoapByDep] = useState<SoapByDep>(() =>
    normalizeSoapByDep(url ? (extras?.soapByDep ?? {}) : readJson<unknown>('soapByDep', {})))

  const [eventsByDep, setEventsByDep] = useState<EventsByDep>(() =>
    normalizeEventsByDep(url ? (extras?.eventsByDep ?? {}) : readJson<unknown>('eventsByDep', {})))

  // Whether the link still carries everything: a setup whose wizard documents make it too long
  // keeps only the plain parameters, and the tab says so.
  const [shareStatus, setShareStatus] = useState<'written' | 'too-large'>('written')

  // Persist to localStorage — debounced so a keystroke doesn't trigger eight
  // synchronous JSON.stringify + setItem calls; flushed on unmount / page hide.
  const persistRef = useRef<() => void>(() => {})
  useEffect(() => {
    const write = () => {
      writeJson('formValues', form)
      writeJson('selectedDeps', selected)
      writeJson('selectedOptions', selectedOptions)
      writeString('multiModuleEnabled', String(multiModuleEnabled))
      writeJson('selectedModules', selectedModules)
      writeJson('sqlByDep', sqlByDep)
      writeJson('openApiByDep', openApiByDep)
      writeJson('soapByDep', soapByDep)
      writeJson('eventsByDep', eventsByDep)
    }
    persistRef.current = write
    const handle = setTimeout(write, PERSIST_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [form, selected, selectedOptions, multiModuleEnabled, selectedModules, sqlByDep, openApiByDep, soapByDep, eventsByDep])

  useEffect(() => {
    const flush = () => persistRef.current()
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  // Sync form state into the URL so the page is shareable (debounced like persistence).
  useEffect(() => {
    if (!active || !initialized) return
    const handle = setTimeout(() => {
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
      if (form.department) p.set('department', form.department)
      if (selected.length > 0) p.set('dependencies', selected.join(','))
      for (const [depId, optIds] of Object.entries(selectedOptions)) {
        if (optIds.length > 0 && selected.includes(depId)) {
          p.set(`opts-${depId}`, optIds.join(','))
        }
      }
      const snapshot = captureSnapshot({
        form, selected, selectedOptions, sqlByDep, openApiByDep, soapByDep, eventsByDep,
        multiModuleEnabled, selectedModules,
      })
      let status: 'written' | 'too-large' = 'written'
      if (carriesMoreThanParams(snapshot)) {
        const encoded = encodeBackendShare(snapshot)
        if (encoded.length > MAX_BACKEND_SHARE_LENGTH) status = 'too-large'
        else p.set(BACKEND_SHARE_PARAM, encoded)
      }
      setShareStatus(status)
      window.history.replaceState(null, '', '?' + p.toString())
    }, PERSIST_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [form, selected, selectedOptions, sqlByDep, openApiByDep, soapByDep, eventsByDep, multiModuleEnabled,
    selectedModules, initialized, active])

  // Apply server defaults on first metadata load (only if no saved form and no URL params)
  useEffect(() => {
    if (metadata && !initialized) {
      if (!init.hadStoredForm && !init.url) {
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
  }, [metadata, initialized, init])

  // Remove saved dependencies that no longer exist in the catalog
  const validIds = useMemo(() => {
    if (!metadata) return null
    return new Set(metadata.dependencies.values.flatMap(g => g.values.map(d => d.id)))
  }, [metadata])

  useEffect(() => {
    if (validIds && initialized && selected.length > 0) {
      const filtered = selected.filter(id => validIds.has(id))
      if (filtered.length !== selected.length) {
        setSelected(filtered)
      }
    }
  }, [validIds, initialized, selected])

  const handleFormChange = useCallback((updates: Partial<ProjectFormValues>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }, [])

  const handleDepsChange = useCallback((newSelected: string[]) => {
    const removed = selected.filter(id => !newSelected.includes(id))
    setSelected(newSelected)
    if (removed.length > 0) {
      const drop = <V,>(prev: Record<string, V>): Record<string, V> => {
        const next = { ...prev }
        for (const id of removed) delete next[id]
        return next
      }
      setSelectedOptions(drop)
      setSqlByDep(drop)
      setOpenApiByDep(drop)
      setSoapByDep(drop)
      setEventsByDep(drop)
    }
    setActiveTemplate(null)
  }, [selected])

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

  const handleSoapByDepChange = useCallback((depId: string, entry: SoapWizardEntry | null) => {
    setSoapByDep(prev => {
      const next = { ...prev }
      if (entry === null) delete next[depId]
      else next[depId] = entry
      return next
    })
  }, [])

  const handleEventsByDepChange = useCallback((depId: string, entry: EventsWizardEntry | null) => {
    setEventsByDep(prev => {
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
      setSoapByDep({})
      setEventsByDep({})
      return
    }
    setSqlByDep({})
    setOpenApiByDep({})
    setSoapByDep({})
    setEventsByDep({})
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
    setForm({ ...defaultForm(null), ...snapshot.form })
    setSelected([...snapshot.selected])
    setSelectedOptions(JSON.parse(JSON.stringify(snapshot.selectedOptions)))
    setSqlByDep(JSON.parse(JSON.stringify(snapshot.sqlByDep)))
    setOpenApiByDep(normalizeOpenApiByDep(JSON.parse(JSON.stringify(snapshot.openApiByDep ?? {}))))
    setSoapByDep(normalizeSoapByDep(JSON.parse(JSON.stringify(snapshot.soapByDep ?? {}))))
    setEventsByDep(normalizeEventsByDep(JSON.parse(JSON.stringify(snapshot.eventsByDep ?? {}))))
    setMultiModuleEnabled(snapshot.multiModuleEnabled)
    setSelectedModules([...snapshot.selectedModules])
    setActiveTemplate(null)
  }, [])

  const resetAll = useCallback(() => {
    setForm(defaultForm(metadata))
    setSelected([])
    setSelectedOptions({})
    setSqlByDep({})
    setOpenApiByDep({})
    setSoapByDep({})
    setEventsByDep({})
    setMultiModuleEnabled(false)
    setSelectedModules([])
    setActiveTemplate(null)
    window.history.replaceState(null, '', window.location.pathname)
  }, [metadata])

  return {
    form,
    selected,
    selectedOptions,
    sqlByDep,
    openApiByDep,
    soapByDep,
    eventsByDep,
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
    handleSoapByDepChange,
    handleEventsByDepChange,
    handleTemplateSelect,
    applySnapshot,
    resetAll,
    setActiveTemplate,
    shareStatus,
  }
}
