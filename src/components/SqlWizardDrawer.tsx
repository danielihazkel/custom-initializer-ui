import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AdminFormDrawer } from './admin/shared/AdminFormDrawer'
import { CodeEditor } from './admin/file-contributions/CodeEditor'
import type { SqlApiMode, SqlTableConfig, SqlWizardEntry } from '../types'
import { requiredSqlDeps, isSqlDepSatisfied } from '../utils/projectUtils'
import { LiveSchemaPanel } from './liveSchema/LiveSchemaPanel'
import { fetchDdl, type LiveReadRequest } from './liveSchema/liveSchemaApi'
import { isRtl, t, tn } from '../i18n'
import { codeText } from '../utils/codeText'

function apiModes(): { id: SqlApiMode; label: string; hint: string }[] {
  return [
    { id: 'NONE', label: t('Entities only'), hint: t('JPA entities (+ optional repositories)') },
    { id: 'ENTITY_DIRECT', label: t('REST API — entity'), hint: t('Repository + Service + Controller, entity exposed directly') },
    { id: 'INLINE_DTO', label: t('REST API — DTO'), hint: t('Adds a record DTO with from()/toEntity() — no extra dependency') },
    { id: 'MAPSTRUCT_DTO', label: t('REST API — MapStruct'), hint: t('Adds a record DTO + @Mapper interface (auto-adds MapStruct)') },
  ]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  depId: string
  depName: string
  dialectName: string
  initial: SqlWizardEntry | null
  selected: string[]
  onSave: (entry: SqlWizardEntry | null) => void
  parseError?: { message: string; snippet?: string; statementIndex?: number } | null
}

// The bracket alternative matches a whole SQL Server [schema].[table] chain (not just
// the first [schema] segment) so bareName can resolve it to the table name.
const TABLE_REGEX = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|`([^`]+)`|(\[[^\]]+\](?:\s*\.\s*\[[^\]]+\])*)|([a-zA-Z_][\w$]*(?:\.[a-zA-Z_][\w$]*)?))/gi

// A SELECT (or WITH … SELECT) becomes a read-only @Subselect view. Detected so the
// "no CREATE TABLE" hint doesn't misfire and so views surface in the detected list.
// The authoritative parse/naming happens server-side; this is a best-effort preview.
const SELECT_REGEX = /(^|;)\s*(?:WITH\b|SELECT\b)/i
const FROM_REGEX = /\bFROM\s+(?:"([^"]+)"|`([^`]+)`|(\[[^\]]+\](?:\s*\.\s*\[[^\]]+\])*)|([a-zA-Z_][\w$]*(?:\.[a-zA-Z_][\w$]*)?))/i

// Drop SQL Server brackets, then take the last dotted segment (the table name),
// so both `[dbo].[t]` and `dbo.t` resolve to `t`.
function bareName(raw: string): string {
  const cleaned = raw.replace(/[[\]]/g, '')
  return cleaned.includes('.') ? cleaned.substring(cleaned.lastIndexOf('.') + 1) : cleaned
}

function detectTableNames(sql: string): string[] {
  const names: string[] = []
  for (const m of sql.matchAll(TABLE_REGEX)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? m[4]
    if (!raw) continue
    names.push(bareName(raw))
  }
  return names
}

// One display name per SELECT statement — derived from its FROM table (matching the
// backend's view-naming), or "view" when there's no resolvable FROM.
function detectViewNames(sql: string): string[] {
  const views: string[] = []
  for (const stmt of sql.split(';')) {
    const s = stmt.trim()
    if (!s || !/^(?:WITH\b|SELECT\b)/i.test(s)) continue
    const m = s.match(FROM_REGEX)
    const raw = m ? (m[1] ?? m[2] ?? m[3] ?? m[4]) : null
    views.push(raw ? bareName(raw) : 'view')
  }
  return views
}

function hasSelect(sql: string): boolean {
  return SELECT_REGEX.test(sql)
}

/** What a read from a live database put in the script. */
function readSummary(tableCount: number, viewCount: number, schema: string, replaced: boolean): string {
  const tables = tn(tableCount, '{n} table', '{n} tables')
  if (viewCount) {
    const views = tn(viewCount, '{n} view', '{n} views')
    return replaced
      ? t('Read {tables} and {views} from {schema} — the script was replaced.', { tables, views, schema })
      : t('Read {tables} and {views} from {schema}.', { tables, views, schema })
  }
  return replaced
    ? t('Read {tables} from {schema} — the script was replaced.', { tables, schema })
    : t('Read {tables} from {schema}.', { tables, schema })
}

/** One on/off line of the "other dependencies" box. */
function ExtraToggle({ checked, disabled, onChange, label, note }: {
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  label: string
  note: ReactNode
}) {
  return (
    <label className={`flex items-start gap-2 text-xs ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 accent-primary"
      />
      <span>
        <span className="font-semibold text-on-surface">{label}</span>
        <span className="block text-[10px] text-on-surface-variant leading-relaxed">{note}</span>
      </span>
    </label>
  )
}

export function SqlWizardDrawer({ isOpen, onClose, depId, depName, dialectName, initial, selected, onSave, parseError }: Props) {
  const [sql, setSql] = useState<string>(initial?.sql ?? '')
  const [subPackage, setSubPackage] = useState<string>(initial?.subPackage ?? 'entity')
  const [tables, setTables] = useState<SqlTableConfig[]>(initial?.tables ?? [])
  const [apiMode, setApiMode] = useState<SqlApiMode>(initial?.apiMode ?? 'NONE')
  const [flywayBaseline, setFlywayBaseline] = useState<boolean>(initial?.flywayBaseline ?? true)
  const [generateTests, setGenerateTests] = useState<boolean>(initial?.generateTests ?? false)
  // Reading from a live database: the panel is open, and what the last read replaced (for Undo).
  const [liveOpen, setLiveOpen] = useState(false)
  const [lastRead, setLastRead] = useState<{ summary: string; warnings: string[]; previous: string } | null>(null)

  async function readFromDatabase(req: LiveReadRequest) {
    const r = await fetchDdl(req)
    const previous = sql
    setSql(r.sql)
    setLiveOpen(false)
    setLastRead({
      summary: readSummary(r.tables, r.views, req.schema, previous.trim() !== ''),
      warnings: r.warnings,
      previous,
    })
  }

  // Re-seed drawer state when it re-opens for a different dep
  useEffect(() => {
    if (isOpen) {
      setLiveOpen(false)
      setLastRead(null)
      setSql(initial?.sql ?? '')
      setSubPackage(initial?.subPackage ?? 'entity')
      setTables(initial?.tables ?? [])
      setApiMode(initial?.apiMode ?? 'NONE')
      setFlywayBaseline(initial?.flywayBaseline ?? true)
      setGenerateTests(initial?.generateTests ?? false)
    }
  }, [isOpen, depId]) // eslint-disable-line react-hooks/exhaustive-deps

  const detected = useMemo(() => detectTableNames(sql), [sql])
  const detectedViews = useMemo(() => detectViewNames(sql), [sql])
  const selectPresent = useMemo(() => hasSelect(sql), [sql])

  // Merge detected tables with existing repo-flag state so toggles survive edits
  useEffect(() => {
    setTables(prev => {
      const byName = new Map(prev.map(t => [t.name, t]))
      return detected.map(name => byName.get(name) ?? { name, generateRepository: true })
    })
  }, [detected.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    const trimmed = sql.trim()
    if (!trimmed) {
      onSave(null)
    } else {
      onSave({
        sql: trimmed,
        subPackage: subPackage.trim() || 'entity',
        tables,
        apiMode,
        // Kept only when they differ from the defaults, so an untouched entry stays as it was.
        ...(flywayBaseline ? {} : { flywayBaseline: false }),
        ...(generateTests && apiMode !== 'NONE' ? { generateTests: true } : {}),
      })
    }
    onClose()
  }

  function toggleRepo(name: string) {
    setTables(prev => prev.map(t => t.name === name ? { ...t, generateRepository: !t.generateRepository } : t))
  }

  function handleClear() {
    setSql('')
    setTables([])
  }

  return (
    <AdminFormDrawer
      title={t('SQL Entities — {dep}', { dep: depName })}
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
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>database</span>
          <span>
            {t('Dialect detected:')} <span className="font-bold">{dialectName}</span>
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
            {t('Sub-package (under your root package)')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={subPackage}
              onChange={e => setSubPackage(e.target.value)}
              placeholder="entity"
              dir="ltr"
              className="flex-1 bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
            />
            <span className="text-[10px] text-secondary font-mono">→ {t('repositories go to')} <span className="text-on-surface-variant" dir="ltr">repository/</span></span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
            {t('Generate REST API')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {apiModes().map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setApiMode(m.id)}
                title={m.hint}
                className={`text-start px-3 py-2 rounded-lg border text-xs transition-all ${
                  apiMode === m.id
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-surface-container-highest border-outline-variant text-on-surface-variant hover:border-primary/50'
                }`}
              >
                <div className="font-bold">{m.label}</div>
                <div className="text-[10px] leading-tight mt-0.5 text-secondary">{m.hint}</div>
              </button>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-secondary">{t('Required dependencies')}</div>
            {requiredSqlDeps(apiMode).map(dep => {
              const ok = isSqlDepSatisfied(dep, selected)
              return (
                <div key={dep} className="flex items-center gap-1.5 text-[10px]">
                  <span className={`material-symbols-outlined ${ok ? 'text-primary' : 'text-secondary'}`} style={{ fontSize: '13px' }}>
                    {ok ? 'check_circle' : 'add_circle'}
                  </span>
                  <code className="text-primary">{dep}</code>
                  <span className="text-on-surface-variant">{ok ? t('already selected') : t('added automatically on save')}</span>
                </div>
              )
            })}
          </div>
          {apiMode !== 'NONE' && (
            <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
              {codeText(t('A Service + Controller (REST CRUD under `/api/<table>`) is generated per table with a primary key. Tables without a primary key still produce an entity only.'))}
            </p>
          )}
        </div>

        <div data-sql-extras>
          <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
            {t("With the project's other dependencies")}
          </label>
          <div className="space-y-2 border border-outline-variant rounded-lg p-3 bg-surface-container-lowest">
            <ExtraToggle
              checked={flywayBaseline}
              onChange={setFlywayBaseline}
              label={t('Use this script as the Flyway baseline')}
              note={selected.includes('flyway')
                ? codeText(t('Written to `db/migration/V1__init.sql`, in place of the placeholder migration.'))
                : codeText(t('Takes effect when `flyway` is selected — it is not, so no migration is written.'))}
            />
            <ExtraToggle
              checked={generateTests && apiMode !== 'NONE'}
              disabled={apiMode === 'NONE'}
              onChange={setGenerateTests}
              label={t('Generate controller tests')}
              note={apiMode === 'NONE'
                ? t('Needs a REST API mode: a test is written per controller.')
                : codeText(t('A `@WebMvcTest` per controller, the service mocked.'))}
            />
            <div className="flex items-start gap-2 text-[10px] text-on-surface-variant leading-relaxed">
              <span className={`material-symbols-outlined ${selected.includes('validation') ? 'text-primary' : 'text-secondary'}`} style={{ fontSize: '13px' }}>
                {selected.includes('validation') ? 'check_circle' : 'info'}
              </span>
              <span>
                {selected.includes('validation')
                  ? codeText(t('`validation` is selected: `NOT NULL` and column lengths become `@NotNull` / `@Size`, and request bodies are `@Valid`.'))
                  : codeText(t('Select `validation` to turn `NOT NULL` and column lengths into Bean Validation on the request bodies.'))}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-widest text-secondary">
              {t('SQL Scripts')}
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLiveOpen(o => !o)}
                aria-expanded={liveOpen}
                data-live-toggle
                className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>database</span>
                {liveOpen ? t('Close') : t('Read from a database…')}
              </button>
              {sql.length > 0 && (
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
          {liveOpen && (
            <div className="mb-3">
              <LiveSchemaPanel
                dialect={dialectName}
                readLabel={n => n === 0 ? t('Pick tables to read') : sql.trim() ? t('Read {n} into the script (replaces it)', { n }) : t('Read {n} into the script', { n })}
                onRead={readFromDatabase}
              />
            </div>
          )}
          {lastRead && (
            <div role="status" data-live-read className="mb-2 flex items-start gap-2 text-[11px] text-on-surface-variant border border-outline-variant rounded-lg px-3 py-2">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '14px' }}>check_circle</span>
              <span className="flex-1">
                {lastRead.summary}
                {lastRead.warnings.map(w => <span key={w} className="block text-warning">{w}</span>)}
              </span>
              <button type="button" className="underline hover:no-underline"
                      onClick={() => { setSql(lastRead.previous); setLastRead(null) }}>
                {t('Undo')}
              </button>
            </div>
          )}
          <div dir="ltr">
            <CodeEditor
              value={sql}
              onChange={setSql}
              targetPath="init.sql"
            />
          </div>
          <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
            {codeText(t('Paste one or more `CREATE TABLE` statements, or read them from a database (a view comes in as a `SELECT` of its columns) — keys, foreign keys and unique constraints added by `ALTER TABLE` are read too, and a `CHECK (col IN (…))` becomes an enum. Entities + optional JPA repositories are generated into your project when downloaded. A `SELECT` becomes a read-only `@Subselect` view (GET-only; fields are generated as `String` with a TODO to set the real type in source). `COMMENT ON`, `CREATE INDEX`, and `GRANT` statements are accepted and silently ignored.'))}
          </p>
        </div>

        {parseError && (
          <div className="text-xs text-error bg-error/10 border border-error/30 rounded-lg p-3 space-y-1.5">
            <div className="font-bold uppercase tracking-widest text-[10px]">{t('SQL parse error')}</div>
            <div className="text-on-surface">
              {parseError.statementIndex != null
                ? t('Statement #{n}: {message}', { n: parseError.statementIndex, message: parseError.message })
                : parseError.message}
            </div>
            {parseError.snippet && (
              <pre className="mt-1 text-[10px] font-mono whitespace-pre-wrap text-on-surface-variant bg-surface-container-lowest border border-outline-variant rounded p-2">{parseError.snippet}</pre>
            )}
          </div>
        )}

        {(tables.length > 0 || detectedViews.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-widest text-secondary">
                {t('Detected Entities')}
              </label>
              <span className="text-[10px] font-bold py-0.5 px-2 bg-primary/10 text-primary rounded-full">
                {tables.length + detectedViews.length}
              </span>
            </div>
            <div className="space-y-2 border border-outline-variant rounded-lg p-3 bg-surface-container-lowest">
              {tables.map(table => (
                <label key={table.name} className="flex items-center justify-between gap-3 text-xs cursor-pointer group">
                  <span className="font-mono text-on-surface font-semibold" dir="ltr">{table.name}</span>
                  <div className="flex items-center gap-2 text-secondary group-hover:text-on-surface transition-colors">
                    <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      table.generateRepository
                        ? 'bg-secondary border-secondary text-on-surface'
                        : 'bg-surface-container-lowest border-secondary/40 group-hover:border-secondary'
                    }`}>
                      {table.generateRepository && <span className="material-symbols-outlined font-bold text-background" style={{ fontSize: '12px' }}>check</span>}
                    </div>
                    <input
                      type="checkbox"
                      checked={table.generateRepository}
                      onChange={() => toggleRepo(table.name)}
                      className="sr-only"
                    />
                    <span className="text-[10px] font-medium">{t('Generate repository')}</span>
                  </div>
                </label>
              ))}
              {detectedViews.map((name, i) => (
                <div key={`view-${i}-${name}`} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-mono text-on-surface font-semibold" dir="ltr">{name}</span>
                  <span className="flex items-center gap-1 text-[10px] font-medium py-0.5 px-2 bg-tertiary/10 text-tertiary rounded-full">
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>visibility</span>
                    {t('read-only view')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sql.trim().length > 0 && tables.length === 0 && !selectPresent && (
          <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg p-3">
            {codeText(t('No `CREATE TABLE` or `SELECT` statements detected. Check your SQL syntax.'), 'font-mono')}
          </div>
        )}
      </div>
    </AdminFormDrawer>
  )
}
