import { inputClass } from '../controls'
import { enumValueOption, fieldOption, keyOption } from '../fieldOptions'
import {
  DEFAULT_LANE_SIZE, LANE_SIZES, MAX_CARD_FIELDS, MAX_WIP_LIMIT, cardFieldOptions, defaultCardFields,
  defaultLaneField, laneFields, laneValues,
} from '../newPageTypes'
import { defaultOptionLabel, pageLabel } from '../pageLayout'
import type { FormProps } from './formTypes'
import { SMALL_BUTTON } from './constants'
import { EntitySelect, Field, PresetFilters } from './fields'

export function BoardForm({ page, index, entities, errors, update, lossy }: FormProps) {
  const entity = entities.find(e => e.name === page.entity)
  const lane = page.laneField ?? defaultLaneField(entity)
  const laneField = entity?.fields.find(f => f.name === lane)
  const values = laneValues(entity, lane)
  const lanes = page.lanes ?? values
  const cards = page.cardFields ?? defaultCardFields(entity, lane)
  const options = cardFieldOptions(entity)
  const labelOf = (key: string) => keyOption(entity, key)
  const setLanes = (next: string[]) => {
    // Every value ticked is the default — leave it off the request.
    const ordered = values.filter(v => next.includes(v))
    const limits = Object.fromEntries(Object.entries(page.wipLimits ?? {}).filter(([k]) => ordered.includes(k)))
    update(index, { lanes: ordered.length === values.length ? undefined : ordered, wipLimits: Object.keys(limits).length ? limits : undefined })
  }
  const setLimit = (value: string, raw: string) => {
    const n = Number(raw)
    const next = { ...(page.wipLimits ?? {}) }
    if (raw === '' || !Number.isFinite(n)) delete next[value]
    else next[value] = Math.max(1, Math.min(MAX_WIP_LIMIT, Math.round(n)))
    update(index, { wipLimits: Object.keys(next).length ? next : undefined })
  }
  const toggleCard = (name: string) => {
    const next = cards.includes(name) ? cards.filter(c => c !== name) : [...cards, name]
    if (next.length === 0 || next.length > MAX_CARD_FIELDS) return
    update(index, { cardFields: next })
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Entity" error={errors.entity} control="entity">
          <EntitySelect
            label="Board entity"
            value={page.entity ?? ''}
            options={entities.filter(e => laneFields(e).length > 0).map(e => e.name)}
            error={errors.entity}
            onChange={name => {
              const next = entities.find(e => e.name === name)
              const dropped = [page.lanes && 'lanes', page.wipLimits && 'lane limits', page.cardFields && 'card fields', page.sort && 'sort',
                Object.keys(page.presetFilter ?? {}).length > 0 && 'filter'].filter((d): d is string => Boolean(d))
              lossy(`Showed ${name} in “${pageLabel(page)}”`, dropped)
              update(index, { entity: name, laneField: defaultLaneField(next), lanes: undefined, wipLimits: undefined, cardFields: undefined, sort: undefined, presetFilter: undefined })
            }}
          />
        </Field>
        <Field label="Lanes by" error={errors.laneField} control="laneField" hint="Each lane is one value; moving a card sets it">
          <select
            aria-label="Lane field"
            value={page.laneField ?? ''}
            onChange={e => update(index, { laneField: e.target.value || undefined, lanes: undefined, wipLimits: undefined })}
            className={`${inputClass(errors.laneField)} w-full py-1 text-xs`}
          >
            <option value="">{defaultOptionLabel(defaultLaneField(entity), 'enum or yes/no field', labelOf)}</option>
            {laneFields(entity).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
          </select>
        </Field>
        <Field label="Cards loaded per lane" error={errors.laneSize} control="laneSize" hint="“Load more” fetches the next ones">
          <select
            aria-label="Cards per lane"
            value={page.laneSize ?? DEFAULT_LANE_SIZE}
            onChange={e => update(index, { laneSize: Number(e.target.value) === DEFAULT_LANE_SIZE ? undefined : Number(e.target.value) })}
            className={`${inputClass(errors.laneSize)} w-full py-1 text-xs`}
          >
            {LANE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Lanes and limits" error={errors.lanes ?? errors.wipLimits} control="lanes" hint="A limit refuses cards past it and marks the lane when it is full">
        <div className="space-y-1">
          {values.map(v => {
            const on = lanes.includes(v)
            return (
              <div key={v} className="flex items-center gap-2 text-xs">
                <label className="flex min-w-[10rem] items-center gap-1.5">
                  <input type="checkbox" checked={on} onChange={() => setLanes(on ? lanes.filter(x => x !== v) : [...lanes, v])} disabled={on && lanes.length === 1} />
                  {enumValueOption(laneField, v)}
                </label>
                {on && (
                  <input
                    type="number"
                    min={1}
                    max={MAX_WIP_LIMIT}
                    aria-label={`Most cards in ${v}`}
                    placeholder="No limit"
                    value={page.wipLimits?.[v] ?? ''}
                    onChange={e => setLimit(v, e.target.value)}
                    className={`${inputClass()} w-24 py-0.5 text-xs`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </Field>
      <Field label="A card shows" error={errors.cardFields} control="cardFields" hint={`1–${MAX_CARD_FIELDS} fields, in the order picked; the first is its heading`}>
        <div className="flex flex-wrap gap-1.5">
          {options.map(name => {
            const at = cards.indexOf(name)
            return (
              <button
                key={name}
                type="button"
                aria-pressed={at >= 0}
                onClick={() => toggleCard(name)}
                disabled={at < 0 && cards.length >= MAX_CARD_FIELDS}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40 ${at >= 0 ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-secondary hover:border-primary/50'}`}
              >
                {at >= 0 && <span className="me-1 tabular-nums">{at + 1}</span>}{labelOf(name)}{at === 0 ? ' · heading' : ''}
              </button>
            )
          })}
          {page.cardFields && (
            <button type="button" onClick={() => update(index, { cardFields: undefined })} className={SMALL_BUTTON}>Reset to default</button>
          )}
        </div>
      </Field>
      <Field label="Cards sorted by" error={errors.sort} control="sort">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Card sort"
            value={page.sort?.field ?? ''}
            onChange={e => update(index, { sort: e.target.value ? { field: e.target.value, dir: page.sort?.dir ?? 'asc' } : undefined })}
            className={`${inputClass(errors.sort)} max-w-[12rem] py-1 text-xs`}
          >
            <option value="">The key (default)</option>
            {(entity?.fields ?? []).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
          </select>
          {page.sort?.field && (
            <select
              aria-label="Card sort direction"
              value={page.sort.dir ?? 'asc'}
              onChange={e => update(index, { sort: { field: page.sort!.field, dir: e.target.value as 'asc' | 'desc' } })}
              className={`${inputClass()} max-w-[8rem] py-1 text-xs`}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          )}
        </div>
      </Field>
      <PresetFilters filter={page.presetFilter} entity={entity} errors={errors} onChange={presetFilter => update(index, { presetFilter })} heading="Only cards with" />
    </div>
  )
}
