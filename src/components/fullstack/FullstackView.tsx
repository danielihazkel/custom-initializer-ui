import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { validateEntities, validateMeta, countMetaErrors, type MetaErrors } from './validation'

interface ProjectMeta {
  groupId: string
  artifactId: string
  packageName: string
  domainPackage: string
  bootVersion: string
  javaVersion: string
}

const DEFAULT_META: ProjectMeta = {
  groupId: 'com.menora',
  artifactId: 'demo',
  packageName: 'com.menora.demo',
  domainPackage: '',
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

// localStorage keys — namespaced so they don't collide with the Backend/Frontend tabs.
const LS = {
  meta: 'fullstack:meta',
  entities: 'fullstack:entities',
  deps: 'fullstack:deps',
  backendSet: 'fullstack:backendSet',
  frontendSet: 'fullstack:frontendSet',
} as const

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

export function FullstackView() {
  const [meta, setMeta] = useState<ProjectMeta>(() => loadJson(LS.meta, DEFAULT_META))
  const [entities, setEntities] = useState<FullstackEntityDef[]>(() => loadJson(LS.entities, DEFAULT_ENTITIES))
  const [backendSet, setBackendSet] = useState(() => localStorage.getItem(LS.backendSet) ?? 'spring-jpa-crud')
  const [frontendSet, setFrontendSet] = useState(() => localStorage.getItem(LS.frontendSet) ?? 'react-tailwind-crud')
  const [availableSets, setAvailableSets] = useState<EntityTemplateSetSummary[]>([])
  const [setsLoading, setSetsLoading] = useState(true)
  const [setsError, setSetsError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedDeps, setSelectedDeps] = useState<string[]>(() => loadJson<string[]>(LS.deps, []))
  const {
    preview, previousPreview, loading: previewLoading, error: previewError,
    fetchPreview, clearPreview, clearError,
  } = useFullstackPreview()

  const { bootVersions, javaVersions } = useAdminMetadata()
  const currentBackendSet = availableSets.find(s => s.setKey === backendSet)
  const currentFrontendSet = availableSets.find(s => s.setKey === frontendSet)
  const currentDefaults = currentBackendSet?.defaultDeps ?? []

  // Validation — mirrors the backend FullstackRequestValidator so problems surface inline
  // before submit. The server stays the source of truth.
  const entityErrors = useMemo(() => validateEntities(entities), [entities])
  const metaErrors: MetaErrors = useMemo(() => validateMeta(meta), [meta])
  const errorCount = entityErrors.count + countMetaErrors(metaErrors)
  const hasErrors = errorCount > 0

  // Persist form state so a refresh doesn't lose the user's work (mirrors useProjectState).
  useEffect(() => { localStorage.setItem(LS.meta, JSON.stringify(meta)) }, [meta])
  useEffect(() => { localStorage.setItem(LS.entities, JSON.stringify(entities)) }, [entities])
  useEffect(() => { localStorage.setItem(LS.deps, JSON.stringify(selectedDeps)) }, [selectedDeps])
  useEffect(() => { localStorage.setItem(LS.backendSet, backendSet) }, [backendSet])
  useEffect(() => { localStorage.setItem(LS.frontendSet, frontendSet) }, [frontendSet])

  // Drop a stale preview error once the user changes any input, so the Explore button
  // doesn't stay error-styled (with the message hidden in a tooltip) after they've moved on.
  useEffect(() => { clearError() }, [meta, entities, selectedDeps, backendSet, frontendSet, clearError])

  // Reseed deps + pre-fill Boot/Java versions from the chosen backend set's pins. We only do
  // this on a *genuine* user change of the backend set — never on initial hydration, so a
  // restored selection (deps/versions) isn't clobbered when availableSets loads. The pins are
  // advisory: the user can still override the version dropdowns afterwards.
  const seededBackendSetRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentBackendSet) return
    if (seededBackendSetRef.current === null) {
      // First resolution after load — adopt without overwriting restored state. Only seed
      // defaults if we have no saved deps at all (first-ever visit).
      seededBackendSetRef.current = currentBackendSet.setKey
      setSelectedDeps(prev => prev.length === 0 ? [...currentBackendSet.defaultDeps] : prev)
      return
    }
    if (seededBackendSetRef.current !== currentBackendSet.setKey) {
      const prevSet = availableSets.find(s => s.setKey === seededBackendSetRef.current)
      const prevDefaults = new Set(prevSet?.defaultDeps ?? [])
      seededBackendSetRef.current = currentBackendSet.setKey
      // Re-seed the new set's defaults but keep any user-added extras (deps the
      // user selected that weren't defaults of the previous set), so switching
      // sets doesn't silently discard their custom picks.
      setSelectedDeps(prev => {
        const extras = prev.filter(d => !prevDefaults.has(d))
        return Array.from(new Set([...currentBackendSet.defaultDeps, ...extras]))
      })
      setMeta(prev => ({
        ...prev,
        bootVersion: currentBackendSet.bootVersion ?? prev.bootVersion,
        javaVersion: currentBackendSet.javaVersion ?? prev.javaVersion,
      }))
    }
  }, [currentBackendSet, availableSets])

  // Frontend sets can also declare a javaVersion (rare). Apply only on a genuine change.
  const seededFrontendSetRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentFrontendSet) return
    if (seededFrontendSetRef.current === null) {
      seededFrontendSetRef.current = currentFrontendSet.setKey
      return
    }
    if (seededFrontendSetRef.current !== currentFrontendSet.setKey) {
      seededFrontendSetRef.current = currentFrontendSet.setKey
      if (currentFrontendSet.javaVersion) {
        setMeta(prev => ({ ...prev, javaVersion: currentFrontendSet.javaVersion! }))
      }
    }
  }, [currentFrontendSet])

  function handleImport(imported: FullstackEntityDef[], mode: ImportMode) {
    setEntities(mode === 'replace' ? imported : [...entities, ...imported])
    const verb = mode === 'replace' ? 'Replaced with' : 'Appended'
    const n = imported.length
    setToast({ message: `${verb} ${n} entit${n === 1 ? 'y' : 'ies'} from DDL`, type: 'success' })
  }

  // Load the template-set list. Extracted so the inline Retry can re-run it; on failure
  // we keep the hardcoded fallback options (the screen stays usable) and surface a
  // persistent inline notice rather than a one-shot toast the user might miss.
  const loadTemplateSets = useCallback(() => {
    setSetsLoading(true)
    setSetsError(null)
    fetch('/metadata/entity-template-sets')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: EntityTemplateSetSummary[]) => setAvailableSets(data))
      .catch((err: Error) => setSetsError(err.message))
      .finally(() => setSetsLoading(false))
  }, [])

  useEffect(() => { loadTemplateSets() }, [loadTemplateSets])

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
    if (hasErrors) {
      setToast({ message: `Fix ${errorCount} validation issue${errorCount === 1 ? '' : 's'} first`, type: 'error' })
      return false
    }
    return true
  }

  function explore() {
    if (!validateBeforeSubmit()) return
    fetchPreview(buildBody())
  }

  /** Returns true when the ZIP downloaded successfully — lets the preview modal stay
   *  open (and show the error toast) on failure, and close only on success. */
  async function generate(): Promise<boolean> {
    if (!validateBeforeSubmit()) return false
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
      return true
    } catch (err) {
      setToast({ message: `Generation failed: ${(err as Error).message}`, type: 'error' })
      return false
    } finally {
      setGenerating(false)
    }
  }

  function updateMeta(updates: Partial<ProjectMeta>) {
    setMeta(prev => ({ ...prev, ...updates }))
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  // The global Reset (App.tsx) is hidden on this tab; we portal our own, mirroring
  // FrontendView. FullstackDepPicker is fully controlled, so resetting selectedDeps
  // below re-renders it — no remount needed.
  function handleReset() {
    if (!confirm('Reset the fullstack generator to defaults? This clears your entities and selections.')) return
    Object.values(LS).forEach(k => localStorage.removeItem(k))
    setMeta({ ...DEFAULT_META })
    setEntities(DEFAULT_ENTITIES.map(e => ({ ...e, fields: e.fields.map(f => ({ ...f })) })))
    setBackendSet('spring-jpa-crud')
    setFrontendSet('react-tailwind-crud')
    // Re-seed deps from whichever backend set resolves; the set-change effect won't
    // fire if the key is unchanged, so seed explicitly here.
    const target = availableSets.find(s => s.setKey === 'spring-jpa-crud')
    setSelectedDeps(target ? [...target.defaultDeps] : [])
    clearPreview()
    setToast({ message: 'Fullstack generator reset to defaults', type: 'success' })
  }
  const portalTarget = typeof document !== 'undefined' ? document.body : null

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
          <Labeled label="Group ID" htmlFor="fs-groupId" error={metaErrors.groupId}>
            <input id="fs-groupId" className={inputClass(metaErrors.groupId)} value={meta.groupId}
                   aria-invalid={Boolean(metaErrors.groupId)}
                   onChange={e => updateMeta({ groupId: e.target.value })} />
          </Labeled>
          <Labeled label="Artifact ID" htmlFor="fs-artifactId" error={metaErrors.artifactId}>
            <input id="fs-artifactId" className={inputClass(metaErrors.artifactId)} value={meta.artifactId}
                   aria-invalid={Boolean(metaErrors.artifactId)}
                   onChange={e => updateMeta({ artifactId: e.target.value })} />
          </Labeled>
          <Labeled label="Package Name" htmlFor="fs-packageName" error={metaErrors.packageName}>
            <input id="fs-packageName" className={inputClass(metaErrors.packageName)} value={meta.packageName}
                   aria-invalid={Boolean(metaErrors.packageName)}
                   onChange={e => updateMeta({ packageName: e.target.value })} />
          </Labeled>
          <Labeled label="Domain Package" htmlFor="fs-domainPackage" error={metaErrors.domainPackage}>
            <input id="fs-domainPackage" className={inputClass(metaErrors.domainPackage)} value={meta.domainPackage}
                   aria-invalid={Boolean(metaErrors.domainPackage)}
                   placeholder={meta.packageName || 'com.menora.demo'}
                   onChange={e => updateMeta({ domainPackage: e.target.value })} />
            <p className="text-[11px] text-on-surface-variant">
              Where entities/repositories/controllers go, split into <code>.entity</code>, <code>.repository</code>,
              <code>.dto</code>, <code>.service</code>, <code>.controller</code>. Blank = same as Package Name; must be under it.
            </p>
          </Labeled>
          <Labeled label="Java Version" htmlFor="fs-javaVersion">
            <select id="fs-javaVersion" className={inputClass()} value={meta.javaVersion}
                    onChange={e => updateMeta({ javaVersion: e.target.value })}>
              {javaVersions.length === 0 && <option value={meta.javaVersion}>{meta.javaVersion}</option>}
              {javaVersions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </Labeled>
          <Labeled label="Boot Version" htmlFor="fs-bootVersion">
            <select id="fs-bootVersion" className={inputClass()} value={meta.bootVersion}
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
        {setsError && (
          <div className="flex items-center justify-between gap-3 text-[11px] text-error border border-error/30 bg-error/10 rounded px-3 py-2">
            <span>Couldn't load template sets ({setsError}); showing defaults.</span>
            <button
              type="button"
              onClick={loadTemplateSets}
              disabled={setsLoading}
              className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-error/40 text-error hover:bg-error/10 transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>refresh</span>
              Retry
            </button>
          </div>
        )}
        {setsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-hidden="true">
            <div className="h-[58px] rounded bg-surface-container-low animate-pulse" />
            <div className="h-[58px] rounded bg-surface-container-low animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Labeled label="Backend" htmlFor="fs-backendSet">
              <select id="fs-backendSet" className={inputClass()} value={backendSet} onChange={e => setBackendSet(e.target.value)}>
                {backendSets.length === 0 && <option value="spring-jpa-crud">spring-jpa-crud (default)</option>}
                {backendSets.map(s => <option key={s.setKey} value={s.setKey}>{s.name} ({s.setKey})</option>)}
              </select>
            </Labeled>
            <Labeled label="Frontend" htmlFor="fs-frontendSet">
              <select id="fs-frontendSet" className={inputClass()} value={frontendSet} onChange={e => setFrontendSet(e.target.value)}>
                {frontendSets.length === 0 && <option value="react-tailwind-crud">react-tailwind-crud (default)</option>}
                {frontendSets.map(s => <option key={s.setKey} value={s.setKey}>{s.name} ({s.setKey})</option>)}
              </select>
            </Labeled>
          </div>
        )}
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
        <EntitiesEditor entities={entities} onChange={setEntities} errors={entityErrors.entities} />
      </section>

      <section className="border-t border-outline-variant pt-6 flex items-center justify-end gap-3">
        {hasErrors && (
          <span className="text-[11px] text-error flex items-center gap-1 mr-auto">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
            {errorCount} issue{errorCount === 1 ? '' : 's'} to fix before generating
          </span>
        )}
        <button
          onClick={explore}
          disabled={previewLoading || hasErrors}
          title={previewError ? (previewError.kind ? `${previewError.kind}: ${previewError.message}` : previewError.message) : 'Preview the generated file tree before downloading'}
          className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 active:scale-95 disabled:opacity-60 ${previewError
            ? 'border-error/50 text-error hover:bg-error/5'
            : 'border-outline-variant text-secondary hover:text-primary hover:border-primary hover:bg-primary/5'}`}
        >
          {previewLoading
            ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
            : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>travel_explore</span>Explore</>}
        </button>
        <button
          onClick={generate}
          disabled={generating || hasErrors}
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
        existingCount={entities.length}
        onImport={handleImport}
      />

      {portalTarget && createPortal(
        <button
          onClick={handleReset}
          className="fixed bottom-8 right-8 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface-container-high border border-outline-variant text-secondary hover:text-error hover:border-error/50 shadow-lg transition-all active:scale-95"
          title="Reset the fullstack generator"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>restart_alt</span>
          Reset
        </button>,
        portalTarget,
      )}

      {preview && createPortal(
        <ProjectPreview
          preview={preview}
          previousPreview={previousPreview}
          artifactId={meta.artifactId || 'demo'}
          onClose={clearPreview}
          onDownload={async () => { if (await generate()) clearPreview() }}
        />,
        document.body,
      )}
    </div>
  )
}

function inputClass(error?: string): string {
  const base = 'w-full bg-background border rounded px-3 py-2 text-sm text-on-surface outline-none transition-all'
  return error
    ? `${base} border-error focus:ring-2 focus:ring-error/20 focus:border-error`
    : `${base} border-outline-variant focus:ring-2 focus:ring-primary/20 focus:border-primary`
}

function Labeled({ label, htmlFor, error, children }: {
  label: string; htmlFor?: string; error?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-[11px] font-semibold uppercase tracking-wider text-secondary">{label}</label>
      {children}
      {error && <p className="text-[11px] text-error">{error}</p>}
    </div>
  )
}
