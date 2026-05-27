import { useMemo, useState } from 'react'
import type { AdminDependencyEntry, AdminEntityTemplateSet, EntityTemplateSetKind } from '../../../types'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'

interface Props {
  data: Partial<AdminEntityTemplateSet>
  errors: Record<string, string>
  onChange: (updates: Partial<AdminEntityTemplateSet>) => void
  defaultDeps: string[]
  onDefaultDepsChange: (next: string[]) => void
  catalogDeps: AdminDependencyEntry[]
}

const KINDS: { value: EntityTemplateSetKind; label: string }[] = [
  { value: 'BACKEND_JAVA', label: 'Backend (Java)' },
  { value: 'FRONTEND_REACT', label: 'Frontend (React)' },
]

export function EntityTemplateSetForm({
  data, errors, onChange, defaultDeps, onDefaultDepsChange, catalogDeps,
}: Props) {
  const [depQuery, setDepQuery] = useState('')
  const selectedSet = useMemo(() => new Set(defaultDeps), [defaultDeps])

  const sortedCatalog = useMemo(() =>
    [...catalogDeps].sort((a, b) => a.depId.localeCompare(b.depId)),
    [catalogDeps])

  const filtered = useMemo(() => {
    const q = depQuery.trim().toLowerCase()
    if (!q) return sortedCatalog
    return sortedCatalog.filter(d =>
      d.depId.toLowerCase().includes(q) ||
      (d.name ?? '').toLowerCase().includes(q))
  }, [sortedCatalog, depQuery])

  function toggle(depId: string, checked: boolean) {
    if (checked) {
      if (selectedSet.has(depId)) return
      onDefaultDepsChange([...defaultDeps, depId])
    } else {
      onDefaultDepsChange(defaultDeps.filter(d => d !== depId))
    }
  }

  const isBackend = data.kind === 'BACKEND_JAVA'

  return (
    <>
      <FieldRow label="Set Key" required error={errors.setKey} hint="Unique identifier, e.g. 'spring-jpa-crud'">
        <input
          type="text"
          className={inputClass}
          value={data.setKey ?? ''}
          onChange={e => onChange({ setKey: e.target.value })}
          placeholder="spring-jpa-crud"
        />
      </FieldRow>
      <FieldRow label="Name" required error={errors.name}>
        <input
          type="text"
          className={inputClass}
          value={data.name ?? ''}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Spring Boot + JPA CRUD"
        />
      </FieldRow>
      <FieldRow label="Description">
        <textarea
          className={inputClass}
          rows={2}
          value={data.description ?? ''}
          onChange={e => onChange({ description: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="Kind" required error={errors.kind}>
        <select
          className={selectClass}
          value={data.kind ?? ''}
          onChange={e => onChange({ kind: e.target.value as EntityTemplateSetKind })}
        >
          <option value="">— Select kind —</option>
          {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Enabled">
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={data.enabled ?? true}
            onChange={e => onChange({ enabled: e.target.checked })}
          />
          Surface this set in the wizard
        </label>
      </FieldRow>
      <FieldRow label="Sort Order">
        <input
          type="number"
          className={inputClass}
          value={data.sortOrder ?? 0}
          onChange={e => onChange({ sortOrder: Number(e.target.value) })}
        />
      </FieldRow>

      {isBackend && (
        <FieldRow
          label="Default Dependencies"
          hint="Pre-checked in the wizard when this set is selected. Users can uncheck anything before generating — for the standard JPA + REST templates to compile you'll want data-jpa and web here, plus an embedded DB driver like h2 unless you expect users to bring their own."
        >
          <div className="space-y-2">
            <input
              type="text"
              className={inputClass}
              placeholder="Filter dependencies…"
              value={depQuery}
              onChange={e => setDepQuery(e.target.value)}
            />
            <div className="border border-outline-variant rounded-lg bg-background max-h-64 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="text-xs text-secondary text-center py-4">No matches</div>
              )}
              {filtered.map(d => (
                <label
                  key={d.depId}
                  className="flex items-start gap-2 px-3 py-1.5 border-b border-outline-variant/50 last:border-b-0 hover:bg-surface-container-low cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedSet.has(d.depId)}
                    onChange={e => toggle(d.depId, e.target.checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{d.depId}</code>
                      <span className="ml-2 text-on-surface">{d.name}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="text-[11px] text-on-surface-variant">
              {defaultDeps.length} selected
            </div>
          </div>
        </FieldRow>
      )}
    </>
  )
}
