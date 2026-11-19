import { useEffect, useRef, useState } from 'react'
import { AdminFormDrawer } from '../admin/shared/AdminFormDrawer'
import { ConfirmDialog } from '../ConfirmDialog'
import { CopyButton } from '../shared/CopyButton'
import { showToast } from '../../toast'
import type { FullstackStarterRequest } from '../../types'
import { DIALECT_LABELS, fetchSchemas, useLiveSchemaOptions } from '../liveSchema/liveSchemaApi'
import {
  createModelTables, DatabaseError, ddlFileName, fetchModelDdl, projectDialect,
  SCHEMA_DIALECT_LABELS, SCHEMA_DIALECTS, type CreateTablesResult, type DdlResult, type SchemaDialectId,
} from './databaseApi'
import { t, tn } from '../../i18n'

export type DatabaseMode = 'export' | 'create'

export interface DatabaseDrawerProps {
  isOpen: boolean
  onClose: () => void
  /** The model as Generate sends it — read once when the drawer opens. */
  buildRequest: () => FullstackStarterRequest
  selectedDeps: readonly string[]
  artifactId: string
  initialMode?: DatabaseMode
}

const LABEL = 'block text-[11px] font-bold uppercase tracking-widest text-secondary mb-2'
const SELECT = 'w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:opacity-50'

/**
 * The model's tables outside a generated project: **Export DDL** — the script for a database picked
 * here (it starts on the project's own), to copy or download — and **Create in database** — the same
 * script run on a schema source an admin allowed it for, after a check that says what would run and
 * refuses when a table is already there. The script is the project's Flyway baseline.
 */
export function DatabaseDrawer({ isOpen, onClose, buildRequest, selectedDeps, artifactId, initialMode = 'export' }: DatabaseDrawerProps) {
  const [mode, setMode] = useState<DatabaseMode>(initialMode)
  const requestRef = useRef<FullstackStarterRequest | null>(null)
  if (isOpen && requestRef.current === null) requestRef.current = buildRequest()
  if (!isOpen) requestRef.current = null

  // ── Export ────────────────────────────────────────────────────────────
  const ownDialect = projectDialect(selectedDeps)
  const [dialect, setDialect] = useState<SchemaDialectId>(ownDialect)
  const [ddl, setDdl] = useState<DdlResult | null>(null)
  const [ddlError, setDdlError] = useState<DatabaseError | null>(null)
  const [loadingDdl, setLoadingDdl] = useState(false)

  useEffect(() => {
    if (!isOpen || mode !== 'export' || !requestRef.current) return
    const abort = new AbortController()
    setLoadingDdl(true)
    setDdlError(null)
    fetchModelDdl(requestRef.current, dialect, abort.signal)
      .then(r => { setDdl(r); setLoadingDdl(false) })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setDdl(null)
        setDdlError(err instanceof DatabaseError ? err : new DatabaseError(0, t('Error'), String(err)))
        setLoadingDdl(false)
      })
    return () => abort.abort()
  }, [isOpen, mode, dialect])

  function download() {
    if (!ddl) return
    const url = URL.createObjectURL(new Blob([ddl.sql], { type: 'application/sql' }))
    const a = document.createElement('a')
    a.href = url
    a.download = ddlFileName(artifactId, ddl.dialect)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // ── Create ────────────────────────────────────────────────────────────
  const { options, loading: loadingOptions } = useLiveSchemaOptions()
  const writable = options.sources.filter(s => s.createTables)
  const [source, setSource] = useState('')
  const [schemas, setSchemas] = useState<string[]>([])
  const [schema, setSchema] = useState('')
  const [schemasError, setSchemasError] = useState<string | null>(null)
  const [plan, setPlan] = useState<CreateTablesResult | null>(null)
  const [createError, setCreateError] = useState<DatabaseError | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const writableNames = writable.map(s => s.name).join('\n')
  useEffect(() => {
    if (!isOpen) return
    const names = writableNames ? writableNames.split('\n') : []
    if (!names.includes(source)) setSource(names[0] ?? '')
  }, [isOpen, writableNames, source])

  useEffect(() => {
    setSchemas([])
    setSchema('')
    setSchemasError(null)
    setPlan(null)
    setCreateError(null)
    if (!isOpen || mode !== 'create' || !source) return
    const abort = new AbortController()
    fetchSchemas({ source }, abort.signal)
      .then(r => {
        setSchemas(r.schemas)
        setSchema(r.defaultSchema ?? r.schemas[0] ?? '')
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setSchemasError(err instanceof Error ? err.message : String(err))
      })
    return () => abort.abort()
  }, [isOpen, mode, source])

  // Reopening starts over: a plan is for the model and the target it was checked against.
  useEffect(() => {
    if (!isOpen) return
    setMode(initialMode)
    setDialect(ownDialect)
    setPlan(null)
    setCreateError(null)
    setConfirming(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening; the project's database is read then
  }, [isOpen])

  const planReady = plan !== null && createError === null
  const sourceDialect = writable.find(s => s.name === source)?.dialect

  async function check() {
    const request = requestRef.current
    if (!request || !source || !schema) {
      setCreateError(new DatabaseError(0, t('Pick a target'), t('Pick a source and a schema first.')))
      throw new Error('no target')
    }
    setBusy(true)
    setCreateError(null)
    try {
      setPlan(await createModelTables(request, source, schema, true))
    } catch (err) {
      setPlan(null)
      setCreateError(err instanceof DatabaseError ? err : new DatabaseError(0, t('Error'), String(err)))
      throw err
    } finally {
      setBusy(false)
    }
  }

  async function run() {
    const request = requestRef.current
    if (!request || !plan) return
    setConfirming(false)
    setBusy(true)
    setCreateError(null)
    try {
      const done = await createModelTables(request, source, schema, false)
      showToast({ message: tn(done.created.length, 'Created {n} table in {schema} on {source}', 'Created {n} tables in {schema} on {source}', { schema: done.schema, source }), type: 'success' })
      onClose()
    } catch (err) {
      setCreateError(err instanceof DatabaseError ? err : new DatabaseError(0, t('Error'), String(err)))
    } finally {
      setBusy(false)
    }
  }

  async function primary() {
    if (mode === 'export') {
      if (!ddl) throw new Error('nothing to download')
      download()
      return
    }
    if (planReady) {
      setConfirming(true)
      return
    }
    await check()
  }

  const saveLabel = mode === 'export'
    ? t('Download .sql')
    : planReady && plan ? tn(plan.tables.length, 'Create {n} table', 'Create {n} tables') : t('Check')

  return (
    <>
      <AdminFormDrawer
        title={t('Model tables')}
        isOpen={isOpen}
        onClose={onClose}
        onSave={primary}
        saving={busy || (mode === 'export' && loadingDdl)}
        saveLabel={saveLabel}
        savingLabel={mode === 'export' ? t('Writing…') : t('Working…')}
      >
        <div className="space-y-4" data-database-drawer>
          <div role="radiogroup" aria-label={t('What to do with the tables')} data-database-mode
               className="flex gap-1 p-1 rounded-lg bg-surface-container-low border border-outline-variant">
            {([['export', t('Export DDL'), 'description'], ['create', t('Create in database'), 'database']] as const).map(([id, text, icon]) => (
              <button key={id} type="button" role="radio" aria-checked={mode === id}
                      onClick={() => setMode(id)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        mode === id ? 'bg-primary/15 text-primary' : 'text-secondary hover:text-on-surface'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{icon}</span>
                {text}
              </button>
            ))}
          </div>

          {mode === 'export' && (<>
            <p className="text-[12px] text-secondary leading-relaxed">
              {t('The CREATE TABLE script for this model — the same one a project with Flyway gets as its first migration')}{' '}
              (<code>V1__init.sql</code>){t(', so the tables are the ones the generated entities expect.')}
            </p>
            <div>
              <label className={LABEL} htmlFor="db-dialect">{t('Database')}</label>
              <select id="db-dialect" className={SELECT} value={dialect} data-ddl-dialect
                      onChange={e => setDialect(e.target.value as SchemaDialectId)}>
                {SCHEMA_DIALECTS.map(d => (
                  <option key={d} value={d}>{d === ownDialect ? t('{database} (this project’s)', { database: SCHEMA_DIALECT_LABELS[d] }) : SCHEMA_DIALECT_LABELS[d]}</option>
                ))}
              </select>
            </div>
            {ddlError && <ErrorBox error={ddlError} />}
            {ddl && (
              <div className={`space-y-2 ${loadingDdl ? 'opacity-60' : ''}`} data-ddl-result>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-secondary">
                    {tn(ddl.tables.length, '{n} table', '{n} tables')} · {ddl.label}
                  </span>
                  <CopyButton text={ddl.sql} label={t('Copy SQL')} />
                </div>
                <pre className="font-mono text-[11px] leading-relaxed bg-background border border-outline-variant rounded p-3 max-h-[50vh] overflow-auto whitespace-pre" data-ddl-sql>
                  {ddl.sql}
                </pre>
              </div>
            )}
          </>)}

          {mode === 'create' && (<>
            <p className="text-[12px] text-secondary leading-relaxed">
              {t('Runs this model’s CREATE TABLE script on a database an admin set up as a source and allowed it for.')}{' '}
              <b>{t('Check')}</b> {t('shows what would run; nothing is created until you confirm, and nothing at all if one of the tables is already there.')}
            </p>
            {!loadingOptions && writable.length === 0 ? (
              <p className="text-[12px] rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2" data-no-writable-source>
                {t('No database source allows creating tables. An admin can allow it for a source under Admin → Schema sources. Meanwhile,')}{' '}
                <button type="button" className="text-primary underline" onClick={() => setMode('export')}>{t('export the DDL')}</button> {t('and run it yourself.')}
              </p>
            ) : (<>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL} htmlFor="db-source">{t('Source')}</label>
                  <select id="db-source" className={SELECT} value={source} data-create-source
                          onChange={e => setSource(e.target.value)}>
                    {writable.map(s => (
                      <option key={s.name} value={s.name}>{s.name} — {DIALECT_LABELS[s.dialect] ?? s.dialect}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL} htmlFor="db-schema">{t('Schema')}</label>
                  <select id="db-schema" className={SELECT} value={schema} data-create-schema
                          disabled={schemas.length === 0}
                          onChange={e => { setSchema(e.target.value); setPlan(null); setCreateError(null) }}>
                    {schemas.length === 0 && <option value="">{schemasError ? '—' : t('Connecting…')}</option>}
                    {schemas.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {schemasError && <p className="text-[12px] text-error" role="alert">{schemasError}</p>}
              {sourceDialect && sourceDialect !== ownDialect && !plan && (
                <p className="text-[11px] text-warning" data-dialect-mismatch>
                  {t('This project runs on {project}; the tables will be written for {source}, the source’s database.', {
                    project: SCHEMA_DIALECT_LABELS[ownDialect], source: DIALECT_LABELS[sourceDialect] ?? sourceDialect,
                  })}
                </p>
              )}
            </>)}

            {createError && <ErrorBox error={createError} />}

            {plan && (
              <div className="space-y-2" data-create-plan>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-secondary">
                    {tn(plan.tables.length, '{n} table', '{n} tables')} · {t('{n} statements', { n: plan.statements })} · {plan.schema}
                  </span>
                  <CopyButton text={plan.sql} label={t('Copy SQL')} />
                </div>
                {plan.dialect !== plan.projectDialect && (
                  <p className="text-[11px] text-warning" data-dialect-mismatch>
                    {t('Written for {source}, the source’s database — this project runs on {project}.', {
                      source: plan.label, project: SCHEMA_DIALECT_LABELS[plan.projectDialect],
                    })}
                  </p>
                )}
                {plan.flyway && (
                  <p className="text-[11px] text-secondary" data-flyway-note>
                    {t('This project has Flyway, whose')} <code>V1__init.sql</code>{' '}
                    {t('makes these same tables. On this database the app’s first start finds them there and marks V1 as applied')}{' '}
                    (<code>baseline-on-migrate</code>){t('; Hibernate then checks them against the entities.')}
                  </p>
                )}
                {!plan.transactional && (
                  <p className="text-[11px] text-secondary" data-not-transactional>
                    {t('On {database} each CREATE commits at once: if a statement fails, the tables made before it are dropped again.', { database: plan.label })}
                  </p>
                )}
                <pre className="font-mono text-[11px] leading-relaxed bg-background border border-outline-variant rounded p-3 max-h-[40vh] overflow-auto whitespace-pre" data-create-sql>
                  {plan.sql}
                </pre>
              </div>
            )}
          </>)}
        </div>
      </AdminFormDrawer>

      {confirming && plan && (
        <ConfirmDialog
          title={tn(plan.tables.length, 'Create {n} table?', 'Create {n} tables?')}
          message={t('This runs {n} statements on {source}, in schema {schema}, as the source’s user. Nothing there is changed or dropped.', {
            n: plan.statements, source, schema: plan.schema,
          })}
          confirmLabel={t('Create tables')}
          tone="danger"
          onConfirm={() => { void run() }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}

function ErrorBox({ error }: { error: DatabaseError }) {
  return (
    <div className="rounded-lg border border-error/40 bg-error/5 px-3 py-2 text-[12px] text-on-surface space-y-1" role="alert" data-database-error>
      <p className="font-semibold text-error">{error.title}</p>
      <p>{error.message}{error.path ? <span className="text-secondary"> ({error.path})</span> : null}</p>
      {error.existing.length > 0 && (
        <ul className="list-disc ps-5 font-mono text-[11px]" data-existing-tables dir="ltr">
          {error.existing.map(table => <li key={table}>{table}</li>)}
        </ul>
      )}
    </div>
  )
}
