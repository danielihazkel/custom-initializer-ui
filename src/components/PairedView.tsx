import { useCallback, useMemo, useState } from 'react'
import { BackendHalfPanel, type BackendHalfState } from './paired/BackendHalfPanel'
import { FrontendHalfPanel, type FrontendHalfState } from './paired/FrontendHalfPanel'
import { OpenApiSourceInput } from './paired/OpenApiSourceInput'

/**
 * Paired BE+FE generator. Two columns hosting the same form components used by
 * the dedicated Backend and Frontend tabs — sub-options, compatibility banners,
 * design system + palette, starter templates, version selectors all carry over.
 *
 * Each half-panel owns its own state in memory (paired state is intentionally
 * not persisted to localStorage so it doesn't collide with the dedicated tabs'
 * saved selections). The bottom row carries the three shared concerns:
 *   - apiBaseUrl (FE → BE wiring at dev time)
 *   - OpenAPI spec (drives BE codegen + FE typed-client output)
 *   - the Generate button (single POST to /starter-paired.zip)
 */
export function PairedView() {
  const [beState, setBeState] = useState<BackendHalfState | null>(null)
  const [feState, setFeState] = useState<FrontendHalfState | null>(null)

  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [openApiSpec, setOpenApiSpec] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onBeChange = useCallback((s: BackendHalfState) => setBeState(s), [])
  const onFeChange = useCallback((s: FrontendHalfState) => setFeState(s), [])

  const beArtifactId = beState?.form.artifactId ?? 'demo-api'
  const feProjectName = feState?.form.projectName ?? 'demo-ui'

  const ready = beState !== null && feState !== null

  const showOpenApiSpecMissingWarning = useMemo(
    () => Boolean(feState?.selectedDeps.includes('api-client-openapi')) && !openApiSpec.trim(),
    [feState?.selectedDeps, openApiSpec],
  )

  async function handleGenerate() {
    if (!beState || !feState) return
    setBusy(true)
    setError(null)
    try {
      const trimmedSpec = openApiSpec.trim()

      const beOpts: Record<string, string[]> = {}
      for (const [depId, optIds] of Object.entries(beState.selectedOptions)) {
        if (optIds.length > 0 && beState.selectedDeps.includes(depId)) beOpts[depId] = optIds
      }

      const specByDep: Record<string, string> = {}
      let backendDeps = beState.selectedDeps
      if (trimmedSpec) {
        specByDep.openapi = trimmedSpec
        if (!backendDeps.includes('openapi')) backendDeps = [...backendDeps, 'openapi']
      }
      // Carry per-dep wizard specs (set via the BE half's OpenAPI wizard drawer).
      for (const [depId, entry] of Object.entries(beState.openApiByDep)) {
        if (backendDeps.includes(depId) && entry.spec) specByDep[depId] = entry.spec
      }

      const feOpts: Record<string, string[]> = {}
      for (const [depId, optIds] of Object.entries(feState.selectedOptions)) {
        if (optIds.length > 0 && feState.selectedDeps.includes(depId)) feOpts[depId] = optIds
      }

      const body = {
        backend: {
          groupId: beState.form.groupId,
          artifactId: beState.form.artifactId,
          name: beState.form.name,
          description: beState.form.description,
          packageName: beState.form.packageName,
          bootVersion: beState.form.bootVersion,
          language: beState.form.language,
          type: beState.form.type,
          packaging: beState.form.packaging,
          javaVersion: beState.form.javaVersion,
          dependencies: backendDeps,
          opts: beOpts,
          ...(Object.keys(specByDep).length > 0 ? { specByDep } : {}),
        },
        frontend: {
          projectName: feState.form.projectName,
          description: feState.form.description,
          scope: feState.form.scope,
          appTitle: feState.form.appTitle,
          reactVersion: feState.reactVersion,
          nodeVersion: feState.nodeVersion,
          packageManager: feState.packageManager,
          basePath: feState.basePath,
          colorPalette: feState.colorPaletteId,
          apiBaseUrl: apiBaseUrl || undefined,
          backendArtifactId: beState.form.artifactId || undefined,
          dependencies: feState.selectedDeps,
          opts: feOpts,
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
      a.download = `${beState.form.artifactId || 'paired'}.zip`
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

  return (
    <div className="max-w-7xl mx-auto px-6 space-y-8">
      {/* Mini-hero */}
      <div className="px-2 space-y-3">
        <span className="label-runic-sm text-primary flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>link</span>
          Paired Generator
        </span>
        <h2 className="display text-on-surface font-normal" style={{ fontSize: 'clamp(28px, 4vw, 36px)', lineHeight: 1.1 }}>
          Backend + Frontend, Pre-Wired
        </h2>
        <p className="text-sm text-secondary max-w-3xl">
          Spring Boot backend + React/Vite frontend in a single monorepo zip, pre-wired so the FE talks
          to the BE in dev (env file + Vite proxy + CORS). Same form depth as the dedicated tabs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backend column */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <span className="label-runic-sm text-primary flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>terminal</span>
              Backend
            </span>
            <span className="cut-corners ml-2 px-2 py-0.5 text-[10px] font-mono bg-primary/10 text-primary">
              {beArtifactId}
            </span>
          </div>
          <BackendHalfPanel onChange={onBeChange} />
        </section>

        {/* Frontend column */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <span className="label-runic-sm text-primary flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>monitor</span>
              Frontend
            </span>
            <span className="cut-corners ml-2 px-2 py-0.5 text-[10px] font-mono bg-primary/10 text-primary">
              {feProjectName}
            </span>
          </div>
          <FrontendHalfPanel onChange={onFeChange} />
        </section>
      </div>

      {/* Bottom row: paired wiring + Generate */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <h2 className="label-runic-sm text-primary flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>cable</span>
          Wiring
        </h2>

        <Field label="API Base URL (optional — defaults to http://localhost:8080)">
          <input
            value={apiBaseUrl}
            onChange={e => setApiBaseUrl(e.target.value)}
            className={inputClass}
            placeholder="http://localhost:8080"
          />
          <span className="block text-[11px] text-secondary mt-1 px-0.5">
            Writes <code>.env.development</code> and a <code>/api</code> proxy in the FE’s <code>vite.config.ts</code>.
          </span>
        </Field>

        <Field label="OpenAPI spec (optional — drives BE codegen + FE typed client)">
          <OpenApiSourceInput
            value={openApiSpec}
            onChange={setOpenApiSpec}
            apiBaseUrl={apiBaseUrl}
          />
          {showOpenApiSpecMissingWarning && (
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
          <button
            onClick={handleGenerate}
            disabled={busy || !ready}
            className="cut-corners runic label-runic-sm px-6 py-2 transition-all duration-300 active:scale-95 animated-gradient-btn disabled:opacity-60"
          >
            {busy ? 'Generating…' : 'Generate Paired Zip'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputClass =
  'w-full bg-surface-container/40 border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-runic-sm text-primary block mb-1.5">{label}</span>
      {children}
    </label>
  )
}
