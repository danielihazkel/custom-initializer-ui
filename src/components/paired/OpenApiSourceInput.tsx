import { useCallback, useEffect, useRef, useState } from 'react'

type Tab = 'paste' | 'upload' | 'url' | 'be'

interface ValidateSummary {
  operations: number
  schemas: number
  title?: string
  version?: string
}

interface ValidateResponse {
  valid: boolean
  errors: string[]
  summary: ValidateSummary | null
}

interface Props {
  /** Current spec text. The parent owns this so other code paths (warning banners,
   *  request body assembly) can read it directly. */
  value: string
  onChange: (spec: string) => void
  /** API base URL from the shared wiring row — used by the "From BE" shortcut. */
  apiBaseUrl: string
}

/**
 * Tabbed input letting the user supply an OpenAPI spec four ways:
 *   Paste · Upload · Fetch URL · Pull from BE (/v3/api-docs).
 *
 * URL fetches go through {@code POST /paired/openapi/fetch} on the same backend
 * — the browser can't reach a separate-port BE directly (no CORS), so the
 * initializr proxies the request.
 */
export function OpenApiSourceInput({ value, onChange, apiBaseUrl }: Props) {
  const [tab, setTab] = useState<Tab>('paste')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ValidateResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Debounced validate whenever the spec changes (skips zero-length).
  useEffect(() => {
    setSummary(null)
    setError(null)
    if (!value.trim()) return
    const handle = setTimeout(() => {
      void validate(value).then(setSummary).catch(() => setSummary(null))
    }, 350)
    return () => clearTimeout(handle)
  }, [value])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('File exceeds 5 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      onChange(text)
      setError(null)
    }
    reader.onerror = () => setError('Failed to read file')
    reader.readAsText(file)
  }, [onChange])

  const handleFetch = useCallback(async (target: string) => {
    if (!target.trim()) {
      setError('URL is required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/paired/openapi/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target.trim() }),
      })
      const data = (await res.json()) as { spec?: string; error?: string }
      if (!res.ok || !data.spec) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      onChange(data.spec)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [onChange])

  const handleFromBe = useCallback(async () => {
    const base = (apiBaseUrl || 'http://localhost:8080').replace(/\/$/, '')
    await handleFetch(`${base}/v3/api-docs`)
  }, [apiBaseUrl, handleFetch])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 bg-surface-container-high rounded-xl p-0.5 border border-outline-variant w-fit">
        <TabButton active={tab === 'paste'} onClick={() => setTab('paste')}>Paste</TabButton>
        <TabButton active={tab === 'upload'} onClick={() => setTab('upload')}>Upload</TabButton>
        <TabButton active={tab === 'url'} onClick={() => setTab('url')}>URL</TabButton>
        <TabButton active={tab === 'be'} onClick={() => setTab('be')}>From BE</TabButton>
      </div>

      {tab === 'paste' && (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={'# Paste an OpenAPI 3 YAML or JSON spec.\n# Auto-adds the BE openapi dep; the FE gets it at\n# frontend/openapi.yaml + a gen:api npm script.'}
          className={`${INPUT_CLASS} font-mono text-xs min-h-[140px]`}
          spellCheck={false}
        />
      )}

      {tab === 'upload' && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml,.json,application/yaml,application/json,text/yaml"
            onChange={handleFileSelect}
            className="block text-xs text-secondary file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-primary file:text-on-primary file:font-semibold file:cursor-pointer hover:file:brightness-110"
          />
          {value && (
            <div className="text-[11px] text-secondary px-0.5">
              Loaded {value.length.toLocaleString()} chars.{' '}
              <button
                type="button"
                onClick={() => { onChange(''); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="text-primary hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'url' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/openapi.yaml"
              className={INPUT_CLASS}
            />
            <button
              type="button"
              onClick={() => handleFetch(url)}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-on-primary disabled:opacity-60 active:scale-95 transition-all whitespace-nowrap"
            >
              {busy ? 'Fetching…' : 'Fetch'}
            </button>
          </div>
          <p className="text-[11px] text-secondary px-0.5">
            Fetched server-side so the browser doesn’t need CORS for the target.
          </p>
        </div>
      )}

      {tab === 'be' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="text-xs text-secondary truncate flex-1">
              {(apiBaseUrl || 'http://localhost:8080').replace(/\/$/, '')}/v3/api-docs
            </code>
            <button
              type="button"
              onClick={handleFromBe}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-on-primary disabled:opacity-60 active:scale-95 transition-all whitespace-nowrap"
            >
              {busy ? 'Pulling…' : 'Pull spec'}
            </button>
          </div>
          <p className="text-[11px] text-secondary px-0.5">
            Hits the springdoc default at <code>/v3/api-docs</code> on your paired backend.
          </p>
        </div>
      )}

      {error && (
        <div className="text-xs text-error bg-error-container/20 border border-error-container rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {summary && (
        <div className="flex items-center gap-2 text-[11px] px-0.5">
          {summary.valid ? (
            <>
              <span className="material-symbols-outlined text-success" style={{ fontSize: '14px' }}>check_circle</span>
              <span className="text-secondary">
                Valid OpenAPI{summary.summary?.title ? `: ${summary.summary.title}` : ''}
                {summary.summary?.version ? ` v${summary.summary.version}` : ''}
                {summary.summary ? ` · ${summary.summary.operations} ops · ${summary.summary.schemas} schemas` : ''}
              </span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-warning" style={{ fontSize: '14px' }}>warning</span>
              <span className="text-secondary truncate">
                Not a valid OpenAPI spec{summary.errors[0] ? `: ${summary.errors[0]}` : ''}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

async function validate(spec: string): Promise<ValidateResponse> {
  const res = await fetch('/paired/openapi/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as ValidateResponse
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        active ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:text-on-surface'
      }`}
    >
      {children}
    </button>
  )
}

const INPUT_CLASS =
  'w-full bg-surface-container/40 border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all'
