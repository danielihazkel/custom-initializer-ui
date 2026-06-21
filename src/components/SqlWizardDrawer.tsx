import { useEffect, useMemo, useState } from 'react'
import { AdminFormDrawer } from './admin/shared/AdminFormDrawer'
import { CodeEditor } from './admin/file-contributions/CodeEditor'
import type { SqlApiMode, SqlTableConfig, SqlWizardEntry } from '../types'
import { requiredSqlDeps, isSqlDepSatisfied } from '../utils/projectUtils'

const API_MODES: { id: SqlApiMode; label: string; hint: string }[] = [
  { id: 'NONE', label: 'Entities only', hint: 'JPA entities (+ optional repositories)' },
  { id: 'ENTITY_DIRECT', label: 'REST API — entity', hint: 'Repository + Service + Controller, entity exposed directly' },
  { id: 'INLINE_DTO', label: 'REST API — DTO', hint: 'Adds a record DTO with from()/toEntity() — no extra dependency' },
  { id: 'MAPSTRUCT_DTO', label: 'REST API — MapStruct', hint: 'Adds a record DTO + @Mapper interface (auto-adds MapStruct)' },
]

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

const TABLE_REGEX = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([a-zA-Z_][\w$]*(?:\.[a-zA-Z_][\w$]*)?))/gi

function detectTableNames(sql: string): string[] {
  const names: string[] = []
  for (const m of sql.matchAll(TABLE_REGEX)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? m[4]
    if (!raw) continue
    const bare = raw.includes('.') ? raw.substring(raw.lastIndexOf('.') + 1) : raw
    names.push(bare)
  }
  return names
}

export function SqlWizardDrawer({ isOpen, onClose, depId, depName, dialectName, initial, selected, onSave, parseError }: Props) {
  const [sql, setSql] = useState<string>(initial?.sql ?? '')
  const [subPackage, setSubPackage] = useState<string>(initial?.subPackage ?? 'entity')
  const [tables, setTables] = useState<SqlTableConfig[]>(initial?.tables ?? [])
  const [apiMode, setApiMode] = useState<SqlApiMode>(initial?.apiMode ?? 'NONE')

  // Re-seed drawer state when it re-opens for a different dep
  useEffect(() => {
    if (isOpen) {
      setSql(initial?.sql ?? '')
      setSubPackage(initial?.subPackage ?? 'entity')
      setTables(initial?.tables ?? [])
      setApiMode(initial?.apiMode ?? 'NONE')
    }
  }, [isOpen, depId]) // eslint-disable-line react-hooks/exhaustive-deps

  const detected = useMemo(() => detectTableNames(sql), [sql])

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
      title={`SQL Entities — ${depName}`}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saving={false}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-xs text-primary">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>database</span>
          <span>
            Dialect detected: <span className="font-bold">{dialectName}</span>
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
            Sub-package (under your root package)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={subPackage}
              onChange={e => setSubPackage(e.target.value)}
              placeholder="entity"
              className="flex-1 bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
            />
            <span className="text-[10px] text-secondary font-mono">→ repositories go to <span className="text-on-surface-variant">repository/</span></span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
            Generate REST API
          </label>
          <div className="grid grid-cols-2 gap-2">
            {API_MODES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setApiMode(m.id)}
                title={m.hint}
                className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
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
            <div className="text-[10px] font-bold uppercase tracking-widest text-secondary">Required dependencies</div>
            {requiredSqlDeps(apiMode).map(dep => {
              const ok = isSqlDepSatisfied(dep, selected)
              return (
                <div key={dep} className="flex items-center gap-1.5 text-[10px]">
                  <span className={`material-symbols-outlined ${ok ? 'text-primary' : 'text-secondary'}`} style={{ fontSize: '13px' }}>
                    {ok ? 'check_circle' : 'add_circle'}
                  </span>
                  <code className="text-primary">{dep}</code>
                  <span className="text-on-surface-variant">{ok ? 'already selected' : 'added automatically on save'}</span>
                </div>
              )
            })}
          </div>
          {apiMode !== 'NONE' && (
            <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
              A Service + Controller (REST CRUD under <code className="text-primary">/api/&lt;table&gt;</code>) is generated per
              table with a primary key. Tables without a primary key still produce an entity only.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-widest text-secondary">
              CREATE TABLE Scripts
            </label>
            {sql.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[10px] text-secondary hover:text-error transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <CodeEditor
            value={sql}
            onChange={setSql}
            targetPath="init.sql"
          />
          <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
            Paste one or more <code className="text-primary">CREATE TABLE</code> statements. Entities + optional
            JPA repositories are generated into your project when downloaded. <code className="text-primary">COMMENT ON</code>,
            {' '}<code className="text-primary">CREATE INDEX</code>, and <code className="text-primary">GRANT</code> statements
            are accepted and silently ignored.
          </p>
        </div>

        {parseError && (
          <div className="text-xs text-error bg-error/10 border border-error/30 rounded-lg p-3 space-y-1.5">
            <div className="font-bold uppercase tracking-widest text-[10px]">SQL parse error</div>
            <div className="text-on-surface">
              {parseError.statementIndex != null
                ? `Statement #${parseError.statementIndex}: ${parseError.message}`
                : parseError.message}
            </div>
            {parseError.snippet && (
              <pre className="mt-1 text-[10px] font-mono whitespace-pre-wrap text-on-surface-variant bg-surface-container-lowest border border-outline-variant rounded p-2">{parseError.snippet}</pre>
            )}
          </div>
        )}

        {tables.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-widest text-secondary">
                Detected Tables
              </label>
              <span className="text-[10px] font-bold py-0.5 px-2 bg-primary/10 text-primary rounded-full">
                {tables.length}
              </span>
            </div>
            <div className="space-y-2 border border-outline-variant rounded-lg p-3 bg-surface-container-lowest">
              {tables.map(t => (
                <label key={t.name} className="flex items-center justify-between gap-3 text-xs cursor-pointer group">
                  <span className="font-mono text-on-surface font-semibold">{t.name}</span>
                  <div className="flex items-center gap-2 text-secondary group-hover:text-on-surface transition-colors">
                    <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      t.generateRepository
                        ? 'bg-secondary border-secondary text-on-surface'
                        : 'bg-surface-container-lowest border-secondary/40 group-hover:border-secondary'
                    }`}>
                      {t.generateRepository && <span className="material-symbols-outlined font-bold text-background" style={{ fontSize: '12px' }}>check</span>}
                    </div>
                    <input
                      type="checkbox"
                      checked={t.generateRepository}
                      onChange={() => toggleRepo(t.name)}
                      className="sr-only"
                    />
                    <span className="text-[10px] font-medium">Generate repository</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {sql.trim().length > 0 && tables.length === 0 && (
          <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            No <code className="font-mono">CREATE TABLE</code> statements detected. Check your SQL syntax.
          </div>
        )}
      </div>
    </AdminFormDrawer>
  )
}
