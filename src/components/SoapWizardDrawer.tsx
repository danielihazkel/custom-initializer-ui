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

/** A file the WSDL refers to: `id` keeps its row while its path is being typed. */
interface FileRow {
  id: number
  path: string
  text: string
}

let nextRowId = 1

function rowsOf(files: Record<string, string> | undefined): FileRow[] {
  // What a link or a stored draft holds is taken as it is until here: only text is a file.
  return Object.entries(files ?? {}).filter(file => typeof file[1] === 'string')
    .map(([path, text]) => ({ id: nextRowId++, path, text }))
}

/** The rows as the request carries them; the name two rows share, if any. */
function filesOf(rows: FileRow[]): { files: Record<string, string>; duplicate: string | null } {
  const files: Record<string, string> = {}
  let duplicate: string | null = null
  for (const row of rows) {
    const path = row.path.trim()
    if (!path) continue
    if (path in files) duplicate = path
    files[path] = row.text
  }
  return { files, duplicate }
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
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
  const [rows, setRows] = useState<FileRow[]>(() => rowsOf(initial?.files))
  const [endpointSubPackage, setEndpointSubPackage] = useState<string>(initial?.endpointSubPackage ?? 'endpoint')
  const [clientSubPackage, setClientSubPackage] = useState<string>(initial?.clientSubPackage ?? 'client')
  const [payloadSubPackage, setPayloadSubPackage] = useState<string>(initial?.payloadSubPackage ?? 'generated')
  const [mode, setMode] = useState<SoapMode>(initial?.mode ?? 'ENDPOINTS')
  const [baseUrlProperty, setBaseUrlProperty] = useState<string>(initial?.baseUrlProperty ?? 'soap.client.base-url')
  const [contextPath, setContextPath] = useState<string>(initial?.contextPath ?? '/ws')
  const [services, setServices] = useState<string[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const moreFilesInputRef = useRef<HTMLInputElement>(null)

  // Re-seed when drawer re-opens
  useEffect(() => {
    if (isOpen) {
      setWsdl(initial?.wsdl ?? '')
      setRows(rowsOf(initial?.files))
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
    const { files, duplicate } = filesOf(rows)
    if (duplicate) {
      setParseError(t('Two files are named {name}.', { name: duplicate }))
      setServices([])
      return
    }
    const controller = new AbortController()
    const handle = setTimeout(() => {
      fetch('/starter-wizard.detect-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The files only when there are some: one document is the request it always was.
        body: JSON.stringify(Object.keys(files).length > 0 ? { wsdl: trimmed, files } : { wsdl: trimmed }),
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
  }, [wsdl, rows])

  const emitEndpoints = mode === 'ENDPOINTS' || mode === 'BOTH'
  const emitClient = mode === 'CLIENT' || mode === 'BOTH'

  async function handleSave(): Promise<void> {
    const trimmed = wsdl.trim()
    if (!trimmed) {
      onSave(null)
    } else {
      const { files } = filesOf(rows)
      onSave({
        wsdl: trimmed,
        endpointSubPackage: endpointSubPackage.trim() || 'endpoint',
        clientSubPackage: clientSubPackage.trim() || 'client',
        payloadSubPackage: payloadSubPackage.trim() || 'generated',
        mode,
        baseUrlProperty: baseUrlProperty.trim() || 'soap.client.base-url',
        contextPath: contextPath.trim() || '/ws',
        ...(Object.keys(files).length > 0 ? { files } : {}),
      })
    }
    onClose()
  }

  function handleClear() {
    setWsdl('')
    setRows([])
    setServices([])
    setParseError(null)
  }

  /** Adds files to the list; one already there under the same name is replaced. */
  function addRows(added: { path: string; text: string }[]) {
    setRows(prev => {
      const names = new Set(added.map(a => a.path))
      return [...prev.filter(r => !names.has(r.path.trim())), ...added.map(a => ({ id: nextRowId++, ...a }))]
    })
  }

  /**
   * The main document, or a whole WSDL at once: of several files the first `.wsdl` is the main
   * one (a row's "Make main" corrects a wrong guess) and the rest are what it refers to.
   */
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (picked.length === 0) return
    const main = picked.find(f => f.name.toLowerCase().endsWith('.wsdl')) ?? picked[0]
    const texts = await Promise.all(picked.map(readText))
    setWsdl(texts[picked.indexOf(main)])
    const others = picked.map((f, i) => ({ path: f.name, text: texts[i] })).filter((_, i) => picked[i] !== main)
    if (others.length > 0) addRows(others)
  }

  async function handleMoreFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (picked.length === 0) return
    const texts = await Promise.all(picked.map(readText))
    addRows(picked.map((f, i) => ({ path: f.name, text: texts[i] })))
  }

  /** Swaps a file with the main document: the old main takes the file's name. */
  function makeMain(row: FileRow) {
    const previous = wsdl
    setWsdl(row.text)
    setRows(prev => previous.trim()
      ? prev.map(r => (r.id === row.id ? { ...r, text: previous } : r))
      : prev.filter(r => r.id !== row.id))
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
            accept=".wsdl,.xsd,.xml"
            multiple
            aria-label={t('Upload file…')}
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

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-widest text-secondary">
              {t('Files the WSDL refers to')}
            </label>
            <button
              type="button"
              onClick={() => moreFilesInputRef.current?.click()}
              className="text-[10px] text-secondary hover:text-on-surface transition-colors"
            >
              {t('Add files…')}
            </button>
          </div>
          <input
            ref={moreFilesInputRef}
            type="file"
            accept=".wsdl,.xsd,.xml"
            multiple
            aria-label={t('Add files…')}
            className="hidden"
            onChange={handleMoreFiles}
          />
          {rows.length > 0 && (
            <ul className="space-y-1.5 mb-1.5">
              {rows.map(row => (
                <li key={row.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.path}
                    onChange={e => setRows(prev => prev.map(r => (r.id === row.id ? { ...r, path: e.target.value } : r)))}
                    aria-label={t('Path of the file')}
                    placeholder="schemas/types.xsd"
                    dir="ltr"
                    className="flex-1 min-w-0 bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-1.5 text-xs font-mono text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
                  />
                  <span className="text-[10px] text-on-surface-variant whitespace-nowrap" dir="ltr">
                    {(row.text.length / 1024).toFixed(1)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => makeMain(row)}
                    className="text-[10px] text-secondary hover:text-on-surface transition-colors whitespace-nowrap"
                  >
                    {t('Make main')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRows(prev => prev.filter(r => r.id !== row.id))}
                    aria-label={t('Remove {name}', { name: row.path })}
                    className="text-secondary hover:text-error transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-on-surface-variant leading-relaxed">
            {codeText(t('For a WSDL in several files: the WSDLs and schemas the document above imports or includes. Name each the way the reference to it reads from that document — `schemas/types.xsd`. They are written beside the WSDL and served with it.'))}
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
