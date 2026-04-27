import { useEffect, useRef, useState } from 'react'
import { AdminFormDrawer } from './admin/shared/AdminFormDrawer'
import { CodeEditor } from './admin/file-contributions/CodeEditor'
import type { SoapMode, SoapWizardEntry } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  depId: string
  depName: string
  initial: SoapWizardEntry | null
  onSave: (entry: SoapWizardEntry | null) => void
}

const MODES: { id: SoapMode; label: string; hint: string }[] = [
  { id: 'ENDPOINTS', label: 'Endpoints', hint: 'Server — @Endpoint classes' },
  { id: 'CLIENT', label: 'Client', hint: 'Consumer — WebServiceTemplate' },
  { id: 'BOTH', label: 'Both', hint: 'Endpoints + client, shared payloads' },
]

export function SoapWizardDrawer({ isOpen, onClose, depId, depName, initial, onSave }: Props) {
  const [wsdl, setWsdl] = useState<string>(initial?.wsdl ?? '')
  const [endpointSubPackage, setEndpointSubPackage] = useState<string>(initial?.endpointSubPackage ?? 'endpoint')
  const [clientSubPackage, setClientSubPackage] = useState<string>(initial?.clientSubPackage ?? 'client')
  const [payloadSubPackage, setPayloadSubPackage] = useState<string>(initial?.payloadSubPackage ?? 'generated')
  const [mode, setMode] = useState<SoapMode>(initial?.mode ?? 'ENDPOINTS')
  const [baseUrlProperty, setBaseUrlProperty] = useState<string>(initial?.baseUrlProperty ?? 'soap.client.base-url')
  const [contextPath, setContextPath] = useState<string>(initial?.contextPath ?? '/ws')
  const [services, setServices] = useState<string[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Re-seed when drawer re-opens
  useEffect(() => {
    if (isOpen) {
      setWsdl(initial?.wsdl ?? '')
      setEndpointSubPackage(initial?.endpointSubPackage ?? 'endpoint')
      setClientSubPackage(initial?.clientSubPackage ?? 'client')
      setPayloadSubPackage(initial?.payloadSubPackage ?? 'generated')
      setMode(initial?.mode ?? 'ENDPOINTS')
      setBaseUrlProperty(initial?.baseUrlProperty ?? 'soap.client.base-url')
      setContextPath(initial?.contextPath ?? '/ws')
      setParseError(null)
    }
  }, [isOpen, depId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced live service detection
  useEffect(() => {
    const trimmed = wsdl.trim()
    if (!trimmed) {
      setServices([])
      setParseError(null)
      return
    }
    const handle = setTimeout(() => {
      fetch('/starter-wizard.detect-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wsdl: trimmed }),
      })
        .then(async res => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({} as Record<string, unknown>))
            const msgs = (body as { messages?: unknown }).messages
            setParseError(Array.isArray(msgs) ? msgs.join('; ') : 'Invalid WSDL')
            setServices([])
            return
          }
          const data = await res.json() as string[]
          setServices(Array.isArray(data) ? data : [])
          setParseError(null)
        })
        .catch(() => {
          setParseError('Could not reach backend to validate WSDL')
          setServices([])
        })
    }, 400)
    return () => clearTimeout(handle)
  }, [wsdl])

  const emitEndpoints = mode === 'ENDPOINTS' || mode === 'BOTH'
  const emitClient = mode === 'CLIENT' || mode === 'BOTH'

  async function handleSave(): Promise<void> {
    const trimmed = wsdl.trim()
    if (!trimmed) {
      onSave(null)
    } else {
      onSave({
        wsdl: trimmed,
        endpointSubPackage: endpointSubPackage.trim() || 'endpoint',
        clientSubPackage: clientSubPackage.trim() || 'client',
        payloadSubPackage: payloadSubPackage.trim() || 'generated',
        mode,
        baseUrlProperty: baseUrlProperty.trim() || 'soap.client.base-url',
        contextPath: contextPath.trim() || '/ws',
      })
    }
    onClose()
  }

  function handleClear() {
    setWsdl('')
    setServices([])
    setParseError(null)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result
      if (typeof text === 'string') setWsdl(text)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <AdminFormDrawer
      title={`SOAP — ${depName}`}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saving={false}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-xs text-primary">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>hub</span>
          <span>
            Paste a WSDL 1.1 document. Pick a mode to generate
            {' '}<span className="font-bold">@Endpoint</span> stubs, a
            {' '}<span className="font-bold">WebServiceTemplate</span> client, or both.
            JAXB payload classes are generated at build time by the JAX-WS Maven plugin.
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
            Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(m => {
              const active = mode === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={
                    'rounded-lg border px-3 py-2 text-left transition-all ' +
                    (active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant bg-surface-container-highest text-on-surface hover:border-primary/60')
                  }
                >
                  <div className="text-xs font-bold">{m.label}</div>
                  <div className="text-[10px] text-on-surface-variant mt-0.5 leading-tight">{m.hint}</div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {emitEndpoints && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
                Endpoint sub-package
              </label>
              <input
                type="text"
                value={endpointSubPackage}
                onChange={e => setEndpointSubPackage(e.target.value)}
                placeholder="endpoint"
                className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
              />
            </div>
          )}
          {emitEndpoints && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
                Servlet context path
              </label>
              <input
                type="text"
                value={contextPath}
                onChange={e => setContextPath(e.target.value)}
                placeholder="/ws"
                className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
              />
            </div>
          )}
          {emitClient && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
                Client sub-package
              </label>
              <input
                type="text"
                value={clientSubPackage}
                onChange={e => setClientSubPackage(e.target.value)}
                placeholder="client"
                className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
              />
            </div>
          )}
          {emitClient && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
                Base URL property
              </label>
              <input
                type="text"
                value={baseUrlProperty}
                onChange={e => setBaseUrlProperty(e.target.value)}
                placeholder="soap.client.base-url"
                className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
              Generated payload package
            </label>
            <input
              type="text"
              value={payloadSubPackage}
              onChange={e => setPayloadSubPackage(e.target.value)}
              placeholder="generated"
              className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-widest text-secondary">
              WSDL
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-secondary hover:text-on-surface transition-colors"
              >
                Upload file…
              </button>
              {wsdl.length > 0 && (
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
            accept=".wsdl,.xml"
            className="hidden"
            onChange={handleFile}
          />
          <CodeEditor
            value={wsdl}
            onChange={setWsdl}
            targetPath="service.wsdl"
          />
          <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
            {emitEndpoints && (
              <>Endpoints go to <code className="text-primary">{endpointSubPackage || 'endpoint'}</code> served at <code className="text-primary">{contextPath || '/ws'}</code>. </>
            )}
            {emitClient && (
              <>Client goes to <code className="text-primary">{clientSubPackage || 'client'}</code> with base URL at <code className="text-primary">{baseUrlProperty || 'soap.client.base-url'}</code>. </>
            )}
            JAXB payloads compile into <code className="text-primary">{payloadSubPackage || 'generated'}</code>.
            {emitEndpoints && ' Endpoint methods throw UnsupportedOperationException until implemented.'}
          </p>
        </div>

        {parseError && (
          <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 leading-relaxed">
            {parseError}
          </div>
        )}

        {services.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-widest text-secondary">
                Detected Services
              </label>
              <span className="text-[10px] font-bold py-0.5 px-2 bg-primary/10 text-primary rounded-full">
                {services.length}
              </span>
            </div>
            <div className="space-y-1 border border-outline-variant rounded-lg p-3 bg-surface-container-lowest max-h-48 overflow-y-auto">
              {services.map(s => (
                <div key={s} className="text-xs font-mono text-on-surface">{s}</div>
              ))}
            </div>
          </div>
        )}

        {wsdl.trim().length > 0 && services.length === 0 && !parseError && (
          <div className="text-xs text-secondary bg-surface-container-lowest border border-outline-variant rounded-lg p-3">
            No services detected yet…
          </div>
        )}
      </div>
    </AdminFormDrawer>
  )
}
