import type { FullstackCalendarMode } from '../../../types'
import { inputClass } from '../controls'
import { fieldOption, keyOption } from '../fieldOptions'
import { CALENDAR_MODES, calendarDateFields, defaultCalendarDate } from '../newPageTypes'
import { defaultOptionLabel, pageLabel } from '../pageLayout'
import type { FormProps } from './formTypes'
import { EntitySelect, Field, PresetFilters } from './fields'

export function CalendarForm({ page, index, entities, errors, update, lossy }: FormProps) {
  const entity = entities.find(e => e.name === page.entity)
  const dates = calendarDateFields(entity)
  const date = page.dateField ?? defaultCalendarDate(entity)
  const modes = page.modes ?? ['month']
  const setModes = (next: FullstackCalendarMode[]) => update(index, { modes: next })
  const toggle = (mode: FullstackCalendarMode) => {
    if (modes.includes(mode)) {
      if (modes.length > 1) setModes(modes.filter(m => m !== mode))
    } else {
      setModes(CALENDAR_MODES.map(m => m.value).filter(m => m === mode || modes.includes(m)))
    }
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 @sm:grid-cols-3">
        <Field label="Entity" error={errors.entity} control="entity">
          <EntitySelect
            label="Calendar entity"
            value={page.entity ?? ''}
            options={entities.filter(e => calendarDateFields(e).length > 0).map(e => e.name)}
            error={errors.entity}
            onChange={name => {
              const next = entities.find(e => e.name === name)
              const dropped = [page.endField && 'end date', Object.keys(page.presetFilter ?? {}).length > 0 && 'filter'].filter((d): d is string => Boolean(d))
              lossy(`Showed ${name} in “${pageLabel(page)}”`, dropped)
              update(index, { entity: name, dateField: defaultCalendarDate(next), endField: undefined, presetFilter: undefined, modes: modes.filter(m => m !== 'timeline').length ? modes.filter(m => m !== 'timeline') : ['month'] })
            }}
          />
        </Field>
        <Field label="Placed by" error={errors.dateField} control="dateField" hint="The date a row sits on; the page loads only the period on screen">
          <select
            aria-label="Date field"
            value={page.dateField ?? ''}
            onChange={e => update(index, { dateField: e.target.value || undefined })}
            className={`${inputClass(errors.dateField)} w-full py-1 text-xs`}
          >
            <option value="">{defaultOptionLabel(defaultCalendarDate(entity), 'filterable date', k => keyOption(entity, k))}</option>
            {dates.map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
          </select>
        </Field>
        <Field label="Ends on" error={errors.endField} control="endField" hint="Optional — a row then spans its days, and the timeline draws it as a bar">
          <select
            aria-label="End date field"
            value={page.endField ?? ''}
            onChange={e => {
              const endField = e.target.value || undefined
              update(index, { endField, ...(endField ? {} : { modes: modes.filter(m => m !== 'timeline').length ? modes.filter(m => m !== 'timeline') : ['month'] }) })
            }}
            className={`${inputClass(errors.endField)} w-full py-1 text-xs`}
          >
            <option value="">None — one day each</option>
            {dates.filter(f => f.name !== date).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Views" error={errors.modes} control="modes" hint="The first ticked view opens; the others are a switch above the calendar">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Calendar views">
          {CALENDAR_MODES.map(m => {
            const on = modes.includes(m.value)
            const blocked = m.value === 'timeline' && !page.endField
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={on}
                disabled={blocked && !on}
                title={blocked && !on ? 'Pick an end date first — a timeline bar runs from one date to the other' : undefined}
                onClick={() => toggle(m.value)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40 ${on ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-secondary hover:border-primary/50'}`}
              >
                {m.label}{on && modes[0] === m.value && modes.length > 1 ? ' · opens' : ''}
              </button>
            )
          })}
        </div>
      </Field>
      <PresetFilters filter={page.presetFilter} entity={entity} errors={errors} onChange={presetFilter => update(index, { presetFilter })} heading="Only rows with" />
    </div>
  )
}
