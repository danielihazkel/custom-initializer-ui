import type { FullstackListSort, FullstackPageDef } from '../../../types'
import { inputClass } from '../controls'
import { moveItem } from '../reorder'
import { dropIndicatorClass, useDragReorder } from '../useDragReorder'
import {
  MAX_HEADER_STATS, MAX_TITLE, childTabEntity, childTabPresentation, withChildTab, childTabVia, pageLabel,
  relationsTo, retargetHeaderStat, retargetRecord,
} from '../pageLayout'
import type { FormProps } from './formTypes'
import { ICON_BUTTON, SMALL_BUTTON } from './constants'
import { AggFields, DragGrip, EntitySelect, Field, ListOptions, MoveButtons, ViaSelect } from './fields'

export function RecordForm({ page, index, entities, errors, update, lossy, removed, dnd, projectOpts }: FormProps & { dnd: ReturnType<typeof useDragReorder>; projectOpts: string[] }) {
  const entity = entities.find(e => e.name === page.entity)
  const related = entities.filter(e => relationsTo(e, page.entity).length > 0).map(e => e.name)
  // Omitted childTabs means "every related list" — the same default the generator applies.
  const tabs = page.childTabs ?? related
  const selected = tabs.map(childTabEntity)
  const ordered = [...selected, ...related.filter(n => !selected.includes(n))]

  function toggle(name: string) {
    update(index, {
      childTabs: selected.includes(name) ? tabs.filter(t => childTabEntity(t) !== name) : [...tabs, name],
    })
  }
  function setVia(name: string, via: string) {
    update(index, { childTabs: tabs.map(t => (childTabEntity(t) === name ? withChildTab(t, { via: via || undefined }) : t)) })
  }
  function setShown(name: string, patch: { columns?: string[]; sort?: FullstackListSort }) {
    update(index, { childTabs: tabs.map(t => (childTabEntity(t) === name ? withChildTab(t, patch) : t)) })
  }

  return (
    <div className="space-y-2">
      <Field label="Entity" error={errors.entity} control="entity" hint="Rows of this entity open on this page">
        <EntitySelect
          label="Record entity"
          value={page.entity ?? ''}
          options={entities.map(e => e.name)}
          error={errors.entity}
          onChange={name => {
            // The related lists and header numbers described the old entity's relations.
            const { patch, dropped } = retargetRecord(page, name)
            lossy(`Opened ${name} on “${pageLabel(page)}”`, dropped)
            update(index, patch)
          }}
        />
      </Field>
      <div className="space-y-1" data-control="childTabs">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          Related lists as tabs, in order
          {page.childTabs == null && related.length > 0 && <span className="font-normal normal-case tracking-normal"> · every related list (default)</span>}
        </p>
        {related.length === 0 ? (
          <p className="text-[11px] text-secondary">
            Nothing points at {entity?.name ?? 'this entity'} — the page shows its details only.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {ordered.map(name => {
              const on = selected.includes(name)
              const at = selected.indexOf(name)
              return (
                <li
                  key={name}
                  {...(on ? dnd.rowProps(`childTabs:${index}`, at) : {})}
                  className={`flex items-center gap-1.5 ${on ? dropIndicatorClass(dnd.indicatorFor(`childTabs:${index}`, at)) : ''}`}
                >
                  {on ? <DragGrip dnd={dnd} list={`childTabs:${index}`} index={at} /> : <span className="w-[14px]" />}
                  {on ? (
                    <MoveButtons
                      label={`the ${name} tab`}
                      canUp={at > 0}
                      canDown={at < selected.length - 1}
                      onMove={delta => update(index, { childTabs: moveItem(tabs, at, at + delta) })}
                    />
                  ) : <span className="w-[14px]" />}
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-on-surface">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(name)}
                      className="accent-primary"
                    />
                    {name}
                  </label>
                  {on && (
                    <ViaSelect
                      label={`Link ${name} through`}
                      relations={relationsTo(entities.find(e => e.name === name), page.entity)}
                      value={childTabVia(tabs[at])}
                      error={errors[`childTab.${at}`]}
                      onChange={via => setVia(name, via)}
                    />
                  )}
                  {on && (
                    <ListOptions
                      label={`${name} tab`}
                      entity={entities.find(e => e.name === name)}
                      projectOpts={projectOpts}
                      columns={childTabPresentation(tabs[at]).columns}
                      sort={childTabPresentation(tabs[at]).sort}
                      onChange={patch => setShown(name, patch)}
                    />
                  )}
                  {on && errors[`childTab.${at}`] && <span className="text-[11px] text-error">{errors[`childTab.${at}`]}</span>}
                </li>
              )
            })}
          </ul>
        )}
        {errors.childTabs && <p className="text-[11px] text-error">{errors.childTabs}</p>}
        {page.childTabs != null && related.length > 0 && (
          <button type="button" onClick={() => update(index, { childTabs: undefined })} className={SMALL_BUTTON}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">restart_alt</span>
            All related lists (default)
          </button>
        )}
      </div>
      <HeaderStatsFields page={page} index={index} entities={entities} errors={errors} update={update} lossy={lossy} removed={removed} />
    </div>
  )
}

/** A record page's header tiles: none, the default (a count per related tab), or a list of
 *  counts/aggregates over related entities. */
function HeaderStatsFields({ page, index, entities, errors, update, lossy, removed }: FormProps) {
  const related = entities.filter(e => relationsTo(e, page.entity).length > 0)
  const stats = page.headerStats
  const set = (next: FullstackPageDef['headerStats']) => update(index, { headerStats: next })
  return (
    <div className="space-y-1" data-control="headerStats">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
        Header numbers <span className="font-normal normal-case tracking-normal">· tiles above the tabs</span>
      </p>
      <div role="radiogroup" aria-label="Header numbers" className="inline-flex overflow-hidden rounded border border-outline-variant text-xs">
        {([['default', 'A count per tab'], ['none', 'None'], ['custom', 'Choose']] as const).map(([mode, label]) => {
          const current = stats == null ? 'default' : stats.length === 0 ? 'none' : 'custom'
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={current === mode}
              onClick={() => set(mode === 'default' ? undefined : mode === 'none' ? [] : [{ child: related[0]?.name ?? '' }])}
              disabled={mode === 'custom' && related.length === 0}
              className={`px-2 py-0.5 ${current === mode ? 'bg-primary/15 font-semibold text-primary' : 'text-secondary hover:bg-primary/5'} disabled:opacity-40`}
            >
              {label}
            </button>
          )
        })}
      </div>
      {stats?.map((s, si) => {
        const child = entities.find(e => e.name === s.child)
        const error = errors[`headerStat.${si}`]
        return (
          <div key={si} className="flex flex-wrap items-center gap-2" data-control={`headerStat.${si}`} data-header-stat={si}>
            <EntitySelect
              label="Counted entity"
              value={s.child}
              options={related.map(e => e.name)}
              error={error}
              className="max-w-[10rem]"
              onChange={name => {
                const { stat, dropped } = retargetHeaderStat(s, entities.find(e => e.name === name), page.entity)
                lossy(`Switched header number ${si + 1} to ${name}`, dropped)
                set(stats.map((x, i) => (i === si ? stat : x)))
              }}
            />
            <ViaSelect
              label="Link the tile through"
              relations={relationsTo(child, page.entity)}
              value={s.via}
              error={error}
              onChange={via => set(stats.map((x, i) => (i === si ? { ...x, via: via || undefined } : x)))}
            />
            <AggFields
              agg={s.agg}
              field={s.field}
              entity={child}
              error={error}
              onChange={patch => set(stats.map((x, i) => (i === si ? { ...x, ...patch } : x)))}
            />
            <input
              type="text"
              aria-label="Header number title"
              value={s.title ?? ''}
              maxLength={MAX_TITLE}
              placeholder="Title (optional)"
              onChange={e => set(stats.map((x, i) => (i === si ? { ...x, title: e.target.value || undefined } : x)))}
              className={`${inputClass()} min-w-[8rem] flex-1 py-1 text-xs`}
            />
            <button
              type="button"
              onClick={() => {
                removed?.(`Removed header number ${si + 1} from “${pageLabel(page)}”`)
                set(stats.filter((_, i) => i !== si))
              }}
              className={ICON_BUTTON}
              aria-label={`Remove header number ${si + 1}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
            {error && <p className="w-full text-[11px] text-error">{error}</p>}
          </div>
        )
      })}
      {stats && stats.length > 0 && stats.length < MAX_HEADER_STATS && (
        <button type="button" onClick={() => set([...stats, { child: related[0]?.name ?? '' }])} className={SMALL_BUTTON}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          Add number
        </button>
      )}
      {errors.headerStats && <p className="text-[11px] text-error">{errors.headerStats}</p>}
    </div>
  )
}
