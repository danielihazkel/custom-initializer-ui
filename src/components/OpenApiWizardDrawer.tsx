import { useEffect, useRef, useState } from 'react'
import { AdminFormDrawer } from './admin/shared/AdminFormDrawer'
import { CodeEditor } from './admin/file-contributions/CodeEditor'
import type { OpenApiWizardEntry } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  depId: string
  depName: string
  initial: OpenApiWizardEntry | null
  onSave: (entry: OpenApiWizardEntry | null) => void
}

export function OpenApiWizardDrawer({ isOpen, onClose, depId, depName, initial, onSave }: Props) {
  const [spec, setSpec] = useState<string>(initial?.spec ?? '')
  const [apiSubPackage, setApiSubPackage] = useState<string>(initial?.apiSubPackage ?? 'api')
  const [dtoSubPackage, setDtoSubPackage] = useState<string>(initial?.dtoSubPackage ?? 'dto')
  const [paths, setPaths] = useState<string[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Re-seed when drawer re-opens
  useEffect(() => {
    if (isOpen) {
      setSpec(initial?.spec ?? '')
      setApiSubPackage(initial?.apiSubPackage ?? 'api')
      setDtoSubPackage(initial?.dtoSubPackage ?? 'dto')
      setParseError(null)
    }
  }, [isOpen, depId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced live path detection
  useEffect(() => {
    const trimmed = spec.trim()
    if (!trimmed) {
      setPaths([])
      setParseError(null)
      return
    }
    const handle = setTimeout(() => {
      fetch('/starter-openapi.paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: trimmed }),
      })
        .then(async res => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({} as Record<string, unknown>))
            const msgs = (body as { messages?: unknown }).messages
            setParseError(Array.isArray(msgs) ? msgs.join('; ') : 'Invalid OpenAPI spec')
            setPaths([])
            return
          }
          const data = await res.json() as string[]
          setPaths(Array.isArray(data) ? data : [])
          setParseError(null)
        })
        .catch(() => {
          setParseError('Could not reach backend to validate spec')
          setPaths([])
        })
    }, 400)
    return () => clearTimeout(handle)
  }, [spec])

  async function handleSave(): Promise<void> {
    const trimmed = spec.trim()
    if (!trimmed) {
      onSave(null)
    } else {
      onSave({
        spec: trimmed,
        apiSubPackage: apiSubPackage.trim() || 'api',
        dtoSubPackage: dtoSubPackage.trim() || 'dto',
      })
    }
    onClose()
  }

  function handleClear() {
    setSpec('')
    setPaths([])
    setParseError(null)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result
      if (typeof text === 'string') setSpec(text)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <AdminFormDrawer
      title={`OpenAPI Controllers — ${depName}`}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saving={false}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-xs text-primary">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>integration_instructions</span>
          <span>
            Paste an OpenAPI 3.x spec (YAML or JSON) to generate <span className="font-bold">@RestController</span> classes and DTO records.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
              API sub-package
            </label>
            <input
              type="text"
              value={apiSubPackage}
              onChange={e => setApiSubPackage(e.target.value)}
              placeholder="api"
              className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
              DTO sub-package
            </label>
            <input
              type="text"
              value={dtoSubPackage}
              onChange={e => setDtoSubPackage(e.target.value)}
              placeholder="dto"
              className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-widest text-secondary">
              OpenAPI Spec
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-secondary hover:text-on-surface transition-colors"
              >
                Upload file…
              </button>
              {spec.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[10px] text-secondary hover:text-error transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml,.json"
            className="hidden"
            onChange={handleFile}
          />
          <CodeEditor
            value={spec}
            onChange={setSpec}
            targetPath="openapi.yaml"
          />
          <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
            Controllers go to <code className="text-primary">{apiSubPackage || 'api'}</code>, records to <code className="text-primary">{dtoSubPackage || 'dto'}</code>.
            Method bodies throw <code className="text-primary">UnsupportedOperationException</code> so the project still compiles.
          </p>
        </div>

        {parseError && (
          <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 leading-relaxed">
            {parseError}
          </div>
        )}

        {paths.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-widest text-secondary">
                Detected Operations
              </label>
              <span className="text-[10px] font-bold py-0.5 px-2 bg-primary/10 text-primary rounded-full">
                {paths.length}
              </span>
            </div>
            <div className="space-y-1 border border-outline-variant rounded-lg p-3 bg-surface-container-lowest max-h-48 overflow-y-auto">
              {paths.map(p => (
                <div key={p} className="text-xs font-mono text-on-surface">{p}</div>
              ))}
            </div>
          </div>
        )}

        {spec.trim().length > 0 && paths.length === 0 && !parseError && (
          <div className="text-xs text-secondary bg-surface-container-lowest border border-outline-variant rounded-lg p-3">
            No operations detected yet…
          </div>
        )}
      </div>
    </AdminFormDrawer>
  )
}
