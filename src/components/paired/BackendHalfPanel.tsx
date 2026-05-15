import { useCallback, useEffect, useState } from 'react'
import { useMetadata } from '../../hooks/useMetadata'
import { useExtensions } from '../../hooks/useExtensions'
import { useSqlDialects } from '../../hooks/useSqlDialects'
import { useOpenApiCapable } from '../../hooks/useOpenApiCapable'
import { useSoapCapable } from '../../hooks/useSoapCapable'
import { useCompatibility } from '../../hooks/useCompatibility'
import { OptionsPanel } from '../OptionsPanel'
import { ProjectForm } from '../ProjectForm'
import { DependencySelector } from '../DependencySelector'
import { defaultForm } from '../../utils/projectUtils'
import type {
  InitializrMetadata,
  ProjectFormValues,
  SqlByDep,
  OpenApiByDep,
  SoapByDep,
  SqlWizardEntry,
  OpenApiWizardEntry,
  SoapWizardEntry,
} from '../../types'

export interface BackendHalfState {
  form: ProjectFormValues
  selectedDeps: string[]
  selectedOptions: Record<string, string[]>
  sqlByDep: SqlByDep
  openApiByDep: OpenApiByDep
  soapByDep: SoapByDep
}

interface Props {
  onChange: (state: BackendHalfState) => void
  onMetadataLoaded?: (metadata: InitializrMetadata) => void
}

const INITIAL: BackendHalfState = {
  form: { ...defaultForm(null), artifactId: 'demo-api', name: 'demo-api', packageName: 'com.menora.demo' },
  selectedDeps: ['web'],
  selectedOptions: {},
  sqlByDep: {},
  openApiByDep: {},
  soapByDep: {},
}

/**
 * Self-contained Backend half of the Paired generator. Owns its own state
 * (kept in memory — paired state is not persisted to localStorage to avoid
 * colliding with the dedicated Backend tab's saved selections).
 *
 * Reuses the dedicated tab's view components (`OptionsPanel`, `ProjectForm`,
 * `DependencySelector`) verbatim, so feature parity comes for free — search,
 * compatibility banners, sub-options, SQL/OpenAPI/SOAP wizards, etc.
 */
export function BackendHalfPanel({ onChange, onMetadataLoaded }: Props) {
  const { metadata, loading, error } = useMetadata()
  const { extensions } = useExtensions()
  const { dialects: sqlDialects } = useSqlDialects()
  const { depIds: openApiCapableDeps } = useOpenApiCapable()
  const { depIds: soapCapableDeps } = useSoapCapable()
  const { rules: compatibilityRules } = useCompatibility('BACKEND')

  const [state, setState] = useState<BackendHalfState>(INITIAL)
  const [initialized, setInitialized] = useState(false)

  // Apply server defaults once metadata loads.
  useEffect(() => {
    if (!metadata || initialized) return
    setState(s => ({
      ...s,
      form: {
        ...defaultForm(metadata),
        artifactId: s.form.artifactId || 'demo-api',
        name: s.form.name || 'demo-api',
        packageName: s.form.packageName || 'com.menora.demo',
      },
    }))
    setInitialized(true)
    onMetadataLoaded?.(metadata)
  }, [metadata, initialized, onMetadataLoaded])

  // Drop stale dep selections after metadata changes.
  useEffect(() => {
    if (!metadata || state.selectedDeps.length === 0) return
    const valid = new Set(metadata.dependencies.values.flatMap(g => g.values.map(d => d.id)))
    const filtered = state.selectedDeps.filter(id => valid.has(id))
    if (filtered.length !== state.selectedDeps.length) {
      setState(s => ({ ...s, selectedDeps: filtered }))
    }
  }, [metadata, state.selectedDeps])

  // Report state up.
  useEffect(() => {
    onChange(state)
  }, [state, onChange])

  const handleFormChange = useCallback((updates: Partial<ProjectFormValues>) => {
    setState(s => ({ ...s, form: { ...s.form, ...updates } }))
  }, [])

  const handleDepsChange = useCallback((newSelected: string[]) => {
    setState(s => {
      const removed = s.selectedDeps.filter(id => !newSelected.includes(id))
      if (removed.length === 0) return { ...s, selectedDeps: newSelected }
      const selectedOptions = { ...s.selectedOptions }
      const sqlByDep = { ...s.sqlByDep }
      const openApiByDep = { ...s.openApiByDep }
      const soapByDep = { ...s.soapByDep }
      for (const id of removed) {
        delete selectedOptions[id]
        delete sqlByDep[id]
        delete openApiByDep[id]
        delete soapByDep[id]
      }
      return { ...s, selectedDeps: newSelected, selectedOptions, sqlByDep, openApiByDep, soapByDep }
    })
  }, [])

  const handleOptionsChange = useCallback((depId: string, optIds: string[]) => {
    setState(s => ({ ...s, selectedOptions: { ...s.selectedOptions, [depId]: optIds } }))
  }, [])

  const handleSqlByDepChange = useCallback((depId: string, entry: SqlWizardEntry | null) => {
    setState(s => {
      const next = { ...s.sqlByDep }
      if (entry === null) delete next[depId]
      else next[depId] = entry
      return { ...s, sqlByDep: next }
    })
  }, [])

  const handleOpenApiByDepChange = useCallback((depId: string, entry: OpenApiWizardEntry | null) => {
    setState(s => {
      const next = { ...s.openApiByDep }
      if (entry === null) delete next[depId]
      else next[depId] = entry
      return { ...s, openApiByDep: next }
    })
  }, [])

  const handleSoapByDepChange = useCallback((depId: string, entry: SoapWizardEntry | null) => {
    setState(s => {
      const next = { ...s.soapByDep }
      if (entry === null) delete next[depId]
      else next[depId] = entry
      return { ...s, soapByDep: next }
    })
  }, [])

  if (loading) {
    return <div className="text-secondary text-sm p-6">Loading backend metadata…</div>
  }
  if (error || !metadata) {
    return (
      <div className="text-error text-sm p-6">
        Failed to load backend metadata.
        {error && <div className="text-xs mt-2 opacity-70">{error}</div>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <OptionsPanel metadata={metadata} values={state.form} onChange={handleFormChange} section="upper" />
      <ProjectForm values={state.form} onChange={handleFormChange} />
      <OptionsPanel metadata={metadata} values={state.form} onChange={handleFormChange} section="lower" />
      <div className="glass-panel rounded-2xl p-4">
        <DependencySelector
          metadata={metadata}
          selected={state.selectedDeps}
          onChange={handleDepsChange}
          extensions={extensions}
          selectedOptions={state.selectedOptions}
          onOptionsChange={handleOptionsChange}
          compatibilityRules={compatibilityRules}
          sqlDialects={sqlDialects}
          sqlByDep={state.sqlByDep}
          onSqlByDepChange={handleSqlByDepChange}
          openApiCapableDeps={openApiCapableDeps}
          openApiByDep={state.openApiByDep}
          onOpenApiByDepChange={handleOpenApiByDepChange}
          soapCapableDeps={soapCapableDeps}
          soapByDep={state.soapByDep}
          onSoapByDepChange={handleSoapByDepChange}
        />
      </div>
    </div>
  )
}
