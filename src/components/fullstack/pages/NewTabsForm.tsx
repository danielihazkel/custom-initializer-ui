import type { FullstackPageDef } from '../../../types'
import { inputClass } from '../controls'
import { MAX_TABS, MIN_TABS, PAGE_TYPE_META, pageLabel } from '../pageLayout'
import { SMALL_BUTTON } from './constants'

/** The "new tabs page" step: which pages it embeds, its title, and whether they leave the nav. */
export interface TabsFormState {
  picked: string[]
  title: string
  hide: boolean
}

/** The opening state: the first two pages that can be tabs, hidden from the nav. */
export function initialTabsForm(eligible: FullstackPageDef[]): TabsFormState {
  return { picked: eligible.slice(0, MIN_TABS).map(p => p.id), title: 'Tabs', hide: true }
}

/**
 * Asks which pages a new tabs page embeds before adding it — shared by the inline Pages editor
 * and the layout designer, so both add a tabs page the same way.
 */
export function NewTabsForm({ eligible, form, onChange, onAdd, onCancel, className = '' }: {
  /** The pages that can be a tab (`tabCandidates`). */
  eligible: FullstackPageDef[]
  form: TabsFormState
  onChange: (form: TabsFormState) => void
  onAdd: () => void
  onCancel: () => void
  className?: string
}) {
  const count = form.picked.length
  return (
    <div className={`space-y-2 ${className}`} data-tabs-form>
      <p className="text-xs font-semibold text-on-surface">New tabs page</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-secondary" htmlFor="new-tabs-title">Title</label>
        <input
          id="new-tabs-title"
          type="text"
          aria-label="Tabs page title"
          value={form.title}
          onChange={e => onChange({ ...form, title: e.target.value })}
          className={`${inputClass()} max-w-[14rem] py-1 text-xs`}
        />
      </div>
      <p className="text-[11px] text-secondary">Pages to show as tabs, {MIN_TABS} to {MAX_TABS}, in this order:</p>
      <ul className="flex flex-wrap gap-2">
        {eligible.map(p => {
          const on = form.picked.includes(p.id)
          return (
            <li key={p.id}>
              <label className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-outline-variant text-on-surface'}`}>
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={on}
                  aria-label={`Tab: ${pageLabel(p)}`}
                  onChange={() => onChange({ ...form, picked: on ? form.picked.filter(id => id !== p.id) : [...form.picked, p.id] })}
                />
                {pageLabel(p)}
                <span className="text-[10px] text-secondary">{PAGE_TYPE_META[p.type]?.label ?? p.type}</span>
              </label>
            </li>
          )
        })}
      </ul>
      <label className="inline-flex items-center gap-1.5 text-xs text-on-surface">
        <input
          type="checkbox"
          className="accent-primary"
          checked={form.hide}
          aria-label="Hide these pages from the navigation"
          onChange={e => onChange({ ...form, hide: e.target.checked })}
        />
        Hide these pages from the navigation — they open only as tabs
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={count < MIN_TABS || count > MAX_TABS}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary disabled:opacity-50"
          title={count < MIN_TABS ? `Pick at least ${MIN_TABS} pages` : count > MAX_TABS ? `At most ${MAX_TABS} tabs` : undefined}
        >
          Add tabs page
        </button>
        <button type="button" onClick={onCancel} className={SMALL_BUTTON}>Cancel</button>
        <span className="text-[10px] text-secondary">{count} of {MAX_TABS} picked</span>
      </div>
    </div>
  )
}
