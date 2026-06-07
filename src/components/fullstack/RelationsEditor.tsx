import type { FullstackRelationDef } from '../../types'
import type { RelationErrors } from './validation'

interface Props {
  relations: FullstackRelationDef[]
  /** All entity names in the request (valid FK targets; self-references are allowed). */
  entityNames: string[]
  onChange: (relations: FullstackRelationDef[]) => void
  errors?: Record<number, RelationErrors>
}

function newRelation(defaultTarget: string): FullstackRelationDef {
  return { type: 'MANY_TO_ONE', fieldName: '', targetEntity: defaultTarget, required: false }
}

/**
 * Per-entity editor for `MANY_TO_ONE` relations (the FK-owning side). v1 supports only
 * MANY_TO_ONE — the inverse `@OneToMany` is auto-derived server-side via the
 * `inverseCollections` opt, so there is no inverse editor here.
 */
export function RelationsEditor({ relations, entityNames, onChange, errors }: Props) {
  function update(idx: number, updates: Partial<FullstackRelationDef>) {
    onChange(relations.map((r, i) => (i === idx ? { ...r, ...updates } : r)))
  }
  function remove(idx: number) {
    onChange(relations.filter((_, i) => i !== idx))
  }
  function add() {
    onChange([...relations, newRelation(entityNames[0] ?? '')])
  }

  return (
    <div className="space-y-2 border-t border-outline-variant pt-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">Relations</span>
        <span className="text-[10px] text-secondary/70">@ManyToOne — foreign key to another entity</span>
      </div>

      {relations.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-secondary">
              <th className="text-left py-1 px-2">Field name</th>
              <th className="text-left py-1 px-2">Target entity</th>
              <th className="text-center py-1 px-2 w-12">Req</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {relations.map((rel, rIdx) => {
              const rErr = errors?.[rIdx]
              return (
                <tr key={rIdx} className="border-t border-outline-variant">
                  <td className="py-1.5 px-2 align-top">
                    <input
                      type="text"
                      aria-label="Relation field name"
                      aria-invalid={Boolean(rErr?.fieldName)}
                      className={`w-full bg-background border rounded px-2 py-1 text-xs font-mono focus:ring-1 outline-none ${rErr?.fieldName ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                      value={rel.fieldName}
                      onChange={e => update(rIdx, { fieldName: e.target.value })}
                      placeholder="customer"
                    />
                    {rErr?.fieldName && <p className="mt-0.5 text-[10px] text-error">{rErr.fieldName}</p>}
                  </td>
                  <td className="py-1.5 px-2 align-top">
                    <select
                      aria-label="Target entity"
                      aria-invalid={Boolean(rErr?.targetEntity)}
                      className={`w-full bg-background border rounded px-2 py-1 text-xs focus:ring-1 outline-none ${rErr?.targetEntity ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                      value={rel.targetEntity}
                      onChange={e => update(rIdx, { targetEntity: e.target.value })}
                    >
                      <option value="">—</option>
                      {entityNames.map(n => <option key={n} value={n}>{n}</option>)}
                      {/* Keep a stale/unknown target visible so it isn't silently dropped. */}
                      {rel.targetEntity && !entityNames.includes(rel.targetEntity) && (
                        <option value={rel.targetEntity}>{rel.targetEntity}</option>
                      )}
                    </select>
                    {rErr?.targetEntity && <p className="mt-0.5 text-[10px] text-error">{rErr.targetEntity}</p>}
                  </td>
                  <td className="py-1.5 px-2 text-center align-top">
                    <input
                      type="checkbox"
                      aria-label="Required (not null)"
                      checked={!!rel.required}
                      onChange={e => update(rIdx, { required: e.target.checked })}
                    />
                  </td>
                  <td className="py-1.5 px-2 text-right align-top">
                    <button
                      onClick={() => remove(rIdx)}
                      className="p-1 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
                      title="Remove relation"
                      aria-label="Remove relation"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <button
        onClick={add}
        className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
        Add relation
      </button>
    </div>
  )
}
