import type { FullstackEntityDef, FullstackFormSection } from '../../types'
import type { EntityErrors } from './validation'
import { Labeled, inputClass } from './controls'
import { askableFields } from './pageLayout'
import { MAX_FORM_SECTIONS } from './formSections'

interface Props {
  entity: FullstackEntityDef
  errors?: EntityErrors
  onUpdate: (updates: Partial<FullstackEntityDef>) => void
  /** Ticking "SELECT view" — the parent sets `viewQuery: ''` and focuses the query textarea. */
  onTickView: (checked: boolean) => void
}

/** One-line summary of the non-default settings, shown beside the Settings button when the
 *  panel is closed so nothing set inside it is invisible. */
export function settingsSummary(entity: FullstackEntityDef): string[] {
  const parts: string[] = []
  if (entity.label?.trim()) parts.push(`“${entity.label.trim()}”${entity.labelPlural?.trim() ? ` / “${entity.labelPlural.trim()}”` : ''}`)
  const table = [entity.schema?.trim(), entity.tableName?.trim()].filter(Boolean).join('.')
  if (table) parts.push(table)
  if (entity.readOnly && entity.viewQuery == null) parts.push('read-only')
  if (entity.viewQuery != null) parts.push(entity.viewQuery.trim() ? 'SELECT view' : 'SELECT view (query missing)')
  const sections = entity.formSections?.length ?? 0
  if (sections) parts.push(`${sections} form section${sections === 1 ? '' : 's'}`)
  return parts
}

/**
 * The entity's secondary attributes — display labels, physical mapping, SELECT-backed view —
 * behind one "Settings" button, so the card header stays readable on a laptop. Errors that
 * concern these controls force the panel open (the caller decides).
 */
export function EntitySettingsPanel({ entity, errors, onUpdate, onTickView }: Props) {
  const isView = entity.viewQuery != null
  const queryMissing = isView && !entity.viewQuery?.trim()
  return (
    <div className="rounded-lg border border-outline-variant bg-background/50 px-3 py-3 space-y-3" data-entity-settings>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Labeled label="Display label" hint="Human-facing name in the generated UI (nav, headings, dialogs). Blank = derived from the entity name.">
          <input type="text" aria-label="Display label (optional)" className={inputClass()} placeholder="e.g. Customer"
                 value={entity.label ?? ''} onChange={e => onUpdate({ label: e.target.value || undefined })} />
        </Labeled>
        <Labeled label="Plural label" hint="For nav / list heading / dashboard. Blank = the label, then the derived plural.">
          <input type="text" aria-label="Plural display label (optional)" className={inputClass()} placeholder="e.g. Customers"
                 value={entity.labelPlural ?? ''} onChange={e => onUpdate({ labelPlural: e.target.value || undefined })} />
        </Labeled>
        <Labeled label="Schema" hint="Database schema the table lives in (optional).">
          <input type="text" aria-label="Schema (optional)" className={inputClass()} placeholder="e.g. sales"
                 value={entity.schema ?? ''} disabled={isView}
                 onChange={e => onUpdate({ schema: e.target.value || undefined })} />
        </Labeled>
        <Labeled label="Table name" hint={isView ? 'A SELECT-backed view maps to its query, not a table' : 'Blank = snake_case of the entity name.'}>
          <input type="text" aria-label="Table name (optional)" className={inputClass()} placeholder="e.g. customers"
                 value={entity.tableName ?? ''} disabled={isView}
                 onChange={e => onUpdate({ tableName: e.target.value || undefined })} />
        </Labeled>
      </div>

      <FormSectionsEditor entity={entity} error={errors?.formSections} onChange={formSections => onUpdate({ formSections })} />

      <label
        className="flex items-start gap-2 text-xs text-on-surface cursor-pointer"
        title={isView ? 'A SELECT-backed view is always read-only' : 'Generate GET-only scaffolding (no create/update/delete)'}
      >
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-primary"
          aria-label="Read-only"
          checked={Boolean(entity.readOnly) || isView}
          disabled={isView}
          onChange={e => onUpdate({ readOnly: e.target.checked || undefined })}
        />
        <span className="flex flex-col">
          <span>Read-only</span>
          <span className="text-[11px] text-secondary">GET-only scaffolding — no create, update or delete.</span>
        </span>
      </label>

      <label
        className="flex items-start gap-2 text-xs text-on-surface cursor-pointer"
        title="Map this entity to a SELECT query (Hibernate @Immutable + @Subselect) instead of a table. Always read-only; no relations."
      >
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" aria-label="SELECT-backed view"
               checked={isView} onChange={e => onTickView(e.target.checked)} />
        <span className="flex flex-col">
          <span>SELECT view</span>
          <span className="text-[11px] text-secondary">
            Read-only, mapped to a query via <code className="font-mono">@Subselect</code>. Field names must match the projected aliases.
          </span>
        </span>
      </label>

      {isView && (
        <div className="space-y-1">
          <textarea
            aria-label="View SELECT query"
            aria-invalid={queryMissing}
            data-pending={queryMissing ? '' : undefined}
            className={`w-full font-mono text-[11px] bg-background border rounded p-3 min-h-[100px] focus:ring-2 outline-none ${
              queryMissing ? 'border-warning focus:ring-warning/20' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
            value={entity.viewQuery}
            placeholder="SELECT u.id AS id, u.full_name AS fullName FROM users u"
            spellCheck={false}
            onChange={e => onUpdate({ viewQuery: e.target.value })}
          />
          {queryMissing && (
            <p className="flex items-center gap-1 text-[11px] text-warning" data-pending>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit_note</span>
              {errors?.viewQuery ?? 'Enter the SELECT query or untick "SELECT view"'}
            </p>
          )}
        </div>
      )}

      {entity.sourceSql && !isView && (
        <details className="rounded-lg border border-outline-variant bg-background/50">
          <summary className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-secondary cursor-pointer select-none">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>code</span>
            Imported from this <code className="font-mono">CREATE TABLE</code> (read-only — for reference).
          </summary>
          <textarea
            aria-label="Source CREATE TABLE"
            className="w-full font-mono text-[11px] bg-background border-t border-outline-variant rounded-b p-3 min-h-[100px] text-secondary outline-none resize-y"
            value={entity.sourceSql}
            readOnly
            spellCheck={false}
          />
        </details>
      )}
    </div>
  )
}

/**
 * The form in titled sections: each lists some of the entity's fields and relations (a chip per
 * name, on in at most one section). The drawer form, the record's details and a wizard without
 * steps of its own follow them; what no section lists comes after, untitled.
 */
function FormSectionsEditor({ entity, error, onChange }: {
  entity: FullstackEntityDef
  error?: string
  onChange: (sections: FullstackFormSection[] | undefined) => void
}) {
  const sections = entity.formSections ?? []
  const names = askableFields(entity).map(a => a.name)
  const owner = (name: string) => sections.findIndex(s => s.fields.includes(name))
  const set = (next: FullstackFormSection[]) => onChange(next.length ? next : undefined)
  const patch = (i: number, p: Partial<FullstackFormSection>) => set(sections.map((s, j) => (j === i ? { ...s, ...p } : s)))
  const unplaced = names.filter(n => owner(n) < 0)
  return (
    <div className="space-y-2" data-form-sections>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          Form sections <span className="font-normal normal-case tracking-normal">· group the form, the details and the wizard's steps</span>
        </p>
        <button
          type="button"
          disabled={sections.length >= MAX_FORM_SECTIONS || names.length === 0}
          onClick={() => set([...sections, { title: `Section ${sections.length + 1}`, fields: unplaced.slice(0, 4) }])}
          className="inline-flex items-center gap-1 rounded-md border border-outline-variant px-2 py-0.5 text-[11px] font-semibold text-secondary hover:border-primary/50 hover:text-primary disabled:opacity-40"
          title={sections.length >= MAX_FORM_SECTIONS ? `At most ${MAX_FORM_SECTIONS} sections` : 'Add a titled section'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">add</span>
          Add section
        </button>
      </div>
      {sections.length === 0 && (
        <p className="text-[11px] text-secondary">None — the form is one list of fields, in their order.</p>
      )}
      {sections.map((section, i) => (
        <div key={i} className="space-y-1.5 rounded-md border border-outline-variant px-2 py-1.5" data-form-section={i}>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              aria-label={`Title of form section ${i + 1}`}
              value={section.title}
              onChange={e => patch(i, { title: e.target.value })}
              className={`${inputClass(!section.title.trim() ? 'x' : undefined)} max-w-[16rem] py-1 text-xs`}
            />
            <span className="flex-1" />
            <button type="button" disabled={i === 0} onClick={() => set(sections.map((s, j) => (j === i - 1 ? sections[i] : j === i ? sections[i - 1] : s)))}
              className="rounded p-0.5 text-secondary hover:text-primary disabled:opacity-30" aria-label={`Move form section ${i + 1} up`}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">arrow_upward</span>
            </button>
            <button type="button" disabled={i === sections.length - 1} onClick={() => set(sections.map((s, j) => (j === i + 1 ? sections[i] : j === i ? sections[i + 1] : s)))}
              className="rounded p-0.5 text-secondary hover:text-primary disabled:opacity-30" aria-label={`Move form section ${i + 1} down`}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">arrow_downward</span>
            </button>
            <button type="button" onClick={() => set(sections.filter((_, j) => j !== i))}
              className="rounded p-0.5 text-secondary hover:text-error" aria-label={`Remove form section ${i + 1}`}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">close</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {names.map(name => {
              const at = owner(name)
              const on = at === i
              const elsewhere = at >= 0 && at !== i
              return (
                <button
                  key={name}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`${name} in form section ${i + 1}`}
                  disabled={elsewhere}
                  title={elsewhere ? `In “${sections[at].title}”` : on ? 'In this section — click to take it out' : 'Click to put it in this section'}
                  onClick={() => patch(i, { fields: on ? section.fields.filter(f => f !== name) : [...section.fields, name] })}
                  className={`rounded-full px-2 py-0.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'bg-primary/10 text-primary' : 'border border-dashed border-outline-variant text-secondary hover:text-primary'}`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {sections.length > 0 && unplaced.length > 0 && (
        <p className="text-[11px] text-secondary" data-form-sections-rest>Not in a section (shown after them): {unplaced.join(', ')}</p>
      )}
      {error && <p className="text-[11px] text-error">{error}</p>}
    </div>
  )
}
