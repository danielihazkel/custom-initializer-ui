import { useEffect, useState } from 'react'
import { AdminFormDrawer } from '../admin/shared/AdminFormDrawer'
import type { FullstackEntityDef } from '../../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  hasExisting: boolean
  onImport: (entities: FullstackEntityDef[], mode: ImportMode) => void
}

export type ImportMode = 'replace' | 'append'

const DIALECTS: { value: string; label: string }[] = [
  { value: 'H2', label: 'H2' },
  { value: 'POSTGRESQL', label: 'PostgreSQL' },
  { value: 'MYSQL', label: 'MySQL' },
  { value: 'MSSQL', label: 'SQL Server' },
  { value: 'ORACLE', label: 'Oracle' },
  { value: 'DB2', label: 'DB2' },
]

interface WireField {
  name: string
  type: FullstackEntityDef['fields'][number]['type']
  primaryKey: boolean
  generated: boolean
  required: boolean
  unique: boolean
  length: number | null
  enumValues: string[]
}
interface WireEntity {
  name: string
  tableName: string | null
  fields: WireField[]
}
interface ImportResponse {
  entities: WireEntity[]
}
interface ImportError {
  error?: string
  detail?: string
  statementIndex?: number
  snippet?: string
}

export function ImportFromDdlDrawer({ isOpen, onClose, hasExisting, onImport }: Props) {
  const [sql, setSql] = useState('')
  const [dialect, setDialect] = useState('H2')
  const [mode, setMode] = useState<ImportMode>(hasExisting ? 'append' : 'replace')
  const [error, setError] = useState<ImportError | null>(null)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setMode(hasExisting ? 'append' : 'replace')
    }
  }, [isOpen, hasExisting])

  async function handleSave() {
    setError(null)
    const trimmed = sql.trim()
    if (!trimmed) {
      setError({ detail: 'Paste at least one CREATE TABLE statement' })
      throw new Error('empty')
    }
    const res = await fetch('/metadata/fullstack/import-ddl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: trimmed, dialect }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null) as ImportError | null
      setError(body ?? { detail: `HTTP ${res.status}` })
      throw new Error(body?.detail ?? `HTTP ${res.status}`)
    }
    const body = await res.json() as ImportResponse
    const entities: FullstackEntityDef[] = body.entities.map(e => ({
      name: e.name,
      tableName: e.tableName ?? undefined,
      fields: e.fields.map(f => ({
        name: f.name,
        type: f.type,
        primaryKey: f.primaryKey || undefined,
        generated: f.generated || undefined,
        required: f.required || undefined,
        unique: f.unique || undefined,
        length: f.length ?? undefined,
        enumValues: f.enumValues.length > 0 ? f.enumValues : undefined,
      })),
    }))
    if (entities.length === 0) {
      setError({ detail: 'No CREATE TABLE statements were detected' })
      throw new Error('empty result')
    }
    onImport(entities, mode)
    setSql('')
    onClose()
  }

  return (
    <AdminFormDrawer
      title="Import Entities from SQL DDL"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saving={false}
    >
      <div className="space-y-4">
        <p className="text-[12px] text-secondary leading-relaxed">
          Paste <code className="font-mono text-on-surface">CREATE TABLE</code> statements
          and a starter entity list will be generated. Column types map to fullstack field
          types — review the result in the editor before generating.
        </p>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-secondary mb-2">
            SQL Dialect
          </label>
          <select
            className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            value={dialect}
            onChange={e => setDialect(e.target.value)}
          >
            {DIALECTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-secondary mb-2">
            DDL
          </label>
          <textarea
            className="w-full font-mono text-xs bg-background border border-outline-variant rounded p-3 min-h-[260px] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            placeholder={'CREATE TABLE products (\n  id BIGINT PRIMARY KEY AUTO_INCREMENT,\n  sku VARCHAR(64) NOT NULL,\n  price NUMERIC(10,2)\n);'}
            value={sql}
            onChange={e => setSql(e.target.value)}
            spellCheck={false}
          />
        </div>

        {hasExisting && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-secondary mb-2">
              Mode
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
                <span>Append to existing</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  value="replace"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                />
                <span>Replace all</span>
              </label>
            </div>
          </div>
        )}

        {error && (
          <div className="px-3 py-2 rounded-lg bg-error/10 border border-error/30 text-xs text-error space-y-1">
            <div className="font-bold">{error.error ?? 'Parse error'}</div>
            {error.detail && <div className="font-mono break-all">{error.detail}</div>}
            {error.statementIndex != null && (
              <div className="text-[11px] opacity-80">Statement #{error.statementIndex}</div>
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
