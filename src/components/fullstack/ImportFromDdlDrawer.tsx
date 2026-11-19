import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { AdminFormDrawer } from '../admin/shared/AdminFormDrawer'
import type { FullstackEntityDef } from '../../types'
import { newUid } from './uid'
import { useSqlDialects } from '../../hooks/useSqlDialects'
import { LiveSchemaPanel } from '../liveSchema/LiveSchemaPanel'
import { postLive, type LiveReadRequest } from '../liveSchema/liveSchemaApi'
import { t, tn } from '../../i18n'

interface Props {
  isOpen: boolean
  onClose: () => void
  hasExisting: boolean
  /** Number of entities currently in the editor — drives the "Replace all" warning copy. */
  existingCount?: number
  /** 'ddl' parses CREATE TABLE into table-backed entities; 'select' parses a SELECT into a
   *  single read-only @Subselect view entity (fields default to STRING for you to type). */
  variant?: ImportVariant
  /** note: optional server-side advisory (e.g. columns detected heuristically / add manually). */
  onImport: (entities: FullstackEntityDef[], mode: ImportMode, note?: string) => void
}

export type ImportMode = 'replace' | 'append'
export type ImportVariant = 'ddl' | 'select'

/** The words of each variant, in the site's language at the moment the drawer renders. */
function copyOf(variant: ImportVariant): {
  title: string; endpoint: string; emptyHint: string; emptyResult: string; placeholder: string; blurb: ReactNode
} {
  if (variant === 'ddl') {
    return {
      title: t('Import Entities from SQL DDL'),
      endpoint: '/metadata/fullstack/import-ddl',
      emptyHint: t('Paste at least one CREATE TABLE statement'),
      emptyResult: t('No CREATE TABLE statements were detected'),
      placeholder: 'CREATE TABLE products (\n  id BIGINT PRIMARY KEY AUTO_INCREMENT,\n  sku VARCHAR(64) NOT NULL,\n  price NUMERIC(10,2)\n);',
      blurb: (
        <>{t('Paste')} <code className="font-mono text-on-surface">CREATE TABLE</code>{' '}
        {t('statements and a starter entity list will be generated. Column types map to fullstack field types — review the result in the editor before generating.')}</>
      ),
    }
  }
  return {
    title: t('Import a Read-only View from SELECT'),
    endpoint: '/metadata/fullstack/import-select',
    emptyHint: t('Paste a SELECT query'),
    emptyResult: t('No columns were detected in the SELECT'),
    placeholder: 'SELECT u.id AS id,\n       u.full_name AS fullName,\n       o.total AS lastOrderTotal\nFROM users u\nJOIN orders o ON o.user_id = u.id;',
    blurb: (
      <>{t('Paste a')} <code className="font-mono text-on-surface">SELECT</code>{' '}
      {t('query. Its columns become a single read-only view entity (mapped via Hibernate')}
      <code className="font-mono text-on-surface"> @Subselect</code>{t(', GET-only). A query has no column types, so every field defaults to')}{' '}
      <code className="font-mono text-on-surface">STRING</code>{' '}
      {t('— set the right types and pick the primary key in the editor. Alias each column')}{' '}
      (<code className="font-mono text-on-surface">AS name</code>) {t('to control field names.')}</>
    ),
  }
}

// Display names for the dialect enum ids the server reports (`/metadata/sql-dialects`, the same
// source the SQL wizard uses). Unknown ids fall back to the raw name.
const DIALECT_LABELS: Record<string, string> = {
  H2: 'H2', POSTGRESQL: 'PostgreSQL', MYSQL: 'MySQL', MSSQL: 'SQL Server', ORACLE: 'Oracle', DB2: 'DB2',
}
// Used until the catalog answers (or when it fails), so the drawer is never left without a dialect.
const FALLBACK_DIALECTS = Object.keys(DIALECT_LABELS)

/** Distinct dialect ids from the depId → dialect map, catalog order, H2 first when present. */
export function dialectOptions(dialects: Record<string, string>): { value: string; label: string }[] {
  const ids = Array.from(new Set(Object.values(dialects).filter(Boolean)))
  const ordered = ids.includes('H2') ? ['H2', ...ids.filter(d => d !== 'H2')] : ids
  return (ordered.length > 0 ? ordered : FALLBACK_DIALECTS).map(value => ({ value, label: DIALECT_LABELS[value] ?? value }))
}

interface WireField {
  name: string
  type: FullstackEntityDef['fields'][number]['type']
  primaryKey: boolean
  generated: boolean
  required: boolean
  unique: boolean
  length: number | null
  enumValues: string[]
  /** The DDL's own column name (the field name is its camelCase, which can't be reversed). */
  column?: string | null
}
interface WireRelation {
  type: string
  fieldName: string
  targetEntity: string
  required: boolean
  joinColumn?: string | null
}
interface WireEntity {
  name: string
  tableName: string | null
  schema?: string | null
  fields: WireField[]
  readOnly?: boolean
  viewQuery?: string | null
  sourceSql?: string | null
  /** MANY_TO_ONEs derived from single-column foreign keys between the pasted tables. */
  relations?: WireRelation[] | null
  /** UNIQUE constraints over several columns, by the field / relation names the columns became. */
  uniqueKeys?: string[][] | null
}
interface ImportResponse {
  entities: WireEntity[]
  note?: string | null
}
interface ImportError {
  error?: string
  detail?: string
  statementIndex?: number
  snippet?: string
}

/** The server's entities as the editor holds them (each with fresh uids). */
function toEditorEntities(wire: WireEntity[]): FullstackEntityDef[] {
  return wire.map(e => ({
    uid: newUid(),
    name: e.name,
    tableName: e.tableName ?? undefined,
    schema: e.schema ?? undefined,
    readOnly: e.readOnly || undefined,
    viewQuery: e.viewQuery ?? undefined,
    sourceSql: e.sourceSql ?? undefined,
    fields: e.fields.map(f => ({
      uid: newUid(),
      name: f.name,
      type: f.type,
      primaryKey: f.primaryKey || undefined,
      generated: f.generated || undefined,
      required: f.required || undefined,
      unique: f.unique || undefined,
      length: f.length ?? undefined,
      enumValues: f.enumValues.length > 0 ? f.enumValues : undefined,
      column: f.column ?? undefined,
    })),
    relations: e.relations && e.relations.length > 0
      ? e.relations.map(r => ({
        uid: newUid(),
        type: 'MANY_TO_ONE' as const,
        fieldName: r.fieldName,
        targetEntity: r.targetEntity,
        required: r.required || undefined,
        joinColumn: r.joinColumn ?? undefined,
      }))
      : undefined,
    uniqueKeys: e.uniqueKeys && e.uniqueKeys.length > 0
      ? e.uniqueKeys.map(fields => ({ fields }))
      : undefined,
  }))
}

/** Where the DDL import's tables come from: pasted text, or a live database. */
type DdlSource = 'paste' | 'database'

export function ImportFromDdlDrawer({ isOpen, onClose, hasExisting, existingCount = 0, variant = 'ddl', onImport }: Props) {
  const [sql, setSql] = useState('')
  const [dialect, setDialect] = useState('H2')
  const [mode, setMode] = useState<ImportMode>(hasExisting ? 'append' : 'replace')
  const [error, setError] = useState<ImportError | null>(null)
  const [parsing, setParsing] = useState(false)
  // Two-step flow: "Parse" fills this preview, "Import N entities" commits it. Editing the SQL
  // or switching dialect clears it, so what gets imported is always what was reviewed.
  const [parsed, setParsed] = useState<{ entities: FullstackEntityDef[]; note?: string } | null>(null)
  // The SQL or dialect changed after Parse: the preview (and the ticks) stay on screen, dimmed,
  // but can't be imported until re-parsed — a stray keystroke must not throw the review away.
  const [stale, setStale] = useState(false)
  // Which parsed entities to import (uids) — everything by default, so a paste of a whole schema
  // can be trimmed to the tables that matter without re-pasting.
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [source, setSource] = useState<DdlSource>('paste')
  const fromDatabase = variant === 'ddl' && source === 'database'
  const copy = copyOf(variant)

  /** The live panel's read: the entities come back ready, so they go straight to the preview. */
  async function readFromDatabase(req: LiveReadRequest) {
    const body = await postLive<ImportResponse>('/metadata/fullstack/import-live', req)
    const entities = toEditorEntities(body.entities)
    setError(null)
    setParsed({ entities, note: body.note ?? undefined })
    setStale(false)
    setSelected(new Set(entities.map(e => e.uid!)))
  }
  const fileInputRef = useRef<HTMLInputElement>(null)
  // A `.sql` file can be picked or dropped onto the textarea instead of pasted; its text replaces
  // the current SQL and, like typing, marks an existing preview stale.
  function loadFile(file: File | undefined) {
    if (!file) return
    file.text()
      .then(text => { setSql(text); setError(null); if (parsed) setStale(true) })
      .catch(() => setError({ error: t('Read failed'), detail: t("Couldn't read {file}", { file: file.name }) }))
  }
  function onDrop(e: DragEvent<HTMLTextAreaElement>) {
    const file = e.dataTransfer.files?.[0]
    if (!file) return // a text drag falls through to the browser's default paste
    e.preventDefault()
    loadFile(file)
  }
  const { dialects: catalogDialects } = useSqlDialects()
  const dialectChoices = dialectOptions(catalogDialects)
  // If the catalog answers without the current pick (e.g. a dialect was removed), fall back to
  // the first option rather than posting an id the server no longer accepts.
  const dialectIds = dialectChoices.map(d => d.value).join(',')
  useEffect(() => {
    const ids = dialectIds.split(',')
    if (!ids.includes(dialect)) setDialect(ids[0] || 'H2')
  }, [dialectIds, dialect])

  // Re-seed on every open and on a variant switch: the same drawer instance serves both the
  // DDL and SELECT imports, so leftover text from one must never be posted to the other.
  useEffect(() => {
    if (isOpen) {
      setSql('')
      setError(null)
      setParsing(false)
      setParsed(null)
      setStale(false)
      setSelected(new Set())
      setMode(hasExisting ? 'append' : 'replace')
      setSource('paste')
    }
  }, [isOpen, hasExisting, variant])

  async function handleSave() {
    if (parsed && !stale) {
      const chosen = parsed.entities.filter(e => e.uid && selected.has(e.uid))
      if (chosen.length === 0) {
        setError({ detail: t('Tick at least one entity to import') })
        throw new Error('nothing selected')
      }
      // A relation to a table that was left out would point at nothing — drop it (the note
      // under the chip said so before the click).
      const kept = new Set(chosen.map(e => e.name.toLowerCase()))
      const entities = chosen.map(e => {
        const relations = e.relations?.filter(r => kept.has(r.targetEntity.toLowerCase()))
        // A unique key over a link that went with its table names nothing any more: dropped too.
        const dropped = new Set((e.relations ?? []).filter(r => !relations?.includes(r)).map(r => r.fieldName))
        const uniqueKeys = e.uniqueKeys?.filter(k => !k.fields.some(f => dropped.has(f)))
        return { ...e, relations, uniqueKeys: uniqueKeys && uniqueKeys.length > 0 ? uniqueKeys : undefined }
      })
      onImport(entities, mode, parsed.note)
      setSql('')
      setParsed(null)
      setStale(false)
      onClose()
      return
    }
    setError(null)
    if (fromDatabase) {
      setError({ detail: t('Connect, pick the tables and read them first') })
      throw new Error('nothing read')
    }
    const trimmed = sql.trim()
    if (!trimmed) {
      setError({ detail: copy.emptyHint })
      throw new Error('empty')
    }
    setParsing(true)
    let body: ImportResponse
    try {
      const res = await fetch(copy.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: trimmed, dialect }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null) as ImportError | null
        setError(errBody ?? { detail: `HTTP ${res.status}` })
        throw new Error(errBody?.detail ?? `HTTP ${res.status}`)
      }
      body = await res.json() as ImportResponse
    } catch (err) {
      // A network failure has no response body — surface it in the same error box. (An HTTP
      // error already set a richer one above; the functional update keeps it.)
      setError(prev => prev ?? { detail: err instanceof Error ? err.message : String(err) })
      throw err
    } finally {
      setParsing(false)
    }
    const entities = toEditorEntities(body.entities)
    if (entities.length === 0) {
      setError({ detail: copy.emptyResult })
      throw new Error('empty result')
    }
    // Re-parsing after an edit keeps the ticks of entities that are still there (by name).
    const previouslyUnticked = new Set(
      stale && parsed ? parsed.entities.filter(e => e.uid && !selected.has(e.uid)).map(e => e.name.toLowerCase()) : [])
    setParsed({ entities, note: body.note ?? undefined })
    setStale(false)
    setSelected(new Set(entities.filter(e => !previouslyUnticked.has(e.name.toLowerCase())).map(e => e.uid!)))
  }

  const n = parsed?.entities.length ?? 0
  const nSelected = parsed ? parsed.entities.filter(e => e.uid && selected.has(e.uid)).length : 0
  const selectedNames = new Set(parsed?.entities.filter(e => e.uid && selected.has(e.uid)).map(e => e.name.toLowerCase()) ?? [])
  function toggleSelected(uid: string) {
    setSelected(prev => { const next = new Set(prev); next.has(uid) ? next.delete(uid) : next.add(uid); return next })
  }

  return (
    <AdminFormDrawer
      title={copy.title}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saving={parsing}
      saveLabel={parsed && !stale
        ? (nSelected === n ? tn(n, 'Import {n} entity', 'Import {n} entities') : t('Import {count} of {n}', { count: nSelected, n }))
        : fromDatabase ? t('Import') : stale ? t('Parse again') : t('Parse')}
      savingLabel={t('Parsing…')}
    >
      <div className="space-y-4">
        <p className="text-[12px] text-secondary leading-relaxed">
          {copy.blurb}
        </p>

        {variant === 'ddl' && (
          <div role="radiogroup" aria-label={t('Where the tables come from')} data-ddl-source className="flex gap-1 p-1 rounded-lg bg-surface-container-low border border-outline-variant">
            {([['paste', t('Paste SQL'), 'content_paste'], ['database', t('From a database'), 'database']] as const).map(([id, text, icon]) => (
              <button key={id} type="button" role="radio" aria-checked={source === id}
                      onClick={() => { if (source !== id) { setSource(id); setParsed(null); setStale(false); setError(null) } }}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        source === id ? 'bg-primary/15 text-primary' : 'text-secondary hover:text-on-surface'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{icon}</span>
                {text}
              </button>
            ))}
          </div>
        )}

        {fromDatabase && (
          <LiveSchemaPanel
            readLabel={count => count === 0 ? t('Pick tables to read') : t('Read {n} into the preview', { n: count })}
            onRead={readFromDatabase}
          />
        )}

        {!fromDatabase && (<>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-secondary mb-2">
            {t('SQL Dialect')}
          </label>
          <select
            className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            value={dialect}
            onChange={e => { setDialect(e.target.value); if (parsed) setStale(true) }}
          >
            {dialectChoices.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-secondary">
              {variant === 'select' ? t('SELECT query') : 'DDL'}
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-on-surface transition-colors"
              title={t('Load a .sql file (or drop one onto the text area)')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>upload_file</span>
              {t('Load .sql file…')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".sql,.ddl,.txt,text/plain,application/sql"
              className="hidden"
              aria-label={t('Load SQL file')}
              onChange={e => { loadFile(e.target.files?.[0]); e.target.value = '' }}
            />
          </div>
          <textarea
            dir="ltr"
            aria-label={variant === 'select' ? t('SELECT query') : 'DDL'}
            className="w-full font-mono text-xs bg-background border border-outline-variant rounded p-3 min-h-[260px] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            placeholder={copy.placeholder}
            value={sql}
            onChange={e => { setSql(e.target.value); if (parsed) setStale(true) }}
            onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
            onDrop={onDrop}
            spellCheck={false}
          />
        </div>
        </>)}

        {parsed && (
          <div className={`space-y-2 ${stale ? 'opacity-60' : ''}`} data-import-preview data-stale={stale ? '' : undefined}>
            {stale && (
              <p className="flex items-center gap-1.5 text-[11px] text-warning rounded-lg border border-warning/40 bg-warning/5 px-3 py-2" role="status">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>sync_problem</span>
                {t('The SQL changed since this preview — click Parse again to refresh it. Your ticks are kept.')}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-secondary">
                {tn(n, 'Preview — {n} entity', 'Preview — {n} entities')}
              </span>
              <span className="flex items-center gap-3 text-[11px] text-secondary">
                {n > 1 && (
                  <button type="button" className="underline hover:no-underline"
                          onClick={() => setSelected(nSelected === n ? new Set() : new Set(parsed.entities.map(e => e.uid!)))}>
                    {nSelected === n ? t('Select none') : t('Select all')}
                  </button>
                )}
                <span>{t('Tick what to import')}</span>
              </span>
            </div>
            {parsed.note && (
              <p className="flex items-start gap-1.5 text-[11px] text-secondary rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2">
                <span className="material-symbols-outlined mt-0.5" style={{ fontSize: '14px' }}>info</span>
                {parsed.note}
              </p>
            )}
            <ul className="space-y-2 max-h-[40vh] overflow-y-auto pe-1">
              {parsed.entities.map(e => (
                <li key={e.uid} className={`rounded-lg border bg-surface-container-low px-3 py-2 ${selected.has(e.uid!) ? 'border-outline-variant' : 'border-outline-variant/40 opacity-60'}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      aria-label={t('Import {entity}', { entity: e.name })}
                      checked={selected.has(e.uid!)}
                      onChange={() => toggleSelected(e.uid!)}
                    />
                    <span className="font-mono text-sm font-semibold text-on-surface">{e.name}</span>
                    {e.tableName && <span className="text-[10px] font-mono text-secondary" dir="ltr">{e.schema ? `${e.schema}.` : ''}{e.tableName}</span>}
                    {(e.readOnly || e.viewQuery) && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary/10 text-secondary font-bold">{t('read-only')}</span>
                    )}
                    <span className="ms-auto text-[11px] text-secondary">{tn(e.fields.length, '{n} field', '{n} fields')}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1" dir="ltr">
                    {e.fields.map(f => (
                      <span key={f.uid} className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${f.primaryKey ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline-variant/60 text-secondary'}`}
                            title={[f.primaryKey && t('primary key'), f.generated && t('generated'), f.required && t('required'), f.unique && t('unique')].filter(Boolean).join(', ') || undefined}>
                        {f.primaryKey ? '🔑 ' : ''}{f.name}: {f.type}{f.length ? `(${f.length})` : ''}
                      </span>
                    ))}
                    {e.relations?.map(r => {
                      const targetKept = selectedNames.has(r.targetEntity.toLowerCase())
                      return (
                        <span key={r.uid} data-relation-chip
                              className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${targetKept ? 'border-tertiary/40 bg-tertiary/10 text-tertiary' : 'border-outline-variant/60 text-secondary line-through'}`}
                              title={targetKept
                                ? (r.required
                                  ? t("@ManyToOne {relation} (required) — from the table's foreign key", { relation: `${r.fieldName} → ${r.targetEntity}` })
                                  : t("@ManyToOne {relation} — from the table's foreign key", { relation: `${r.fieldName} → ${r.targetEntity}` }))
                                : t('{entity} is not being imported, so this relation is dropped', { entity: r.targetEntity })}>
                          <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>link</span>
                          {r.fieldName} → {r.targetEntity}
                        </span>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasExisting && parsed && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-secondary mb-2">
              {t('Mode')}
            </label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  value="append"
                  checked={mode === 'append'}
                  onChange={() => setMode('append')}
                />
                <span>{t('Append to existing')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  value="replace"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                />
                <span>{t('Replace all')}</span>
              </label>
            </div>
            {mode === 'replace' && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-error">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>warning</span>
                {tn(existingCount, 'Discards your current {n} entity.', 'Discards your current {n} entities.')}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="px-3 py-2 rounded-lg bg-error/10 border border-error/30 text-xs text-error space-y-1">
            <div className="font-bold">{error.error ?? t('Parse error')}</div>
            {error.detail && <div className="font-mono break-all">{error.detail}</div>}
            {error.statementIndex != null && (
              <div className="text-[11px] opacity-80">{t('Statement #{n}', { n: error.statementIndex })}</div>
            )}
            {error.snippet && (
              <pre className="text-[11px] font-mono bg-background/50 rounded p-2 overflow-x-auto">{error.snippet}</pre>
            )}
          </div>
        )}
      </div>
    </AdminFormDrawer>
  )
}
