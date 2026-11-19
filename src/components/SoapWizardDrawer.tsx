import { useEffect, useRef, useState } from 'react'
import { AdminFormDrawer } from './admin/shared/AdminFormDrawer'
import { CodeEditor } from './admin/file-contributions/CodeEditor'
import type { SoapMode, SoapWizardEntry } from '../types'
import { isRtl, t } from '../i18n'
import { codeText } from '../utils/codeText'

interface Props {
  isOpen: boolean
  onClose: () => void
  depId: string
  depName: string
  initial: SoapWizardEntry | null
  onSave: (entry: SoapWizardEntry | null) => void
}

function modes(): { id: SoapMode; label: string; hint: string }[] {
  return [
    { id: 'ENDPOINTS', label: t('Endpoints'), hint: t('Server — @Endpoint classes') },
    { id: 'CLIENT', label: t('Client'), hint: t('Consumer — WebServiceTemplate') },
    { id: 'BOTH', label: t('Both'), hint: t('Endpoints + client, shared payloads') },
  ]
}

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
      setServices([])
      setParseError(null)
    }
  }, [isOpen, depId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced live service detection. The controller aborts an in-flight request when the
  // WSDL changes again, so a slow earlier response can never overwrite a newer one.
  useEffect(() => {
    const trimmed = wsdl.trim()
    if (!trimmed) {
      setServices([])
      setParseError(null)
      return
    }
    const controller = new AbortController()
    const handle = setTimeout(() => {
      fetch('/starter-wizard.detect-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wsdl: trimmed }),
        signal: controller.signal,
      })
        .then(async res => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({} as Record<string, unknown>))
            const msgs = (body as { messages?: unknown }).messages
            setParseError(Array.isArray(msgs) ? msgs.join('; ') : t('Invalid WSDL'))
            setServices([])
            return
          }
          const data = await res.json() as string[]
          setServices(Array.isArray(data) ? data : [])
          setParseError(null)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setParseError(t('Could not reach backend to validate WSDL'))
          setServices([])
        })
    }, 400)
    return () => {
      clearTimeout(handle)
      controller.abort()
    }
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
      title={t('SOAP — {dep}', { dep: depName })}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saving={false}
      saveLabel={t('Save')}
      cancelLabel={t('Cancel')}
      closeLabel={t('Close')}
      dir={isRtl() ? 'rtl' : 'ltr'}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-xs text-primary">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>hub</span>
          <span>
            {t('Paste a WSDL 1.1 document. Pick a mode to generate @Endpoint stubs, a WebServiceTemplate client, or both. JAXB payload classes are generated at build time by the JAX-WS Maven plugin.')}
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
            {t('Mode')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {modes().map(m => {
              const active = mode === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={
                    'rounded-lg border px-3 py-2 text-start transition-all ' +
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
                {t('Endpoint sub-package')}
              </label>
              <input
                type="text"
                value={endpointSubPackage}
                onChange={e => setEndpointSubPackage(e.target.value)}
                placeholder="endpoint"
                dir="ltr"
                className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
              />
            </div>
          )}
          {emitEndpoints && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
                {t('Servlet context path')}
              </label>
              <input
                type="text"
                value={contextPath}
                onChange={e => setContextPath(e.target.value)}
                placeholder="/ws"
                dir="ltr"
                className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
              />
            </div>
          )}
          {emitClient && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
                {t('Client sub-package')}
              </label>
              <input
                type="text"
                value={clientSubPackage}
                onChange={e => setClientSubPackage(e.target.value)}
                placeholder="client"
                dir="ltr"
                className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
              />
            </div>
          )}
          {emitClient && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
                {t('Base URL property')}
              </label>
              <input
                type="text"
                value={baseUrlProperty}
                onChange={e => setBaseUrlProperty(e.target.value)}
                placeholder="soap.client.base-url"
                dir="ltr"
                className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
              {t('Generated payload package')}
            </label>
            <input
              type="text"
              value={payloadSubPackage}
              onChange={e => setPayloadSubPackage(e.target.value)}
              placeholder="generated"
              dir="ltr"
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
                {t('Upload file…')}
              </button>
              {wsdl.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[10px] text-secondary hover:text-error transition-colors"
                >
                  {t('Clear')}
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
          <div dir="ltr">
            <CodeEditor
              value={wsdl}
              onChange={setWsdl}
              targetPath="service.wsdl"
            />
          </div>
          <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
            {emitEndpoints && (
              <>{codeText(t('Endpoints go to `{package}` served at `{path}`.', { package: endpointSubPackage || 'endpoint', path: contextPath || '/ws' }))} </>
            )}
            {emitClient && (
              <>{codeText(t('Client goes to `{package}` with base URL at `{property}`.', { package: clientSubPackage || 'client', property: baseUrlProperty || 'soap.client.base-url' }))} </>
            )}
            {codeText(t('JAXB payloads compile into `{package}`.', { package: payloadSubPackage || 'generated' }))}
            {emitEndpoints && <> {t('Endpoint methods throw UnsupportedOperationException until implemented.')}</>}
          </p>
        </div>

        {parseError && (
          <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg p-3 leading-relaxed">
            {parseError}
          </div>
        )}

        {services.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-widest text-secondary">
                {t('Detected Services')}
              </label>
              <span className="text-[10px] font-bold py-0.5 px-2 bg-primary/10 text-primary rounded-full">
                {services.length}
              </span>
            </div>
            <div className="space-y-1 border border-outline-variant rounded-lg p-3 bg-surface-container-lowest max-h-48 overflow-y-auto">
              {services.map(s => (
                <div key={s} className="text-xs font-mono text-on-surface" dir="ltr">{s}</div>
              ))}
            </div>
          </div>
        )}

        {wsdl.trim().length > 0 && services.length === 0 && !parseError && (
          <div className="text-xs text-secondary bg-surface-container-lowest border border-outline-variant rounded-lg p-3">
            {t('No services detected yet…')}
          </div>
        )}
      </div>
    </AdminFormDrawer>
  )
}
