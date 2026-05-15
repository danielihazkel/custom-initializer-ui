import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFrontendMetadata } from '../hooks/useFrontendMetadata'
import { useFrontendState } from '../hooks/useFrontendState'
import { useFrontendPreview } from '../hooks/useFrontendPreview'
import { useStarterTemplates } from '../hooks/useStarterTemplates'
import { useFrontendPresets } from '../hooks/useFrontendPresets'
import { useCompatibility } from '../hooks/useCompatibility'
import { TemplatePicker } from './TemplatePicker'
import { PresetPickerFE } from './frontend/PresetPickerFE'
import { ProjectFormFE } from './frontend/ProjectFormFE'
import { OptionsPanelFE } from './frontend/OptionsPanelFE'
import { SelectedDependenciesFE } from './frontend/SelectedDependenciesFE'
import { AvailableDependenciesFE } from './frontend/AvailableDependenciesFE'
import { ProjectPreview } from './ProjectPreview'

interface Props {
  onGenerated?: () => void
  onReset?: () => void
}

export function FrontendView({ onGenerated, onReset }: Props) {
  const { metadata, loading, error, reload } = useFrontendMetadata()
  const fe = useFrontendState(metadata)
  const { templates } = useStarterTemplates('FRONTEND')
  const { rules: compatibilityRules } = useCompatibility('FRONTEND')
  const presets = useFrontendPresets()
  const {
    preview, previousPreview,
    loading: previewLoading, error: previewError,
    fetchPreview, clearPreview,
  } = useFrontendPreview()

  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null)
  const [resetSlot, setResetSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setHeaderSlot(document.getElementById('header-frontend-actions'))
    setResetSlot(document.getElementById('header-frontend-reset'))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-secondary text-sm relative z-10">
        Loading frontend metadata…
      </div>
    )
  }

  if (error || !metadata) {
    return (
      <div className="flex items-center justify-center p-16 relative z-10">
        <div className="bg-surface-container border border-error-container rounded-xl p-6 max-w-md text-center space-y-3">
          <h2 className="text-base font-bold text-on-surface">Cannot load frontend catalog</h2>
          <p className="text-sm text-secondary">
            Make sure the backend exposes <code>/frontend/metadata</code> on port 8080.
          </p>
          {error && (
            <code className="block text-xs text-error bg-surface-container-lowest rounded p-2">
              {error}
            </code>
          )}
          <button
            onClick={reload}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-outline-variant hover:bg-surface-container-high transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  function handleGenerate() {
    presets.pushRecent(fe.state)
    const a = document.createElement('a')
    a.href = fe.downloadUrl
    a.download = `${fe.state.form.projectName || 'demo'}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    onGenerated?.()
  }

  function handleReset() {
    if (!window.confirm('Reset the project to defaults? Your current selections will be lost.')) return
    fe.reset()
    onReset?.()
  }

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-on-surface">React + TypeScript + Vite Generator</h2>
        <p className="text-xs text-secondary mt-0.5">
          Scaffolds a Feature-Slice Design project with your chosen tooling. Single-app v1.
        </p>
      </div>

      {headerSlot && createPortal(
        <>
          <button
            onClick={() => fetchPreview(fe.state)}
            disabled={previewLoading}
            title={previewError ? (previewError.kind ? `${previewError.kind}: ${previewError.message}` : previewError.message) : 'Preview project files before downloading'}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-60 ${previewError ? 'text-error' : 'text-secondary hover:text-on-surface'}`}
          >
            {previewLoading
              ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
              : 'Explore'}
          </button>
          <button
            onClick={handleGenerate}
            className="px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn"
            style={{ minWidth: '110px' }}
          >
            Generate
          </button>
        </>,
        headerSlot
      )}

      {resetSlot && createPortal(
        <button
          onClick={handleReset}
          className="p-2 rounded text-secondary hover:text-on-surface transition-colors duration-200"
          aria-label="Reset to defaults"
          title="Reset project to defaults (clears form & dependencies)"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>restart_alt</span>
        </button>,
        resetSlot
      )}

      {templates.length > 0 && (
        <TemplatePicker
          templates={templates}
          activeTemplateId={fe.activeTemplate}
          onSelect={fe.applyTemplate}
        />
      )}
      <PresetPickerFE
        presets={presets.presets}
        recents={presets.recents}
        currentSnapshot={fe.state}
        onLoad={fe.loadSnapshot}
        onSave={presets.savePreset}
        onDeletePreset={presets.deletePreset}
        onDeleteRecent={presets.deleteRecent}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: form + options */}
        <section className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-2xl p-5">
            <ProjectFormFE values={fe.state.form} onChange={fe.updateForm} />
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <OptionsPanelFE
              metadata={metadata}
              reactVersion={fe.state.reactVersion}
              nodeVersion={fe.state.nodeVersion}
              packageManager={fe.state.packageManager}
              basePath={fe.state.basePath}
              designSystem={fe.state.designSystem}
              colorPaletteId={fe.state.colorPaletteId}
              apiBaseUrl={fe.state.apiBaseUrl}
              backendArtifactId={fe.state.backendArtifactId}
              onReactVersionChange={fe.setReactVersion}
              onNodeVersionChange={fe.setNodeVersion}
              onPackageManagerChange={fe.setPackageManager}
              onBasePathChange={fe.setBasePath}
              onDesignSystemChange={fe.setDesignSystem}
              onColorPaletteChange={fe.setColorPaletteId}
              onApiBaseUrlChange={fe.setApiBaseUrl}
              onBackendArtifactIdChange={fe.setBackendArtifactId}
            />
          </div>
          <div className="flex items-center justify-end text-[11px] text-secondary px-1">
            <span>
              FSD layers: <code className="text-on-surface">app · pages · widgets · features · entities · shared</code>
            </span>
          </div>
        </section>

        {/* Right column: selected + available dependency panels */}
        <section className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-panel rounded-2xl p-5">
            <SelectedDependenciesFE
              metadata={metadata}
              selectedDeps={fe.state.selectedDeps}
              selectedOptions={fe.state.selectedOptions}
              compatibilityRules={compatibilityRules}
              onToggleDep={fe.toggleDep}
              onToggleOption={fe.toggleOption}
            />
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <AvailableDependenciesFE
              metadata={metadata}
              selectedDeps={fe.state.selectedDeps}
              onToggleDep={fe.toggleDep}
            />
          </div>
        </section>
      </div>

      {preview && createPortal(
        <ProjectPreview
          preview={preview}
          previousPreview={previousPreview}
          artifactId={fe.state.form.projectName || 'demo'}
          onClose={clearPreview}
          onDownload={() => { handleGenerate(); clearPreview() }}
        />,
        document.body,
      )}
    </div>
  )
}
