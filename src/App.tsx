import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

  const [shareCopied, setShareCopied] = useState(false)
  const [generateSuccess, setGenerateSuccess] = useState(false)
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

  function handleShare(): void {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setShareCopied(true)
      setAppToast({ message: 'Link copied to clipboard', type: 'success' })
      setTimeout(() => setShareCopied(false), 2000)
    })
  }

  function handleGenerate(): void {
    triggerDownload(form, selectedDeps, selectedOptions, { enabled: multiModuleEnabled, modules: selectedModules }, sqlByDep, openApiByDep)
    pushRecent(currentSnapshot)
    setGenerateSuccess(true)
    setAppToast({ message: 'Project downloaded!', type: 'success' })
    setTimeout(() => setGenerateSuccess(false), 2000)
  }

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
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 glass-header">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold text-on-surface tracking-tighter">Spring Initializr</span>
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => setView(v => v === 'tutorial' ? 'initializr' : 'tutorial')}
              className={`text-sm transition-colors duration-200 ${view === 'tutorial' ? 'text-on-surface font-semibold' : 'text-secondary hover:text-on-surface'}`}
            >
              Training
            </button>
            <button
              onClick={() => setView(v => v === 'guide' ? 'initializr' : 'guide')}
              className={`text-sm transition-colors duration-200 ${view === 'guide' ? 'text-on-surface font-semibold' : 'text-secondary hover:text-on-surface'}`}
            >
              Guide
            </button>
            <button
              onClick={() => setView(v => v === 'admin' ? 'initializr' : 'admin')}
              className={`text-sm transition-colors duration-200 ${view === 'admin' ? 'text-on-surface font-semibold' : 'text-secondary hover:text-on-surface'}`}
            >
              Config
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {/* Search button */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-high transition-colors duration-200 text-secondary hover:text-on-surface group shadow-sm"
            aria-label="Search dependencies"
            title="Search dependencies (Cmd/Ctrl + K)"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
            <span className="hidden sm:inline text-xs font-medium">Search</span>
            <span className="hidden sm:flex border border-outline-variant bg-surface-container rounded px-1.5 py-0.5 text-[10px] font-bold text-secondary group-hover:text-on-surface">⌘K</span>
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="p-2 rounded text-secondary hover:text-on-surface transition-colors duration-200"
            aria-label="Copy share link"
            title="Copy link to current configuration"
          >
            <AnimatePresence mode="wait">
              {shareCopied ? (
                <motion.span
                  key="check"
                  className="material-symbols-outlined"
                  style={{ fontSize: '20px', display: 'block' }}
                  initial={{ opacity: 0, scale: 0.3, rotate: 90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.3 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  check
                </motion.span>
              ) : (
                <motion.span
                  key="share"
                  className="material-symbols-outlined"
                  style={{ fontSize: '20px', display: 'block' }}
                  initial={{ opacity: 0, scale: 0.3, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.3, rotate: 90 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  share
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          {/* Theme toggle */}
          <button
            onClick={() => setIsDark(d => !d)}
            className="p-2 rounded text-secondary hover:text-on-surface transition-colors duration-200"
            aria-label="Toggle theme"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          <button
            onClick={() => { fetchPreview(form, selectedDeps, selectedOptions, { enabled: multiModuleEnabled, modules: selectedModules }, sqlByDep, openApiByDep); pushRecent(currentSnapshot) }}
            disabled={previewLoading}
            title={previewError ?? 'Preview project files before downloading'}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-60 ${previewError ? 'text-error' : 'text-secondary hover:text-on-surface'}`}
          >
            {previewLoading
              ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
              : 'Explore'}
          </button>
          <button
            onClick={handleGenerate}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn ${generateSuccess ? 'generate-success' : ''}`}
            style={{ minWidth: '110px' }}
          >
            <AnimatePresence mode="wait">
              {generateSuccess ? (
                <motion.span
                  key="success"
                  className="flex items-center justify-center gap-1.5"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                  Done!
                </motion.span>
              ) : (
                <motion.span
                  key="generate"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  Generate
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </header>

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
