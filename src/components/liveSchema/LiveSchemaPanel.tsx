import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DIALECT_LABELS, LiveSchemaError, fetchSchemas, fetchTables, useLiveSchemaOptions,
  type LiveConnection, type LiveReadRequest, type LiveTableRef,
} from './liveSchemaApi'

const TYPED = '__typed__'

interface Props {
  /** The database type, fixed by the SQL wizard's dependency; without it the panel offers a picker. */
  dialect?: string
  /** The primary button's words for n picked tables and views. */
  readLabel: (n: number) => string
  /** Runs the read; a thrown error is shown in the panel. */
  onRead: (req: LiveReadRequest) => Promise<void>
}

const input = 'w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none'
const label = 'block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1'

/**
 * Pick a database, a schema and its tables and views, then read them. The database is an admin's
 * source or — when the server allows it — one typed in by hand; a typed password lives in this
 * component's state only and goes with each call.
 */
export function LiveSchemaPanel({ dialect: fixedDialect, readLabel, onRead }: Props) {
  const { options, loading } = useLiveSchemaOptions()
  const readable = useMemo(() => Object.keys(options.drivers), [options.drivers])
  const [pickedDialect, setPickedDialect] = useState<string>('')
  const dialect = fixedDialect || pickedDialect || readable.find(d => options.drivers[d]) || readable[0] || ''
  const sources = options.sources.filter(s => s.dialect === dialect)
  const driverMissing = dialect !== '' && options.drivers[dialect] === false
  const unreadable = fixedDialect !== undefined && !loading && !readable.includes(fixedDialect)

  const [choice, setChoice] = useState<string>('')
  const effectiveChoice = choice || (sources[0]?.name ?? (options.typedConnections ? TYPED : ''))
  const typed = effectiveChoice === TYPED

  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [database, setDatabase] = useState('')
  const [library, setLibrary] = useState('')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [trustCert, setTrustCert] = useState(false)

  const [schemas, setSchemas] = useState<string[] | null>(null)
  const [schema, setSchema] = useState('')
  const [tables, setTables] = useState<LiveTableRef[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [filter, setFilter] = useState('')
  const [qualify, setQualify] = useState(true)
  const [busy, setBusy] = useState<'connect' | 'tables' | 'read' | null>(null)
  const [error, setError] = useState<{ title: string; detail: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Any change to the connection forgets what was listed through the old one.
  const connectionKey = [dialect, effectiveChoice, host, port, database, library, user, trustCert].join('|')
  useEffect(() => {
    abortRef.current?.abort()
    setSchemas(null)
    setTables(null)
    setPicked(new Set())
    setError(null)
  }, [connectionKey])
  useEffect(() => () => abortRef.current?.abort(), [])

  function connection(): LiveConnection {
    if (!typed) return { source: effectiveChoice }
    return {
      dialect,
      host: host.trim(),
      port: port.trim() ? Number(port) : undefined,
      database: database.trim() || undefined,
      library: library.trim() || undefined,
      user: user.trim(),
      password,
      trustServerCertificate: dialect === 'MSSQL' ? trustCert : undefined,
    }
  }

  function fail(err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    setError(err instanceof LiveSchemaError
      ? { title: err.title, detail: err.message }
      : { title: 'Error', detail: err instanceof Error ? err.message : String(err) })
  }

  async function listTables(name: string, signal: AbortSignal) {
    setBusy('tables')
    try {
      const r = await fetchTables(connection(), name, signal)
      setTables(r.tables)
      setTruncated(r.truncated)
      setPicked(new Set())
    } finally {
      setBusy(null)
    }
  }

  async function connect() {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setError(null)
    setBusy('connect')
    try {
      const r = await fetchSchemas(connection(), ctrl.signal)
      setSchemas(r.schemas)
      const first = r.defaultSchema ?? r.schemas[0] ?? ''
      setSchema(first)
      setBusy(null)
      if (first) await listTables(first, ctrl.signal)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  async function changeSchema(name: string) {
    setSchema(name)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setError(null)
    try {
      await listTables(name, ctrl.signal)
    } catch (err) {
      fail(err)
    }
  }

  async function read() {
    if (picked.size === 0) return
    setError(null)
    setBusy('read')
    try {
      const order = (tables ?? []).map(t => t.name).filter(n => picked.has(n))
      await onRead({ connection: connection(), schema, tables: order, qualify })
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  const shown = (tables ?? []).filter(t => !filter.trim() || t.name.toLowerCase().includes(filter.trim().toLowerCase()))
  const allShownPicked = shown.length > 0 && shown.every(t => picked.has(t.name))
  const overLimit = picked.size > options.maxTables
  const typedReady = !typed || (host.trim() !== '' && user.trim() !== '' && (dialect === 'DB2' || database.trim() !== ''))
  const canConnect = !loading && !driverMissing && effectiveChoice !== '' && typedReady && busy === null

  function toggle(name: string) {
    setPicked(prev => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next })
  }
  function toggleShown() {
    setPicked(prev => {
      const next = new Set(prev)
      for (const t of shown) { if (allShownPicked) next.delete(t.name); else next.add(t.name) }
      return next
    })
  }

  if (unreadable) {
    return (
      <div data-live-schema className="text-xs text-on-surface-variant border border-outline-variant rounded-lg p-3">
        {DIALECT_LABELS[fixedDialect] ?? fixedDialect} cannot be read from a live database — paste its DDL instead.
      </div>
    )
  }

  return (
    <div data-live-schema className="space-y-3 border border-outline-variant rounded-lg p-3 bg-surface-container-lowest">
      {fixedDialect === undefined && (
        <div>
          <label htmlFor="live-dialect" className={label}>Database type</label>
          <select id="live-dialect" className={input} value={dialect} onChange={e => { setPickedDialect(e.target.value); setChoice('') }}>
            {readable.map(d => (
              <option key={d} value={d}>{DIALECT_LABELS[d] ?? d}{options.drivers[d] ? '' : ' (no driver on the server)'}</option>
            ))}
          </select>
        </div>
      )}

      {driverMissing ? (
        <p role="status" className="text-xs text-warning">
          The {DIALECT_LABELS[dialect] ?? dialect} driver is not installed on this server, so it cannot be read here.
        </p>
      ) : (
        <>
          <div>
            <label htmlFor="live-source" className={label}>Connect to</label>
            <select id="live-source" className={input} value={effectiveChoice} onChange={e => setChoice(e.target.value)}>
              {sources.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              {options.typedConnections && <option value={TYPED}>Another database…</option>}
              {sources.length === 0 && !options.typedConnections && <option value="">No database set up</option>}
            </select>
            {!typed && sources.find(s => s.name === effectiveChoice)?.description && (
              <p className="text-[10px] text-on-surface-variant mt-1">{sources.find(s => s.name === effectiveChoice)?.description}</p>
            )}
            {sources.length === 0 && !options.typedConnections && !loading && (
              <p className="text-[10px] text-on-surface-variant mt-1">
                An admin can add {DIALECT_LABELS[dialect] ?? dialect} databases under Admin → Schema sources.
              </p>
            )}
          </div>

          {typed && (
            <div data-live-typed className="grid grid-cols-6 gap-2">
              <div className="col-span-4">
                <label htmlFor="live-host" className={label}>Host</label>
                <input id="live-host" className={input} value={host} onChange={e => setHost(e.target.value)} placeholder="db01.menora.co.il" />
              </div>
              <div className="col-span-2">
                <label htmlFor="live-port" className={label}>Port</label>
                <input id="live-port" className={input} inputMode="numeric" value={port}
                       onChange={e => setPort(e.target.value.replace(/\D/g, ''))}
                       placeholder={options.defaultPorts[dialect] ? String(options.defaultPorts[dialect]) : '—'}
                       disabled={dialect === 'DB2'} />
              </div>
              {dialect === 'DB2' ? (
                <div className="col-span-6">
                  <label htmlFor="live-library" className={label}>Library (optional)</label>
                  <input id="live-library" className={input} value={library} onChange={e => setLibrary(e.target.value)} />
                </div>
              ) : (
                <div className="col-span-6">
                  <label htmlFor="live-database" className={label}>{dialect === 'ORACLE' ? 'Service name' : 'Database'}</label>
                  <input id="live-database" className={input} value={database} onChange={e => setDatabase(e.target.value)} />
                </div>
              )}
              <div className="col-span-3">
                <label htmlFor="live-user" className={label}>User</label>
                <input id="live-user" className={input} value={user} onChange={e => setUser(e.target.value)} autoComplete="off" />
              </div>
              <div className="col-span-3">
                <label htmlFor="live-password" className={label}>Password</label>
                <input id="live-password" className={input} type="password" value={password}
                       onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              {dialect === 'MSSQL' && (
                <label className="col-span-6 flex items-center gap-2 text-xs text-on-surface-variant">
                  <input type="checkbox" className="accent-primary" checked={trustCert} onChange={e => setTrustCert(e.target.checked)} />
                  Trust the server's certificate (a self-signed one)
                </label>
              )}
              <p className="col-span-6 text-[10px] text-on-surface-variant leading-relaxed">
                Use a user that may only read. The password is sent for this read and kept nowhere.
              </p>
            </div>
          )}

          <button type="button" onClick={connect} disabled={!canConnect}
                  className="w-full px-3 py-2 rounded-lg text-xs font-bold border border-primary/60 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
            {busy === 'connect' ? 'Connecting…' : schemas ? 'Connect again' : 'Connect'}
          </button>
        </>
      )}

      {schemas && (
        <div>
          <label htmlFor="live-schema" className={label}>Schema</label>
          <select id="live-schema" className={input} value={schema} onChange={e => changeSchema(e.target.value)} disabled={busy !== null}>
            {schemas.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {tables && (
        <div data-live-tables>
          <div className="flex items-center gap-2 mb-1.5">
            <input aria-label="Filter tables" className={`${input} py-1 text-xs`} placeholder="Filter…" value={filter} onChange={e => setFilter(e.target.value)} />
            {shown.length > 0 && (
              <button type="button" onClick={toggleShown} className="text-[11px] text-secondary underline hover:no-underline whitespace-nowrap">
                {allShownPicked ? 'Select none' : 'Select all'}
              </button>
            )}
          </div>
          {tables.length === 0 ? (
            <p className="text-xs text-on-surface-variant">This schema has no tables or views you may read.</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
              {shown.map(t => (
                <li key={t.name}>
                  <label className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                    <input type="checkbox" className="accent-primary" checked={picked.has(t.name)} onChange={() => toggle(t.name)} aria-label={`Read ${t.name}`} />
                    <span className="font-mono text-on-surface">{t.name}</span>
                    {t.kind === 'VIEW' && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-tertiary/10 text-tertiary font-bold">view</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {truncated && <p className="text-[10px] text-warning mt-1">Only the first tables are listed; filter to find one.</p>}
          <label className="flex items-center gap-2 text-xs text-on-surface-variant mt-2">
            <input type="checkbox" className="accent-primary" checked={qualify} onChange={e => setQualify(e.target.checked)} />
            Keep the schema name ({schema || 'schema'}.table)
          </label>
          {overLimit && <p className="text-[11px] text-error mt-1">Pick at most {options.maxTables} at a time.</p>}
          <button type="button" onClick={read} disabled={picked.size === 0 || overLimit || busy !== null}
                  className="mt-2 w-full px-3 py-2 rounded-lg text-xs font-bold bg-primary text-on-primary hover:brightness-110 transition-all disabled:opacity-50">
            {busy === 'read' ? 'Reading…' : readLabel(picked.size)}
          </button>
        </div>
      )}

      {busy === 'tables' && <p className="text-[11px] text-secondary">Listing tables…</p>}

      {error && (
        <div role="alert" className="text-xs text-error bg-error/10 border border-error/30 rounded-lg p-2.5">
          <div className="font-bold">{error.title}</div>
          <div className="break-words">{error.detail}</div>
        </div>
      )}
    </div>
  )
}
