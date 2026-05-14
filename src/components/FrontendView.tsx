import { useFrontendMetadata } from '../hooks/useFrontendMetadata'
import { useFrontendState } from '../hooks/useFrontendState'
import { ProjectFormFE } from './frontend/ProjectFormFE'
import { OptionsPanelFE } from './frontend/OptionsPanelFE'
import { DependencyPickerFE } from './frontend/DependencyPickerFE'

interface Props {
  onGenerated?: () => void
}

export function FrontendView({ onGenerated }: Props) {
  const { metadata, loading, error, reload } = useFrontendMetadata()
  const fe = useFrontendState(metadata)

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
    const a = document.createElement('a')
    a.href = fe.downloadUrl
    a.download = `${fe.state.form.projectName || 'demo'}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    onGenerated?.()
  }

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-on-surface">React + TypeScript + Vite Generator</h2>
          <p className="text-xs text-secondary mt-0.5">
            Scaffolds a Feature-Slice Design project with your chosen tooling. Single-app v1.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          className="px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn"
        >
          Generate
        </button>
      </div>

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
              onReactVersionChange={fe.setReactVersion}
              onNodeVersionChange={fe.setNodeVersion}
              onPackageManagerChange={fe.setPackageManager}
              onBasePathChange={fe.setBasePath}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-secondary px-1">
            <button
              type="button"
              onClick={fe.reset}
              className="hover:text-on-surface transition-colors"
            >
              Reset to defaults
            </button>
            <span>
              FSD layers: <code className="text-on-surface">app · pages · widgets · features · entities · shared</code>
            </span>
          </div>
        </section>

        {/* Right column: dependency picker */}
        <section className="lg:col-span-7">
          <div className="glass-panel rounded-2xl p-5">
            <DependencyPickerFE
              metadata={metadata}
              selectedDeps={fe.state.selectedDeps}
              selectedOptions={fe.state.selectedOptions}
              onToggleDep={fe.toggleDep}
              onToggleOption={fe.toggleOption}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
