import { useCallback, useEffect, useState } from 'react'
import { useFrontendMetadata, type FrontendMetadata } from '../../hooks/useFrontendMetadata'
import { useStarterTemplates } from '../../hooks/useStarterTemplates'
import { useCompatibility } from '../../hooks/useCompatibility'
import { TemplatePicker } from '../TemplatePicker'
import { ProjectFormFE } from '../frontend/ProjectFormFE'
import { OptionsPanelFE } from '../frontend/OptionsPanelFE'
import { SelectedDependenciesFE } from '../frontend/SelectedDependenciesFE'
import { AvailableDependenciesFE } from '../frontend/AvailableDependenciesFE'
import type { FeForm } from '../../hooks/useFrontendState'
import type { StarterTemplate } from '../../types'

export interface FrontendHalfState {
  form: FeForm
  reactVersion: string
  nodeVersion: string
  packageManager: string
  basePath: string
  selectedDeps: string[]
  selectedOptions: Record<string, string[]>
  designSystem: string
  colorPaletteId: string
}

interface Props {
  onChange: (state: FrontendHalfState) => void
  onMetadataLoaded?: (metadata: FrontendMetadata) => void
}

const DESIGN_NONE = 'design-none'

function deriveDesignSystem(deps: string[]): string {
  return deps.find(d => d.startsWith('design-')) ?? DESIGN_NONE
}

function initialState(metadata: FrontendMetadata | null): FrontendHalfState {
  const d = metadata?.defaults
  const defaultPalette = metadata?.colorPalettes?.find(p => p.isDefault)?.id
    ?? metadata?.colorPalettes?.[0]?.id
    ?? ''
  return {
    form: {
      projectName: 'demo-ui',
      description: d?.description ?? '',
      scope: d?.scope ?? '',
      appTitle: 'Demo UI',
    },
    reactVersion: d?.reactVersion ?? '18',
    nodeVersion: d?.nodeVersion ?? '20',
    packageManager: d?.packageManager ?? 'pnpm',
    basePath: '/',
    selectedDeps: [],
    selectedOptions: {},
    designSystem: DESIGN_NONE,
    colorPaletteId: defaultPalette,
  }
}

/**
 * Self-contained Frontend half of the Paired generator. Owns its own state
 * (in-memory only — paired state is not persisted to localStorage to avoid
 * colliding with the dedicated Frontend tab's saved selections).
 *
 * Reuses the dedicated tab's components verbatim: TemplatePicker,
 * ProjectFormFE, OptionsPanelFE, SelectedDependenciesFE, AvailableDependenciesFE.
 * That carries sub-options, compatibility banners, design system + palette,
 * version pickers, and starter templates into paired generation without forking.
 */
export function FrontendHalfPanel({ onChange, onMetadataLoaded }: Props) {
  const { metadata, loading, error, reload } = useFrontendMetadata()
  const { templates } = useStarterTemplates('FRONTEND')
  const { rules: compatibilityRules } = useCompatibility('FRONTEND')

  const [state, setState] = useState<FrontendHalfState>(() => initialState(null))
  const [initialized, setInitialized] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)

  // Apply server defaults once metadata loads.
  useEffect(() => {
    if (!metadata || initialized) return
    setState(prev => ({
      ...initialState(metadata),
      form: { ...prev.form, ...initialState(metadata).form, projectName: prev.form.projectName || 'demo-ui' },
    }))
    setInitialized(true)
    onMetadataLoaded?.(metadata)
  }, [metadata, initialized, onMetadataLoaded])

  // Report state up.
  useEffect(() => {
    onChange(state)
  }, [state, onChange])

  const updateForm = useCallback((patch: Partial<FeForm>) => {
    setState(s => ({ ...s, form: { ...s.form, ...patch } }))
  }, [])

  const setReactVersion = useCallback((v: string) => setState(s => ({ ...s, reactVersion: v })), [])
  const setNodeVersion = useCallback((v: string) => setState(s => ({ ...s, nodeVersion: v })), [])
  const setPackageManager = useCallback((v: string) => setState(s => ({ ...s, packageManager: v })), [])
  const setBasePath = useCallback((v: string) => setState(s => ({ ...s, basePath: v || '/' })), [])
  const setColorPaletteId = useCallback((v: string) => setState(s => ({ ...s, colorPaletteId: v })), [])

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

  if (loading) {
    return <div className="text-secondary text-sm p-6">Loading frontend metadata…</div>
  }
  if (error || !metadata) {
    return (
      <div className="text-error text-sm p-6 space-y-2">
        <div>Failed to load frontend metadata.</div>
        {error && <div className="text-xs opacity-70">{error}</div>}
        <button
          onClick={reload}
          className="px-3 py-1 rounded-lg text-xs font-semibold border border-outline-variant hover:bg-surface-container-high transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {templates.length > 0 && (
        <TemplatePicker
          templates={templates}
          activeTemplateId={activeTemplate}
          onSelect={applyTemplate}
        />
      )}

      <div className="glass-panel rounded-2xl p-5">
        <ProjectFormFE values={state.form} onChange={updateForm} />
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <OptionsPanelFE
          metadata={metadata}
          reactVersion={state.reactVersion}
          nodeVersion={state.nodeVersion}
          packageManager={state.packageManager}
          basePath={state.basePath}
          designSystem={state.designSystem}
          colorPaletteId={state.colorPaletteId}
          apiBaseUrl=""
          backendArtifactId=""
          onReactVersionChange={setReactVersion}
          onNodeVersionChange={setNodeVersion}
          onPackageManagerChange={setPackageManager}
          onBasePathChange={setBasePath}
          onDesignSystemChange={setDesignSystem}
          onColorPaletteChange={setColorPaletteId}
          onApiBaseUrlChange={() => { /* paired view handles apiBaseUrl in the shared row */ }}
          onBackendArtifactIdChange={() => { /* paired view handles backendArtifactId in the shared row */ }}
          hidePairedBackendSection
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel rounded-2xl p-5">
          <SelectedDependenciesFE
            metadata={metadata}
            selectedDeps={state.selectedDeps}
            selectedOptions={state.selectedOptions}
            compatibilityRules={compatibilityRules}
            onToggleDep={toggleDep}
            onToggleOption={toggleOption}
          />
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <AvailableDependenciesFE
            metadata={metadata}
            selectedDeps={state.selectedDeps}
            onToggleDep={toggleDep}
          />
        </div>
      </div>
    </div>
  )
}
