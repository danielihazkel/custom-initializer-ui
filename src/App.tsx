import { useState, useEffect } from 'react'

import { useMetadata } from './hooks/useMetadata'
import { useExtensions } from './hooks/useExtensions'
import { useSqlDialects } from './hooks/useSqlDialects'
import { useOpenApiCapable } from './hooks/useOpenApiCapable'
import { useCompatibility } from './hooks/useCompatibility'
import { useProjectPreview } from './hooks/useProjectPreview'
import { useStarterTemplates } from './hooks/useStarterTemplates'
import { useModuleTemplates } from './hooks/useModuleTemplates'
import { useProjectState } from './hooks/useProjectState'
import { useProjectPresets } from './hooks/useProjectPresets'

import { InitializrView } from './components/InitializrView'
import { ProjectPreview } from './components/ProjectPreview'
import { TemplateCompare } from './components/TemplateCompare'
import { Suspense, lazy } from 'react'

const TutorialView = lazy(() => import('./components/tutorial/TutorialView').then(m => ({ default: m.TutorialView })))
const AdminPage = lazy(() => import('./components/admin/AdminPage').then(m => ({ default: m.AdminPage })))
const GuideView = lazy(() => import('./components/guide/GuideView').then(m => ({ default: m.GuideView })))
import { CommandPalette } from './components/CommandPalette'
import { AppToast } from './components/AppToast'
import { AppHeader } from './components/AppHeader'

import { triggerDownload, captureSnapshot } from './utils/projectUtils'
import type { Toast } from './types'

export default function App() {
  const { metadata, loading, error } = useMetadata()
  const { extensions } = useExtensions()
  const { dialects: sqlDialects } = useSqlDialects()
  const { depIds: openApiCapableDeps } = useOpenApiCapable()
  const { rules: compatibilityRules } = useCompatibility()
  const { templates } = useStarterTemplates()
  const { modules: moduleTemplates } = useModuleTemplates()
  const { preview, previousPreview, loading: previewLoading, error: previewError, fetchPreview, clearPreview } = useProjectPreview()

  const {
    form,
    selected: selectedDeps,
    selectedOptions,
    sqlByDep,
    openApiByDep,
    multiModuleEnabled,
    selectedModules,
    activeTemplate,
    setMultiModuleEnabled,
    handleFormChange,
    handleDepsChange,
    handleOptionsChange,
    handleSqlByDepChange,
    handleOpenApiByDepChange,
    handleTemplateSelect,
    applySnapshot,
    setSelectedModules
  } = useProjectState(metadata)

  const {
    presets,
    recents,
    savePreset,
    deletePreset,
    deleteRecent,
    pushRecent,
  } = useProjectPresets()

  const currentSnapshot = captureSnapshot({
    form,
    selected: selectedDeps,
    selectedOptions,
    sqlByDep,
    openApiByDep,
    multiModuleEnabled,
    selectedModules,
  })

  const [appToast, setAppToast] = useState<Toast | null>(null)
  
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })
  
  const [view, setView] = useState<'initializr' | 'tutorial' | 'admin' | 'guide'>('initializr')
  const [compareOpen, setCompareOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Command Palette global hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(o => !o)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Sync html class with theme
  useEffect(() => {
    const html = document.documentElement
    if (isDark) {
      html.classList.add('dark')
      html.classList.remove('light')
    } else {
      html.classList.add('light')
      html.classList.remove('dark')
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-surface-container border border-error-container rounded-xl p-8 max-w-md text-center space-y-3">
          <h2 className="text-lg font-bold text-on-surface">Cannot reach backend</h2>
          <p className="text-sm text-secondary">Make sure the Spring Initializr backend is running on port 8080.</p>
          <code className="block text-xs text-error bg-surface-container-lowest rounded p-3">{error}</code>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-on-background">
      {/* Top Nav */}
      <AppHeader
        view={view}
        setView={setView}
        isDark={isDark}
        setIsDark={setIsDark}
        onSearchOpen={() => setCommandPaletteOpen(true)}
        onExplore={() => {
          fetchPreview(form, selectedDeps, selectedOptions, { enabled: multiModuleEnabled, modules: selectedModules }, sqlByDep, openApiByDep);
          pushRecent(currentSnapshot)
        }}
        onGenerate={() => {
          triggerDownload(form, selectedDeps, selectedOptions, { enabled: multiModuleEnabled, modules: selectedModules }, sqlByDep, openApiByDep)
          pushRecent(currentSnapshot)
        }}
        exploreLoading={previewLoading}
        exploreError={previewError}
      />

      {/* Main Content */}
      <main className="pt-20 pb-8 min-h-screen bg-background relative overflow-hidden">
        {/* Decorative ambient background blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-tertiary/10 rounded-full blur-[120px] pointer-events-none" />

        {view === 'tutorial' ? (
          <div className="relative z-10 animate-fade-in-up">
            <Suspense fallback={<div className="flex items-center justify-center p-16 text-secondary text-sm">Loading Training...</div>}>
              <TutorialView onClose={() => setView('initializr')} />
            </Suspense>
          </div>
        ) : view === 'guide' ? (
          <div className="relative z-10 animate-fade-in-up">
            <Suspense fallback={<div className="flex items-center justify-center p-16 text-secondary text-sm">Loading Guide...</div>}>
              <GuideView onClose={() => setView('initializr')} />
            </Suspense>
          </div>
        ) : view === 'admin' ? (
          <div className="relative z-10">
            <Suspense fallback={<div className="flex items-center justify-center p-16 text-secondary text-sm">Loading Config...</div>}>
              <AdminPage />
            </Suspense>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center p-16 text-secondary text-sm relative z-10">
            Loading metadata…
          </div>
        ) : (
          <InitializrView
            metadata={metadata}
            templates={templates}
            moduleTemplates={moduleTemplates}
            extensions={extensions}
            compatibilityRules={compatibilityRules}
            sqlDialects={sqlDialects}
            sqlByDep={sqlByDep}
            onSqlByDepChange={handleSqlByDepChange}
            openApiCapableDeps={openApiCapableDeps}
            openApiByDep={openApiByDep}
            onOpenApiByDepChange={handleOpenApiByDepChange}
            form={form}
            selectedDeps={selectedDeps}
            selectedOptions={selectedOptions}
            activeTemplate={activeTemplate}
            multiModuleEnabled={multiModuleEnabled}
            selectedModules={selectedModules}
            onFormChange={handleFormChange}
            onDepsChange={handleDepsChange}
            onOptionsChange={handleOptionsChange}
            onTemplateSelect={handleTemplateSelect}
            onMultiModuleToggle={() => setMultiModuleEnabled(v => !v)}
            onModulesChange={setSelectedModules}
            onCompareOpen={() => setCompareOpen(true)}
            presets={presets}
            recents={recents}
            currentSnapshot={currentSnapshot}
            onPresetLoad={applySnapshot}
            onPresetSave={savePreset}
            onPresetDelete={deletePreset}
            onRecentDelete={deleteRecent}
          />
        )}
      </main>

      {/* Compare Templates modal */}
      {compareOpen && (
        <TemplateCompare
          templates={templates}
          metadata={metadata}
          extensions={extensions}
          onClose={() => setCompareOpen(false)}
        />
      )}

      {/* Project Preview modal */}
      {preview && (
        <ProjectPreview
          preview={preview}
          previousPreview={previousPreview}
          artifactId={form.artifactId}
          onClose={clearPreview}
          onDownload={() => { triggerDownload(form, selectedDeps, selectedOptions, { enabled: multiModuleEnabled, modules: selectedModules }, sqlByDep, openApiByDep); clearPreview() }}

        />
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        metadata={metadata}
        templates={templates}
        form={form}
        selectedDeps={selectedDeps}
        onSelectTemplate={handleTemplateSelect}
        onToggleDependency={(depId) => {
          const newSelected = selectedDeps.includes(depId)
            ? selectedDeps.filter(id => id !== depId)
            : [...selectedDeps, depId];
          handleDepsChange(newSelected);
        }}
        onFormChange={handleFormChange}
      />

      <AppToast toast={appToast} onClear={() => setAppToast(null)} />
    </div>
  )
}
