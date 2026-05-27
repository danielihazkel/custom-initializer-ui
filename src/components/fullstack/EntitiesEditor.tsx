import type { FullstackEntityDef, FullstackFieldDef, FullstackFieldType } from '../../types'

const FIELD_TYPES: FullstackFieldType[] = [
  'STRING', 'LONG', 'INTEGER', 'BOOLEAN',
  'LOCAL_DATE', 'LOCAL_DATE_TIME', 'BIG_DECIMAL', 'ENUM',
]

interface Props {
  entities: FullstackEntityDef[]
  onChange: (entities: FullstackEntityDef[]) => void
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

export function EntitiesEditor({ entities, onChange }: Props) {
  function updateEntity(idx: number, updates: Partial<FullstackEntityDef>) {
    onChange(entities.map((e, i) => i === idx ? { ...e, ...updates } : e))
  }
  function removeEntity(idx: number) {
    onChange(entities.filter((_, i) => i !== idx))
  }
  function addEntity() {
    onChange([...entities, newEntity()])
  }
  function updateField(eIdx: number, fIdx: number, updates: Partial<FullstackFieldDef>) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: e.fields.map((f, j) => j === fIdx ? { ...f, ...updates } : f) }
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
      {entities.map((entity, eIdx) => (
        <div key={eIdx} className="border border-outline-variant rounded-xl p-5 bg-surface-container-low space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary shrink-0">Entity</span>
              <input
                type="text"
                className="flex-1 max-w-sm bg-background border border-outline-variant rounded px-3 py-2 text-sm font-mono text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="User, Order, Product…"
                value={entity.name}
                onChange={e => updateEntity(eIdx, { name: e.target.value })}
              />
              <input
                type="text"
                className="flex-1 max-w-xs bg-background border border-outline-variant rounded px-3 py-2 text-sm text-secondary placeholder:text-secondary/60 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="table_name (optional)"
                value={entity.tableName ?? ''}
                onChange={e => updateEntity(eIdx, { tableName: e.target.value || undefined })}
              />
            </div>
            <button
              onClick={() => removeEntity(eIdx)}
              className="p-1.5 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
              title="Remove entity"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
            </button>
          </div>

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
                {entity.fields.map((field, fIdx) => (
                  <tr key={fIdx} className="border-t border-outline-variant">
                    <td className="py-1.5 px-2">
                      <input
                        type="text"
                        className="w-full bg-background border border-outline-variant rounded px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                        value={field.name}
                        onChange={e => updateField(eIdx, fIdx, { name: e.target.value })}
                        placeholder="fieldName"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <select
                        className="w-full bg-background border border-outline-variant rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                        value={field.type}
                        onChange={e => updateField(eIdx, fIdx, { type: e.target.value as FullstackFieldType })}
                      >
                        {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <input type="checkbox" checked={!!field.primaryKey}
                        onChange={e => updateField(eIdx, fIdx, { primaryKey: e.target.checked })} />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <input type="checkbox" checked={!!field.generated}
                        onChange={e => updateField(eIdx, fIdx, { generated: e.target.checked })} />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <input type="checkbox" checked={!!field.required}
                        onChange={e => updateField(eIdx, fIdx, { required: e.target.checked })} />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <input type="checkbox" checked={!!field.unique}
                        onChange={e => updateField(eIdx, fIdx, { unique: e.target.checked })} />
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        type="number"
                        className="w-full bg-background border border-outline-variant rounded px-2 py-1 text-xs disabled:opacity-40 focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                        value={field.length ?? ''}
                        disabled={field.type !== 'STRING'}
                        onChange={e => updateField(eIdx, fIdx, { length: e.target.value === '' ? undefined : Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        type="text"
                        className="w-full bg-background border border-outline-variant rounded px-2 py-1 text-xs disabled:opacity-40 focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                        placeholder="ACTIVE,DISABLED"
                        value={field.enumValues?.join(',') ?? ''}
                        disabled={field.type !== 'ENUM'}
                        onChange={e => updateField(eIdx, fIdx, {
                          enumValues: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                        })}
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <button
                        onClick={() => removeField(eIdx, fIdx)}
                        className="p-1 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
                        title="Remove field"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                      </button>
                    </td>
                  </tr>
                ))}
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
      ))}

      <button
        onClick={addEntity}
        className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary text-secondary hover:text-primary text-sm font-medium transition-colors"
      >
        + Add entity
      </button>
    </div>
  )
}
