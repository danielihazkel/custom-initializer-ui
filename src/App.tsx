import { useState, useEffect } from 'react'
import { useMetadata } from './hooks/useMetadata'
import { useExtensions } from './hooks/useExtensions'
import { ProjectForm } from './components/ProjectForm'
import { OptionsPanel } from './components/OptionsPanel'
import { DependencySelector } from './components/DependencySelector'
import type { InitializrMetadata, ProjectFormValues } from './types'

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
  selectedOptions: Record<string, string[]>
): void {
  const url = new URL('/starter.zip', window.location.origin)
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
  const [form, setForm] = useState<ProjectFormValues>(() => defaultForm(null))
  const [selected, setSelected] = useState<string[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({})
  const [initialized, setInitialized] = useState<boolean>(false)
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
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

  useEffect(() => {
    if (metadata && !initialized) {
      setForm(defaultForm(metadata))
      setInitialized(true)
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
  }

  function handleOptionsChange(depId: string, optIds: string[]): void {
    setSelectedOptions(prev => ({ ...prev, [depId]: optIds }))
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
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-background border-b border-outline-variant">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold text-on-surface tracking-tighter">Spring Initializr</span>
          <nav className="hidden md:flex items-center gap-6">
            <a className="text-secondary hover:text-on-surface transition-colors duration-200 text-sm" href="#">Guides</a>
            <a className="text-secondary hover:text-on-surface transition-colors duration-200 text-sm" href="#">Projects</a>
            <a className="text-secondary hover:text-on-surface transition-colors duration-200 text-sm" href="#">Training</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
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
          <button className="px-4 py-1.5 rounded text-sm font-medium text-secondary hover:text-on-surface transition-all duration-200 active:scale-95">
            Explore
          </button>
          <button
            onClick={() => triggerDownload(form, selected, selectedOptions)}
            className="px-5 py-1.5 rounded text-sm font-bold transition-all duration-200 active:scale-95 bg-primary-container text-on-primary-container hover:brightness-110"
          >
            Generate
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 min-h-screen bg-background">
        {loading ? (
          <div className="flex items-center justify-center p-16 text-secondary text-sm">
            Loading metadata…
          </div>
        ) : (
          <div className="max-w-7xl mx-auto p-8 grid grid-cols-12 gap-8">
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
              />
            </section>
          </div>
        )}
      </main>

      {/* Mobile FAB */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-surface-container-high border border-outline-variant shadow-2xl rounded-full px-6 py-3 flex items-center justify-between z-50">
        <div className="flex flex-col">
          <span className="text-[10px] text-secondary font-bold uppercase">Ready?</span>
          <span className="text-xs font-bold text-on-surface">{form.artifactId}.zip</span>
        </div>
        <button
          onClick={() => triggerDownload(form, selected, selectedOptions)}
          className="px-6 py-2 rounded-full text-xs font-bold bg-primary text-on-primary"
        >
          Generate
        </button>
      </div>
    </div>
  )
}
