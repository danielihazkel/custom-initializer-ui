import type { FullstackDateRange, FullstackPageDef } from '../../../types'
import { inputClass } from '../controls'
import { fieldOption, relationOption } from '../fieldOptions'
import { DATE_RANGES, REFRESH_CHOICES, reloads, MAX_DASHBOARD_FILTERS, dashboardFilterCandidates, pageLabel, stripDateRange } from '../pageLayout'
import type { FormProps } from './formTypes'
import { Field } from './fields'
import { t } from '../../../i18n'

/**
 * A dashboard page's own settings: its period picker, its refresh and its filters. The widgets
 * are not here — they are added, ordered and removed on the designer's canvas, and one widget's
 * settings are `WidgetCard`, in the inspector.
 */
export function DashboardForm({ page, index, entities, errors, update, lossy }: FormProps) {
  return (
    <div className="space-y-2">
      <Field
        label={t('Period picker')}
        error={errors.dateRange}
        control="dateRange"
        hint={page.dateRange ? t('The dashboard opens on this period; widgets with a date follow the picker') : t('Off — every widget covers all rows')}
      >
        <select
          aria-label={t('Period picker')}
          aria-invalid={Boolean(errors.dateRange)}
          value={page.dateRange ?? ''}
          onChange={e => {
            if (e.target.value) {
              update(index, { dateRange: e.target.value as FullstackDateRange })
              return
            }
            // A widget's date field and comparison only mean something under a picker.
            const { patch, dropped } = stripDateRange(page)
            lossy(t('Switched the period picker off on “{page}”', { page: pageLabel(page) }), dropped)
            update(index, patch)
          }}
          className={`${inputClass(errors.dateRange)} max-w-[14rem]`}
        >
          <option value="">{t('Off')}</option>
          {DATE_RANGES.map(r => <option key={r.value} value={r.value}>{t('Opens on: {period}', { period: r.label })}</option>)}
        </select>
      </Field>
      <Field
        label={t('Auto-refresh')}
        error={errors.refreshSeconds}
        control="refreshSeconds"
        hint={(page.widgets ?? []).some(reloads)
          ? page.refreshSeconds ? t('The widgets reload on this timer while the page is open; Refresh reloads them any time') : t('Off — the generated Refresh button reloads the widgets')
          : t('Add a widget that shows data first')}
      >
        <select
          aria-label={t('Auto-refresh')}
          aria-invalid={Boolean(errors.refreshSeconds)}
          value={page.refreshSeconds ?? ''}
          disabled={!(page.widgets ?? []).some(reloads) && page.refreshSeconds == null}
          onChange={e => update(index, { refreshSeconds: e.target.value ? Number(e.target.value) : undefined })}
          className={`${inputClass(errors.refreshSeconds)} max-w-[14rem]`}
        >
          <option value="">{t('Off')}</option>
          {REFRESH_CHOICES.map(r => <option key={r.value} value={r.value}>{t('Reload {every}', { every: r.label })}</option>)}
        </select>
      </Field>
      <DashboardFilters page={page} entities={entities} error={errors.filters} onChange={filters => update(index, { filters })} />
    </div>
  )
}

/** The dashboard's filters: one chip per enum, boolean or relation its widgets' entities can all be
 *  filtered by with one control (at most four). A filter no widget takes any more stays listed, so
 *  it can be dropped. Hidden while there is nothing to offer. */
function DashboardFilters({ page, entities, error, onChange }: {
  page: FullstackPageDef
  entities: FormProps['entities']
  error?: string
  onChange: (filters: string[] | undefined) => void
}) {
  const chosen = page.filters ?? []
  const candidates = dashboardFilterCandidates(page, entities)
  const lower = (s: string) => s.trim().toLowerCase()
  const stale = chosen.filter(name => !candidates.some(c => lower(c.name) === lower(name)))
  if (candidates.length === 0 && stale.length === 0) return null
  const atCap = chosen.length >= MAX_DASHBOARD_FILTERS
  const toggle = (name: string, on: boolean) => {
    const next = on ? chosen.filter(k => lower(k) !== lower(name)) : [...chosen, name]
    onChange(next.length ? next : undefined)
  }
  return (
    <Field
      label={t('Filters')}
      error={error}
      control="filters"
      hint={t('One control above the widgets for each, setting every widget whose entity has it (unless the widget fixes it itself) · up to {max}', { max: MAX_DASHBOARD_FILTERS })}
    >
      <ul className="flex flex-wrap gap-1.5" data-dashboard-filters>
        {candidates.map(c => {
          const on = chosen.some(k => lower(k) === lower(c.name))
          const label = c.field ? fieldOption(c.field) : relationOption(c.name)
          const disabled = !on && atCap
          return (
            <li key={c.name}>
              <label
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-outline-variant text-on-surface'} ${disabled ? 'opacity-50' : ''}`}
                title={disabled ? t('A dashboard takes at most {max} filters', { max: MAX_DASHBOARD_FILTERS }) : t('Filters {entities}', { entities: c.entities.join(', ') })}
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={on}
                  disabled={disabled}
                  aria-label={t('Filter by {field}', { field: label })}
                  onChange={() => toggle(c.name, on)}
                />
                {label}
              </label>
            </li>
          )
        })}
        {stale.map((name, i) => (
          <li key={`stale:${i}:${name}`}>
            <label className="inline-flex items-center gap-1.5 rounded-full border border-error/50 px-2 py-0.5 text-[11px] text-error" title={t('None of the widgets can take this filter any more — untick to drop it')}>
              <input
                type="checkbox"
                className="accent-primary"
                checked
                aria-label={t('Filter by {field}', { field: name })}
                onChange={() => toggle(name, true)}
              />
              {name || t('(blank)')}
            </label>
          </li>
        ))}
      </ul>
    </Field>
  )
}
