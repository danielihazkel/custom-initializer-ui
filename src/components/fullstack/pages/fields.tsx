import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { FullstackAgg, FullstackBucket, FullstackEntityDef, FullstackFieldDef, FullstackListSort, FullstackPageRole } from '../../../types'
import { inputClass } from '../controls'
import { enumValueOption, fieldOption, relationOption } from '../fieldOptions'
import { moveItem } from '../reorder'
import { useDragReorder } from '../useDragReorder'
import {
  MAX_GROUP, MAX_SPAN, PAGE_ROLES, defaultPresetValue, parsePresetRange, PRESET_PERIODS, presetKind,
  presettableFields, listColumns, numericFields, sortableKeys, valuesOf,
} from '../pageLayout'
import type { FormProps } from './formTypes'
import { ICON_BUTTON, SMALL_BUTTON } from './constants'

/** Who may open the page: everyone, or users holding one of the generated security's roles. Always shown, so the option is discoverable: without an LDAP auth
 *  dependency the boxes are disabled and a shortcut adds ldap-auth-rest. */
export function RolesField({ page, index, errors, update, ldapAuth, onAddDep, isStart }: Omit<FormProps, 'entities' | 'lossy'> & { ldapAuth?: boolean; onAddDep?: (dep: string) => void; isStart?: boolean }) {
  const roles = page.roles ?? []
  const noLdap = ldapAuth === false
  // The start page is open to everyone; the boxes stay live on a start page that already has
  // roles (from a load), so the user can clear them.
  const locked = Boolean(isStart) && roles.length === 0
  const toggle = (role: FullstackPageRole) => {
    const next = roles.includes(role) ? roles.filter(r => r !== role) : [...roles, role]
    update(index, { roles: next.length ? next : undefined })
  }
  return (
    <Field
      label="Who can open it"
      error={errors.roles}
      control="roles"
      hint={roles.length
        ? 'Hidden from the nav, and blocked, for users without one of these roles (checked against their LDAP groups)'
        : locked ? 'The start page is open to everyone — make another page the start page to restrict this one'
          : noLdap ? 'Restricting pages needs ldap-auth-rest (or ldap-auth) among the backend dependencies'
            : 'Everyone — tick a role to restrict the page'}
    >
      <div className="flex flex-wrap items-center gap-3">
        {PAGE_ROLES.map(role => (
          <label key={role} className={`inline-flex items-center gap-1.5 text-xs ${(noLdap || locked) && !roles.includes(role) ? 'text-secondary/70' : 'text-on-surface'}`}>
            <input
              type="checkbox"
              checked={roles.includes(role)}
              disabled={(noLdap || locked) && !roles.includes(role)}
              onChange={() => toggle(role)}
              className="accent-primary"
              aria-label={`Only ${role}`}
            />
            {role === 'ADMIN' ? 'Admins' : 'Users'} <span className="font-mono text-[10px] text-secondary">{role}</span>
          </label>
        ))}
        {noLdap && !locked && onAddDep && (
          <button type="button" onClick={() => onAddDep('ldap-auth-rest')} className={SMALL_BUTTON} data-add-ldap-auth>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">add</span>
            Add ldap-auth-rest
          </button>
        )}
      </div>
    </Field>
  )
}

/** One nav section in the strip: its name is edited in place (committed on blur or Enter, Escape
 *  reverts) and it moves past its neighbours with the arrows. */
export function GroupChip({ group, count, canUp, canDown, onRename, onMove }: {
  group: string
  count: number
  canUp: boolean
  canDown: boolean
  onRename: (to: string) => void
  onMove: (delta: number) => void
}) {
  const [draft, setDraft] = useState(group)
  useEffect(() => setDraft(group), [group])
  const commit = () => {
    const to = draft.trim()
    if (to && to !== group) onRename(to)
    else setDraft(group)
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-[11px]" data-nav-group={group}>
      <input
        type="text"
        aria-label={`Rename the ${group} group`}
        title="Rename this group on every page in it"
        value={draft}
        maxLength={MAX_GROUP}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
          if (e.key === 'Escape') setDraft(group)
        }}
        style={{ width: `${Math.max(4, draft.length + 1)}ch` }}
        className="bg-transparent font-semibold text-on-surface outline-none focus:underline"
      />
      <span className="text-secondary">{count}</span>
      <MoveButtons label={`the ${group} group`} canUp={canUp} canDown={canDown} onMove={onMove} />
    </span>
  )
}

/** Up/down buttons — the keyboard alternative to dragging a row. */
export function MoveButtons({ label, canUp, canDown, onMove }: { label: string; canUp: boolean; canDown: boolean; onMove: (delta: number) => void }) {
  return (
    <span className="inline-flex shrink-0 flex-col">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={!canUp}
        className="leading-none text-secondary/70 hover:text-primary disabled:opacity-20"
        aria-label={`Move ${label} up`}
        title="Move up"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>keyboard_arrow_up</span>
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={!canDown}
        className="leading-none text-secondary/70 hover:text-primary disabled:opacity-20"
        aria-label={`Move ${label} down`}
        title="Move down"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>keyboard_arrow_down</span>
      </button>
    </span>
  )
}

/** The "opens filtered on" rows of a list, report or widget: a value of a filterable enum/boolean
 *  column, or a period/range on a date or number column — what the backend accepts as a preset. */
export function PresetFilters({ filter, entity, errors, onChange, heading = 'Opens filtered on', controlPrefix = 'presetFilter.' }: {
  filter: Record<string, string> | undefined
  entity: FullstackEntityDef | undefined
  /** Per-field messages under `presetFilter.<field>`. */
  errors: Record<string, string>
  onChange: (next: Record<string, string> | undefined) => void
  heading?: string
  /** The `data-control` prefix a problem reveals — a widget's filters live under its own. */
  controlPrefix?: string
}) {
  const filterable = presettableFields(entity)
  const filters = Object.entries(filter ?? {})
  const unused = filterable.filter(f => !(f.name in (filter ?? {})))

  function setFilter(field: string, value: string | null, rename?: string) {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(filter ?? {})) {
      if (k !== field) next[k] = v
      else if (value !== null) next[rename ?? k] = value
    }
    if (!(field in (filter ?? {})) && value !== null) next[field] = value
    onChange(Object.keys(next).length ? next : undefined)
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">{heading}</p>
      {filters.length === 0 && (
        <p className="text-[11px] text-secondary">
          {filterable.length === 0
            ? `Every row — ${entity?.name ?? 'this entity'} has no filterable enum, boolean, date or number field to preset.`
            : 'Every row (no preset filter).'}
        </p>
      )}
      {filters.map(([field, value]) => {
        const f = filterable.find(x => x.name === field)
        const error = errors[`presetFilter.${field}`]
        return (
          <div key={field} className="flex items-center gap-2" data-preset-filter={field} data-control={`${controlPrefix}${field}`}>
            <select
              aria-label="Filter field"
              aria-invalid={Boolean(error)}
              value={field}
              onChange={e => setFilter(field, value, e.target.value)}
              className={`${inputClass(error)} max-w-[12rem] py-1 text-xs`}
            >
              <option value={field}>{f ? fieldOption(f) : field}</option>
              {unused.map(o => <option key={o.name} value={o.name}>{fieldOption(o)}</option>)}
            </select>
            {f && presetKind(f) !== 'choice' ? (
              <PresetRangeInput field={f} value={value} error={error} onChange={v => setFilter(field, v)} />
            ) : (
              <select
                aria-label={`Filter value for ${field}`}
                value={value}
                onChange={e => setFilter(field, e.target.value)}
                className={`${inputClass(error)} max-w-[12rem] py-1 text-xs`}
              >
                {!valuesOf(f).includes(value) && <option value={value}>{value}</option>}
                {valuesOf(f).map(v => <option key={v} value={v}>{enumValueOption(f, v)}</option>)}
              </select>
            )}
            <button
              type="button"
              onClick={() => setFilter(field, null)}
              className={ICON_BUTTON}
              aria-label={`Remove the ${field} filter`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
            {error && <span className="text-[11px] text-error">{error}</span>}
          </div>
        )
      })}
      {unused.length > 0 && (
        <button
          type="button"
          onClick={() => setFilter(unused[0].name, defaultPresetValue(unused[0]))}
          className={SMALL_BUTTON}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>filter_alt</span>
          Add filter
        </button>
      )}
    </div>
  )
}

/** A date field's preset (a period ending today, or two dates) or a number field's (min and max),
 *  edited as controls and stored as the wire spelling (`last:30d`, `2026-01-01..2026-03-31`, `100..500`). */
function PresetRangeInput({ field, value, error, onChange }: {
  field: FullstackFieldDef
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  const kind = presetKind(field)
  const period = PRESET_PERIODS.find(p => p.value === value.trim().toLowerCase())
  const range = parsePresetRange(value) ?? { from: '', to: '' }
  const custom = kind === 'date' && !period
  const box = `${inputClass(error)} w-[9rem] py-1 text-xs`
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-preset-range={field.name}>
      {kind === 'date' && (
        <select
          aria-label={`Filter period for ${field.name}`}
          value={period ? period.value : 'custom'}
          onChange={e => onChange(e.target.value === 'custom' ? `${range.from}..${range.to}` : e.target.value)}
          className={`${inputClass(error)} max-w-[10rem] py-1 text-xs`}
        >
          {PRESET_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          <option value="custom">Between dates…</option>
        </select>
      )}
      {(custom || kind === 'number') && (
        <>
          <input
            type={kind === 'date' ? 'date' : 'number'}
            aria-label={`${kind === 'date' ? 'From date' : 'Min'} for ${field.name}`}
            value={range.from}
            step={kind === 'number' ? 'any' : undefined}
            onChange={e => onChange(`${e.target.value}..${range.to}`)}
            className={box}
          />
          <span className="text-[11px] text-secondary">to</span>
          <input
            type={kind === 'date' ? 'date' : 'number'}
            aria-label={`${kind === 'date' ? 'To date' : 'Max'} for ${field.name}`}
            value={range.to}
            step={kind === 'number' ? 'any' : undefined}
            onChange={e => onChange(`${range.from}..${e.target.value}`)}
            className={box}
          />
        </>
      )}
    </span>
  )
}

/** A widget's width on the four-column grid; its kind's default is stored as nothing. */
export function SpanPicker({ span, fallback, onChange }: { span: number; fallback: number; onChange: (span: number | undefined) => void }) {
  return (
    <div role="radiogroup" aria-label="Widget width" className="inline-flex overflow-hidden rounded border border-outline-variant">
      {Array.from({ length: MAX_SPAN }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={span === n}
          aria-label={`${n} column${n === 1 ? '' : 's'}${n === fallback ? ' (default)' : ''}`}
          onClick={() => onChange(n === fallback ? undefined : n)}
          className={`px-2 py-0.5 text-xs ${span === n ? 'bg-primary/15 font-semibold text-primary' : 'text-secondary hover:bg-primary/5'}`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

/** A small labelled control inside a widget card. */
export function MiniField({ label, hint, grow, children }: { label: string; hint?: string; grow?: boolean; children: ReactNode }) {
  return (
    <div className={`space-y-0.5 ${grow ? 'min-w-[8rem] flex-1' : ''}`}>
      <span className="block text-[10px] font-semibold text-secondary">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-secondary/70">{hint}</span>}
    </div>
  )
}

export function BucketSelect({ value, onChange }: { value: FullstackBucket | undefined; onChange: (bucket: FullstackBucket) => void }) {
  return (
    <select
      aria-label="Bucket"
      value={value ?? 'month'}
      onChange={e => onChange(e.target.value as FullstackBucket)}
      className={`${inputClass()} max-w-[7rem] py-1 text-xs`}
    >
      <option value="day">Per day</option>
      <option value="month">Per month</option>
      <option value="year">Per year</option>
    </select>
  )
}

/** How to reduce the rows, and which numeric column — shared by the dashboard widgets and a
 *  report's chart, because the backend validates both with the same rule. */
export function AggFields({ agg, field, entity, error, onChange }: {
  agg: FullstackAgg | undefined
  field: string | undefined
  entity: FullstackEntityDef | undefined
  error?: string
  onChange: (patch: { agg?: FullstackAgg; field?: string }) => void
}) {
  const numeric = numericFields(entity)
  const reduces = !!agg && agg !== 'count'
  return (
    <>
      <select
        aria-label="Aggregate"
        value={agg ?? 'count'}
        // Going back to a plain count drops the field with it, which the backend requires.
        onChange={e => {
          const next = e.target.value as FullstackAgg
          onChange(next === 'count' ? { agg: undefined, field: undefined } : { agg: next, ...(field ? {} : numeric.length === 1 ? { field: numeric[0].name } : {}) })
        }}
        className={`${inputClass()} max-w-[8rem] py-1 text-xs`}
      >
        <option value="count">Count rows</option>
        <option value="sum" disabled={numeric.length === 0}>Sum of…</option>
        <option value="avg" disabled={numeric.length === 0}>Average of…</option>
        <option value="min" disabled={numeric.length === 0}>Lowest…</option>
        <option value="max" disabled={numeric.length === 0}>Highest…</option>
      </select>
      {reduces && (
        <select
          aria-label="Value field"
          aria-invalid={Boolean(error)}
          value={field ?? ''}
          onChange={e => onChange({ field: e.target.value || undefined })}
          className={`${inputClass(error)} max-w-[9rem] py-1 text-xs`}
        >
          <option value="">Pick a number…</option>
          {numeric.map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
          {field && !numeric.some(f => f.name === field) && <option value={field}>{field}</option>}
        </select>
      )}
    </>
  )
}

/** The grip that starts a drag of a row in `list` (the row itself is the drop target). */
export function DragGrip({ dnd, list, index }: { dnd: ReturnType<typeof useDragReorder>; list: string; index: number }) {
  return (
    <span {...dnd.handleProps(list, index)} className="cursor-grab select-none text-secondary/70 hover:text-secondary" title="Drag to reorder" aria-hidden="true">
      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>drag_indicator</span>
    </span>
  )
}

/**
 * How an embedded list opens — a record's related list, a master–detail child: its columns (chips,
 * on or off; the shown ones in their order, each movable earlier) and its sort. Folded unless
 * something is set; absent parts are the list's own defaults.
 */
export function ListOptions({ label, entity, projectOpts, columns, sort, onChange }: {
  label: string
  entity: FullstackEntityDef | undefined
  projectOpts: string[]
  columns?: string[]
  sort?: FullstackListSort
  onChange: (patch: { columns?: string[]; sort?: FullstackListSort }) => void
}) {
  const all = listColumns(entity, projectOpts)
  const keys = all.map(c => c.key)
  const shown = columns ?? keys
  const summary = [columns ? `${columns.length} column${columns.length === 1 ? '' : 's'}` : null, sort ? `by ${sort.field} ${sort.dir === 'desc' ? '↓' : '↑'}` : null].filter(Boolean).join(' · ')
  // Open on arrival when something is already set, so it is not missed; then the user's to fold.
  const [startOpen] = useState(Boolean(columns || sort))
  // The entity's order is the default: a list back to it drops the setting.
  const keep = (next: string[]) => onChange({ columns: next.join() === keys.join() ? undefined : next, sort })
  const ordered = [...shown.flatMap(k => all.filter(c => c.key === k)), ...all.filter(c => !shown.includes(c.key))]
  return (
    <details className="text-[11px]" data-list-options open={startOpen}>
      <summary className="cursor-pointer select-none text-secondary hover:text-primary">{summary || 'Columns & sort'}</summary>
      <div className="mt-1 space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {ordered.map(c => {
            const on = shown.includes(c.key)
            const at = shown.indexOf(c.key)
            return (
              <span key={c.key} className="inline-flex items-center">
                {on && at > 0 && (
                  <button
                    type="button"
                    onClick={() => keep(moveItem(shown, at, at - 1))}
                    className="rounded-full px-1 text-secondary hover:text-primary"
                    aria-label={`Move the ${c.label} column earlier in the ${label}`}
                    title="Move earlier"
                  >
                    ‹
                  </button>
                )}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`${c.label} column of the ${label}`}
                  disabled={on && shown.length === 1}
                  onClick={() => keep(on ? shown.filter(k => k !== c.key) : [...shown, c.key])}
                  className={`rounded-full px-2 py-0.5 ${on ? 'bg-primary/10 text-primary' : 'border border-dashed border-outline-variant text-secondary'} disabled:opacity-50`}
                >
                  {c.label}
                </button>
              </span>
            )
          })}
        </div>
        <span className="inline-flex items-center gap-1.5">
          <select
            aria-label={`Sort of the ${label}`}
            value={sort?.field ?? ''}
            onChange={e => onChange({ columns, sort: e.target.value ? { field: e.target.value, ...(sort?.dir ? { dir: sort.dir } : {}) } : undefined })}
            className={`${inputClass()} max-w-[11rem] py-0.5 text-[11px]`}
          >
            <option value="">Default order (the key)</option>
            {sortableKeys(entity, projectOpts).map(k => <option key={k} value={k}>{all.find(c => c.key === k)?.label ?? k}</option>)}
          </select>
          {sort && (
            <button
              type="button"
              onClick={() => onChange({ columns, sort: { field: sort.field, ...(sort.dir === 'desc' ? {} : { dir: 'desc' as const }) } })}
              className="rounded border border-outline-variant px-1.5 py-0.5 text-secondary hover:text-primary"
              aria-label={`Sort the ${label} ${sort.dir === 'desc' ? 'ascending' : 'descending'}`}
            >
              {sort.dir === 'desc' ? '↓' : '↑'}
            </button>
          )}
        </span>
      </div>
    </details>
  )
}

export function Field({ label, error, hint, control, children }: { label: string; error?: string; hint?: string; control?: string; children: ReactNode }) {
  return (
    <div className="space-y-1" data-control={control}>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-secondary">{label}</span>
      {children}
      {error ? <p className="text-[11px] text-error">{error}</p> : hint ? <p className="text-[10px] text-secondary">{hint}</p> : null}
    </div>
  )
}

/** Which of a child's several relations to the record entity links them — shown only when there
 *  is a choice. The default (blank) is the first relation, as the generator picks it. */
export function ViaSelect({ label, relations, value, error, onChange }: {
  label: string
  relations: string[]
  value: string | undefined
  error?: string
  onChange: (via: string) => void
}) {
  if (relations.length < 2 && !value) return null
  return (
    <select
      aria-label={label}
      title="Which relation links these rows to the record"
      aria-invalid={Boolean(error)}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className={`${inputClass(error)} max-w-[10rem] py-0.5 text-[11px]`}
    >
      <option value="">via {relations[0] ? relationOption(relations[0]) : '?'} (default)</option>
      {relations.slice(1).map(r => <option key={r} value={r}>via {relationOption(r)}</option>)}
      {value && !relations.includes(value) && <option value={value}>via {value}</option>}
    </select>
  )
}

/** Entity picker that keeps an unknown (renamed away) value visible instead of dropping it. */
/** Entity name → its picker text (label, then name when they differ), for every EntitySelect. */
export const EntityOptions = createContext<ReadonlyMap<string, string>>(new Map())

export function EntitySelect({ label, value, options, error, empty, className, onChange }: {
  label: string
  value: string
  options: string[]
  error?: string
  empty?: string
  className?: string
  onChange: (name: string) => void
}) {
  const text = useContext(EntityOptions)
  return (
    <select
      aria-label={label}
      aria-invalid={Boolean(error)}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`${inputClass(error)} py-1 text-xs ${className ?? ''}`}
    >
      <option value="">{empty ?? '— pick an entity —'}</option>
      {options.map(n => <option key={n} value={n}>{text.get(n) ?? n}</option>)}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
    </select>
  )
}
