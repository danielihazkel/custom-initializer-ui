import type { FullstackInboxQueue } from '../../../types'
import { inputClass } from '../controls'
import { fieldOption, keyOption } from '../fieldOptions'
import { DEFAULT_INBOX_QUEUES, INBOX_QUEUES, MAX_CARD_FIELDS, cardFieldOptions, defaultInboxFields, hasInbox } from '../newPageTypes'
import { pageLabel } from '../pageLayout'
import type { FormProps } from './formTypes'
import { SMALL_BUTTON } from './constants'
import { EntitySelect, Field, PresetFilters } from './fields'

/** An inbox page: its entity (one whose workflow assigns rows), its queues, columns, sort and filter. */
export function InboxForm({ page, index, entities, errors, update, lossy }: FormProps) {
  const entity = entities.find(e => e.name === page.entity)
  const queues = page.queues ?? DEFAULT_INBOX_QUEUES
  const cards = page.cardFields ?? defaultInboxFields(entity)
  const wf = entity?.workflow
  const options = cardFieldOptions(entity).filter(n => n !== wf?.statusField && n !== wf?.assigneeField && n !== wf?.dueField)
  const labelOf = (key: string) => keyOption(entity, key)
  const setQueues = (next: FullstackInboxQueue[]) => {
    if (next.length === 0) return
    update(index, { queues: JSON.stringify(next) === JSON.stringify(DEFAULT_INBOX_QUEUES) ? undefined : next })
  }
  const toggleCard = (name: string) => {
    const next = cards.includes(name) ? cards.filter(c => c !== name) : [...cards, name]
    if (next.length === 0 || next.length > MAX_CARD_FIELDS) return
    update(index, { cardFields: next })
  }
  return (
    <div className="space-y-3">
      <Field label="Entity" error={errors.entity} control="entity" hint="An entity whose workflow assigns rows to users">
        <EntitySelect
          label="Inbox entity"
          value={page.entity ?? ''}
          options={entities.filter(hasInbox).map(e => e.name)}
          error={errors.entity}
          onChange={name => {
            const dropped = [page.cardFields && 'columns', page.sort && 'sort', Object.keys(page.presetFilter ?? {}).length > 0 && 'filter']
              .filter((d): d is string => Boolean(d))
            lossy(`Listed ${name} in “${pageLabel(page)}”`, dropped)
            update(index, { entity: name, cardFields: undefined, sort: undefined, presetFilter: undefined })
          }}
        />
      </Field>
      <Field label="Queues" error={errors.queues} control="queues" hint="Tabs, in the order picked; the first opens">
        <div className="flex flex-wrap gap-1.5">
          {INBOX_QUEUES.map(q => {
            const at = queues.indexOf(q.value)
            return (
              <button
                key={q.value}
                type="button"
                aria-pressed={at >= 0}
                disabled={at >= 0 && queues.length === 1}
                onClick={() => setQueues(at >= 0 ? queues.filter(x => x !== q.value) : [...queues, q.value])}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 ${at >= 0 ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-secondary hover:border-primary/50'}`}
              >
                {at >= 0 && <span className="me-1 tabular-nums">{at + 1}</span>}{q.label}
              </button>
            )
          })}
        </div>
      </Field>
      <Field label="A row shows" error={errors.cardFields} control="cardFields"
             hint={`1–${MAX_CARD_FIELDS} fields before the status, assignee${wf?.dueField ? ' and due date' : ''}; the first names the row`}>
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
                {at >= 0 && <span className="me-1 tabular-nums">{at + 1}</span>}{labelOf(name)}
              </button>
            )
          })}
          {page.cardFields && (
            <button type="button" onClick={() => update(index, { cardFields: undefined })} className={SMALL_BUTTON}>Reset to default</button>
          )}
        </div>
      </Field>
      <Field label="Sorted by" error={errors.sort} control="sort">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Inbox sort"
            value={page.sort?.field ?? ''}
            onChange={e => update(index, { sort: e.target.value ? { field: e.target.value, dir: page.sort?.dir ?? 'asc' } : undefined })}
            className={`${inputClass(errors.sort)} max-w-[12rem] py-1 text-xs`}
          >
            <option value="">{wf?.dueField ? 'Soonest due (default)' : 'Newest (default)'}</option>
            {(entity?.fields ?? []).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
          </select>
          {page.sort?.field && (
            <select
              aria-label="Inbox sort direction"
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
      <PresetFilters filter={page.presetFilter} entity={entity} errors={errors} onChange={presetFilter => update(index, { presetFilter })} heading="Only tasks with" />
    </div>
  )
}
