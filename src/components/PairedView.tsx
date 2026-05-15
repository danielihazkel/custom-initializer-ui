import { useEffect, useState } from 'react'
import { useMetadata } from '../hooks/useMetadata'
import { useFrontendMetadata } from '../hooks/useFrontendMetadata'

/**
 * Minimal MVP for the paired generator. Two columns (BE + FE), each with project
 * naming and a flat dependency picker, plus a single Generate button that POSTs
 * to `/starter-paired.zip` and triggers a browser download.
 *
 * Power users who want the rich BE form (wizards, multi-module, presets) or the
 * rich FE form (starter templates, color palette, sub-options) still use the
 * dedicated Backend/Frontend tabs. This view exists to demonstrate the paired
 * endpoint and produce a working monorepo skeleton.
 */
export function PairedView() {
  const { metadata: be, loading: beLoading } = useMetadata()
  const { metadata: fe, loading: feLoading } = useFrontendMetadata()

  const [beArtifactId, setBeArtifactId] = useState('demo-api')
  const [bePackageName, setBePackageName] = useState('')
  const [beBootVersion, setBeBootVersion] = useState('')
  const [beDeps, setBeDeps] = useState<string[]>(['web'])

  const [feProjectName, setFeProjectName] = useState('demo-ui')
  const [fePackageManager, setFePackageManager] = useState('pnpm')
  const [feDeps, setFeDeps] = useState<string[]>(['style-tailwind'])

  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [openApiSpec, setOpenApiSpec] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Apply server defaults once metadata loads, but don't overwrite user edits.
  useEffect(() => {
    if (be && !beBootVersion) setBeBootVersion(be.bootVersion?.default ?? '')
  }, [be, beBootVersion])
  useEffect(() => {
    if (fe && !fePackageManager) setFePackageManager(fe.defaults.packageManager)
  }, [fe, fePackageManager])

  function toggleBeDep(depId: string) {
    setBeDeps(prev => prev.includes(depId) ? prev.filter(d => d !== depId) : [...prev, depId])
  }
  function toggleFeDep(depId: string) {
    setFeDeps(prev => prev.includes(depId) ? prev.filter(d => d !== depId) : [...prev, depId])
  }

  async function handleGenerate() {
    setBusy(true)
    setError(null)
    try {
      // When the user provides an OpenAPI spec we route it through the existing
      // wizard contract (specByDep keyed by the BE openapi dep id). The same spec
      // is picked up by FrontendProjectGenerator and written to frontend/openapi.yaml
      // when the FE half has the api-client-openapi dep selected.
      const trimmedSpec = openApiSpec.trim()
      const backendDeps = trimmedSpec && !beDeps.includes('openapi')
        ? [...beDeps, 'openapi']
        : beDeps

      const body: Record<string, unknown> = {
        backend: {
          artifactId: beArtifactId || 'demo-api',
          packageName: bePackageName || undefined,
          bootVersion: beBootVersion || undefined,
          dependencies: backendDeps,
          ...(trimmedSpec ? { specByDep: { openapi: trimmedSpec } } : {}),
        },
        frontend: {
          projectName: feProjectName || 'demo-ui',
          packageManager: fePackageManager,
          dependencies: feDeps,
          apiBaseUrl: apiBaseUrl || undefined,
          backendArtifactId: beArtifactId || undefined,
        },
      }
      const res = await fetch('/starter-paired.zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${beArtifactId || 'paired'}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (beLoading || feLoading) {
    return <div className="flex items-center justify-center p-16 text-secondary text-sm">Loading metadata…</div>
  }
  if (!be || !fe) {
    return <div className="flex items-center justify-center p-16 text-error text-sm">Failed to load metadata.</div>
  }

  return (
    <div className="max-w-7xl mx-auto px-6 space-y-6">
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>
            link
          </span>
          <h1 className="text-xl font-bold text-on-surface">Paired Generator</h1>
        </div>
        <p className="text-sm text-secondary">
          Spring Boot backend + React/Vite frontend in a single monorepo zip, pre-wired so the FE talks
          to the BE in dev (env file + Vite proxy + CORS).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backend column */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>terminal</span>
            <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface">Backend</h2>
          </div>

          <Field label="Artifact ID">
            <input value={beArtifactId} onChange={e => setBeArtifactId(e.target.value)}
                   className={inputClass} placeholder="demo-api" />
          </Field>
          <Field label="Package Name (optional)">
            <input value={bePackageName} onChange={e => setBePackageName(e.target.value)}
                   className={inputClass} placeholder="com.menora.demo" />
          </Field>
          <Field label="Boot Version">
            <select value={beBootVersion} onChange={e => setBeBootVersion(e.target.value)} className={inputClass}>
              {be.bootVersion.values.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>

          <DepGroupList
            groups={be.dependencies.values.map(g => ({
              name: g.name,
              entries: g.values.map(v => ({ id: v.id, name: v.name, description: v.description })),
            }))}
            selected={beDeps}
            onToggle={toggleBeDep}
          />
        </div>

        {/* Frontend column */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>monitor</span>
            <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface">Frontend</h2>
          </div>

          <Field label="Project Name">
            <input value={feProjectName} onChange={e => setFeProjectName(e.target.value)}
                   className={inputClass} placeholder="demo-ui" />
          </Field>
          <Field label="Package Manager">
            <div className="inline-flex p-0.5 rounded-xl border border-outline-variant bg-surface-container-high">
              {fe.packageManagers.map(pm => {
                const active = pm.id === fePackageManager
                return (
                  <button key={pm.id} type="button" onClick={() => setFePackageManager(pm.id)}
                          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            active ? 'bg-primary text-on-primary shadow-sm'
                                   : 'text-secondary hover:text-on-surface'}`}>
                    {pm.name}
                  </button>
                )
              })}
            </div>
          </Field>

          <DepGroupList
            groups={fe.dependencies.map(g => ({
              name: g.name,
              entries: g.entries.map(e => ({ id: e.id, name: e.name, description: e.description })),
            }))}
            selected={feDeps}
            onToggle={toggleFeDep}
          />
        </div>
      </div>

      {/* Bottom row: paired wiring + Generate */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <Field label="API Base URL (optional — defaults to http://localhost:8080)">
          <input value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)}
                 className={inputClass} placeholder="http://localhost:8080" />
        </Field>

        <Field label="OpenAPI spec (optional — drives BE codegen + FE typed client)">
          <textarea
            value={openApiSpec}
            onChange={e => setOpenApiSpec(e.target.value)}
            placeholder={"# Paste an OpenAPI 3 YAML or JSON spec.\n# Auto-adds the BE openapi dep; the FE gets it at\n# frontend/openapi.yaml + a gen:api npm script."}
            className={`${inputClass} font-mono text-xs min-h-[140px]`}
            spellCheck={false}
          />
          {feDeps.includes('api-client-openapi') && !openApiSpec.trim() && (
            <span className="block text-[11px] text-on-warning-container/80 mt-1 px-0.5">
              <span className="material-symbols-outlined align-middle" style={{ fontSize: '13px' }}>info</span>{' '}
              api-client-openapi is selected but no spec was provided — the dep ships its
              scripts and config but <code>openapi.yaml</code> will be missing.
            </span>
          )}
        </Field>

        {error && (
          <div className="text-xs text-error bg-error-container/20 border border-error-container rounded-xl p-3">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={handleGenerate} disabled={busy}
                  className="px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn disabled:opacity-60">
            {busy ? 'Generating…' : 'Generate Paired Zip'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputClass =
  'w-full bg-surface-container-high border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase font-bold tracking-widest text-primary mb-1.5">{label}</span>
      {children}
    </label>
  )
}

interface DepListGroup {
  name: string
  entries: { id: string; name: string; description?: string }[]
}

function DepGroupList({ groups, selected, onToggle }: {
  groups: DepListGroup[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <span className="block text-[10px] uppercase font-bold tracking-widest text-primary">Dependencies</span>
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
        {groups.map(g => (
          <div key={g.name}>
            <div className="text-[11px] text-secondary mb-1.5 px-0.5 uppercase tracking-wide">{g.name}</div>
            <div className="flex flex-wrap gap-1.5">
              {g.entries.map(e => {
                const active = selected.includes(e.id)
                return (
                  <button key={e.id} type="button" onClick={() => onToggle(e.id)}
                          title={e.description}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                            active
                              ? 'bg-primary text-on-primary border-primary'
                              : 'border-outline-variant text-secondary hover:text-on-surface hover:border-primary/40'
                          }`}>
                    {e.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
