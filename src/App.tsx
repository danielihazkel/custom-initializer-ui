import { useState, useEffect } from 'react'
import { useMetadata } from './hooks/useMetadata'
import { useExtensions } from './hooks/useExtensions'
import { useCompatibility } from './hooks/useCompatibility'
import { useProjectPreview } from './hooks/useProjectPreview'
import { useStarterTemplates } from './hooks/useStarterTemplates'
import { useModuleTemplates } from './hooks/useModuleTemplates'
import { ProjectPreview } from './components/ProjectPreview'
import { ProjectForm } from './components/ProjectForm'
import { OptionsPanel } from './components/OptionsPanel'
import { DependencySelector } from './components/DependencySelector'
import { TemplatePicker } from './components/TemplatePicker'
import { TemplateCompare } from './components/TemplateCompare'
import { ModuleSelector } from './components/ModuleSelector'
import { TutorialView } from './components/tutorial/TutorialView'
import { AdminPage } from './components/admin/AdminPage'
import type { InitializrMetadata, ProjectFormValues, StarterTemplate } from './types'

function parseUrlParams(): {
  form: Partial<ProjectFormValues>
  selected: string[]
  selectedOptions: Record<string, string[]>
} | null {
  const p = new URLSearchParams(window.location.search)
  if (!p.has('groupId') && !p.has('dependencies')) return null

  const form: Partial<ProjectFormValues> = {}
  for (const key of [
    'groupId', 'artifactId', 'name', 'description', 'packageName',
    'bootVersion', 'language', 'type', 'packaging', 'javaVersion',
  ] as const) {
    const v = p.get(key)
    if (v !== null) form[key] = v
  }

  const deps = p.get('dependencies')
  const selected = deps ? deps.split(',').filter(Boolean) : []

  const selectedOptions: Record<string, string[]> = {}
  for (const [k, v] of p.entries()) {
    if (k.startsWith('opts-')) {
      selectedOptions[k.slice(5)] = v.split(',').filter(Boolean)
    }
  }

  return { form, selected, selectedOptions }
}

function defaultForm(metadata: InitializrMetadata | null): ProjectFormValues {
  return {
    groupId: 'com.menora',
    artifactId: 'demo',
    name: 'demo',
    description: 'Demo project for Spring Boot',
    packageName: 'com.menora.demo',
    bootVersion: metadata?.bootVersion?.default ?? '',
    language: metadata?.language?.default ?? 'java',
    type: metadata?.type?.default ?? 'maven-project',
    packaging: metadata?.packaging?.default ?? 'jar',
    javaVersion: metadata?.javaVersion?.default ?? '21',
  }
}

function triggerDownload(
  form: ProjectFormValues,
  selected: string[],
  selectedOptions: Record<string, string[]>,
  multiModule?: { enabled: boolean; modules: string[] }
): void {
  const isMultiModule = multiModule?.enabled && multiModule.modules.length > 0
  const url = new URL(isMultiModule ? '/starter-multimodule.zip' : '/starter.zip', window.location.origin)
  url.searchParams.set('type', form.type)
  url.searchParams.set('language', form.language)
  url.searchParams.set('bootVersion', form.bootVersion)
  url.searchParams.set('groupId', form.groupId)
  url.searchParams.set('artifactId', form.artifactId)
  url.searchParams.set('name', form.name)
  url.searchParams.set('description', form.description)
  url.searchParams.set('packageName', form.packageName)
  url.searchParams.set('packaging', form.packaging)
  url.searchParams.set('javaVersion', form.javaVersion)
  if (isMultiModule) {
    url.searchParams.set('modules', multiModule!.modules.join(','))
  }
  if (selected.length > 0) {
    url.searchParams.set('dependencies', selected.join(','))
  }
  for (const [depId, optIds] of Object.entries(selectedOptions)) {
    if (optIds.length > 0 && selected.includes(depId)) {
      url.searchParams.set(`opts-${depId}`, optIds.join(','))
    }
  }
  const a = document.createElement('a')
  a.href = url.toString()
  a.download = `${form.artifactId}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export default function App() {
  const { metadata, loading, error } = useMetadata()
  const { extensions } = useExtensions()
  const { rules: compatibilityRules } = useCompatibility()
  const { templates } = useStarterTemplates()
  const { modules: moduleTemplates } = useModuleTemplates()
  const { preview, previousPreview, loading: previewLoading, error: previewError, fetchPreview, clearPreview } = useProjectPreview()
  const [form, setForm] = useState<ProjectFormValues>(() => {
    const url = parseUrlParams()
    if (url) return { ...defaultForm(null), ...url.form }
    const saved = localStorage.getItem('formValues')
    return saved ? JSON.parse(saved) : defaultForm(null)
  })
  const [selected, setSelected] = useState<string[]>(() => {
    const url = parseUrlParams()
    if (url) return url.selected
    const saved = localStorage.getItem('selectedDeps')
    return saved ? JSON.parse(saved) : []
  })
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>(() => {
    const url = parseUrlParams()
    if (url) return url.selectedOptions
    const saved = localStorage.getItem('selectedOptions')
    return saved ? JSON.parse(saved) : {}
  })
  const [initialized, setInitialized] = useState<boolean>(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })
  const [view, setView] = useState<'initializr' | 'tutorial' | 'admin'>('initializr')
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [multiModuleEnabled, setMultiModuleEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('multiModuleEnabled')
    return saved === 'true'
  })
  const [selectedModules, setSelectedModules] = useState<string[]>(() => {
    const saved = localStorage.getItem('selectedModules')
    return saved ? JSON.parse(saved) : []
  })

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

  // Persist form state to localStorage
  useEffect(() => { localStorage.setItem('formValues', JSON.stringify(form)) }, [form])
  useEffect(() => { localStorage.setItem('selectedDeps', JSON.stringify(selected)) }, [selected])
  useEffect(() => { localStorage.setItem('selectedOptions', JSON.stringify(selectedOptions)) }, [selectedOptions])
  useEffect(() => { localStorage.setItem('multiModuleEnabled', String(multiModuleEnabled)) }, [multiModuleEnabled])
  useEffect(() => { localStorage.setItem('selectedModules', JSON.stringify(selectedModules)) }, [selectedModules])

  // Sync form state into the URL so the page is shareable
  useEffect(() => {
    if (!initialized) return
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
    if (selected.length > 0) p.set('dependencies', selected.join(','))
    for (const [depId, optIds] of Object.entries(selectedOptions)) {
      if (optIds.length > 0 && selected.includes(depId)) {
        p.set(`opts-${depId}`, optIds.join(','))
      }
    }
    history.replaceState(null, '', '?' + p.toString())
  }, [form, selected, selectedOptions, initialized])

  // Apply server defaults on first metadata load (only if no saved form and no URL params)
  useEffect(() => {
    if (metadata && !initialized) {
      const p = new URLSearchParams(window.location.search)
      const hasUrl = p.has('groupId') || p.has('dependencies')
      if (!localStorage.getItem('formValues') && !hasUrl) {
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
  }, [metadata, initialized])

  // Remove saved dependencies that no longer exist in the catalog
  useEffect(() => {
    if (metadata && initialized && selected.length > 0) {
      const validIds = new Set(
        metadata.dependencies.values.flatMap(g => g.values.map(d => d.id))
      )
      const filtered = selected.filter(id => validIds.has(id))
      if (filtered.length !== selected.length) {
        setSelected(filtered)
      }
    }
  }, [metadata, initialized])

  function handleFormChange(updates: Partial<ProjectFormValues>): void {
    setForm(prev => ({ ...prev, ...updates }))
  }

  function handleDepsChange(newSelected: string[]): void {
    // Clear sub-options for any dependency that was just removed
    const removed = selected.filter(id => !newSelected.includes(id))
    if (removed.length > 0) {
      setSelectedOptions(prev => {
        const next = { ...prev }
        for (const id of removed) delete next[id]
        return next
      })
    }
    setSelected(newSelected)
    setActiveTemplate(null)
  }

  function handleOptionsChange(depId: string, optIds: string[]): void {
    setSelectedOptions(prev => ({ ...prev, [depId]: optIds }))
    setActiveTemplate(null)
  }

  function handleTemplateSelect(template: StarterTemplate | null): void {
    if (!template) {
      setActiveTemplate(null)
      setSelected([])
      setSelectedOptions({})
      return
    }
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
  }

  function handleShare(): void {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    })
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
            <a className="text-secondary hover:text-on-surface transition-colors duration-200 text-sm" href="#">Guides</a>
            <a className="text-secondary hover:text-on-surface transition-colors duration-200 text-sm" href="#">Projects</a>
            <button
              onClick={() => setView(v => v === 'tutorial' ? 'initializr' : 'tutorial')}
              className={`text-sm transition-colors duration-200 ${view === 'tutorial' ? 'text-on-surface font-semibold' : 'text-secondary hover:text-on-surface'}`}
            >
              Training
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
          {/* Share button */}
          <button
            onClick={handleShare}
            className="p-2 rounded text-secondary hover:text-on-surface transition-colors duration-200"
            aria-label="Copy share link"
            title="Copy link to current configuration"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {shareCopied ? 'check' : 'share'}
            </span>
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
            onClick={() => fetchPreview(form, selected, selectedOptions, { enabled: multiModuleEnabled, modules: selectedModules })}
            disabled={previewLoading}
            title={previewError ?? 'Preview project files before downloading'}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-60 ${previewError ? 'text-error' : 'text-secondary hover:text-on-surface'}`}
          >
            {previewLoading
              ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
              : 'Explore'}
          </button>
          <button
            onClick={() => triggerDownload(form, selected, selectedOptions, { enabled: multiModuleEnabled, modules: selectedModules })}
            className="px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn"
          >
            Generate
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-32 min-h-screen bg-background relative overflow-hidden">
        {/* Decorative ambient background blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-tertiary/10 rounded-full blur-[120px] pointer-events-none" />

        {view === 'tutorial' ? (
          <div className="relative z-10 animate-fade-in-up"><TutorialView onClose={() => setView('initializr')} /></div>
        ) : view === 'admin' ? (
          <div className="relative z-10 animate-fade-in-up"><AdminPage /></div>
        ) : loading ? (
          <div className="flex items-center justify-center p-16 text-secondary text-sm relative z-10">
            Loading metadata…
          </div>
        ) : (
          <>
          <div className="max-w-7xl mx-auto px-8 relative z-10 animate-fade-in-up">
            <TemplatePicker
              templates={templates}
              activeTemplateId={activeTemplate}
              onSelect={handleTemplateSelect}
              onCompare={() => setCompareOpen(true)}
            />
          </div>
          <div className="max-w-7xl mx-auto px-8 grid grid-cols-12 gap-10 relative z-10 animate-fade-in-up">
            {/* Left Column */}
            <section className="col-span-12 lg:col-span-5 space-y-8">
              <div className="mb-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">
                  Project Setup
                </h2>
                <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                  Configure metadata and core language settings
                </p>
              </div>
              <OptionsPanel metadata={metadata} values={form} onChange={handleFormChange} section="upper" />
              <ProjectForm values={form} onChange={handleFormChange} />
              <OptionsPanel metadata={metadata} values={form} onChange={handleFormChange} section="lower" />

              {/* Multi-Module Toggle */}
              {moduleTemplates.length > 0 && (
                <div className="glass-panel rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-1.5">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>account_tree</span>
                        Multi-Module Project
                      </h3>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">Generate a parent POM with sub-modules</p>
                    </div>
                    <button
                      onClick={() => setMultiModuleEnabled(v => !v)}
                      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${multiModuleEnabled ? 'bg-primary' : 'bg-surface-container-high'}`}
                      aria-label="Toggle multi-module"
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${multiModuleEnabled ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  {multiModuleEnabled && (
                    <ModuleSelector
                      modules={moduleTemplates}
                      selectedModules={selectedModules}
                      onChange={setSelectedModules}
                    />
                  )}
                </div>
              )}
            </section>

            {/* Right Column — Dependencies */}
            <section className="col-span-12 lg:col-span-7">
              <DependencySelector
                metadata={metadata}
                selected={selected}
                onChange={handleDepsChange}
                extensions={extensions}
                selectedOptions={selectedOptions}
                onOptionsChange={handleOptionsChange}
                compatibilityRules={compatibilityRules}
              />
            </section>
          </div>
          </>
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
          onDownload={() => { triggerDownload(form, selected, selectedOptions, { enabled: multiModuleEnabled, modules: selectedModules }); clearPreview() }}
        />
      )}

      {/* Floating Summary & Generate Panel */}
      {view === 'initializr' && (
        <div className="fixed bottom-6 lg:bottom-8 left-1/2 -translate-x-1/2 w-[95%] max-w-4xl glass-card rounded-2xl px-6 py-4 flex items-center justify-between z-50 animate-fade-in-up shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Ready to go?</span>
              <span className="text-sm font-bold text-on-surface">{form.artifactId}.zip</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs text-on-surface-variant font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary/60"></span>{form.type.includes('maven') ? 'Maven' : 'Gradle'}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-tertiary/60"></span>Java {form.javaVersion}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-secondary"></span>Boot {form.bootVersion}</span>
              {selected.length > 0 && (
                <span className="flex items-center gap-1.5 pl-3 border-l border-outline-variant text-on-surface">{selected.length} deps</span>
              )}
              {multiModuleEnabled && selectedModules.length > 0 && (
                <span className="flex items-center gap-1.5 pl-3 border-l border-outline-variant text-on-surface">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>account_tree</span>
                  {selectedModules.length} modules
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => triggerDownload(form, selected, selectedOptions, { enabled: multiModuleEnabled, modules: selectedModules })}
            className="px-8 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn shadow-lg"
          >
            GENERATE
          </button>
        </div>
      )}
    </div>
  )
}
