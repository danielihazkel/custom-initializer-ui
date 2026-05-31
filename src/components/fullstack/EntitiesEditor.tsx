import type { FullstackEntityDef, FullstackFieldDef, FullstackFieldType } from '../../types'
import type { EntityErrors } from './validation'

const FIELD_TYPES: FullstackFieldType[] = [
  'STRING', 'LONG', 'INTEGER', 'BOOLEAN',
  'LOCAL_DATE', 'LOCAL_DATE_TIME', 'BIG_DECIMAL', 'ENUM',
]

interface Props {
  entities: FullstackEntityDef[]
  onChange: (entities: FullstackEntityDef[]) => void
  errors?: Record<number, EntityErrors>
}

function newEntity(): FullstackEntityDef {
  return {
    name: '',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true, generated: true },
      { name: 'name', type: 'STRING', required: true },
    ],
  }
}

function newField(): FullstackFieldDef {
  return { name: '', type: 'STRING' }
}

export function EntitiesEditor({ entities, onChange, errors }: Props) {
  function updateEntity(idx: number, updates: Partial<FullstackEntityDef>) {
    onChange(entities.map((e, i) => i === idx ? { ...e, ...updates } : e))
  }
  function removeEntity(idx: number) {
    onChange(entities.filter((_, i) => i !== idx))
  }
  function addEntity() {
    onChange([...entities, newEntity()])
  }
  function duplicateEntity(idx: number) {
    const src = entities[idx]
    // Deep copy fields so edits to the clone don't mutate the original.
    const copy: FullstackEntityDef = {
      name: `${src.name}Copy`,
      tableName: undefined,
      fields: src.fields.map(f => ({ ...f, enumValues: f.enumValues ? [...f.enumValues] : undefined })),
    }
    onChange([...entities.slice(0, idx + 1), copy, ...entities.slice(idx + 1)])
  }
  function updateField(eIdx: number, fIdx: number, updates: Partial<FullstackFieldDef>) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: e.fields.map((f, j) => j === fIdx ? { ...f, ...updates } : f) }
    }))
  }
  // Changing a field's type clears attributes that no longer apply, so we never send
  // an orphaned length (non-STRING) or enumValues (non-ENUM) — the backend rejects both.
  function changeFieldType(eIdx: number, fIdx: number, type: FullstackFieldType) {
    const updates: Partial<FullstackFieldDef> = { type }
    if (type !== 'STRING') updates.length = undefined
    if (type !== 'ENUM') updates.enumValues = undefined
    updateField(eIdx, fIdx, updates)
  }
  function duplicateField(eIdx: number, fIdx: number) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      const src = e.fields[fIdx]
      const copy: FullstackFieldDef = {
        ...src,
        name: `${src.name}Copy`,
        enumValues: src.enumValues ? [...src.enumValues] : undefined,
      }
      return { ...e, fields: [...e.fields.slice(0, fIdx + 1), copy, ...e.fields.slice(fIdx + 1)] }
    }))
  }
  function removeField(eIdx: number, fIdx: number) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: e.fields.filter((_, j) => j !== fIdx) }
    }))
  }
  function addField(eIdx: number) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: [...e.fields, newField()] }
    }))
  }

  return (
    <div className="space-y-6">
      {entities.map((entity, eIdx) => {
        const eErr = errors?.[eIdx]
        return (
        <div key={eIdx} className="border border-outline-variant rounded-xl p-5 bg-surface-container-low space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary shrink-0">Entity</span>
              <div className="flex-1 max-w-sm">
                <input
                  type="text"
                  aria-label="Entity name"
                  aria-invalid={Boolean(eErr?.name)}
                  className={`w-full bg-background border rounded px-3 py-2 text-sm font-mono text-on-surface focus:ring-2 outline-none ${eErr?.name ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                  placeholder="User, Order, Product…"
                  value={entity.name}
                  onChange={e => updateEntity(eIdx, { name: e.target.value })}
                />
                {eErr?.name && <p className="mt-1 text-[11px] text-error">{eErr.name}</p>}
              </div>
              <input
                type="text"
                aria-label="Table name (optional)"
                className="flex-1 max-w-xs bg-background border border-outline-variant rounded px-3 py-2 text-sm text-secondary placeholder:text-secondary/60 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="table_name (optional)"
                value={entity.tableName ?? ''}
                onChange={e => updateEntity(eIdx, { tableName: e.target.value || undefined })}
              />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => duplicateEntity(eIdx)}
                className="p-1.5 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                title="Duplicate entity"
                aria-label="Duplicate entity"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>content_copy</span>
              </button>
              <button
                onClick={() => removeEntity(eIdx)}
                className="p-1.5 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
                title="Remove entity"
                aria-label="Remove entity"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
              </button>
            </div>
          </div>

          {eErr?.pk && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 border border-error/30 text-[11px] text-error">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
              {eErr.pk}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                  <th className="text-left py-1.5 px-2">Name</th>
                  <th className="text-left py-1.5 px-2">Type</th>
                  <th className="text-center py-1.5 px-2 w-12">PK</th>
                  <th className="text-center py-1.5 px-2 w-12">Gen</th>
                  <th className="text-center py-1.5 px-2 w-12">Req</th>
                  <th className="text-center py-1.5 px-2 w-12">Uniq</th>
                  <th className="text-left py-1.5 px-2 w-20">Length</th>
                  <th className="text-left py-1.5 px-2">Enum values</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {entity.fields.map((field, fIdx) => {
                  const fErr = eErr?.fields?.[fIdx]
                  return (
                  <tr key={fIdx} className="border-t border-outline-variant">
                    <td className="py-1.5 px-2 align-top">
                      <input
                        type="text"
                        aria-label="Field name"
                        aria-invalid={Boolean(fErr?.name)}
                        className={`w-full bg-background border rounded px-2 py-1 text-xs font-mono focus:ring-1 outline-none ${fErr?.name ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                        value={field.name}
                        onChange={e => updateField(eIdx, fIdx, { name: e.target.value })}
                        placeholder="fieldName"
                      />
                      {fErr?.name && <p className="mt-0.5 text-[10px] text-error">{fErr.name}</p>}
                    </td>
                    <td className="py-1.5 px-2 align-top">
                      <select
                        aria-label="Field type"
                        className="w-full bg-background border border-outline-variant rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                        value={field.type}
                        onChange={e => changeFieldType(eIdx, fIdx, e.target.value as FullstackFieldType)}
                      >
                        {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      <input type="checkbox" aria-label="Primary key" checked={!!field.primaryKey}
                        onChange={e => updateField(eIdx, fIdx, { primaryKey: e.target.checked })} />
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      <input type="checkbox" aria-label="Auto-generated value" checked={!!field.generated}
                        onChange={e => updateField(eIdx, fIdx, { generated: e.target.checked })} />
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      <input type="checkbox" aria-label="Required (not null)" checked={!!field.required}
                        onChange={e => updateField(eIdx, fIdx, { required: e.target.checked })} />
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      <input type="checkbox" aria-label="Unique" checked={!!field.unique}
                        onChange={e => updateField(eIdx, fIdx, { unique: e.target.checked })} />
                    </td>
                    <td className="py-1.5 px-2 align-top">
                      <input
                        type="number"
                        min={1}
                        aria-label="Max length"
                        aria-invalid={Boolean(fErr?.length)}
                        title={field.type !== 'STRING' ? 'Length applies to STRING fields only' : undefined}
                        className={`w-full bg-background border rounded px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed focus:ring-1 outline-none ${fErr?.length ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                        value={field.length ?? ''}
                        disabled={field.type !== 'STRING'}
                        onChange={e => updateField(eIdx, fIdx, { length: e.target.value === '' ? undefined : Number(e.target.value) })}
                      />
                      {fErr?.length && <p className="mt-0.5 text-[10px] text-error">{fErr.length}</p>}
                    </td>
                    <td className="py-1.5 px-2 align-top">
                      <input
                        type="text"
                        aria-label="Enum values (comma separated)"
                        aria-invalid={Boolean(fErr?.enumValues)}
                        title={field.type !== 'ENUM' ? 'Enum values apply to ENUM fields only' : undefined}
                        className={`w-full bg-background border rounded px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed focus:ring-1 outline-none ${fErr?.enumValues ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                        placeholder="ACTIVE,DISABLED"
                        value={field.enumValues?.join(',') ?? ''}
                        disabled={field.type !== 'ENUM'}
                        onChange={e => updateField(eIdx, fIdx, {
                          enumValues: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                        })}
                      />
                      {field.type === 'ENUM' && (field.enumValues?.length ?? 0) > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {field.enumValues!.map((v, i) => (
                            <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono">{v}</span>
                          ))}
                        </div>
                      )}
                      {fErr?.enumValues && <p className="mt-0.5 text-[10px] text-error">{fErr.enumValues}</p>}
                    </td>
                    <td className="py-1.5 px-2 text-right align-top">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => duplicateField(eIdx, fIdx)}
                          className="p-1 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Duplicate field"
                          aria-label="Duplicate field"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                        </button>
                        <button
                          onClick={() => removeField(eIdx, fIdx)}
                          className="p-1 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
                          title="Remove field"
                          aria-label="Remove field"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
            <button
              onClick={() => addField(eIdx)}
              className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
              Add field
            </button>
          </div>
        </div>
        )
      })}

      {entities.length === 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 border border-error/30 text-[11px] text-error">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
          Add at least one entity to generate a project.
        </div>
      )}

      <button
        onClick={addEntity}
        className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary text-secondary hover:text-primary text-sm font-medium transition-colors"
      >
        + Add entity
      </button>
    </div>
  )
}
