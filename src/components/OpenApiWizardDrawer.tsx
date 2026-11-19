import { useEffect, useRef, useState } from 'react'
import { AdminFormDrawer } from './admin/shared/AdminFormDrawer'
import { CodeEditor } from './admin/file-contributions/CodeEditor'
import type { OpenApiApiStyle, OpenApiClientKind, OpenApiMode, OpenApiWizardEntry } from '../types'
import { isRtl, t } from '../i18n'
import { codeText } from '../utils/codeText'

interface Props {
  isOpen: boolean
  onClose: () => void
  depId: string
  depName: string
  initial: OpenApiWizardEntry | null
  onSave: (entry: OpenApiWizardEntry | null) => void
}

function modes(): { id: OpenApiMode; label: string; hint: string }[] {
  return [
    { id: 'CONTROLLERS', label: t('Controllers'), hint: t('Server — @RestController classes') },
    { id: 'CLIENT', label: t('Client'), hint: t('Consumer — a client per tag') },
    { id: 'BOTH', label: t('Both'), hint: t('Controllers + client, shared DTOs') },
  ]
}

function clientKinds(): { id: OpenApiClientKind; label: string; hint: string }[] {
  return [
    { id: 'restTemplate', label: 'RestTemplate', hint: t('The classic template, one exchange() per operation') },
    { id: 'restClient', label: 'RestClient', hint: t('The fluent client of Spring 6.1 / Boot 3.2') },
  ]
}

function apiStyles(): { id: OpenApiApiStyle; label: string; hint: string }[] {
  return [
    { id: 'interfaces', label: t('Interfaces'), hint: t('An Api interface per tag, regenerated; your controller implements it and an update never touches it') },
    { id: 'classes', label: t('Classes'), hint: t('A controller per tag with TODO bodies, rewritten with the spec') },
  ]
}

/** A new setup starts on interfaces; one saved before the choice existed keeps its classes. */
function styleOf(initial: OpenApiWizardEntry | null): OpenApiApiStyle {
  return initial ? initial.apiStyle ?? 'classes' : 'interfaces'
}

export function OpenApiWizardDrawer({ isOpen, onClose, depId, depName, initial, onSave }: Props) {
  const [spec, setSpec] = useState<string>(initial?.spec ?? '')
  const [apiSubPackage, setApiSubPackage] = useState<string>(initial?.apiSubPackage ?? 'api')
  const [dtoSubPackage, setDtoSubPackage] = useState<string>(initial?.dtoSubPackage ?? 'dto')
  const [clientSubPackage, setClientSubPackage] = useState<string>(initial?.clientSubPackage ?? 'client')
  const [mode, setMode] = useState<OpenApiMode>(initial?.mode ?? 'CONTROLLERS')
  const [baseUrlProperty, setBaseUrlProperty] = useState<string>(initial?.baseUrlProperty ?? 'openapi.client.base-url')
  const [clientKind, setClientKind] = useState<OpenApiClientKind>(initial?.clientKind ?? 'restTemplate')
  const [copySpec, setCopySpec] = useState<boolean>(initial?.copySpec ?? false)
  const [apiStyle, setApiStyle] = useState<OpenApiApiStyle>(styleOf(initial))
  const [paths, setPaths] = useState<string[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Re-seed when drawer re-opens
  useEffect(() => {
    if (isOpen) {
      setSpec(initial?.spec ?? '')
      setApiSubPackage(initial?.apiSubPackage ?? 'api')
      setDtoSubPackage(initial?.dtoSubPackage ?? 'dto')
      setClientSubPackage(initial?.clientSubPackage ?? 'client')
      setMode(initial?.mode ?? 'CONTROLLERS')
      setBaseUrlProperty(initial?.baseUrlProperty ?? 'openapi.client.base-url')
      setClientKind(initial?.clientKind ?? 'restTemplate')
      setCopySpec(initial?.copySpec ?? false)
      setApiStyle(styleOf(initial))
      setPaths([])
      setParseError(null)
    }
  }, [isOpen, depId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced live path detection. The controller aborts an in-flight request when the
  // spec changes again, so a slow earlier response can never overwrite a newer one.
  useEffect(() => {
    const trimmed = spec.trim()
    if (!trimmed) {
      setPaths([])
      setParseError(null)
      return
    }
    const controller = new AbortController()
    const handle = setTimeout(() => {
      fetch('/starter-wizard.detect-paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: trimmed }),
        signal: controller.signal,
      })
        .then(async res => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({} as Record<string, unknown>))
            const msgs = (body as { messages?: unknown }).messages
            setParseError(Array.isArray(msgs) ? msgs.join('; ') : t('Invalid OpenAPI spec'))
            setPaths([])
            return
          }
          const data = await res.json() as string[]
          setPaths(Array.isArray(data) ? data : [])
          setParseError(null)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setParseError(t('Could not reach backend to validate spec'))
          setPaths([])
        })
    }, 400)
    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [spec])

  const emitControllers = mode === 'CONTROLLERS' || mode === 'BOTH'
  const emitClient = mode === 'CLIENT' || mode === 'BOTH'

  async function handleSave(): Promise<void> {
    const trimmed = spec.trim()
    if (!trimmed) {
      onSave(null)
    } else {
      onSave({
        spec: trimmed,
        apiSubPackage: apiSubPackage.trim() || 'api',
        dtoSubPackage: dtoSubPackage.trim() || 'dto',
        clientSubPackage: clientSubPackage.trim() || 'client',
        mode,
        baseUrlProperty: baseUrlProperty.trim() || 'openapi.client.base-url',
        // Kept only when they differ from the defaults, so an untouched entry stays as it was.
        ...(clientKind === 'restClient' && mode !== 'CONTROLLERS' ? { clientKind } : {}),
        ...(copySpec ? { copySpec: true } : {}),
        ...(apiStyle === 'interfaces' && mode !== 'CLIENT' ? { apiStyle } : {}),
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
      title={t('OpenAPI — {dep}', { dep: depName })}
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
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>integration_instructions</span>
          <span>
            {t('Paste an OpenAPI 3.x spec (YAML or JSON). Pick a mode to generate controllers, a client, or both. DTO records are shared.')}
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

        {emitControllers && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
              {t('Server code as')}
            </label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('Server code as')}>
              {apiStyles().map(s => {
                const active = apiStyle === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setApiStyle(s.id)}
                    className={
                      'rounded-lg border px-3 py-2 text-start transition-all ' +
                      (active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-outline-variant bg-surface-container-highest text-on-surface hover:border-primary/60')
                    }
                  >
                    <div className="text-xs font-bold">{s.label}</div>
                    <div className="text-[10px] text-on-surface-variant mt-0.5 leading-tight">{s.hint}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {emitControllers && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
                {t('API sub-package')}
              </label>
              <input
                type="text"
                value={apiSubPackage}
                onChange={e => setApiSubPackage(e.target.value)}
                placeholder="api"
                dir="ltr"
                className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
              {t('DTO sub-package')}
            </label>
            <input
              type="text"
              value={dtoSubPackage}
              onChange={e => setDtoSubPackage(e.target.value)}
              placeholder="dto"
              dir="ltr"
              className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
            />
          </div>
          {emitClient && (
            <>
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
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
                  {t('Base URL property')}
                </label>
                <input
                  type="text"
                  value={baseUrlProperty}
                  onChange={e => setBaseUrlProperty(e.target.value)}
                  placeholder="openapi.client.base-url"
                  dir="ltr"
                  className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
                  {t('Client calls through')}
                </label>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('Client calls through')}>
                  {clientKinds().map(k => {
                    const active = clientKind === k.id
                    return (
                      <button
                        key={k.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setClientKind(k.id)}
                        className={
                          'rounded-lg border px-3 py-2 text-start transition-all ' +
                          (active
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-outline-variant bg-surface-container-highest text-on-surface hover:border-primary/60')
                        }
                      >
                        <div className="text-xs font-bold">{k.label}</div>
                        <div className="text-[10px] text-on-surface-variant mt-0.5 leading-tight">{k.hint}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={copySpec}
            onChange={e => setCopySpec(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span>
            <span className="font-semibold text-on-surface">{t('Keep the spec in the project')}</span>
            <span className="block text-[10px] text-on-surface-variant leading-relaxed">
              {codeText(t('Written to `src/main/resources/openapi/{depId}.yaml` (`.json` for a JSON document), beside the code generated from it.', { depId }))}
            </span>
          </span>
        </label>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-widest text-secondary">
              {t('OpenAPI Spec')}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-secondary hover:text-on-surface transition-colors"
              >
                {t('Upload file…')}
              </button>
              {spec.length > 0 && (
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
            accept=".yaml,.yml,.json"
            className="hidden"
            onChange={handleFile}
          />
          <div dir="ltr">
            <CodeEditor
              value={spec}
              onChange={setSpec}
              targetPath="openapi.yaml"
            />
          </div>
          <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
            {emitControllers && (
              <>{codeText(t('Controllers go to `{package}`.', { package: apiSubPackage || 'api' }))} </>
            )}
            {emitClient && (
              <>{codeText(t('Client goes to `{package}` with base URL at `{property}`.', { package: clientSubPackage || 'client', property: baseUrlProperty || 'openapi.client.base-url' }))} </>
            )}
            {codeText(t('Records, enums and `oneOf` interfaces to `{package}`.', { package: dtoSubPackage || 'dto' }))}
            {emitControllers && <> {codeText(t('`openapi` (Swagger UI) is added beside `web`.'))}</>}
            {emitControllers && ' '}
            {emitControllers && (apiStyle === 'interfaces'
              ? t('Each tag gets an Api interface whose methods answer 501 until your controller overrides them.')
              : t('Controller methods throw UnsupportedOperationException until implemented.'))}
            {' '}{t('Multipart and form bodies become parameters; the client sends the credentials its security schemes ask for, from properties.')}
          </p>
        </div>

        {parseError && (
          <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg p-3 leading-relaxed">
            {parseError}
          </div>
        )}

        {paths.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-widest text-secondary">
                {t('Detected Operations')}
              </label>
              <span className="text-[10px] font-bold py-0.5 px-2 bg-primary/10 text-primary rounded-full">
                {paths.length}
              </span>
            </div>
            <div className="space-y-1 border border-outline-variant rounded-lg p-3 bg-surface-container-lowest max-h-48 overflow-y-auto">
              {paths.map(p => (
                <div key={p} className="text-xs font-mono text-on-surface" dir="ltr">{p}</div>
              ))}
            </div>
          </div>
        )}

        {spec.trim().length > 0 && paths.length === 0 && !parseError && (
          <div className="text-xs text-secondary bg-surface-container-lowest border border-outline-variant rounded-lg p-3">
            {t('No operations detected yet…')}
          </div>
        )}
      </div>
    </AdminFormDrawer>
  )
}
