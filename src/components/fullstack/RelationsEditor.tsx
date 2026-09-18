import type { FullstackRelationDef } from '../../types'
import type { RelationErrors } from './validation'
import { newUid } from './uid'
import { focusRowWhenRendered } from './focus'
import { moveItem } from './reorder'
import { pluralize, toCamelCase } from './naming'
import { dropIndicatorClass, useDragReorder } from './useDragReorder'

interface Props {
  relations: FullstackRelationDef[]
  /** All entity names in the request (valid FK targets; self-references are allowed). */
  entityNames: string[]
  onChange: (relations: FullstackRelationDef[]) => void
  errors?: Record<number, RelationErrors>
  /** When set, adding a relation is not offered and this text explains why (e.g. a SELECT-backed
   *  view can't declare relations). Existing rows stay editable/removable so validation can clear. */
  addDisabledReason?: string
  /** The owning entity's name — names the inverse collection the target would get. */
  ownerName?: string
  /** True when the project-wide `inverseCollections` opt is on, so each row can say what the
   *  target entity gains (`Customer.orders` + `ordersCount`). */
  showInverse?: boolean
}

function newRelation(defaultTarget: string): FullstackRelationDef {
  return { uid: newUid(), type: 'MANY_TO_ONE', fieldName: '', targetEntity: defaultTarget, required: false }
}

const ICON_BUTTON = 'p-1 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary'

/**
 * Per-entity editor for `MANY_TO_ONE` relations (the FK-owning side). v1 supports only
 * MANY_TO_ONE — the inverse `@OneToMany` is auto-derived server-side via the
 * `inverseCollections` opt, so there is no inverse editor here; the hint under each target
 * shows what that derivation will name.
 */
export function RelationsEditor({ relations, entityNames, onChange, errors, addDisabledReason, ownerName, showInverse }: Props) {
  const dnd = useDragReorder((_list, from, to) => onChange(moveItem(relations, from, to)))

  function update(idx: number, updates: Partial<FullstackRelationDef>) {
    onChange(relations.map((r, i) => (i === idx ? { ...r, ...updates } : r)))
  }
  function remove(idx: number) {
    onChange(relations.filter((_, i) => i !== idx))
  }
  function add() {
    const rel = newRelation(entityNames[0] ?? '')
    onChange([...relations, rel])
    focusRowWhenRendered(rel.uid)
  }
  function duplicate(idx: number) {
    const src = relations[idx]
    const copy: FullstackRelationDef = { ...src, uid: newUid(), fieldName: src.fieldName ? `${src.fieldName}Copy` : '' }
    onChange([...relations.slice(0, idx + 1), copy, ...relations.slice(idx + 1)])
    focusRowWhenRendered(copy.uid)
  }
  // Mirrors EntityScaffoldContext: the parent's collection is the pluralized camel-case child name.
  const inverseName = ownerName?.trim() ? pluralize(toCamelCase(ownerName.trim())) : ''

  return (
    <div className="space-y-2 border-t border-outline-variant pt-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">Relations</span>
        <span className="text-[11px] text-secondary/70">@ManyToOne — foreign key to another entity</span>
      </div>

      {relations.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] font-bold uppercase tracking-wider text-secondary">
              <th className="w-6"></th>
              <th className="text-left py-1 px-2">Field name</th>
              <th className="text-left py-1 px-2">Target entity</th>
              <th className="text-center py-1 px-2 w-12">Req</th>
              <th className="w-28"></th>
            </tr>
          </thead>
          <tbody>
            {relations.map((rel, rIdx) => {
              const rErr = errors?.[rIdx]
              const indicator = dnd.indicatorFor('relations', rIdx)
              const target = rel.targetEntity.trim()
              return (
                <tr
                  key={rel.uid ?? `i${rIdx}`}
                  data-row-uid={rel.uid}
                  {...dnd.rowProps('relations', rIdx)}
                  className={`${indicator ? dropIndicatorClass(indicator) : 'border-t border-outline-variant'} ${dnd.isDragging('relations', rIdx) ? 'opacity-40' : ''}`}
                >
                  <td className="py-1.5 pl-1 align-top">
                    {relations.length > 1 && (
                      <span
                        {...dnd.handleProps('relations', rIdx)}
                        className="material-symbols-outlined cursor-grab active:cursor-grabbing text-secondary/60 hover:text-secondary select-none"
                        style={{ fontSize: '16px' }}
                        title="Drag to reorder"
                        aria-label="Drag to reorder relation"
                        role="button"
                      >
                        drag_indicator
                      </span>
                    )}
                  </td>
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
                    {rErr?.fieldName && <p className="mt-0.5 text-[11px] text-error">{rErr.fieldName}</p>}
                  </td>
                  <td className="py-1.5 px-2 align-top">
                    <select
                      aria-label="Target entity"
                      aria-invalid={Boolean(rErr?.targetEntity)}
                      className={`w-full bg-background border rounded px-2 py-1 text-xs focus:ring-1 outline-none ${rErr?.targetEntity ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                      value={rel.targetEntity}
                      onChange={e => update(rIdx, { targetEntity: e.target.value })}
                    >
                      {/* No named entity yet (the owner itself is still blank) — say so instead of a bare dash. */}
                      <option value="">{entityNames.length === 0 ? 'Name an entity first…' : '— pick a target —'}</option>
                      {entityNames.map(n => <option key={n} value={n}>{n}</option>)}
                      {/* Keep a stale/unknown target visible so it isn't silently dropped. */}
                      {rel.targetEntity && !entityNames.includes(rel.targetEntity) && (
                        <option value={rel.targetEntity}>{rel.targetEntity}</option>
                      )}
                    </select>
                    {rErr?.targetEntity && <p className="mt-0.5 text-[11px] text-error">{rErr.targetEntity}</p>}
                    {!rErr?.targetEntity && showInverse && target && inverseName && (
                      <p className="mt-0.5 text-[10px] text-secondary font-mono" data-inverse-hint
                         title="With the Inverse collections option on, the target gets a read-only @OneToMany collection and its DTO a count of these rows">
                        + {target}.{inverseName} · {inverseName}Count
                      </p>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-center align-top">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      aria-label="Required (not null)"
                      checked={!!rel.required}
                      onChange={e => update(rIdx, { required: e.target.checked })}
                    />
                  </td>
                  <td className="py-1.5 px-2 text-right align-top">
                    <div className="flex items-center justify-end gap-0.5">
                      <button type="button" onClick={() => onChange(moveItem(relations, rIdx, rIdx - 1))} disabled={rIdx === 0}
                              className={ICON_BUTTON} title="Move relation up" aria-label="Move relation up">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_upward</span>
                      </button>
                      <button type="button" onClick={() => onChange(moveItem(relations, rIdx, rIdx + 1))} disabled={rIdx === relations.length - 1}
                              className={ICON_BUTTON} title="Move relation down" aria-label="Move relation down">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_downward</span>
                      </button>
                      <button type="button" onClick={() => duplicate(rIdx)} className={ICON_BUTTON} title="Duplicate relation" aria-label="Duplicate relation">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(rIdx)}
                        className="p-1 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
                        title="Remove relation"
                        aria-label="Remove relation"
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
      )}

      {addDisabledReason ? (
        <p className="text-[11px] text-secondary/70 flex items-center gap-1 px-1">
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>info</span>
          {addDisabledReason}
        </p>
      ) : (
        <button
          onClick={add}
          className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          Add relation
        </button>
      )}
    </div>
  )
}
