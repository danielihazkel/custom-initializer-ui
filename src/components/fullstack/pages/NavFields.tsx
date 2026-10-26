import type { FullstackNavIcon, FullstackPageDef } from '../../../types'
import { inputClass } from '../controls'
import { DEFAULT_NAV_ICON, MAX_GROUP, NAV_ICONS } from '../pageLayout'
import type { FormProps } from './formTypes'
import { Field } from './fields'

/** Where a nav page sits in the generated nav: its section (group) and its icon. */
export function NavFields({ page, index, pages, errors, update }: Omit<FormProps, 'entities' | 'lossy'> & { pages: FullstackPageDef[] }) {
  const groups = [...new Set(pages.map(p => p.group?.trim()).filter((g): g is string => Boolean(g)))]
  const fallback = DEFAULT_NAV_ICON[page.type]
  const current = page.icon ?? fallback
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <Field label="Nav group" error={errors.group} control="group" hint={`Pages with the same group are listed together · up to ${MAX_GROUP} characters`}>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="text"
            list={`nav-groups-${index}`}
            aria-label="Nav group"
            aria-invalid={Boolean(errors.group)}
            maxLength={MAX_GROUP}
            value={page.group ?? ''}
            onChange={e => update(index, { group: e.target.value || undefined })}
            placeholder="None"
            className={`${inputClass(errors.group)} min-w-0 flex-1`}
          />
          {groups.some(g => g !== page.group?.trim()) && (
            <select
              aria-label="Move to group"
              value={groups.includes(page.group?.trim() ?? '') ? page.group!.trim() : ''}
              onChange={e => update(index, { group: e.target.value || undefined })}
              className={`${inputClass()} max-w-[10rem] py-1 text-xs`}
              title="Put this page in one of the existing groups"
            >
              <option value="">No group</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
        </div>
        <datalist id={`nav-groups-${index}`}>
          {groups.map(g => <option key={g} value={g} />)}
        </datalist>
      </Field>
      <Field label="Nav icon" error={errors.icon} control="icon">
        <div role="radiogroup" aria-label="Nav icon" className="flex flex-wrap gap-1">
          {(Object.keys(NAV_ICONS) as FullstackNavIcon[]).map(name => {
            const selected = current === name
            const label = `${NAV_ICONS[name].label}${name === fallback ? ' (default)' : ''}`
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label}
                title={label}
                data-nav-icon={name}
                onClick={() => update(index, { icon: name === fallback ? undefined : name })}
                className={`rounded p-1 transition-colors ${selected ? 'bg-primary/15 text-primary ring-1 ring-primary/40' : 'text-secondary hover:bg-primary/5 hover:text-primary'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">{NAV_ICONS[name].symbol}</span>
              </button>
            )
          })}
        </div>
      </Field>
    </div>
  )
}
