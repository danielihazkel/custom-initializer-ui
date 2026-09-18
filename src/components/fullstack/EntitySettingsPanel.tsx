import type { FullstackEntityDef } from '../../types'
import type { EntityErrors } from './validation'

interface Props {
  entity: FullstackEntityDef
  errors?: EntityErrors
  onUpdate: (updates: Partial<FullstackEntityDef>) => void
  /** Ticking "SELECT view" — the parent sets `viewQuery: ''` and focuses the query textarea. */
  onTickView: (checked: boolean) => void
}

const INPUT = 'w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface placeholder:text-secondary/60 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:opacity-40'

/** One-line summary of the non-default settings, shown beside the Settings button when the
 *  panel is closed so nothing set inside it is invisible. */
export function settingsSummary(entity: FullstackEntityDef): string[] {
  const parts: string[] = []
  if (entity.label?.trim()) parts.push(`“${entity.label.trim()}”${entity.labelPlural?.trim() ? ` / “${entity.labelPlural.trim()}”` : ''}`)
  const table = [entity.schema?.trim(), entity.tableName?.trim()].filter(Boolean).join('.')
  if (table) parts.push(table)
  if (entity.viewQuery != null) parts.push(entity.viewQuery.trim() ? 'SELECT view' : 'SELECT view (query missing)')
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
          <input type="text" aria-label="Display label (optional)" className={INPUT} placeholder="e.g. Customer"
                 value={entity.label ?? ''} onChange={e => onUpdate({ label: e.target.value || undefined })} />
        </Labeled>
        <Labeled label="Plural label" hint="For nav / list heading / dashboard. Blank = the label, then the derived plural.">
          <input type="text" aria-label="Plural display label (optional)" className={INPUT} placeholder="e.g. Customers"
                 value={entity.labelPlural ?? ''} onChange={e => onUpdate({ labelPlural: e.target.value || undefined })} />
        </Labeled>
        <Labeled label="Schema" hint="Database schema the table lives in (optional).">
          <input type="text" aria-label="Schema (optional)" className={INPUT} placeholder="e.g. sales"
                 value={entity.schema ?? ''} disabled={isView}
                 onChange={e => onUpdate({ schema: e.target.value || undefined })} />
        </Labeled>
        <Labeled label="Table name" hint={isView ? 'A SELECT-backed view maps to its query, not a table' : 'Blank = snake_case of the entity name.'}>
          <input type="text" aria-label="Table name (optional)" className={INPUT} placeholder="e.g. customers"
                 value={entity.tableName ?? ''} disabled={isView}
                 onChange={e => onUpdate({ tableName: e.target.value || undefined })} />
        </Labeled>
      </div>

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

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-secondary" title={hint}>{label}</label>
      {children}
    </div>
  )
}
