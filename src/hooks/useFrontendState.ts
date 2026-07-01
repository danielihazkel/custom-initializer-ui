import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FrontendMetadata } from './useFrontendMetadata'
import type { StarterTemplate } from '../types'

export interface FeForm {
  projectName: string
  description: string
  scope: string
  appTitle: string
}

export interface FeState {
  form: FeForm
  reactVersion: string
  nodeVersion: string
  packageManager: string
  basePath: string
  selectedDeps: string[]
  selectedOptions: Record<string, string[]>
  designSystem: string
  colorPaletteId: string
  apiBaseUrl: string
  backendArtifactId: string
  rtl: boolean
}

export const DESIGN_NONE = 'design-none'

function deriveDesignSystem(deps: string[]): string {
  return deps.find(d => d.startsWith('design-')) ?? DESIGN_NONE
}

const STORAGE_KEY = 'frontendInitializrState'

function readStored(): Partial<FeState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<FeState>) : null
  } catch {
    return null
  }
}

function defaultState(metadata: FrontendMetadata | null): FeState {
  const d = metadata?.defaults
  const defaultPalette = metadata?.colorPalettes?.find(p => p.isDefault)?.id
    ?? metadata?.colorPalettes?.[0]?.id
    ?? ''
  return {
    form: {
      projectName: d?.projectName ?? 'demo',
      description: d?.description ?? '',
      scope: d?.scope ?? '',
      appTitle: d?.appTitle ?? 'Demo',
    },
    reactVersion: d?.reactVersion ?? '18',
    nodeVersion: d?.nodeVersion ?? '20',
    packageManager: d?.packageManager ?? 'pnpm',
    basePath: '/',
    selectedDeps: [],
    selectedOptions: {},
    designSystem: DESIGN_NONE,
    colorPaletteId: defaultPalette,
    apiBaseUrl: '',
    backendArtifactId: '',
    rtl: false,
  }
}

export function useFrontendState(metadata: FrontendMetadata | null, active: boolean = true) {
  const [state, setState] = useState<FeState>(() => {
    const stored = readStored()
    const fromUrl = parseFrontendUrl()
    const base = defaultState(metadata)
    const merged: FeState = {
      ...base,
      ...stored,
      ...fromUrl,
      form: { ...base.form, ...(stored?.form ?? {}), ...(fromUrl?.form ?? {}) },
    }
    // Always re-derive designSystem from selectedDeps so the picker stays in sync
    // with the source of truth even after older state shapes are loaded.
    merged.designSystem = deriveDesignSystem(merged.selectedDeps)
    return merged
  })

  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)

  // Apply server defaults once metadata loads, but only for fields the user hasn't touched.
  useEffect(() => {
    if (!metadata) return
    setState(prev => {
      const stored = readStored()
      const fromUrl = parseFrontendUrl()
      if (stored || fromUrl) return prev
      return defaultState(metadata)
    })
  }, [metadata])

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* quota — ignore */
    }
  }, [state])

  // Sync state into the URL so the Frontend tab is shareable.
  useEffect(() => {
    if (!active) return
    window.history.replaceState(null, '', '?tab=frontend&' + buildFrontendQuery(state))
  }, [state, active])

  const updateForm = useCallback((patch: Partial<FeForm>) => {
    setState(s => ({ ...s, form: { ...s.form, ...patch } }))
  }, [])

  const setReactVersion = useCallback((v: string) => setState(s => ({ ...s, reactVersion: v })), [])
  const setNodeVersion = useCallback((v: string) => setState(s => ({ ...s, nodeVersion: v })), [])
  const setPackageManager = useCallback((v: string) => setState(s => ({ ...s, packageManager: v })), [])
  const setBasePath = useCallback((v: string) => setState(s => ({ ...s, basePath: v || '/' })), [])
  const setColorPaletteId = useCallback((v: string) => setState(s => ({ ...s, colorPaletteId: v })), [])
  const setApiBaseUrl = useCallback((v: string) => setState(s => ({ ...s, apiBaseUrl: v })), [])
  const setBackendArtifactId = useCallback((v: string) => setState(s => ({ ...s, backendArtifactId: v })), [])
  const setRtl = useCallback((v: boolean) => setState(s => ({ ...s, rtl: v })), [])

  const toggleDep = useCallback((depId: string) => {
    setActiveTemplate(null)
    setState(s => {
      const has = s.selectedDeps.includes(depId)
      const selectedDeps = has ? s.selectedDeps.filter(d => d !== depId) : [...s.selectedDeps, depId]
      const selectedOptions = { ...s.selectedOptions }
      if (has) delete selectedOptions[depId]
      return { ...s, selectedDeps, selectedOptions, designSystem: deriveDesignSystem(selectedDeps) }
    })
  }, [])

  const setDesignSystem = useCallback((id: string) => {
    setActiveTemplate(null)
    setState(s => {
      let deps = s.selectedDeps.filter(d => !d.startsWith('design-'))
      if (id !== DESIGN_NONE) deps = [...deps, id]
      return { ...s, selectedDeps: deps, designSystem: id }
    })
  }, [])

  const applyTemplate = useCallback((tpl: StarterTemplate | null) => {
    if (!tpl) {
      setActiveTemplate(null)
      setState(s => ({ ...s, selectedDeps: [], selectedOptions: {}, designSystem: DESIGN_NONE }))
      return
    }
    const selectedDeps = tpl.dependencies.map(d => d.depId)
    const selectedOptions: Record<string, string[]> = {}
    for (const d of tpl.dependencies) {
      if (d.subOptions && d.subOptions.length) selectedOptions[d.depId] = [...d.subOptions]
    }
    setActiveTemplate(tpl.id)
    setState(s => ({ ...s, selectedDeps, selectedOptions, designSystem: deriveDesignSystem(selectedDeps) }))
  }, [])

  const loadSnapshot = useCallback((snap: FeState) => {
    setActiveTemplate(null)
    setState(snap)
  }, [])

  const toggleOption = useCallback((depId: string, optionId: string) => {
    setState(s => {
      const current = s.selectedOptions[depId] ?? []
      const has = current.includes(optionId)
      const next = has ? current.filter(o => o !== optionId) : [...current, optionId]
      const selectedOptions = { ...s.selectedOptions }
      if (next.length === 0) delete selectedOptions[depId]
      else selectedOptions[depId] = next
      return { ...s, selectedOptions }
    })
  }, [])

  const reset = useCallback(() => {
    setActiveTemplate(null)
    setState(defaultState(metadata))
    window.history.replaceState(null, '', window.location.pathname)
  }, [metadata])

  const downloadUrl = useMemo(() => buildDownloadUrl(state), [state])

  return {
    state,
    activeTemplate,
    updateForm,
    setReactVersion,
    setNodeVersion,
    setPackageManager,
    setBasePath,
    setColorPaletteId,
    setApiBaseUrl,
    setBackendArtifactId,
    setRtl,
    toggleDep,
    toggleOption,
    setDesignSystem,
    applyTemplate,
    loadSnapshot,
    reset,
    downloadUrl,
  }
}

export function buildFrontendQuery(s: FeState): string {
  const qp = new URLSearchParams()
  qp.set('projectName', s.form.projectName)
  if (s.form.description) qp.set('description', s.form.description)
  if (s.form.scope) qp.set('scope', s.form.scope)
  if (s.form.appTitle) qp.set('appTitle', s.form.appTitle)
  qp.set('reactVersion', s.reactVersion)
  qp.set('nodeVersion', s.nodeVersion)
  qp.set('packageManager', s.packageManager)
  if (s.basePath && s.basePath !== '/') qp.set('basePath', s.basePath)
  if (s.colorPaletteId) qp.set('colorPalette', s.colorPaletteId)
  if (s.apiBaseUrl) qp.set('apiBaseUrl', s.apiBaseUrl)
  if (s.backendArtifactId) qp.set('backendArtifactId', s.backendArtifactId)
  if (s.rtl) qp.set('rtl', 'true')
  if (s.selectedDeps.length) qp.set('dependencies', s.selectedDeps.join(','))
  for (const [depId, opts] of Object.entries(s.selectedOptions)) {
    if (opts.length) qp.set(`opts-${depId}`, opts.join(','))
  }
  return qp.toString()
}

export function buildDownloadUrl(s: FeState): string {
  return `/frontend/starter.zip?${buildFrontendQuery(s)}`
}

export function parseFrontendUrl(): Partial<FeState> | null {
  const p = new URLSearchParams(window.location.search)
  if (p.get('tab') !== 'frontend') return null

  const form: Partial<FeForm> = {}
  for (const key of ['projectName', 'description', 'scope', 'appTitle'] as const) {
    const v = p.get(key)
    if (v !== null) form[key] = v
  }

  const out: Partial<FeState> = {}
  if (Object.keys(form).length > 0) out.form = form as FeForm
  const reactVersion = p.get('reactVersion'); if (reactVersion) out.reactVersion = reactVersion
  const nodeVersion = p.get('nodeVersion'); if (nodeVersion) out.nodeVersion = nodeVersion
  const packageManager = p.get('packageManager'); if (packageManager) out.packageManager = packageManager
  const basePath = p.get('basePath'); if (basePath) out.basePath = basePath
  const colorPalette = p.get('colorPalette'); if (colorPalette) out.colorPaletteId = colorPalette
  const apiBaseUrl = p.get('apiBaseUrl'); if (apiBaseUrl !== null) out.apiBaseUrl = apiBaseUrl
  const backendArtifactId = p.get('backendArtifactId'); if (backendArtifactId !== null) out.backendArtifactId = backendArtifactId
  const rtl = p.get('rtl'); if (rtl !== null) out.rtl = rtl === 'true'

  const deps = p.get('dependencies')
  if (deps !== null) {
    const selectedDeps = deps.split(',').filter(Boolean)
    out.selectedDeps = selectedDeps
    out.designSystem = deriveDesignSystem(selectedDeps)
  }

  const selectedOptions: Record<string, string[]> = {}
  for (const [k, v] of p.entries()) {
    if (k.startsWith('opts-')) {
      selectedOptions[k.slice(5)] = v.split(',').filter(Boolean)
    }
  }
  if (Object.keys(selectedOptions).length > 0) out.selectedOptions = selectedOptions

  return out
}
