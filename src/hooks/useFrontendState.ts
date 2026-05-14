import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FrontendMetadata } from './useFrontendMetadata'

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
  }
}

export function useFrontendState(metadata: FrontendMetadata | null) {
  const [state, setState] = useState<FeState>(() => {
    const stored = readStored()
    const base = defaultState(metadata)
    return { ...base, ...stored, form: { ...base.form, ...(stored?.form ?? {}) } }
  })

  // Apply server defaults once metadata loads, but only for fields the user hasn't touched.
  useEffect(() => {
    if (!metadata) return
    setState(prev => {
      const stored = readStored()
      if (stored) return prev
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

  const updateForm = useCallback((patch: Partial<FeForm>) => {
    setState(s => ({ ...s, form: { ...s.form, ...patch } }))
  }, [])

  const setReactVersion = useCallback((v: string) => setState(s => ({ ...s, reactVersion: v })), [])
  const setNodeVersion = useCallback((v: string) => setState(s => ({ ...s, nodeVersion: v })), [])
  const setPackageManager = useCallback((v: string) => setState(s => ({ ...s, packageManager: v })), [])
  const setBasePath = useCallback((v: string) => setState(s => ({ ...s, basePath: v || '/' })), [])

  const toggleDep = useCallback((depId: string) => {
    setState(s => {
      const has = s.selectedDeps.includes(depId)
      const selectedDeps = has ? s.selectedDeps.filter(d => d !== depId) : [...s.selectedDeps, depId]
      const selectedOptions = { ...s.selectedOptions }
      if (has) delete selectedOptions[depId]
      return { ...s, selectedDeps, selectedOptions }
    })
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

  const reset = useCallback(() => setState(defaultState(metadata)), [metadata])

  const downloadUrl = useMemo(() => buildDownloadUrl(state), [state])

  return {
    state,
    updateForm,
    setReactVersion,
    setNodeVersion,
    setPackageManager,
    setBasePath,
    toggleDep,
    toggleOption,
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
  if (s.selectedDeps.length) qp.set('dependencies', s.selectedDeps.join(','))
  for (const [depId, opts] of Object.entries(s.selectedOptions)) {
    if (opts.length) qp.set(`opts-${depId}`, opts.join(','))
  }
  return qp.toString()
}

export function buildDownloadUrl(s: FeState): string {
  return `/frontend/starter.zip?${buildFrontendQuery(s)}`
}
