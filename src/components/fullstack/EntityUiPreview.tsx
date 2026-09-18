import type { FullstackEntityDef } from '../../types'
import { buildUiPreview, type PreviewControl, type UiPreview } from './uiPreview'

interface Props {
  entity: FullstackEntityDef
  entities: FullstackEntityDef[]
  projectOpts: string[]
  locale: 'en' | 'he'
  rtl: boolean
}

// The generated app's own chrome words, mirroring `i18n-strings.ts.mustache` — enough of them
// to make the mock read like the real page in either language.
const STRINGS = {
  en: {
    newItem: (x: string) => `New ${x}`,
    search: 'Search…',
    export: 'Export',
    filter: 'Filters',
    actions: 'Actions',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    table: 'Table', cards: 'Cards', kanban: 'Kanban', calendar: 'Calendar',
    locked: 'locked after create',
    listCaption: 'List page',
    formCaption: 'Create form',
    readOnly: 'read-only — no New / Edit / Delete',
  },
  he: {
    newItem: (x: string) => `${x} חדש`,
    search: 'חיפוש…',
    export: 'ייצוא',
    filter: 'סינון',
    actions: 'פעולות',
    edit: 'עריכה',
    delete: 'מחיקה',
    save: 'שמירה',
    cancel: 'ביטול',
    table: 'טבלה', cards: 'כרטיסים', kanban: 'קנבן', calendar: 'לוח שנה',
    locked: 'ננעל לאחר יצירה',
    listCaption: 'עמוד רשימה',
    formCaption: 'טופס יצירה',
    readOnly: 'לקריאה בלבד — ללא חדש / עריכה / מחיקה',
  },
} as const

/**
 * A static, client-side picture of the page the generator will build for one entity: the
 * list toolbar and table header, then the create form with one control per field. Nothing here
 * is interactive (every control is disabled) — it exists so labels, control types, required
 * marks, defaults, Hebrew chrome and RTL can be checked without an Explore round-trip.
 */
export function EntityUiPreview({ entity, entities, projectOpts, locale, rtl }: Props) {
  const p = buildUiPreview(entity, { projectOpts, entities })
  const t = STRINGS[locale]
  const mockInput = 'w-full bg-background border border-outline-variant rounded px-2 py-1 text-[11px] text-on-surface/70'
  return (
    <div
      data-ui-preview
      dir={rtl ? 'rtl' : 'ltr'}
      className="rounded-lg border border-outline-variant bg-surface-container-low/60 p-3 space-y-4 select-none"
      aria-label={`Preview of the generated ${p.title} page`}
    >
      {/* ── List page ── */}
      <section className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">{t.listCaption}</p>
        <div className="rounded-lg border border-outline-variant bg-surface-container p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-bold text-on-surface">{p.titlePlural}</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {p.views.length > 1 && (
                <span className="inline-flex rounded border border-outline-variant overflow-hidden text-[10px]">
                  {p.views.map((v, i) => (
                    <span key={v} className={`px-1.5 py-0.5 ${i === 0 ? 'bg-primary text-on-primary' : 'text-secondary'}`}>
                      {t[v as 'table' | 'cards' | 'kanban' | 'calendar'] ?? v}
                    </span>
                  ))}
                </span>
              )}
              {p.hasExport && <MockButton outlined>{t.export}</MockButton>}
              {p.canCreate && <MockButton>{t.newItem(p.title)}</MockButton>}
            </div>
          </div>
          {(p.showSearch || p.filters.length > 0) && (
            <div className="flex items-center gap-2 flex-wrap">
              {p.showSearch && <input disabled className={`${mockInput} max-w-[12rem]`} placeholder={t.search} aria-label={t.search} />}
              {p.filters.map(f => (
                <span key={f} className="text-[10px] px-1.5 py-0.5 rounded border border-outline-variant text-secondary">{f} ▾</span>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-left uppercase tracking-wider text-secondary border-b border-outline-variant">
                  {p.hasSelection && <th className="py-1 pr-2 w-5"><input type="checkbox" disabled className="h-3 w-3" aria-label="Select all" /></th>}
                  {p.columns.map((c, i) => (
                    <th key={`${c.label}-${i}`} className={`py-1 px-1.5 font-semibold whitespace-nowrap ${c.kind === 'number' ? 'text-end' : ''}`}>
                      {c.label}{c.kind === 'audit' ? ' ·' : ''}
                    </th>
                  ))}
                  {p.hasRowActions && <th className="py-1 px-1.5 font-semibold text-end">{t.actions}</th>}
                </tr>
              </thead>
              <tbody>
                {[0, 1].map(row => (
                  <tr key={row} className="border-b border-outline-variant/50 text-on-surface/60">
                    {p.hasSelection && <td className="py-1 pr-2"><input type="checkbox" disabled className="h-3 w-3" aria-label="Select row" /></td>}
                    {p.columns.map((c, i) => (
                      <td key={`${c.label}-${i}`} className={`py-1 px-1.5 ${c.kind === 'number' ? 'text-end tabular-nums' : ''}`}>
                        <span className={`inline-block h-2 rounded bg-outline-variant/70 ${c.kind === 'bool' ? 'w-3' : c.kind === 'number' ? 'w-6' : c.kind === 'enum' ? 'w-10 rounded-full' : 'w-14'}`} />
                      </td>
                    ))}
                    {p.hasRowActions && (
                      <td className="py-1 px-1.5 text-end whitespace-nowrap">
                        <span className="text-primary">{t.edit}</span> · <span className="text-error">{t.delete}</span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Create form ── */}
      <section className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">{t.formCaption}</p>
        {p.canCreate ? (
          <div className="rounded-lg border border-outline-variant bg-surface-container p-3 space-y-3 max-w-md">
            <span className="text-sm font-bold text-on-surface">{t.newItem(p.title)}</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
              {p.form.map(c => <MockField key={c.name} control={c} lockedText={t.locked} inputClass={mockInput} />)}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <MockButton outlined>{t.cancel}</MockButton>
              <MockButton>{t.save}</MockButton>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-secondary">{t.readOnly}</p>
        )}
      </section>
    </div>
  )
}

function MockButton({ outlined, children }: { outlined?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold ${
      outlined ? 'border border-outline-variant text-secondary' : 'bg-primary text-on-primary'}`}>
      {children}
    </span>
  )
}

function MockField({ control: c, lockedText, inputClass }: { control: PreviewControl; lockedText: string; inputClass: string }) {
  const wide = c.control === 'textarea'
  return (
    <label className={`flex flex-col gap-1 text-[11px] ${wide ? 'sm:col-span-2' : ''}`} data-preview-field={c.name}>
      <span className="text-secondary">
        {c.label}{c.required && <span className="text-error"> *</span>}
        {c.locked && (
          <span className="ms-1 inline-flex items-center gap-0.5 text-[9px] text-secondary/80" title={lockedText}>
            <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>lock</span>{lockedText}
          </span>
        )}
      </span>
      {c.control === 'checkbox' ? (
        <input type="checkbox" disabled defaultChecked={c.value === 'true'} className="h-3.5 w-3.5 accent-primary" />
      ) : c.control === 'textarea' ? (
        <textarea disabled className={`${inputClass} min-h-[3rem] resize-none`} defaultValue={c.value ?? ''} />
      ) : c.control === 'select' ? (
        <select disabled className={inputClass} defaultValue={c.value ?? ''}>
          {!c.isRelation && <option value="">—</option>}
          {(c.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          disabled
          type={c.control === 'number' ? 'number' : c.control === 'date' ? 'date' : c.control === 'datetime' ? 'datetime-local' : 'text'}
          className={inputClass}
          defaultValue={c.value ?? ''}
          placeholder={c.control === 'uuid' ? '00000000-0000-…' : undefined}
        />
      )}
      {c.hint && <span className="text-[10px] text-secondary/80">{c.hint}</span>}
    </label>
  )
}

export type { UiPreview }
