import { useEffect, useMemo, useState } from 'react'
import { AdminFormDrawer } from './admin/shared/AdminFormDrawer'
import { CodeEditor } from './admin/file-contributions/CodeEditor'
import type { SqlTableConfig, SqlWizardEntry } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  depId: string
  depName: string
  dialectName: string
  initial: SqlWizardEntry | null
  onSave: (entry: SqlWizardEntry | null) => void
}

const TABLE_REGEX = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([a-zA-Z_][\w$]*))/gi

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

export function SqlWizardDrawer({ isOpen, onClose, depId, depName, dialectName, initial, onSave }: Props) {
  const [sql, setSql] = useState<string>(initial?.sql ?? '')
  const [subPackage, setSubPackage] = useState<string>(initial?.subPackage ?? 'entity')
  const [tables, setTables] = useState<SqlTableConfig[]>(initial?.tables ?? [])

  // Re-seed drawer state when it re-opens for a different dep
  useEffect(() => {
    if (isOpen) {
      setSql(initial?.sql ?? '')
      setSubPackage(initial?.subPackage ?? 'entity')
      setTables(initial?.tables ?? [])
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
            JPA repositories are generated into your project when downloaded.
          </p>
        </div>

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
