import { useState, useEffect } from 'react'
import { useMetadata } from './hooks/useMetadata'
import { ProjectForm } from './components/ProjectForm'
import { OptionsPanel } from './components/OptionsPanel'
import { DependencySelector } from './components/DependencySelector'
import { GenerateButton } from './components/GenerateButton'

function defaultForm(metadata) {
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

export default function App() {
  const { metadata, loading, error } = useMetadata()
  const [form, setForm] = useState(() => defaultForm(null))
  const [selected, setSelected] = useState([])
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (metadata && !initialized) {
      setForm(defaultForm(metadata))
      setInitialized(true)
    }
  }, [metadata, initialized])

  function handleFormChange(updates) {
    setForm(prev => ({ ...prev, ...updates }))
  }

  if (error) {
    return (
      <div className="error-screen">
        <h2>Cannot reach backend</h2>
        <p>Make sure the Spring Initializr backend is running on port 8080.</p>
        <code>{error}</code>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <span className="header-logo">🍃</span>
          <div>
            <h1>Menora Spring Initializr</h1>
            <p>Generate a Spring Boot project with Menora defaults</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        {loading ? (
          <div className="loading">Loading metadata…</div>
        ) : (
          <div className="app-columns">
            <div className="left-col">
              <ProjectForm values={form} onChange={handleFormChange} />
              <OptionsPanel metadata={metadata} values={form} onChange={handleFormChange} />
            </div>
            <div className="right-col">
              <DependencySelector
                metadata={metadata}
                selected={selected}
                onChange={setSelected}
              />
            </div>
          </div>
        )}
      </main>

      {!loading && (
        <GenerateButton form={form} selected={selected} />
      )}
    </div>
  )
}
