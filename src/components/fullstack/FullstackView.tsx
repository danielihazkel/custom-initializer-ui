import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  EntityTemplateSetSummary, FullstackEntityDef, FullstackStarterRequest, Toast,
} from '../../types'
import { EntitiesEditor } from './EntitiesEditor'
import { FullstackDepPicker } from './FullstackDepPicker'
import { ImportFromDdlDrawer, type ImportMode } from './ImportFromDdlDrawer'
import { ProjectPreview } from '../ProjectPreview'
import { StatusToast } from '../admin/shared/StatusToast'
import { useFullstackPreview } from '../../hooks/useFullstackPreview'
import { useAdminMetadata } from '../../hooks/useAdminMetadata'

interface ProjectMeta {
  groupId: string
  artifactId: string
  packageName: string
  bootVersion: string
  javaVersion: string
}

const DEFAULT_META: ProjectMeta = {
  groupId: 'com.menora',
  artifactId: 'demo',
  packageName: 'com.menora.demo',
  bootVersion: '3.2.1',
  javaVersion: '21',
}

const DEFAULT_ENTITIES: FullstackEntityDef[] = [
  {
    name: 'User',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true, generated: true },
      { name: 'email', type: 'STRING', required: true, unique: true, length: 200 },
      { name: 'fullName', type: 'STRING', required: true, length: 120 },
      { name: 'active', type: 'BOOLEAN' },
    ],
  },
]

export function FullstackView() {
  const [meta, setMeta] = useState<ProjectMeta>(DEFAULT_META)
  const [entities, setEntities] = useState<FullstackEntityDef[]>(DEFAULT_ENTITIES)
  const [backendSet, setBackendSet] = useState('spring-jpa-crud')
  const [frontendSet, setFrontendSet] = useState('react-tailwind-crud')
  const [availableSets, setAvailableSets] = useState<EntityTemplateSetSummary[]>([])
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedDeps, setSelectedDeps] = useState<string[]>([])
  const {
    preview, previousPreview, loading: previewLoading, error: previewError,
    fetchPreview, clearPreview,
  } = useFullstackPreview()

  const { bootVersions, javaVersions } = useAdminMetadata()
  const currentBackendSet = availableSets.find(s => s.setKey === backendSet)
  const currentFrontendSet = availableSets.find(s => s.setKey === frontendSet)
  const currentDefaults = currentBackendSet?.defaultDeps ?? []

  // Reseed deps + pre-fill Boot/Java versions from the chosen backend set's
  // pins whenever the set changes. The pins are advisory — user can still
  // override the version dropdowns after the set is selected.
  useEffect(() => {
    if (currentBackendSet) {
      setSelectedDeps([...currentBackendSet.defaultDeps])
      setMeta(prev => ({
        ...prev,
        bootVersion: currentBackendSet.bootVersion ?? prev.bootVersion,
        javaVersion: currentBackendSet.javaVersion ?? prev.javaVersion,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendSet, currentBackendSet?.setKey])

  // Frontend sets can also declare a javaVersion (rare). Apply on change.
  useEffect(() => {
    if (currentFrontendSet?.javaVersion) {
      setMeta(prev => ({ ...prev, javaVersion: currentFrontendSet.javaVersion! }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frontendSet, currentFrontendSet?.setKey])

  function handleImport(imported: FullstackEntityDef[], mode: ImportMode) {
    setEntities(mode === 'replace' ? imported : [...entities, ...imported])
    const verb = mode === 'replace' ? 'Replaced with' : 'Appended'
    const n = imported.length
    setToast({ message: `${verb} ${n} entit${n === 1 ? 'y' : 'ies'} from DDL`, type: 'success' })
  }

  useEffect(() => {
    fetch('/metadata/entity-template-sets')
      .then(res => res.ok ? res.json() : [])
      .then((data: EntityTemplateSetSummary[]) => setAvailableSets(data))
      .catch(() => { /* keep defaults */ })
  }, [])

  const backendSets = availableSets.filter(s => s.kind === 'BACKEND_JAVA')
  const frontendSets = availableSets.filter(s => s.kind === 'FRONTEND_REACT')

  function buildBody(): FullstackStarterRequest {
    return {
      ...meta,
      backendTemplateSet: backendSet,
      frontendTemplateSet: frontendSet,
      dependencies: selectedDeps,
      entities,
    }
  }

  function validateBeforeSubmit(): boolean {
    if (!meta.artifactId.trim()) {
      setToast({ message: 'Artifact ID is required', type: 'error' })
      return false
    }
    if (entities.length === 0) {
      setToast({ message: 'Add at least one entity', type: 'error' })
      return false
    }
    return true
  }

  function explore() {
    if (!validateBeforeSubmit()) return
    fetchPreview(buildBody())
  }

  async function generate() {
    if (!validateBeforeSubmit()) return
    setGenerating(true)
    try {
      const body = buildBody()
      const res = await fetch('/starter-fullstack.zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { detail?: string; error?: string } | null
        throw new Error(err?.detail || err?.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${meta.artifactId}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setToast({ message: 'Fullstack project downloaded', type: 'success' })
    } catch (err) {
      setToast({ message: `Generation failed: ${(err as Error).message}`, type: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  function updateMeta(updates: Partial<ProjectMeta>) {
    setMeta(prev => ({ ...prev, ...updates }))
  }

  return (
    <div className="max-w-5xl mx-auto px-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Fullstack CRUD Generator</h1>
        <p className="text-sm text-secondary max-w-2xl">
          Define a set of entities with their fields. Get a single ZIP containing a Spring Boot backend
          (JPA + REST controllers per entity) and a React frontend (Vite + Tailwind, with a table-driven
          CRUD page per entity), already wired together end-to-end.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Project Metadata</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Labeled label="Group ID">
            <input className={inputClass} value={meta.groupId}
                   onChange={e => updateMeta({ groupId: e.target.value })} />
          </Labeled>
          <Labeled label="Artifact ID">
            <input className={inputClass} value={meta.artifactId}
                   onChange={e => updateMeta({ artifactId: e.target.value })} />
          </Labeled>
          <Labeled label="Package Name">
            <input className={inputClass} value={meta.packageName}
                   onChange={e => updateMeta({ packageName: e.target.value })} />
          </Labeled>
          <Labeled label="Java Version">
            <select className={inputClass} value={meta.javaVersion}
                    onChange={e => updateMeta({ javaVersion: e.target.value })}>
              {javaVersions.length === 0 && <option value={meta.javaVersion}>{meta.javaVersion}</option>}
              {javaVersions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </Labeled>
          <Labeled label="Boot Version">
            <select className={inputClass} value={meta.bootVersion}
                    onChange={e => updateMeta({ bootVersion: e.target.value })}>
              {bootVersions.length === 0 && <option value={meta.bootVersion}>{meta.bootVersion}</option>}
              {bootVersions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </Labeled>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Template Sets</h2>
        <p className="text-[11px] text-on-surface-variant">
          Generated files come from the selected backend + frontend template sets. Edit them in the
          Config admin panel under "Entity CRUD".
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Labeled label="Backend">
            <select className={inputClass} value={backendSet} onChange={e => setBackendSet(e.target.value)}>
              {backendSets.length === 0 && <option value="spring-jpa-crud">spring-jpa-crud (default)</option>}
              {backendSets.map(s => <option key={s.setKey} value={s.setKey}>{s.name} ({s.setKey})</option>)}
            </select>
          </Labeled>
          <Labeled label="Frontend">
            <select className={inputClass} value={frontendSet} onChange={e => setFrontendSet(e.target.value)}>
              {frontendSets.length === 0 && <option value="react-tailwind-crud">react-tailwind-crud (default)</option>}
              {frontendSets.map(s => <option key={s.setKey} value={s.setKey}>{s.name} ({s.setKey})</option>)}
            </select>
          </Labeled>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Dependencies</h2>
          <span className="text-[11px] text-secondary">{selectedDeps.length} selected</span>
        </div>
        <p className="text-[11px] text-on-surface-variant">
          Pre-checked from the chosen backend set's defaults. You can uncheck
          anything — the generator respects your final selection. To change what
          a set ships pre-checked, edit it under Admin → Entity CRUD.
        </p>
        <FullstackDepPicker
          selected={selectedDeps}
          defaults={currentDefaults}
          onChange={setSelectedDeps}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Entities</h2>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-secondary">{entities.length} entit{entities.length === 1 ? 'y' : 'ies'}</span>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-outline-variant text-secondary hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors"
              title="Parse CREATE TABLE DDL into entities"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>database</span>
              Import from DDL
            </button>
          </div>
        </div>
        <EntitiesEditor entities={entities} onChange={setEntities} />
      </section>

      <section className="border-t border-outline-variant pt-6 flex items-center justify-end gap-3">
        <button
          onClick={explore}
          disabled={previewLoading}
          title={previewError ? (previewError.kind ? `${previewError.kind}: ${previewError.message}` : previewError.message) : 'Preview the generated file tree before downloading'}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-60 ${previewError ? 'text-error' : 'text-secondary hover:text-on-surface'}`}
        >
          {previewLoading
            ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
            : 'Explore'}
        </button>
        <button
          onClick={generate}
          disabled={generating}
          className="px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn shadow-md disabled:opacity-60"
        >
          {generating ? 'Generating…' : 'Generate Fullstack ZIP'}
        </button>
      </section>

      <StatusToast toast={toast} onClear={() => setToast(null)} />

      <ImportFromDdlDrawer
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        hasExisting={entities.length > 0}
        onImport={handleImport}
      />

      {preview && createPortal(
        <ProjectPreview
          preview={preview}
          previousPreview={previousPreview}
          artifactId={meta.artifactId || 'demo'}
          onClose={clearPreview}
          onDownload={() => { generate(); clearPreview() }}
        />,
        document.body,
      )}
    </div>
  )
}

const inputClass =
  'w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all'

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-secondary">{label}</label>
      {children}
    </div>
  )
}
