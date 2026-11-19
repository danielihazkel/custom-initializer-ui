import { useState } from 'react'
import type { FullstackRelationDef, FullstackRelationType } from '../../types'
import { linkKey, setKey, type LinkIndex } from './childLists'
import type { RelationErrors } from './validation'
import { newUid } from './uid'
import { focusRowWhenRendered } from './focus'
import { moveItem } from './reorder'
import { inverseCollectionName, toSnakeCase, uniqueName } from './naming'
import { dropIndicatorClass, useDragReorder } from './useDragReorder'
import { t } from '../../i18n'

interface Props {
  relations: FullstackRelationDef[]
  /** All entity names in the request (valid FK targets; self-references are allowed). */
  entityNames: string[]
  /** Every (child, parent) pair's foreign keys — the links a one-to-many of this entity can read. */
  linkIndex?: LinkIndex
  /** The owning entity's field names — a duplicated relation must not collide with them. */
  fieldNames?: string[]
  onChange: (relations: FullstackRelationDef[]) => void
  /** A row was removed — the owner offers an Undo that re-inserts it at `index`. */
  onRemoved?: (relation: FullstackRelationDef, index: number) => void
  /** Creates a join entity between the owner and `target` — the many-to-many workaround. Absent
   *  (a view, or an unnamed owner) hides the offer. */
  onAddJoinEntity?: (target: string) => void
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

const many = (rel: FullstackRelationDef) => rel.type === 'MANY_TO_MANY'
const childList = (rel: FullstackRelationDef) => rel.type === 'ONE_TO_MANY'

/** What a row keeps when its kind changes: each kind's own settings mean nothing to the others. */
const KIND_RESET: Record<FullstackRelationType, Partial<FullstackRelationDef>> = {
  MANY_TO_ONE: { type: 'MANY_TO_ONE', joinTable: undefined, inverseJoinColumn: undefined, mappedBy: undefined, composition: undefined },
  // A set of rows is never required and has no single foreign-key column.
  MANY_TO_MANY: { type: 'MANY_TO_MANY', required: false, joinColumn: undefined, mappedBy: undefined, composition: undefined },
  // The other side holds the column, and says whether it is required.
  ONE_TO_MANY: { type: 'ONE_TO_MANY', required: false, joinColumn: undefined, joinTable: undefined, inverseJoinColumn: undefined },
}

function newRelation(defaultTarget: string): FullstackRelationDef {
  return { uid: newUid(), type: 'MANY_TO_ONE', fieldName: '', targetEntity: defaultTarget, required: false }
}

const ICON_BUTTON = 'p-1 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary'

/**
 * Per-entity editor for an entity's relations: `MANY_TO_ONE` (a foreign key), `MANY_TO_MANY`
 * (a set of rows through a join table) and `ONE_TO_MANY` (the rows of another entity whose
 * foreign key points here — read-only from this side). The inverse `@OneToMany` of a foreign key
 * is derived server-side by the `inverseCollections` opt, so there is no inverse editor here; the
 * hint under each target shows what that derivation will name.
 */
export function RelationsEditor({ relations, entityNames, linkIndex, fieldNames = [], onChange, onRemoved, onAddJoinEntity, errors, addDisabledReason, ownerName, showInverse }: Props) {
  const dnd = useDragReorder((_list, from, to) => onChange(moveItem(relations, from, to)))
  // The inline "join entity" picker: which entity the many-to-many goes to.
  const [joinTarget, setJoinTarget] = useState<string | null>(null)
  const joinChoices = entityNames.filter(n => n !== ownerName?.trim())

  const linksOf = (rel: FullstackRelationDef) => linkIndex?.get(linkKey(rel.targetEntity, ownerName ?? '')) ?? []
  /** The target's own sets to this entity: the ones a many-to-many here can be the other side of. */
  const setsOf = (rel: FullstackRelationDef) => linkIndex?.get(setKey(rel.targetEntity, ownerName ?? '')) ?? []

  function update(idx: number, updates: Partial<FullstackRelationDef>) {
    onChange(relations.map((r, i) => (i === idx ? { ...r, ...updates } : r)))
  }
  function remove(idx: number) {
    const removed = relations[idx]
    onChange(relations.filter((_, i) => i !== idx))
    if (removed) onRemoved?.(removed, idx)
  }
  function add() {
    const rel = newRelation(entityNames[0] ?? '')
    onChange([...relations, rel])
    focusRowWhenRendered(rel.uid)
  }
  function duplicate(idx: number) {
    const src = relations[idx]
    const taken = [...fieldNames, ...relations.map(r => r.fieldName)]
    const copy: FullstackRelationDef = {
      ...src,
      uid: newUid(),
      fieldName: src.fieldName.trim() ? uniqueName(`${src.fieldName.trim()}Copy`, taken) : '',
      joinColumn: undefined,
    }
    onChange([...relations.slice(0, idx + 1), copy, ...relations.slice(idx + 1)])
    focusRowWhenRendered(copy.uid)
  }
  // Mirrors EntityScaffoldContext.inverseCollectionName: the owner's plural, told apart by the
  // relation when the owner links to one target twice.
  const inverseNameOf = (rel: FullstackRelationDef) => (ownerName?.trim()
    ? inverseCollectionName(ownerName.trim(), rel.fieldName, rel.targetEntity, relations) : '')

  return (
    <div className="space-y-2 border-t border-outline-variant pt-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">{t('Relations')}</span>
        <span className="text-[11px] text-secondary/70">{t('@ManyToOne — foreign key to another entity')}</span>
        {onAddJoinEntity && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-secondary/70 ms-auto" data-join-entity>
            <span>{t('Links with their own columns?')}</span>
            {joinTarget === null ? (
              <button
                type="button"
                onClick={() => setJoinTarget(joinChoices[0] ?? ownerName?.trim() ?? '')}
                className="font-semibold text-primary underline hover:no-underline"
                title={t('A many-to-many only links two rows. To keep something about each link (a quantity, a date), model it as a join entity that references both sides')}
              >
                {t('Add a join entity…')}
              </button>
            ) : (
              <>
                <span>{t('with')}</span>
                <select
                  aria-label={t('Join entity target')}
                  className="bg-background border border-outline-variant rounded px-1.5 py-0.5 text-[11px] text-on-surface outline-none focus:ring-1 focus:ring-primary/20"
                  value={joinTarget}
                  onChange={e => setJoinTarget(e.target.value)}
                >
                  {(joinChoices.length ? joinChoices : entityNames).map(n => <option key={n} value={n}>{n}</option>)}
                  {joinChoices.length > 0 && ownerName?.trim() && <option value={ownerName.trim()}>{t('{entity} (self)', { entity: ownerName.trim() })}</option>}
                </select>
                <button
                  type="button"
                  onClick={() => { if (joinTarget) onAddJoinEntity(joinTarget); setJoinTarget(null) }}
                  className="px-2 py-0.5 rounded bg-primary text-on-primary font-semibold hover:opacity-90"
                >
                  {t('Create')}
                </button>
                <button type="button" onClick={() => setJoinTarget(null)} className="underline hover:no-underline">{t('Cancel')}</button>
              </>
            )}
          </span>
        )}
      </div>

      {relations.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] font-bold uppercase tracking-wider text-secondary">
              <th className="w-6"></th>
              <th className="text-start py-1 px-2 w-32">{t('Kind')}</th>
              <th className="text-start py-1 px-2">{t('Field name')}</th>
              <th className="text-start py-1 px-2">{t('Target entity')}</th>
              <th className="text-center py-1 px-2 w-12">{t('Req')}</th>
              <th className="w-28"></th>
            </tr>
          </thead>
          <tbody>
            {relations.map((rel, rIdx) => {
              const rErr = errors?.[rIdx]
              const indicator = dnd.indicatorFor('relations', rIdx)
              const target = rel.targetEntity.trim()
              const inverseName = inverseNameOf(rel)
              const links = linksOf(rel)
              return (
                <tr
                  key={rel.uid ?? `i${rIdx}`}
                  data-row-uid={rel.uid}
                  {...dnd.rowProps('relations', rIdx)}
                  className={`${indicator ? dropIndicatorClass(indicator) : 'border-t border-outline-variant'} ${dnd.isDragging('relations', rIdx) ? 'opacity-40' : ''}`}
                >
                  <td className="py-1.5 ps-1 align-top">
                    {relations.length > 1 && (
                      <span
                        {...dnd.handleProps('relations', rIdx)}
                        className="material-symbols-outlined cursor-grab active:cursor-grabbing text-secondary/60 hover:text-secondary select-none"
                        style={{ fontSize: '16px' }}
                        title={t('Drag to reorder')}
                        aria-label={t('Drag to reorder relation')}
                        role="button"
                      >
                        drag_indicator
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 align-top">
                    <select
                      aria-label={t('Relation kind')}
                      className="w-full bg-background border border-outline-variant rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                      value={rel.type}
                      title={t('Many-to-one: this entity holds a foreign key to one row. Many-to-many: it links to any number of rows, through a join table. One-to-many: the rows of another entity that point at this one — read-only here, a table in the details.')}
                      onChange={e => update(rIdx, KIND_RESET[e.target.value as FullstackRelationType])}
                    >
                      <option value="MANY_TO_ONE">{t('Many-to-one')}</option>
                      <option value="MANY_TO_MANY">{t('Many-to-many')}</option>
                      <option value="ONE_TO_MANY">{t('One-to-many')}</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2 align-top">
                    <input
                      type="text"
                      dir="ltr"
                      aria-label={t('Relation field name')}
                      aria-invalid={Boolean(rErr?.fieldName)}
                      className={`w-full bg-background border rounded px-2 py-1 text-xs font-mono focus:ring-1 outline-none ${rErr?.fieldName ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                      value={rel.fieldName}
                      onChange={e => update(rIdx, { fieldName: e.target.value })}
                      placeholder={many(rel) ? 'tags' : childList(rel) ? 'lines' : 'customer'}
                    />
                    {rErr?.fieldName && <p className="mt-0.5 text-[11px] text-error">{rErr.fieldName}</p>}
                    {childList(rel) ? (
                      <>
                        <select
                          aria-label={t('Linked by')}
                          aria-invalid={Boolean(rErr?.mappedBy)}
                          className={`mt-1 w-full bg-background border rounded px-2 py-0.5 text-[11px] font-mono focus:ring-1 outline-none ${rErr?.mappedBy ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                          value={rel.mappedBy ?? ''}
                          onChange={e => update(rIdx, { mappedBy: e.target.value || undefined })}
                          title={t('The many-to-one on the target that points back here. With only one there is nothing to pick.')}
                        >
                          <option value="">
                            {links.length === 1 ? t('by {link} (the only link)', { link: links[0] }) : links.length === 0 ? t('no link back yet') : t('— pick the link —')}
                          </option>
                          {links.map(l => <option key={l} value={l}>{t('by {link}', { link: l })}</option>)}
                          {/* Keep a stale link visible so it isn't silently dropped. */}
                          {rel.mappedBy && !links.includes(rel.mappedBy) && <option value={rel.mappedBy}>{t('by {link}', { link: rel.mappedBy })}</option>}
                        </select>
                        {rErr?.mappedBy && <p className="mt-0.5 text-[11px] text-error">{rErr.mappedBy}</p>}
                        <label
                          className="mt-1 flex items-center gap-1.5 text-[11px] text-on-surface-variant cursor-pointer"
                          title={t('Composition: the rows are part of this entity. Its form edits them in a table, a save carries them, and a row left out is removed. Without it the list is read-only here and the rows are edited on their own page.')}
                        >
                          <input
                            type="checkbox"
                            className="accent-primary"
                            checked={rel.composition === true}
                            aria-invalid={Boolean(rErr?.composition)}
                            onChange={e => update(rIdx, { composition: e.target.checked ? true : undefined })}
                          />
                          {t('Edit the rows in this form')}
                        </label>
                        {rErr?.composition && <p className="mt-0.5 text-[11px] text-error" data-error>{rErr.composition}</p>}
                      </>
                    ) : many(rel) ? (
                      <>
                        {(setsOf(rel).length > 0 || rel.mappedBy) && (
                          <select
                            aria-label={t('Other side of')}
                            aria-invalid={Boolean(rErr?.mappedBy)}
                            data-relation-second-side
                            className={`mt-1 w-full bg-background border rounded px-2 py-0.5 text-[11px] font-mono focus:ring-1 outline-none ${rErr?.mappedBy ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                            value={rel.mappedBy ?? ''}
                            onChange={e => update(rIdx, e.target.value
                              ? { mappedBy: e.target.value, joinTable: undefined, inverseJoinColumn: undefined, joinColumn: undefined }
                              : { mappedBy: undefined })}
                            title={t('The same links from the other end: the target already has a many-to-many to this entity. Pick it and both sides show, filter and edit one set; leave it and this is a second, separate set with a join table of its own.')}
                          >
                            <option value="">{t('a set of its own')}</option>
                            {setsOf(rel).map(s => <option key={s} value={s}>{t('other side of {set}', { set: `${rel.targetEntity}.${s}` })}</option>)}
                            {/* Keep a stale name visible so it isn't silently dropped. */}
                            {rel.mappedBy && !setsOf(rel).includes(rel.mappedBy) && <option value={rel.mappedBy}>{t('other side of {set}', { set: `${rel.targetEntity}.${rel.mappedBy}` })}</option>}
                          </select>
                        )}
                        {rErr?.mappedBy && <p className="mt-0.5 text-[11px] text-error" data-error>{rErr.mappedBy}</p>}
                        {!rel.mappedBy && <input
                          type="text"
                          dir="ltr"
                          aria-label={t('Join table')}
                          aria-invalid={Boolean(rErr?.joinTable)}
                          className={`mt-1 w-full bg-background border rounded px-2 py-0.5 text-[11px] font-mono focus:ring-1 outline-none ${rErr?.joinTable ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                          value={rel.joinTable ?? ''}
                          onChange={e => update(rIdx, { joinTable: e.target.value || undefined })}
                          placeholder={ownerName?.trim() && rel.fieldName.trim() ? `${toSnakeCase(ownerName.trim())}_${toSnakeCase(rel.fieldName.trim())}` : t('join table')}
                          title={t('The table that holds the links, exactly as the schema spells it. Leave blank for <entity>_<field>.')}
                        />}
                        {rErr?.joinTable && <p className="mt-0.5 text-[11px] text-error">{rErr.joinTable}</p>}
                      </>
                    ) : (
                    <input
                      type="text"
                      dir="ltr"
                      aria-label={t('Join column')}
                      aria-invalid={Boolean(rErr?.joinColumn)}
                      className={`mt-1 w-full bg-background border rounded px-2 py-0.5 text-[11px] font-mono focus:ring-1 outline-none ${rErr?.joinColumn ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant/60 focus:ring-primary/20 focus:border-primary'}`}
                      value={rel.joinColumn ?? ''}
                      onChange={e => update(rIdx, { joinColumn: e.target.value || undefined })}
                      placeholder={rel.fieldName.trim() ? `${toSnakeCase(rel.fieldName.trim())}_id` : t('join column')}
                      title={t('The foreign-key column, exactly as the schema spells it. Leave blank for <field>_id. Filled in by Import from DDL.')}
                    />
                    )}
                    {rErr?.joinColumn && <p className="mt-0.5 text-[11px] text-error">{rErr.joinColumn}</p>}
                  </td>
                  <td className="py-1.5 px-2 align-top">
                    <select
                      aria-label={t('Target entity')}
                      aria-invalid={Boolean(rErr?.targetEntity)}
                      className={`w-full bg-background border rounded px-2 py-1 text-xs focus:ring-1 outline-none ${rErr?.targetEntity ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                      value={rel.targetEntity}
                      onChange={e => update(rIdx, { targetEntity: e.target.value })}
                    >
                      {/* No named entity yet (the owner itself is still blank) — say so instead of a bare dash. */}
                      <option value="">{entityNames.length === 0 ? t('Name an entity first…') : t('— pick a target —')}</option>
                      {entityNames.map(n => <option key={n} value={n}>{n}</option>)}
                      {/* Keep a stale/unknown target visible so it isn't silently dropped. */}
                      {rel.targetEntity && !entityNames.includes(rel.targetEntity) && (
                        <option value={rel.targetEntity}>{rel.targetEntity}</option>
                      )}
                    </select>
                    {rErr?.targetEntity && <p className="mt-0.5 text-[11px] text-error">{rErr.targetEntity}</p>}
                    <input
                      type="text"
                      dir="auto"
                      aria-label={t('Relation label')}
                      aria-invalid={Boolean(rErr?.label)}
                      className={`mt-1 w-full bg-background border rounded px-2 py-0.5 text-[11px] focus:ring-1 outline-none ${rErr?.label ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant/60 focus:ring-primary/20 focus:border-primary'}`}
                      value={rel.label ?? ''}
                      onChange={e => update(rIdx, { label: e.target.value || undefined })}
                      placeholder={t('Label (optional)')}
                      title={t('What the generated app calls this relation: its column heading, form label and filter. Leave blank for the field name.')}
                    />
                    {rErr?.label && <p className="mt-0.5 text-[11px] text-error">{rErr.label}</p>}
                    {!rErr?.targetEntity && showInverse && target && inverseName && rel.type === 'MANY_TO_ONE' && (
                      <p className="mt-0.5 text-[10px] text-secondary font-mono" data-inverse-hint dir="ltr"
                         title={t('With the Inverse collections option on, the target gets a read-only @OneToMany collection and its DTO a count of these rows')}>
                        + {target}.{inverseName} · {inverseName}Count
                      </p>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-center align-top">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      aria-label={t('Required (not null)')}
                      disabled={rel.type !== 'MANY_TO_ONE'}
                      title={many(rel) ? t('A many-to-many may always be empty') : childList(rel) ? t('Require the many-to-one on the other side instead') : undefined}
                      checked={!!rel.required}
                      onChange={e => update(rIdx, { required: e.target.checked })}
                    />
                  </td>
                  <td className="py-1.5 px-2 text-end align-top">
                    <div className="flex items-center justify-end gap-0.5">
                      <button type="button" onClick={() => onChange(moveItem(relations, rIdx, rIdx - 1))} disabled={rIdx === 0}
                              className={ICON_BUTTON} title={t('Move relation up')} aria-label={t('Move relation up')}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_upward</span>
                      </button>
                      <button type="button" onClick={() => onChange(moveItem(relations, rIdx, rIdx + 1))} disabled={rIdx === relations.length - 1}
                              className={ICON_BUTTON} title={t('Move relation down')} aria-label={t('Move relation down')}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_downward</span>
                      </button>
                      <button type="button" onClick={() => duplicate(rIdx)} className={ICON_BUTTON} title={t('Duplicate relation')} aria-label={t('Duplicate relation')}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(rIdx)}
                        className="p-1 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
                        title={t('Remove relation')}
                        aria-label={t('Remove relation')}
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
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          {t('Add relation')}
        </button>
      )}
    </div>
  )
}
