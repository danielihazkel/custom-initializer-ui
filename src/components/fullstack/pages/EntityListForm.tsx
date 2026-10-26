import { useState } from 'react'
import type { FullstackEntityDef, FullstackListDetail, FullstackPageDef } from '../../../types'
import { inputClass } from '../controls'
import { dropIndicatorClass, useDragReorder } from '../useDragReorder'
import {
  DEFAULT_PAGE_SIZE, LIST_ACTIONS, LIST_PAGE_SIZES, LIST_VIEWS, enabledListViews, groupableFields, listColumns, pageLabel,
  retargetEntityList, sortableKeys, splitDisabledReason, splitListByField, viewDisabledReason,
} from '../pageLayout'
import type { FormProps } from './formTypes'
import { SMALL_BUTTON } from './constants'
import { DragGrip, EntitySelect, Field, MiniField, PresetFilters } from './fields'

export function EntityListForm({ page, index, entities, errors, update, lossy, dnd, projectOpts, pages, pushUndo, onChange }: FormProps & {
  dnd: ReturnType<typeof useDragReorder>
  projectOpts: string[]
  /** The whole layout — "Split into tabs" adds pages beside this one. */
  pages: FullstackPageDef[]
  pushUndo: (label: string) => void
  onChange: (next: FullstackPageDef[]) => void
}) {
  const entity = entities.find(e => e.name === page.entity)
  const columns = listColumns(entity, projectOpts)
  const hasRecord = pages.some(p => p.type === 'record' && p.entity?.trim().toLowerCase() === entity?.name.trim().toLowerCase())
  const singlePkEntity = (e: FullstackEntityDef) => e.fields.filter(f => f.primaryKey).length === 1
  // "Split into tabs": one hidden list per value of an enum/boolean field, under a tabs page.
  const splittable = groupableFields(entity)
  const [pickedSplit, setPickedSplit] = useState('')
  const splitField = splittable.find(f => f.name === pickedSplit) ?? splittable[0]
  const splitReason = splitDisabledReason(page, splitField, pages)
  function split() {
    if (!splitField || splitReason) return
    pushUndo(`Split “${pageLabel(page)}” by ${splitField.name}`)
    onChange(splitListByField(page, splitField, pages))
  }
  const allKeys = columns.map(c => c.key)
  // Omitted columns means every column in the generated order — the same default the generator applies.
  const shown = page.columns ?? allKeys
  const hidden = allKeys.filter(k => !shown.includes(k))
  const sortable = sortableKeys(entity, projectOpts)
  const views = enabledListViews(entity)
  const list = `columns:${index}`
  const labelOf = (key: string) => columns.find(c => c.key === key)?.label ?? key

  const setColumns = (next: string[]) => {
    const isDefault = next.length === allKeys.length && next.every((k, i) => k === allKeys[i])
    update(index, { columns: isDefault ? undefined : next })
  }
  const toggle = (key: string) => {
    if (!shown.includes(key)) setColumns([...shown, key])
    else if (shown.length > 1) setColumns(shown.filter(k => k !== key))
  }
  const setSort = (field: string | undefined, dir: 'asc' | 'desc' | undefined) =>
    update(index, { sort: field ? { field, ...(dir === 'desc' ? { dir } : {}) } : undefined })

  return (
    <div className="space-y-2">
      <Field label="Entity" error={errors.entity} control="entity">
        <EntitySelect
          label="List entity"
          value={page.entity ?? ''}
          options={entities.map(e => e.name)}
          error={errors.entity}
          onChange={name => {
            // Columns, sort, view and filter stay when the new entity also has them; the rest is named.
            const { patch, dropped } = retargetEntityList(page, entities.find(e => e.name === name), projectOpts)
            lossy(`Listed ${name} on “${pageLabel(page)}”`, dropped)
            update(index, patch)
          }}
        />
      </Field>
      <PresetFilters
        filter={page.presetFilter}
        entity={entity}
        errors={errors}
        onChange={presetFilter => update(index, { presetFilter })}
      />
      {splittable.length > 0 && (
        <div className="flex flex-wrap items-end gap-2" data-control="split">
          <MiniField label="Split into tabs by" hint={splitReason ?? `A hidden list per ${splitField?.name} value, side by side under a new tabs page`}>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Split by field"
                value={splitField?.name ?? ''}
                onChange={e => setPickedSplit(e.target.value)}
                className={`${inputClass()} max-w-[12rem] py-1 text-xs`}
              >
                {splittable.map(f => <option key={f.name} value={f.name}>{f.label?.trim() || f.name}</option>)}
              </select>
              <button
                type="button"
                onClick={split}
                disabled={Boolean(splitReason)}
                className={SMALL_BUTTON}
                title={splitReason ?? 'One undoable step'}
                data-split-list
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>tab</span>
                Split into tabs
              </button>
            </div>
          </MiniField>
        </div>
      )}
      <div className="space-y-1" data-control="columns" role="group" aria-label="Columns">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          Columns <span className="font-normal normal-case tracking-normal">· in table order — click one to hide it, drag to reorder</span>
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {shown.map((key, i) => {
            const col = columns.find(c => c.key === key)
            const last = shown.length === 1
            return (
              <span
                key={key}
                {...dnd.rowProps(list, i)}
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] ${col ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'} ${
                  dnd.isDragging(list, i) ? 'opacity-40' : ''} ${dropIndicatorClass(dnd.indicatorFor(list, i))}`}
                data-list-column={key}
              >
                <DragGrip dnd={dnd} list={list} index={i} />
                {col?.kind === 'relation' && <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">link</span>}
                <button
                  type="button"
                  aria-pressed="true"
                  aria-label={`Hide the ${labelOf(key)} column`}
                  title={last ? 'Keep at least one column' : col ? 'Shown — click to hide' : `${entity?.name ?? 'The entity'} no longer has this column`}
                  disabled={last}
                  onClick={() => toggle(key)}
                  className="inline-flex items-center gap-1 leading-none hover:text-error disabled:cursor-default disabled:hover:text-inherit"
                >
                  {labelOf(key)} <span aria-hidden="true">×</span>
                </button>
              </span>
            )
          })}
          {hidden.map(key => (
            <button
              key={key}
              type="button"
              aria-pressed="false"
              aria-label={`Show the ${labelOf(key)} column`}
              title="Hidden — click to show"
              onClick={() => toggle(key)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-outline-variant px-2 py-0.5 text-[11px] text-secondary hover:border-primary/50 hover:text-primary"
            >
              <span aria-hidden="true">+</span> {labelOf(key)}
            </button>
          ))}
        </div>
        {errors.columns && <p className="text-[11px] text-error">{errors.columns}</p>}
        {page.columns && (
          <button type="button" onClick={() => update(index, { columns: undefined })} className={SMALL_BUTTON}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">restart_alt</span>
            All columns (default)
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 @sm:grid-cols-3 gap-2">
        <Field label="Sort rows by" error={errors.sort} control="sort" hint="How the table opens; the primary key when unset">
          <div className="flex items-center gap-1">
            <select
              aria-label="Sort rows by"
              aria-invalid={Boolean(errors.sort)}
              value={page.sort?.field ?? ''}
              onChange={e => setSort(e.target.value || undefined, page.sort?.dir)}
              className={`${inputClass(errors.sort)} min-w-0 flex-1 py-1 text-xs`}
            >
              <option value="">Default (primary key)</option>
              {sortable.map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
              {page.sort?.field && !sortable.includes(page.sort.field) && <option value={page.sort.field}>{page.sort.field}</option>}
            </select>
            {page.sort?.field && (
              <span role="radiogroup" aria-label="Sort direction" className="inline-flex shrink-0 overflow-hidden rounded-lg border border-outline-variant">
                {(['asc', 'desc'] as const).map(dir => {
                  const on = (page.sort?.dir ?? 'asc') === dir
                  return (
                    <button
                      key={dir}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={dir === 'asc' ? 'Ascending' : 'Descending'}
                      title={dir === 'asc' ? 'Ascending' : 'Descending'}
                      onClick={() => setSort(page.sort?.field, dir)}
                      className={`px-1.5 py-1 ${on ? 'bg-primary/10 text-primary' : 'text-secondary hover:text-primary'}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                    </button>
                  )
                })}
              </span>
            )}
          </div>
        </Field>
        <Field
          label="Row detail opens in"
          error={errors.detail}
          control="detail"
          hint={hasRecord ? 'Default: the record page' : 'Default: the quick-look drawer — add a record page to open rows there'}
        >
          <span role="radiogroup" aria-label="Row detail opens in" className="inline-flex flex-wrap overflow-hidden rounded-lg border border-outline-variant">
            {([
              { value: 'drawer', label: 'Drawer', reason: undefined },
              { value: 'side', label: 'Side pane', reason: entity && !singlePkEntity(entity) ? 'A side pane needs a single-key entity' : undefined },
              { value: 'record', label: 'Record page', reason: hasRecord ? undefined : `Add a record page for ${entity?.name ?? 'the entity'} first` },
            ] as { value: FullstackListDetail; label: string; reason?: string }[]).map(d => {
              const on = (page.detail ?? (hasRecord ? 'record' : 'drawer')) === d.value
              return (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={d.label}
                  disabled={Boolean(d.reason)}
                  title={d.reason ?? d.label}
                  onClick={() => update(index, { detail: d.value === (hasRecord ? 'record' : 'drawer') ? undefined : d.value })}
                  className={`px-2 py-1 text-[11px] ${on ? 'bg-primary/10 font-semibold text-primary' : 'text-secondary hover:text-primary'} disabled:opacity-40 disabled:hover:text-secondary`}
                >
                  {d.label}
                </button>
              )
            })}
          </span>
        </Field>
        <Field
          label="Opens as"
          error={errors.view}
          control="view"
          hint={views.length > 1 ? 'The view it opens in; its toggle offers the others' : `${entity?.name ?? 'It'} offers the table only — tick more list views on the entity`}
        >
          <span role="radiogroup" aria-label="Opens as" className="inline-flex flex-wrap overflow-hidden rounded-lg border border-outline-variant">
            {LIST_VIEWS.map(v => {
              const enabled = views.includes(v.value)
              const on = (page.view ?? views[0]) === v.value
              const reason = enabled ? undefined : viewDisabledReason(entity, v.value)
              return (
                <button
                  key={v.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={v.label}
                  disabled={!enabled}
                  title={reason ?? (v.value === views[0] ? `${v.label} (default)` : v.label)}
                  onClick={() => update(index, { view: v.value === views[0] ? undefined : v.value })}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] ${on ? 'bg-primary/10 font-semibold text-primary' : 'text-secondary hover:text-primary'} disabled:opacity-40 disabled:hover:text-secondary`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">{v.icon}</span>
                  {v.label}
                </button>
              )
            })}
          </span>
        </Field>
        <Field label="Rows per page" error={errors.pageSize} control="pageSize">
          <select
            aria-label="Rows per page"
            aria-invalid={Boolean(errors.pageSize)}
            value={page.pageSize ?? ''}
            onChange={e => update(index, { pageSize: e.target.value ? Number(e.target.value) : undefined })}
            className={`${inputClass(errors.pageSize)} max-w-[10rem] py-1 text-xs`}
          >
            <option value="">Default ({DEFAULT_PAGE_SIZE})</option>
            {LIST_PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
            {page.pageSize != null && !LIST_PAGE_SIZES.includes(page.pageSize) && <option value={page.pageSize}>{page.pageSize}</option>}
          </select>
        </Field>
        <Field
          label="Hide actions"
          error={errors.hideActions}
          control="hideActions"
          hint="Leave buttons out of this list — presentation only; use roles to restrict who may do it"
        >
          <span className="inline-flex flex-wrap gap-1.5" data-hide-actions>
            {LIST_ACTIONS.map(a => {
              const hidden = page.hideActions ?? []
              const on = hidden.includes(a.value)
              return (
                <label
                  key={a.value}
                  title={a.hint}
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${on ? 'border-error/50 bg-error/5 text-error line-through' : 'border-outline-variant text-on-surface'}`}
                >
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={on}
                    aria-label={`Hide ${a.label}`}
                    onChange={() => {
                      const next = on ? hidden.filter(x => x !== a.value) : LIST_ACTIONS.map(x => x.value).filter(x => x === a.value || hidden.includes(x))
                      update(index, { hideActions: next.length ? next : undefined })
                    }}
                  />
                  {a.label}
                </label>
              )
            })}
          </span>
        </Field>
      </div>
    </div>
  )
}
