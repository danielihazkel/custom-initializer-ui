import type { FullstackDateRange, FullstackEntityDef, FullstackPageDef, FullstackWidgetDef } from '../../../types'
import { inputClass } from '../controls'
import { fieldOption, keyOption } from '../fieldOptions'
import { isSortableType } from '../fieldTypes'
import { pluralize } from '../naming'
import { dropIndicatorClass, useDragReorder } from '../useDragReorder'
import {
  MAX_RECENT_LIMIT, MAX_TEXT, dateFields, defaultBarGroupBy, defaultSeries, defaultSpan, drillToPages,
  defaultTopGroupBy, defaultLineGroupBy, defaultOptionLabel, funnelStageFields, linkablePages, LIST_WIDGET_LIMITS, MAX_LINKS,
  MAX_TITLE, filterableDateFields, groupByFields, listColumns, pageLabel, rankableKeys, sortableKeys,
  widgetKindDisabledReason, activityEntities, auditOn, defaultPivotColumns, MAX_ACTIVITY_ENTITIES, MIN_ACTIVITY_LIMIT,
} from '../pageLayout'
import { aggHint, SMALL_BUTTON, WIDGET_KINDS } from './constants'
import { AggFields, BucketSelect, DragGrip, EntitySelect, MiniField, PresetFilters, SpanPicker } from './fields'
import { t } from '../../../i18n'

/**
 * One dashboard widget's settings, in the designer's inspector: its kind, then labelled "Data"
 * (what it measures) and "Display" (how it is shown) columns, then the rows it is limited to.
 * The canvas moves, copies and removes the widget.
 */
export function WidgetCard({ widget, wi, pages, projectOpts, entities, dateRange, errors, dnd, list, onChange, onRetarget }: {
  widget: FullstackWidgetDef
  wi: number
  /** The layout — a links widget picks the pages it opens from it. */
  pages: FullstackPageDef[]
  projectOpts: string[]
  entities: FullstackEntityDef[]
  dateRange: FullstackDateRange | undefined
  errors: Record<string, string>
  /** For the columns of a list widget, which reorder by drag. */
  dnd: ReturnType<typeof useDragReorder>
  list: string
  onChange: (patch: Partial<FullstackWidgetDef>) => void
  onRetarget: (patch: { kind?: FullstackWidgetDef['kind']; entity?: string }) => void
}) {
  const entity = entities.find(e => e.name === widget.entity)
  const own = `widget.${wi}`
  // Each control is marked by its own messages only; the card lists them all under it.
  const err = (control: string): string | undefined => errors[`${own}.${control}`]
  const filterPrefix = `widget.${wi}.presetFilter.`
  const filterErrors = Object.fromEntries(
    Object.entries(errors).filter(([k]) => k.startsWith(filterPrefix)).map(([k, v]) => [`presetFilter.${k.slice(filterPrefix.length)}`, v]),
  )
  const messages = [...new Set(Object.entries(errors)
    .filter(([k]) => (k === own || k.startsWith(`${own}.`)) && !k.startsWith(filterPrefix))
    .map(([, v]) => v))]
  const fallbackSpan = defaultSpan(widget.kind)
  const span = widget.span ?? fallbackSpan
  const dates = filterableDateFields(entity)
  const pk = entity?.fields.find(f => f.primaryKey)?.name
  const labelOf = (key: string) => keyOption(entity, key)

  return (
    <div data-widget={wi} data-control={`widget.${wi}`} className="space-y-3">
      <div role="radiogroup" aria-label={t('Widget kind')} className="inline-flex flex-wrap overflow-hidden rounded border border-outline-variant" data-widget-kind>
        {WIDGET_KINDS.map(k => {
          const on = widget.kind === k.kind
          // A kind that cannot read this widget's entity (or, for a text widget, the first
          // entity it would fall back to) says why instead of producing a problem.
          const reason = on ? undefined : widgetKindDisabledReason(k.kind, entity ?? (widget.entity ? undefined : entities[0]), { entities, scaffoldOpts: projectOpts })
          return (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={k.label}
              aria-disabled={Boolean(reason)}
              disabled={Boolean(reason)}
              title={reason ?? k.hint}
              onClick={() => onRetarget(k.kind !== 'text' && k.kind !== 'activity' && !widget.entity ? { kind: k.kind, entity: entities[0]?.name ?? '' } : { kind: k.kind })}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] disabled:opacity-40 ${on ? 'bg-primary/15 font-semibold text-primary' : 'text-secondary hover:bg-primary/5 hover:text-primary'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">{k.icon}</span>
              {k.short}
            </button>
          )
        })}
      </div>
      {widget.kind === 'list' ? (
        <div className="space-y-2" data-widget-options>
          <div className="grid grid-cols-1 gap-2 @md:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
            <MiniField label={t('Entity')}>
              <EntitySelect label={t('Widget entity')} value={widget.entity} options={entities.map(e => e.name)} error={err('entity')} onChange={name => onRetarget({ entity: name })} />
            </MiniField>
            <MiniField label={t('Title')} grow>
              <input
                type="text"
                aria-label={t('Widget title')}
                value={widget.title ?? ''}
                maxLength={MAX_TITLE}
                placeholder={entity ? pluralize(entity.name) : t('Optional heading')}
                onChange={e => onChange({ title: e.target.value || undefined })}
                className={`${inputClass()} w-full py-1 text-xs`}
              />
            </MiniField>
            <MiniField label={t('Rows')} hint={t('A page of the list')}>
              <div role="radiogroup" aria-label={t('Rows per page')} className="inline-flex overflow-hidden rounded border border-outline-variant">
                {LIST_WIDGET_LIMITS.map(n => {
                  const on = (widget.limit ?? LIST_WIDGET_LIMITS[0]) === n
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => onChange({ limit: n === LIST_WIDGET_LIMITS[0] ? undefined : n })}
                      className={`px-2 py-0.5 text-[11px] ${on ? 'bg-primary/15 font-semibold text-primary' : 'text-secondary hover:bg-primary/5'}`}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            </MiniField>
            <MiniField label={t('Width')} hint={t('Columns of 4 · default {n}', { n: fallbackSpan })}>
              <SpanPicker span={span} fallback={fallbackSpan} onChange={s => onChange({ span: s })} />
            </MiniField>
          </div>
          <MiniField label={t('Columns')} hint={t('Click to hide or show, drag to reorder · default: every column')}>
            <div className="flex flex-wrap items-center gap-1" data-widget-columns>
              {(() => {
                const cols = listColumns(entity, projectOpts)
                const all = cols.map(c => c.key)
                const shown = (widget.columns ?? all).filter(k => all.includes(k))
                const hiddenKeys = all.filter(k => !shown.includes(k))
                const colList = `wcolumns:${list.split(':')[1]}:${wi}`
                const labelOf = (key: string) => cols.find(c => c.key === key)?.label ?? key
                const set = (next: string[]) => {
                  const isDefault = next.length === all.length && next.every((k, i) => k === all[i])
                  onChange({ columns: isDefault || next.length === 0 ? undefined : next })
                }
                return (
                  <>
                    {shown.map((key, i) => (
                      <span
                        key={key}
                        {...dnd.rowProps(colList, i)}
                        className={`inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary ${
                          dnd.isDragging(colList, i) ? 'opacity-40' : ''} ${dropIndicatorClass(dnd.indicatorFor(colList, i))}`}
                        data-widget-column={key}
                      >
                        <DragGrip dnd={dnd} list={colList} index={i} />
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked="true"
                          aria-label={t('Hide the {column} column', { column: labelOf(key) })}
                          disabled={shown.length === 1}
                          title={shown.length === 1 ? t('Keep at least one column') : t('Shown — click to hide')}
                          onClick={() => set(shown.filter(k => k !== key))}
                          className="inline-flex items-center gap-1 leading-none hover:text-error disabled:cursor-default disabled:hover:text-inherit"
                        >
                          {labelOf(key)} <span aria-hidden="true">×</span>
                        </button>
                      </span>
                    ))}
                    {hiddenKeys.map(key => (
                      <button
                        key={key}
                        type="button"
                        role="checkbox"
                        aria-checked="false"
                        aria-label={t('Show the {column} column', { column: labelOf(key) })}
                        title={t('Hidden — click to show')}
                        onClick={() => set([...shown, key])}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-outline-variant px-2 py-0.5 text-[11px] text-secondary hover:border-primary/50 hover:text-primary"
                      >
                        <span aria-hidden="true">+</span> {labelOf(key)}
                      </button>
                    ))}
                  </>
                )
              })()}
            </div>
          </MiniField>
          <MiniField label={t('Sort rows by')}>
            <div className="flex items-center gap-1.5">
              <select
                aria-label={t('Widget sort')}
                value={widget.sort?.field ?? ''}
                onChange={e => onChange({ sort: e.target.value ? { field: e.target.value, dir: widget.sort?.dir } : undefined })}
                className={`${inputClass()} max-w-[12rem] py-1 text-xs`}
              >
                <option value="">{t('Default (the key)')}</option>
                {sortableKeys(entity, projectOpts).map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
              </select>
              {widget.sort && (
                <button
                  type="button"
                  onClick={() => onChange({ sort: { ...widget.sort!, dir: widget.sort!.dir === 'desc' ? undefined : 'desc' } })}
                  className={SMALL_BUTTON}
                  aria-label={widget.sort.dir === 'desc' ? t('Sort ascending') : t('Sort descending')}
                >
                  {widget.sort.dir === 'desc' ? `↓ ${t('desc')}` : `↑ ${t('asc')}`}
                </button>
              )}
            </div>
          </MiniField>
          <DrillToField widget={widget} wi={wi} pages={pages} error={err('drillTo')} onChange={onChange} />
          <PresetFilters
            filter={widget.presetFilter}
            entity={entity}
            errors={filterErrors}
            controlPrefix={filterPrefix}
            onChange={presetFilter => onChange({ presetFilter })}
            heading={t('Only rows where')}
          />
        </div>
      ) : widget.kind === 'links' ? (
        <div className="space-y-2" data-widget-options>
          <div className="grid grid-cols-1 gap-2 @md:grid-cols-[minmax(0,1fr)_auto]">
            <MiniField label={t('Title')} grow>
              <input
                type="text"
                aria-label={t('Widget title')}
                value={widget.title ?? ''}
                maxLength={MAX_TITLE}
                placeholder={t('Optional heading')}
                onChange={e => onChange({ title: e.target.value || undefined })}
                className={`${inputClass()} w-full py-1 text-xs`}
              />
            </MiniField>
            <MiniField label={t('Width')} hint={t('Columns of 4 · default {n}', { n: fallbackSpan })}>
              <SpanPicker span={span} fallback={fallbackSpan} onChange={s => onChange({ span: s })} />
            </MiniField>
          </div>
          <MiniField label={t('Pages it opens')} hint={t('One tile per page, in this order · up to {max}', { max: MAX_LINKS })}>
            <ul className="flex flex-wrap gap-1.5" data-widget-links>
              {linkablePages(pages).map(p => {
                const ids = widget.pages ?? []
                const on = ids.includes(p.id)
                return (
                  <li key={p.id}>
                    <label className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-outline-variant text-on-surface'}`}>
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={on}
                        aria-label={t('Link to {page}', { page: pageLabel(p) })}
                        onChange={() => onChange({ pages: on ? ids.filter(id => id !== p.id) : [...ids, p.id] })}
                      />
                      {pageLabel(p)}
                    </label>
                  </li>
                )
              })}
              {linkablePages(pages).length === 0 && <li className="text-[11px] text-secondary">{t('Add another page first — a links widget opens other pages.')}</li>}
            </ul>
          </MiniField>
        </div>
      ) : widget.kind === 'activity' ? (
        <div className="space-y-2" data-widget-options>
          <div className="grid grid-cols-1 gap-2 @md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <MiniField label={t('Title')} grow>
              <input
                type="text"
                aria-label={t('Widget title')}
                value={widget.title ?? ''}
                maxLength={MAX_TITLE}
                placeholder={t('Recent activity')}
                onChange={e => onChange({ title: e.target.value || undefined })}
                className={`${inputClass()} w-full py-1 text-xs`}
              />
            </MiniField>
            <MiniField label={t('Changes')} hint={`${MIN_ACTIVITY_LIMIT}–${MAX_RECENT_LIMIT}`}>
              <input
                type="number"
                min={MIN_ACTIVITY_LIMIT}
                max={MAX_RECENT_LIMIT}
                aria-label={t('How many changes')}
                value={widget.limit ?? ''}
                placeholder="10"
                onChange={e => onChange({ limit: e.target.value === '' ? undefined : Number(e.target.value) })}
                className={`${inputClass(err('limit'))} w-[4.5rem] py-1 text-xs`}
              />
            </MiniField>
            <MiniField label={t('Width')} hint={t('Columns of 4 · default {n}', { n: fallbackSpan })}>
              <SpanPicker span={span} fallback={fallbackSpan} onChange={s => onChange({ span: s })} />
            </MiniField>
          </div>
          <MiniField label={t('Entities it follows')} hint={t('Audited entities only · none ticked: every one (up to {max})', { max: MAX_ACTIVITY_ENTITIES })}>
            <ul className="flex flex-wrap gap-1.5" data-widget-activity data-control={`widget.${wi}.entities`}>
              {entities.map(e => {
                const audited = auditOn(e, projectOpts)
                const named = widget.entities ?? []
                const on = named.includes(e.name)
                const implied = named.length === 0 && activityEntities(widget, entities, projectOpts).includes(e.name)
                return (
                  <li key={e.name}>
                    <label
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${on ? 'border-primary/50 bg-primary/10 text-primary' : implied ? 'border-dashed border-primary/40 text-primary/80' : 'border-outline-variant text-on-surface'} ${audited ? '' : 'opacity-50'}`}
                      title={audited ? undefined : t('{entity} does not record when it changed — turn the audit option on for it', { entity: e.name })}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={on}
                        disabled={!audited && !on}
                        aria-label={t('Follow {entity}', { entity: e.name })}
                        onChange={() => {
                          const next = on ? named.filter(n => n !== e.name) : [...named, e.name]
                          onChange({ entities: next.length ? next : undefined })
                        }}
                      />
                      {e.name}
                    </label>
                  </li>
                )
              })}
            </ul>
          </MiniField>
        </div>
      ) : widget.kind === 'text' ? (
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-[minmax(0,1fr)_auto]" data-widget-options>
          <MiniField label={t('Title')} grow>
            <input
              type="text"
              aria-label={t('Widget title')}
              value={widget.title ?? ''}
              maxLength={MAX_TITLE}
              placeholder={t('Optional heading')}
              onChange={e => onChange({ title: e.target.value || undefined })}
              className={`${inputClass()} w-full py-1 text-xs`}
            />
          </MiniField>
          <MiniField label={t('Width')} hint={t('Columns of 4 · default {n}', { n: fallbackSpan })}>
            <SpanPicker span={span} fallback={fallbackSpan} onChange={s => onChange({ span: s })} />
          </MiniField>
          <div className="@md:col-span-2">
            <MiniField label={t('Text')} hint={`${t('Plain text; a blank line starts a new paragraph')} · ${(widget.text ?? '').length}/${MAX_TEXT}`}>
              <textarea
                dir="auto"
                aria-label={t('Widget text')}
                aria-invalid={Boolean(err('text'))}
                value={widget.text ?? ''}
                rows={4}
                maxLength={MAX_TEXT}
                placeholder={t('e.g. How the team triages new tickets, who to call, links to the runbook…')}
                onChange={e => onChange({ text: e.target.value || undefined })}
                className={`${inputClass(err('text'))} w-full py-1 text-xs`}
              />
            </MiniField>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 @md:grid-cols-2" data-widget-options>
        <fieldset className="min-w-0 space-y-1.5">
          <legend className="text-[10px] font-semibold uppercase tracking-wider text-secondary/80">{t('Data')}</legend>
          <div className="flex flex-wrap items-end gap-2">
            <MiniField label={t('Entity')}>
              <EntitySelect
                label={t('Widget entity')}
                value={widget.entity}
                options={entities.map(e => e.name)}
                error={err('entity')}
                className="max-w-[10rem]"
                onChange={name => onRetarget({ entity: name })}
              />
            </MiniField>
            {(widget.kind === 'bar' || widget.kind === 'donut') && (
              <MiniField label={t('Group by')} hint={widget.kind === 'donut' ? t('One slice per value (or related record)') : t('One bar per value (or related record)')}>
                <select
                  aria-label={t('Group by')}
                  value={widget.groupBy ?? ''}
                  onChange={e => onChange({ groupBy: e.target.value || undefined })}
                  className={`${inputClass(err('groupBy'))} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(defaultTopGroupBy(entity), t('enum, boolean or relation'), labelOf)}</option>
                  {rankableKeys(entity).map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
                  {widget.groupBy && !rankableKeys(entity).includes(widget.groupBy) && (
                    <option value={widget.groupBy}>{widget.groupBy}</option>
                  )}
                </select>
              </MiniField>
            )}
            {widget.kind === 'funnel' && (
              <MiniField label={t('Stages')} hint={t('An enum field: its values, in their order, are the pipeline. Limit the widget to some of them (its filter) to leave a state off the main line out')}>
                <select
                  aria-label={t('Stages')}
                  value={widget.groupBy ?? ''}
                  onChange={e => onChange({ groupBy: e.target.value || undefined })}
                  className={`${inputClass(err('groupBy'))} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(funnelStageFields(entity)[0]?.name, t('enum'), labelOf)}</option>
                  {funnelStageFields(entity).map(f => <option key={f.name} value={f.name}>{labelOf(f.name)}</option>)}
                  {widget.groupBy && !funnelStageFields(entity).some(f => f.name === widget.groupBy) && (
                    <option value={widget.groupBy}>{widget.groupBy}</option>
                  )}
                </select>
              </MiniField>
            )}
            {widget.kind === 'stacked' && (
              <MiniField label={t('Group by')} hint={t('One bar per value')}>
                <select
                  aria-label={t('Group by')}
                  value={widget.groupBy ?? ''}
                  onChange={e => onChange({ groupBy: e.target.value || undefined })}
                  className={`${inputClass(err('groupBy'))} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(defaultBarGroupBy(entity), t('enum or boolean'), labelOf)}</option>
                  {groupByFields(entity).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
                  {widget.groupBy && !groupByFields(entity).some(f => f.name === widget.groupBy) && (
                    <option value={widget.groupBy}>{widget.groupBy}</option>
                  )}
                </select>
              </MiniField>
            )}
            {widget.kind === 'stacked' && (
              <MiniField label={t('Split by')} hint={t("Each bar's segments")}>
                <select
                  aria-label={t('Split by')}
                  value={widget.series ?? ''}
                  onChange={e => onChange({ series: e.target.value || undefined })}
                  className={`${inputClass(err('series'))} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(defaultSeries(entity, widget.groupBy ?? defaultBarGroupBy(entity)), t('second enum or boolean'), labelOf)}</option>
                  {groupByFields(entity).filter(f => f.name !== (widget.groupBy ?? defaultBarGroupBy(entity))).map(f => (
                    <option key={f.name} value={f.name}>{fieldOption(f)}</option>
                  ))}
                  {widget.series && !groupByFields(entity).some(f => f.name === widget.series) && (
                    <option value={widget.series}>{widget.series}</option>
                  )}
                </select>
              </MiniField>
            )}
            {widget.kind === 'pivot' && (
              <>
                <MiniField label={t('Rows')} hint={t('One row per value (or related record)')}>
                  <select
                    aria-label={t('Pivot rows')}
                    value={widget.groupBy ?? ''}
                    onChange={e => onChange({ groupBy: e.target.value || undefined, ...(widget.series === e.target.value ? { series: undefined } : {}) })}
                    className={`${inputClass(err('groupBy'))} max-w-[11rem] py-1 text-xs`}
                  >
                    <option value="">{defaultOptionLabel(defaultTopGroupBy(entity), t('enum, boolean or relation'), labelOf)}</option>
                    {rankableKeys(entity).map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
                    {widget.groupBy && !rankableKeys(entity).includes(widget.groupBy) && (
                      <option value={widget.groupBy}>{widget.groupBy}</option>
                    )}
                  </select>
                </MiniField>
                <MiniField label={t('Columns')} hint={t('One column per value (or related record)')}>
                  <select
                    aria-label={t('Pivot columns')}
                    value={widget.series ?? ''}
                    onChange={e => onChange({ series: e.target.value || undefined })}
                    className={`${inputClass(err('series'))} max-w-[11rem] py-1 text-xs`}
                  >
                    <option value="">{defaultOptionLabel(defaultPivotColumns(entity, widget.groupBy ?? defaultTopGroupBy(entity)), t('second enum, boolean or relation'), labelOf)}</option>
                    {rankableKeys(entity).filter(k => k !== (widget.groupBy ?? defaultTopGroupBy(entity))).map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
                    {widget.series && !rankableKeys(entity).includes(widget.series) && (
                      <option value={widget.series}>{widget.series}</option>
                    )}
                  </select>
                </MiniField>
              </>
            )}
            {widget.kind === 'line' && (
              <>
                <MiniField label={t('Over')} hint={t('One point per bucket of this date')}>
                  <select
                    aria-label={t('Date field')}
                    value={widget.groupBy ?? ''}
                    onChange={e => onChange({ groupBy: e.target.value || undefined })}
                    className={`${inputClass(err('groupBy'))} max-w-[11rem] py-1 text-xs`}
                  >
                    <option value="">{defaultOptionLabel(defaultLineGroupBy(entity), t('date field'), labelOf)}</option>
                    {dateFields(entity).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
                    {widget.groupBy && !dateFields(entity).some(f => f.name === widget.groupBy) && (
                      <option value={widget.groupBy}>{widget.groupBy}</option>
                    )}
                  </select>
                </MiniField>
                <MiniField label={t('Bucket')}>
                  <BucketSelect value={widget.bucket} onChange={bucket => onChange({ bucket })} />
                </MiniField>
              </>
            )}
            {widget.kind === 'top' && (
              <MiniField label={t('Rank by')} hint={t('The largest groups, biggest first')}>
                <select
                  aria-label={t('Rank by')}
                  value={widget.groupBy ?? ''}
                  onChange={e => onChange({ groupBy: e.target.value || undefined })}
                  className={`${inputClass(err('groupBy'))} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(defaultTopGroupBy(entity), t('enum, boolean or relation'), labelOf)}</option>
                  {rankableKeys(entity).map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
                  {widget.groupBy && !rankableKeys(entity).includes(widget.groupBy) && (
                    <option value={widget.groupBy}>{widget.groupBy}</option>
                  )}
                </select>
              </MiniField>
            )}
            {widget.kind !== 'recent' && widget.kind !== 'timeInState' && (
              <MiniField label={t('Measure')} hint={aggHint()}>
                <span className="inline-flex flex-wrap gap-2">
                  <AggFields agg={widget.agg} field={widget.field} entity={entity} error={err('field') ?? err('agg')} onChange={onChange} />
                </span>
              </MiniField>
            )}
            {(widget.kind === 'progress' || widget.kind === 'gauge') && (
              <MiniField label={t('Target')} hint={widget.kind === 'gauge' ? t('The value at which the dial is full') : t('The value the bar fills up to')}>
                <input
                  type="number"
                  min={0}
                  step="any"
                  aria-label={t('Target')}
                  aria-invalid={Boolean(err('target'))}
                  value={widget.target ?? ''}
                  placeholder={t('e.g. 1000')}
                  onChange={e => onChange({ target: e.target.value || undefined })}
                  className={`${inputClass(err('target'))} max-w-[7rem] py-1 text-xs`}
                />
              </MiniField>
            )}
            {widget.kind === 'kpi' && (
              <label
                className={`inline-flex items-center gap-1 pb-1 text-xs ${dateRange ? 'text-on-surface' : 'text-secondary/60'}`}
                title={dateRange ? t('Show the change against the previous period') : t('Turn on the period picker to compare periods')}
              >
                <input
                  type="checkbox"
                  checked={Boolean(widget.compare)}
                  disabled={!dateRange && !widget.compare}
                  onChange={e => onChange({ compare: e.target.checked || undefined })}
                />
                {t('vs previous period')}
              </label>
            )}
            {widget.kind === 'kpi' && (
              <MiniField label={t('Trend line')} hint={dateRange ? t('Over the picked period, under the number') : t('A small line under the number')}>
                <select
                  aria-label={t('Trend line')}
                  aria-invalid={Boolean(err('trend'))}
                  value={widget.trend ?? ''}
                  disabled={!widget.trend && dateFields(entity).length === 0}
                  title={dateFields(entity).length === 0 ? t('{entity} has no date field to plot over time', { entity: entity?.name ?? t('The entity') }) : undefined}
                  onChange={e => onChange({ trend: (e.target.value || undefined) as FullstackWidgetDef['trend'] })}
                  className={`${inputClass(err('trend'))} max-w-[8rem] py-1 text-xs`}
                >
                  <option value="">{t('None')}</option>
                  <option value="day">{t('Per day')}</option>
                  <option value="month">{t('Per month')}</option>
                  <option value="year">{t('Per year')}</option>
                </select>
              </MiniField>
            )}
            {widget.kind === 'kpi' && widget.trend && !dateRange && (
              <MiniField label={t('Trend over')} hint={t('The date it plots over')}>
                <select
                  aria-label={t('Trend date field')}
                  aria-invalid={Boolean(err('dateField'))}
                  value={widget.dateField ?? ''}
                  onChange={e => onChange({ dateField: e.target.value || undefined })}
                  className={`${inputClass(err('dateField'))} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(dateFields(entity)[0]?.name, t('date field'), labelOf)}</option>
                  {dateFields(entity).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
                  {widget.dateField && !dateFields(entity).some(f => f.name === widget.dateField) && (
                    <option value={widget.dateField}>{widget.dateField}</option>
                  )}
                </select>
              </MiniField>
            )}
          </div>
        </fieldset>

        <fieldset className="min-w-0 space-y-1.5">
          <legend className="text-[10px] font-semibold uppercase tracking-wider text-secondary/80">{t('Display')}</legend>
          <div className="flex flex-wrap items-end gap-2">
            <MiniField label={t('Title')} grow>
              <input
                type="text"
                aria-label={t('Widget title')}
                value={widget.title ?? ''}
                maxLength={MAX_TITLE}
                placeholder={t('Optional — named after the data')}
                onChange={e => onChange({ title: e.target.value || undefined })}
                className={`${inputClass()} min-w-[8rem] w-full py-1 text-xs`}
              />
            </MiniField>
            <MiniField label={t('Width')} hint={t('Columns of 4 · default {n}', { n: fallbackSpan })}>
              <SpanPicker span={span} fallback={fallbackSpan} onChange={s => onChange({ span: s })} />
            </MiniField>
            <DrillToField widget={widget} wi={wi} pages={pages} error={err('drillTo')} onChange={onChange} />
            {(widget.kind === 'recent' || widget.kind === 'top') && (
              <MiniField label={t('Rows')} hint={`1–${MAX_RECENT_LIMIT}`}>
                <input
                  type="number"
                  min={1}
                  max={MAX_RECENT_LIMIT}
                  aria-label={t('How many rows')}
                  value={widget.limit ?? ''}
                  placeholder="5"
                  onChange={e => onChange({ limit: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className={`${inputClass(err('limit'))} w-[4.5rem] py-1 text-xs`}
                />
              </MiniField>
            )}
            {widget.kind === 'recent' && (
              <MiniField label={t('Newest by')} hint={t('Ordered by this, newest first')}>
                <select
                  aria-label={t('Sort by')}
                  value={widget.sortBy ?? ''}
                  onChange={e => onChange({ sortBy: e.target.value || undefined })}
                  className={`${inputClass()} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(pk, t('key'), labelOf)}</option>
                  {(entity?.fields ?? []).filter(f => !f.primaryKey && isSortableType(f.type)).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
                  {auditOn(entity, projectOpts) && (
                    <>
                      <option value="createdAt">{t('Created at (createdAt)')}</option>
                      <option value="updatedAt">{t('Last changed (updatedAt)')}</option>
                    </>
                  )}
                </select>
              </MiniField>
            )}
            {dateRange && (
              <MiniField label={t('Period applies to')} hint={t('The date the picker limits')}>
                {dates.length === 0 ? (
                  <p className="py-1 text-[11px] text-secondary">{t('No filterable date — all rows')}</p>
                ) : (
                  <select
                    aria-label={t('Period date field')}
                    value={widget.dateField ?? ''}
                    onChange={e => onChange({ dateField: e.target.value || undefined })}
                    className={`${inputClass()} max-w-[11rem] py-1 text-xs`}
                  >
                    <option value="">{defaultOptionLabel(dates[0]?.name, t('date field'), labelOf)}</option>
                    {dates.map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
                  </select>
                )}
              </MiniField>
            )}
          </div>
        </fieldset>

        <div className="min-w-0 @md:col-span-2">
          <PresetFilters
            filter={widget.presetFilter}
            entity={entity}
            errors={filterErrors}
            controlPrefix={filterPrefix}
            onChange={presetFilter => onChange({ presetFilter })}
            heading={t('Only rows where')}
          />
        </div>
      </div>
      )}
      {messages.map(m => <p key={m} className="text-[11px] text-error">{m}</p>)}
    </div>
  )
}

/** Where a widget's clicks (a bar, a slice, a point, a ranked row, the tile) and its "View all"
 *  go: by default the entity's own list, or a visible list or report page of the same entity.
 *  Hidden while the entity has no such page (and none is set). */
function DrillToField({ widget, wi, pages, error, onChange }: {
  widget: FullstackWidgetDef
  wi: number
  pages: FullstackPageDef[]
  error?: string
  onChange: (patch: Partial<FullstackWidgetDef>) => void
}) {
  const targets = drillToPages(pages, widget.entity)
  const current = widget.drillTo
  if (targets.length === 0 && !current) return null
  const known = targets.some(p => p.id === current)
  return (
    <div data-control={`widget.${wi}.drillTo`}>
      <MiniField label={t('Clicks open')} hint={t('Where its clicks and View all go')}>
        <select
          aria-label={t('Clicks open')}
          aria-invalid={Boolean(error)}
          value={current ?? ''}
          onChange={e => onChange({ drillTo: e.target.value || undefined })}
          className={`${inputClass(error)} max-w-[12rem] py-1 text-xs`}
        >
          <option value="">{t('Automatic (the entity’s list)')}</option>
          {targets.map(p => <option key={p.id} value={p.id}>{pageLabel(p)}{p.type === 'report' ? ` ${t('(report)')}` : ''}</option>)}
          {current && !known && <option value={current}>{current} {t('(not available)')}</option>}
        </select>
      </MiniField>
    </div>
  )
}
