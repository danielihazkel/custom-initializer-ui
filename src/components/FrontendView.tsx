import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useHotkeys } from '../hooks/useHotkeys'
import { registerCommands } from '../commands'
import { ShortcutsOverlay, FRONTEND_SHORTCUTS } from './fullstack/ShortcutsOverlay'
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
import { ViewSkeleton } from './Skeletons'
import { ConfirmDialog } from './ConfirmDialog'
import { PageHeader } from './shared/PageHeader'
import { NextSteps } from './shared/NextSteps'
import { useBusy } from '../utils/busy'
import { copyToClipboard } from '../utils/clipboard'
import { t, tn, useLang } from '../i18n'

/** What the last successful Generate made — in memory only. */
interface FrontendRun {
  projectName: string
  dependencyCount: number
  packageManager: string
  /** The download URL it was generated from, to tell when the setup has moved on. */
  url: string
}

/** Install and start, in the project's own package manager. */
function runCommandFor(packageManager: string): string {
  if (packageManager === 'yarn') return 'yarn && yarn dev'
  if (packageManager === 'npm') return 'npm install && npm run dev'
  return `${packageManager} install && ${packageManager} dev`
}
import { readErrorBody } from '../utils/previewErrors'
import { downloadBlob } from '../utils/projectUtils'

// Opened on demand — keeps CodeMirror + grammars out of this view's chunk.
const ProjectPreview = lazy(() => import('./ProjectPreview').then(m => ({ default: m.ProjectPreview })))

interface Props {
  onGenerated?: () => void
  onError?: (message: string) => void
  onReset?: () => void
}

export function FrontendView({ onGenerated, onError, onReset }: Props) {
  const lang = useLang()
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
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [lastRun, setLastRun] = useState<FrontendRun | null>(null)
  // The header's conveyor and gears run while a request is out (see utils/busy.ts).
  useBusy(generating || previewLoading)

  // The tab's keys and ⌘K actions. Declared before the loading / error returns (hooks may not
  // follow one) and pointed at the real handlers further down, once there is a catalog.
  const actions = useRef({ generate: () => {}, explore: () => {} })
  useHotkeys([
    { key: 'Enter', ctrl: true, run: () => actions.current.generate() },
    { key: 'e', ctrl: true, shift: true, run: () => actions.current.explore() },
    { key: '?', run: () => setShortcutsOpen(true) },
  ])
  // Registered again when the language changes: the titles are in it.
  useEffect(() => registerCommands([
    { id: 'fe-generate', title: t('Generate and download the frontend project'), icon: 'download', group: t('Frontend'), shortcut: 'Ctrl+Enter', run: () => actions.current.generate() },
    { id: 'fe-explore', title: t('Explore the generated files'), icon: 'folder_open', group: t('Frontend'), shortcut: 'Ctrl+Shift+E', run: () => actions.current.explore() },
    { id: 'fe-reset', title: t('Reset the frontend project to defaults'), icon: 'restart_alt', group: t('Frontend'), run: () => setResetConfirmOpen(true) },
    { id: 'fe-shortcuts', title: t('Keyboard shortcuts'), icon: 'keyboard', group: t('Frontend'), shortcut: '?', run: () => setShortcutsOpen(true) },
  ]), [lang])
  useEffect(() => {
    setHeaderSlot(document.getElementById('header-frontend-actions'))
    setResetSlot(document.getElementById('header-frontend-reset'))
  }, [])

  if (loading) return <ViewSkeleton />

  if (error || !metadata) {
    return (
      <div className="flex items-center justify-center p-16 relative z-10">
        <div className="bg-surface-container border border-error-container rounded-xl p-6 max-w-md text-center space-y-3">
          <h2 className="text-base font-bold text-on-surface">{t('Cannot load frontend catalog')}</h2>
          <p className="text-sm text-secondary">
            {t('Make sure the backend exposes {path} on port 8080.', { path: '/frontend/metadata' })}
          </p>
          {error && (
            <code dir="ltr" className="block text-xs text-error bg-surface-container-lowest rounded p-2">
              {error}
            </code>
          )}
          <button
            onClick={reload}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-outline-variant hover:bg-surface-container-high transition-colors"
          >
            {t('Retry')}
          </button>
        </div>
      </div>
    )
  }

  // Fetch (not an anchor GET) so a server-side failure surfaces as an error
  // instead of a "downloaded" toast with no file.
  async function handleGenerate(): Promise<void> {
    if (generating) return
    setGenerating(true)
    try {
      const url = fe.downloadUrl
      const res = await fetch(url)
      if (!res.ok) {
        const err = await readErrorBody(res)
        onError?.(t("Couldn't generate project: {error}", { error: err.kind ? `${err.kind}: ${err.message}` : err.message }))
        return
      }
      downloadBlob(await res.blob(), `${fe.state.form.projectName || 'demo'}.zip`)
      presets.pushRecent(fe.state)
      setLastRun({
        projectName: fe.state.form.projectName || 'demo',
        dependencyCount: fe.state.selectedDeps.length,
        packageManager: fe.state.packageManager,
        url,
      })
      onGenerated?.()
    } catch (err) {
      onError?.(t("Couldn't generate project: {error}", { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setGenerating(false)
    }
  }

  async function copyShareLink(): Promise<void> {
    const ok = await copyToClipboard(window.location.href)
    if (!ok) onError?.(t("Couldn't copy link — copy it from the address bar"))
  }

  actions.current = {
    generate: () => { void handleGenerate() },
    explore: () => { void fetchPreview(fe.state) },
  }

  function confirmReset() {
    setResetConfirmOpen(false)
    fe.reset()
    onReset?.()
  }

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8">
      <div className="mb-6">
        <PageHeader icon="web" title={t('React Frontend Generator')}>
          {t('React + TypeScript + Vite, scaffolded as a Feature-Sliced Design project with the tooling you choose.')}
        </PageHeader>
      </div>

      {lastRun && (
        <div className="mb-6">
          <NextSteps
            title={tn(lastRun.dependencyCount, '{file} is downloaded — {n} dependency', '{file} is downloaded — {n} dependencies', { file: `${lastRun.projectName}.zip` })}
            hint={<>{t('Install and start it, then open')} <a className="underline" dir="ltr" href="http://localhost:5173" target="_blank" rel="noreferrer">http://localhost:5173</a>.</>}
            stale={fe.downloadUrl !== lastRun.url}
            commands={[
              { label: t('Unpack'), cmd: `unzip ${lastRun.projectName}.zip -d ${lastRun.projectName} && cd ${lastRun.projectName}` },
              { label: t('Run'), cmd: runCommandFor(lastRun.packageManager) },
            ]}
            actionsLabel={t('Keep this setup:')}
            actions={[
              { id: 'link', label: t('Copy share link'), icon: 'link', onClick: () => { void copyShareLink() } },
              { id: 'explore', label: t('Explore the files'), icon: 'folder_open', onClick: () => { void fetchPreview(fe.state) } },
            ]}
            onDismiss={() => setLastRun(null)}
            onCopied={(ok, what) => { if (!ok) onError?.(t("Couldn't copy: {what}", { what })) }}
          />
        </div>
      )}

      {headerSlot && createPortal(
        <>
          <button
            onClick={() => fetchPreview(fe.state)}
            disabled={previewLoading}
            title={previewError ? (previewError.kind ? `${previewError.kind}: ${previewError.message}` : previewError.message) : t('Preview project files before downloading')}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-60 ${previewError ? 'text-error' : 'text-secondary hover:text-on-surface'}`}
          >
            {previewLoading
              ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
              : t('Explore')}
          </button>
          <button
            onClick={() => { void handleGenerate() }}
            disabled={generating}
            aria-busy={generating}
            title={t('Generate and download the project (Ctrl+Enter)')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn ${generating ? 'cursor-progress' : ''}`}
            style={{ minWidth: '110px' }}
          >
            {generating ? (
              <span className="flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }} aria-hidden="true">progress_activity</span>
                {t('Building…')}
              </span>
            ) : t('Generate')}
          </button>
        </>,
        headerSlot
      )}

      {resetSlot && createPortal(
        <button
          onClick={() => setResetConfirmOpen(true)}
          className="p-2 rounded text-secondary hover:text-on-surface transition-colors duration-200"
          aria-label={t('Reset to defaults')}
          title={t('Reset project to defaults (clears form & dependencies)')}
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
              rtl={fe.state.rtl}
              onReactVersionChange={fe.setReactVersion}
              onNodeVersionChange={fe.setNodeVersion}
              onPackageManagerChange={fe.setPackageManager}
              onBasePathChange={fe.setBasePath}
              onDesignSystemChange={fe.setDesignSystem}
              onColorPaletteChange={fe.setColorPaletteId}
              onApiBaseUrlChange={fe.setApiBaseUrl}
              onBackendArtifactIdChange={fe.setBackendArtifactId}
              onRtlChange={fe.setRtl}
            />
          </div>
          <div className="flex items-center justify-end text-[11px] text-secondary px-1">
            <span>
              {t('FSD layers:')} <code className="text-on-surface">app · pages · widgets · features · entities · shared</code>
            </span>
          </div>
        </section>

        {/* Right column: selected + available dependency panels */}
        <section className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4" data-tour="fe-deps">
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

      {shortcutsOpen && <ShortcutsOverlay shortcuts={FRONTEND_SHORTCUTS} onClose={() => setShortcutsOpen(false)} />}

      {resetConfirmOpen && (
        <ConfirmDialog
          title={t('Reset project to defaults?')}
          message={t('Your current form values and selected dependencies will be lost.')}
          confirmLabel={t('Reset')}
          tone="danger"
          onConfirm={confirmReset}
          onCancel={() => setResetConfirmOpen(false)}
        />
      )}

      {preview && createPortal(
        <Suspense fallback={<ViewSkeleton />}>
          <ProjectPreview
            preview={preview}
            previousPreview={previousPreview}
            artifactId={fe.state.form.projectName || 'demo'}
            onClose={clearPreview}
            onDownload={() => { void handleGenerate(); clearPreview() }}
          />
        </Suspense>,
        document.body,
      )}
    </div>
  )
}
