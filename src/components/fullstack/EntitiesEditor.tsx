import { Fragment, useState } from 'react'
import {
  FULLSTACK_ENTITY_OPT_KEYS,
  type FullstackEntityDef, type FullstackEntityOptKey, type FullstackFieldDef, type FullstackFieldType, type FullstackRelationDef,
} from '../../types'
import type { EntityErrors, FieldErrors } from './validation'
import { EnumValuesEditor } from './EnumValuesEditor'
import { RelationsEditor } from './RelationsEditor'
import { cloneWithNewUids, newUid } from './uid'
import { focusRowWhenRendered } from './focus'
import { moveItem } from './reorder'
import { summarizeEntity } from './summary'
import { QuickAddFields } from './QuickAddFields'

const FIELD_TYPES: FullstackFieldType[] = [
  'STRING', 'TEXT', 'LONG', 'INTEGER', 'BOOLEAN',
  'LOCAL_DATE', 'LOCAL_DATE_TIME', 'BIG_DECIMAL', 'UUID', 'ENUM',
]

interface Props {
  entities: FullstackEntityDef[]
  onChange: (entities: FullstackEntityDef[]) => void
  errors?: Record<number, EntityErrors>
  /** True when the model has no entities at all — rendered as an error in the empty state. */
  noEntities?: boolean
  /** Entity uids whose card is collapsed to its header (owned by the parent so "jump to first
   *  error" and collapse-all can drive it). Absent = nothing collapsible. */
  collapsed?: Set<string>
  onToggleCollapsed?: (uid: string) => void
  /** Called just before an entity or field is removed, so the parent can snapshot for Undo. */
  onDestructive?: (label: string) => void
  /** The project-wide `opts.scaffold` selection — shown as the "inherit" value in each entity's
   *  per-entity overrides panel. */
  projectOpts?: string[]
}

/** Labels for the per-entity override panel; the hint says what the flag changes on one entity. */
const ENTITY_OPT_LABELS: Record<FullstackEntityOptKey, { label: string; hint: string }> = {
  audit: { label: 'Audit timestamps', hint: 'createdAt / updatedAt columns' },
  softDelete: { label: 'Soft delete', hint: 'deleted flag + restore endpoint' },
  csvExport: { label: 'CSV export', hint: 'GET /export.csv + Export button' },
  bulkDelete: { label: 'Bulk delete', hint: 'row selection + DELETE /bulk' },
  bulkUpdate: { label: 'Bulk edit', hint: 'row selection + PATCH /bulk' },
  tests: { label: 'Controller test', hint: '@WebMvcTest for this entity' },
}

/** Number of distinct problems on one entity (its own + every field's + every relation's) —
 *  shown as a badge on the card header so a collapsed card never hides an issue. */
export function countEntityErrors(e?: EntityErrors): number {
  if (!e) return 0
  let n = 0
  if (e.name) n += 1
  if (e.noFields) n += 1
  if (e.pk) n += 1
  if (e.view) n += 1
  for (const f of Object.values(e.fields ?? {})) n += Object.values(f).filter(Boolean).length
  for (const r of Object.values(e.relations ?? {})) n += Object.values(r).filter(Boolean).length
  return n
}

/** A fresh entity with the usual `id` + `name` starter fields (shared with the ⌘K action). */
export function newEntity(): FullstackEntityDef {
  return {
    uid: newUid(),
    name: '',
    fields: [
      { uid: newUid(), name: 'id', type: 'LONG', primaryKey: true, generated: true },
      { uid: newUid(), name: 'name', type: 'STRING', required: true },
    ],
  }
}

function newField(): FullstackFieldDef {
  return { uid: newUid(), name: '', type: 'STRING' }
}

export function EntitiesEditor({
  entities, onChange, errors, noEntities, collapsed, onToggleCollapsed, onDestructive, projectOpts = [],
}: Props) {
  // Which entity has its per-entity overrides panel open.
  const [overridesFor, setOverridesFor] = useState<string | null>(null)
  function setEntityOpt(eIdx: number, key: FullstackEntityOptKey, value: boolean | undefined) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      const next = { ...(e.opts ?? {}) }
      if (value === undefined) delete next[key]
      else next[key] = value
      return { ...e, opts: Object.keys(next).length > 0 ? next : undefined }
    }))
  }
  // Which field rows have their constraint panel expanded, keyed by `${entityUid}-${fieldUid}`
  // so the open panel follows its row through duplicate/remove. Rows with a constraint error
  // force open regardless (see isOpen).
  const [expandedFields, setExpandedFields] = useState<Set<string>>(() => new Set())
  function toggleExpand(key: string) {
    setExpandedFields(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }
  // Which entity has its "Paste fields" panel open (one at a time is plenty).
  const [quickAddFor, setQuickAddFor] = useState<string | null>(null)

  function updateEntity(idx: number, updates: Partial<FullstackEntityDef>) {
    onChange(entities.map((e, i) => i === idx ? { ...e, ...updates } : e))
  }
  // Order matters downstream: entity order = nav order, field order = table columns, form rows
  // and CSV columns in the generated app. Rows are keyed by uid, so the moved row keeps its DOM
  // node (and focus/caret) across the swap.
  function moveEntity(idx: number, delta: -1 | 1) {
    onChange(moveItem(entities, idx, idx + delta))
  }
  function moveField(eIdx: number, fIdx: number, delta: -1 | 1) {
    onChange(entities.map((e, i) => i === eIdx ? { ...e, fields: moveItem(e.fields, fIdx, fIdx + delta) } : e))
  }
  function addFields(eIdx: number, fields: FullstackFieldDef[]) {
    onChange(entities.map((e, i) => i === eIdx ? { ...e, fields: [...e.fields, ...fields] } : e))
    focusRowWhenRendered(fields[0]?.uid)
  }
  function removeEntity(idx: number) {
    onDestructive?.(`Removed entity ${entities[idx]?.name.trim() || '(unnamed)'}`)
    onChange(entities.filter((_, i) => i !== idx))
  }
  function addEntity() {
    const entity = newEntity()
    onChange([...entities, entity])
    focusRowWhenRendered(entity.uid)
  }
  function duplicateEntity(idx: number) {
    const src = entities[idx]
    // Deep copy (fresh uids) so edits to the clone don't mutate the original; the physical
    // mapping is intentionally dropped since two entities can't share a table.
    const copy: FullstackEntityDef = {
      ...cloneWithNewUids(src),
      name: `${src.name}Copy`,
      tableName: undefined,
      schema: undefined,
    }
    onChange([...entities.slice(0, idx + 1), copy, ...entities.slice(idx + 1)])
  }
  function updateField(eIdx: number, fIdx: number, updates: Partial<FullstackFieldDef>) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: e.fields.map((f, j) => j === fIdx ? { ...f, ...updates } : f) }
    }))
  }
  // Changing a field's type clears attributes that no longer apply, so we never send
  // an orphaned length (non-STRING) or enumValues (non-ENUM) — the backend rejects both.
  function changeFieldType(eIdx: number, fIdx: number, type: FullstackFieldType) {
    const updates: Partial<FullstackFieldDef> = { type }
    if (type !== 'STRING') updates.length = undefined
    if (type !== 'ENUM') updates.enumValues = undefined
    // Auto-generated keys are valid on an integral key (IDENTITY) or a UUID (@UuidGenerator) —
    // drop the flag when the type can't carry it.
    if (type !== 'LONG' && type !== 'INTEGER' && type !== 'UUID') updates.generated = undefined
    // Constraints follow the same "clear what no longer applies" rule the backend enforces:
    // numeric bounds only on numeric types, regex/email only on STRING.
    const numeric = type === 'LONG' || type === 'INTEGER' || type === 'BIG_DECIMAL'
    if (!numeric) { updates.min = undefined; updates.max = undefined }
    if (type !== 'STRING') { updates.pattern = undefined; updates.email = undefined }
    // The search/filter opt-out flags only apply to eligible types — clear them when leaving.
    if (type !== 'STRING' && type !== 'TEXT') updates.searchable = undefined
    const temporal = type === 'LOCAL_DATE' || type === 'LOCAL_DATE_TIME'
    if (!(type === 'ENUM' || type === 'BOOLEAN' || temporal || numeric)) updates.filterable = undefined
    // A default is typed per field type, so it rarely survives a type change — drop it.
    updates.defaultValue = undefined
    updateField(eIdx, fIdx, updates)
  }

  function updateRelations(eIdx: number, relations: FullstackRelationDef[]) {
    updateEntity(eIdx, { relations })
  }
  // All entity names (non-blank) — valid FK targets for the relations editor.
  const entityNames = entities.map(e => e.name.trim()).filter(Boolean)
  function duplicateField(eIdx: number, fIdx: number) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      const src = e.fields[fIdx]
      const copy: FullstackFieldDef = {
        ...src,
        uid: newUid(),
        name: `${src.name}Copy`,
        enumValues: src.enumValues ? [...src.enumValues] : undefined,
      }
      return { ...e, fields: [...e.fields.slice(0, fIdx + 1), copy, ...e.fields.slice(fIdx + 1)] }
    }))
  }
  function removeField(eIdx: number, fIdx: number) {
    const owner = entities[eIdx]
    onDestructive?.(`Removed field ${owner?.fields[fIdx]?.name.trim() || '(unnamed)'} from ${owner?.name.trim() || '(unnamed)'}`)
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: e.fields.filter((_, j) => j !== fIdx) }
    }))
  }
  function addField(eIdx: number) {
    const field = newField()
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: [...e.fields, field] }
    }))
    focusRowWhenRendered(field.uid)
  }

  return (
    <div className="space-y-6">
      {entities.map((entity, eIdx) => {
        const eErr = errors?.[eIdx]
        // Mirror the backend down-grade rules so the picker only offers a mode the entity supports:
        // kanban groups by an ENUM/BOOLEAN field and writes the value back (needs a writable entity);
        // calendar places records by a LOCAL_DATE/LOCAL_DATE_TIME field.
        const kanbanOk = !entity.readOnly && !entity.viewQuery
          && entity.fields.some(f => f.type === 'ENUM' || f.type === 'BOOLEAN')
        const calendarOk = entity.fields.some(f => f.type === 'LOCAL_DATE' || f.type === 'LOCAL_DATE_TIME')
        // Which list views are enabled (back-compat: fall back to the legacy single listView, else table).
        const views: string[] = entity.listViews ?? (entity.listView ? [entity.listView] : ['table'])
        const VIEW_ORDER = ['table', 'cards', 'kanban', 'calendar']
        const viewOptions = [
          { key: 'table', label: 'Table', applicable: true, hint: '' },
          { key: 'cards', label: 'Cards', applicable: true, hint: '' },
          { key: 'kanban', label: 'Kanban', applicable: kanbanOk, hint: 'Needs an enum/boolean field' },
          { key: 'calendar', label: 'Calendar', applicable: calendarOk, hint: 'Needs a date field' },
        ] as const
        function toggleView(key: string) {
          const has = views.includes(key)
          // Keep at least one view selected; otherwise toggle and re-sort into canonical order so the
          // first (= the generated page's initial mode) is deterministic regardless of click order.
          const next = (has ? views.filter(v => v !== key) : [...views, key])
            .filter((v, i, a) => a.indexOf(v) === i)
          if (next.length === 0) return
          next.sort((a, b) => VIEW_ORDER.indexOf(a) - VIEW_ORDER.indexOf(b))
          updateEntity(eIdx, { listViews: next as FullstackEntityDef['listViews'], listView: undefined })
        }
        const entityKey = entity.uid ?? `i${eIdx}`
        // Loop-invariant: hoisted out of the per-field map below.
        const pkCount = entity.fields.filter(f => f.primaryKey).length
        const errCount = countEntityErrors(eErr)
        const isCollapsed = Boolean(collapsed?.has(entityKey))
        const relCount = entity.relations?.length ?? 0
        const summary = summarizeEntity(entity)
        return (
        <div
          key={entityKey}
          data-entity-index={eIdx}
          data-row-uid={entity.uid}
          className={`border rounded-xl p-5 bg-surface-container shadow-sm space-y-4 ${errCount > 0 ? 'border-error/40' : 'border-outline-variant'}`}
        >
          {/* Header: identity (row 1) split from secondary attributes (row 2) so the controls
              don't overflow a single row on laptop widths. A tinted panel marks the card title. */}
          <div className="rounded-lg bg-primary/[0.04] border border-outline-variant px-3 py-2.5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {onToggleCollapsed && (
                  <button
                    type="button"
                    onClick={() => onToggleCollapsed(entityKey)}
                    aria-expanded={!isCollapsed}
                    aria-label={isCollapsed ? 'Expand entity' : 'Collapse entity'}
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                    className="p-0.5 -ml-1 rounded text-secondary hover:text-on-surface hover:bg-primary/10 transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      {isCollapsed ? 'chevron_right' : 'expand_more'}
                    </span>
                  </button>
                )}
                <span className="text-[11px] font-bold uppercase tracking-wider text-secondary shrink-0">Entity</span>
                <div className="flex-1 max-w-sm">
                  <input
                    type="text"
                    aria-label="Entity name"
                    aria-invalid={Boolean(eErr?.name)}
                    className={`w-full bg-background border rounded px-3 py-2 text-sm font-mono text-on-surface focus:ring-2 outline-none ${eErr?.name ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                    placeholder="User, Order, Product…"
                    value={entity.name}
                    onChange={e => updateEntity(eIdx, { name: e.target.value })}
                  />
                  {eErr?.name && <p className="mt-1 text-[11px] text-error">{eErr.name}</p>}
                </div>
                {isCollapsed && (
                  <span className="hidden sm:inline-flex items-center gap-2 text-[11px] text-secondary shrink-0">
                    <span>{entity.fields.length} field{entity.fields.length === 1 ? '' : 's'}</span>
                    {relCount > 0 && <span>· {relCount} relation{relCount === 1 ? '' : 's'}</span>}
                    {(entity.readOnly || entity.viewQuery) && <span>· read-only</span>}
                    <span className="font-mono">· {summary.path}</span>
                  </span>
                )}
                {errCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error/10 text-error text-[11px] font-semibold shrink-0"
                    title={`${errCount} issue${errCount === 1 ? '' : 's'} on this entity`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>error</span>
                    {errCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {entities.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => moveEntity(eIdx, -1)}
                      disabled={eIdx === 0}
                      className="p-1.5 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary"
                      title="Move entity up (earlier in the generated nav)"
                      aria-label="Move entity up"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_upward</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveEntity(eIdx, 1)}
                      disabled={eIdx === entities.length - 1}
                      className="p-1.5 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary"
                      title="Move entity down"
                      aria-label="Move entity down"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_downward</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => duplicateEntity(eIdx)}
                  className="p-1.5 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Duplicate entity"
                  aria-label="Duplicate entity"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>content_copy</span>
                </button>
                <button
                  onClick={() => removeEntity(eIdx)}
                  className="p-1.5 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
                  title="Remove entity"
                  aria-label="Remove entity"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                </button>
              </div>
            </div>
            {!isCollapsed && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {/* Cluster: display labels (optional) — user-facing names in the generated UI. */}
              <div className="inline-flex items-center gap-3">
              <input
                type="text"
                aria-label="Display label (optional)"
                className="w-44 bg-background border border-outline-variant rounded px-3 py-2 text-sm text-secondary placeholder:text-secondary/60 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="label (optional)"
                title="Human-facing entity name shown in the generated UI (nav, headings, dialogs). Blank = derive from the entity name."
                value={entity.label ?? ''}
                onChange={e => updateEntity(eIdx, { label: e.target.value || undefined })}
              />
              <input
                type="text"
                aria-label="Plural display label (optional)"
                className="w-44 bg-background border border-outline-variant rounded px-3 py-2 text-sm text-secondary placeholder:text-secondary/60 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="plural label (optional)"
                title="Plural form for nav / list heading / dashboard. Blank = falls back to the label, then the derived plural."
                value={entity.labelPlural ?? ''}
                onChange={e => updateEntity(eIdx, { labelPlural: e.target.value || undefined })}
              />
              </div>
              {/* Cluster A: physical mapping (schema + table) — wraps as a unit, never mid-control. */}
              <div className="inline-flex items-center gap-3">
              <input
                type="text"
                aria-label="Schema (optional)"
                className="w-40 bg-background border border-outline-variant rounded px-3 py-2 text-sm text-secondary placeholder:text-secondary/60 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="schema (optional)"
                value={entity.schema ?? ''}
                onChange={e => updateEntity(eIdx, { schema: e.target.value || undefined })}
              />
              <input
                type="text"
                aria-label="Table name (optional)"
                className="w-56 bg-background border border-outline-variant rounded px-3 py-2 text-sm text-secondary placeholder:text-secondary/60 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:opacity-40"
                placeholder="table_name (optional)"
                value={entity.tableName ?? ''}
                disabled={Boolean(entity.viewQuery)}
                title={entity.viewQuery ? 'A SELECT-backed view maps to its query, not a table' : undefined}
                onChange={e => updateEntity(eIdx, { tableName: e.target.value || undefined })}
              />
              </div>
              {/* Cluster B: generated-page behavior (read-only + list views + overrides) — wraps as a unit. */}
              <div className="inline-flex items-center gap-4">
              <button
                type="button"
                onClick={() => setOverridesFor(prev => prev === entityKey ? null : entityKey)}
                aria-expanded={overridesFor === entityKey}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${entity.opts && Object.keys(entity.opts).length > 0 ? 'text-primary bg-primary/10' : 'text-secondary hover:text-primary hover:bg-primary/5'}`}
                title="Turn a project-wide scaffolding option on or off for this entity only"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>tune</span>
                Overrides{entity.opts && Object.keys(entity.opts).length > 0 ? ` (${Object.keys(entity.opts).length})` : ''}
              </button>
              <label
                className="flex items-center gap-1.5 text-xs text-secondary shrink-0 cursor-pointer"
                title={entity.viewQuery ? 'A SELECT-backed view is always read-only' : 'Generate GET-only scaffolding (no create/update/delete)'}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  aria-label="Read-only"
                  checked={Boolean(entity.readOnly) || Boolean(entity.viewQuery)}
                  disabled={Boolean(entity.viewQuery)}
                  onChange={e => updateEntity(eIdx, { readOnly: e.target.checked || undefined })}
                />
                Read-only
              </label>
              <div
                className="flex items-center gap-1.5 text-xs text-secondary shrink-0"
                title="Which list views the generated page includes. A runtime toggle appears when you pick 2+; the first (Table > Cards > Kanban > Calendar) is the initial mode."
              >
                <span>Views</span>
                <div className="inline-flex rounded border border-outline-variant overflow-hidden" role="group" aria-label="List views">
                  {viewOptions.map(opt => {
                    const selected = views.includes(opt.key)
                    // Disabled only blocks *adding* an unsupported view — an already-selected one can
                    // still be removed (so it never gets stuck after its field is deleted).
                    const interactive = opt.applicable || selected
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        aria-pressed={selected}
                        disabled={!interactive}
                        title={opt.applicable ? undefined : opt.hint}
                        onClick={() => toggleView(opt.key)}
                        className={`px-2 py-1 transition-colors ${selected ? 'bg-primary text-on-primary' : 'bg-background text-secondary hover:text-on-surface'} ${interactive ? '' : 'opacity-40 cursor-not-allowed'}`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              </div>
            </div>
            )}
            {/* What this card will generate — derived from the same rules the backend applies, so
                the effect of Search/Filter checkboxes and the view picker is visible without an
                Explore round-trip. */}
            {!isCollapsed && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-secondary" data-entity-summary>
              <span className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>api</span>
                <span className="font-semibold tracking-wide">{summary.verbs.join(' ')}</span>
                <code className="font-mono text-on-surface">{summary.path}</code>
              </span>
              <span>·</span>
              <span>views: {summary.views.map(v => v.by ? `${v.name} (by ${v.by})` : v.name).join(', ')}</span>
              <span>·</span>
              <span title="Fields included in the text-search box">search: {summary.search.length ? summary.search.join(', ') : '—'}</span>
              <span>·</span>
              <span title="Fields that get a filter control">filters: {summary.filters.length ? summary.filters.join(', ') : '—'}</span>
            </p>
            )}
          </div>

          {!isCollapsed && (<>
          {overridesFor === entityKey && (
            <div className="rounded-lg border border-outline-variant bg-background/50 px-3 py-2.5 space-y-2" data-entity-overrides>
              <p className="text-[11px] text-secondary">
                Per-entity overrides of the project-wide Options. <em>Inherit</em> follows the project setting
                (shown in brackets); <em>On</em>/<em>Off</em> forces it for this entity only.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {FULLSTACK_ENTITY_OPT_KEYS.map(key => {
                  const projectOn = projectOpts.includes(key)
                  const value = entity.opts?.[key]
                  const current = value === undefined ? 'inherit' : value ? 'on' : 'off'
                  return (
                    <label key={key} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex flex-col min-w-0">
                        <span className="text-on-surface">{ENTITY_OPT_LABELS[key].label}</span>
                        <span className="text-[10px] text-secondary truncate">{ENTITY_OPT_LABELS[key].hint}</span>
                      </span>
                      <select
                        aria-label={`${ENTITY_OPT_LABELS[key].label} override`}
                        className={`bg-background border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/20 ${current === 'inherit' ? 'border-outline-variant text-secondary' : 'border-primary/50 text-on-surface'}`}
                        value={current}
                        onChange={e => setEntityOpt(eIdx, key, e.target.value === 'inherit' ? undefined : e.target.value === 'on')}
                      >
                        <option value="inherit">Inherit ({projectOn ? 'on' : 'off'})</option>
                        <option value="on">On</option>
                        <option value="off">Off</option>
                      </select>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
          {eErr?.noFields && (
            <div data-error className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 border border-error/30 text-[11px] text-error">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
              {eErr.noFields}
            </div>
          )}

          {eErr?.pk && (
            <div data-error className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 border border-error/30 text-[11px] text-error">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
              {eErr.pk}
            </div>
          )}

          {eErr?.view && (
            <div data-error className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 border border-error/30 text-[11px] text-error">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
              {eErr.view}
            </div>
          )}

          {entity.viewQuery && (
            <details className="rounded-lg border border-outline-variant bg-background/50">
              <summary className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-secondary cursor-pointer select-none">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>table_view</span>
                Read-only view — mapped to this SELECT via <code className="font-mono">@Subselect</code>.
                Field <code className="font-mono">@Column</code> names must match the projected aliases.
              </summary>
              <textarea
                aria-label="View SELECT query"
                className="w-full font-mono text-[11px] bg-background border-t border-outline-variant rounded-b p-3 min-h-[100px] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                value={entity.viewQuery}
                spellCheck={false}
                onChange={e => updateEntity(eIdx, { viewQuery: e.target.value || undefined })}
              />
            </details>
          )}

          {entity.sourceSql && !entity.viewQuery && (
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

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                  <th className="text-left py-1.5 px-2">Name</th>
                  <th className="text-left py-1.5 px-2">Type</th>
                  <th className="text-left py-1.5 px-2" title="Display label for the generated UI (defaults to the field name)">Label</th>
                  <th className="text-center py-1.5 px-2 w-12" title="Primary key (@Id). Tick more than one for a composite key.">PK</th>
                  <th className="text-center py-1.5 px-2 w-12" title="Generated by the database on insert (IDENTITY for LONG/INTEGER, UUID generator for UUID). Primary key only.">Gen</th>
                  <th className="text-center py-1.5 px-2 w-12" title="Required: NOT NULL column + @NotNull/@NotBlank on the DTO + a required form field">Req</th>
                  <th className="text-center py-1.5 px-2 w-12" title="Unique: a unique constraint on the column; a duplicate value answers 409">Uniq</th>
                  <th className="text-center py-1.5 px-2 w-12" title="Locked after create: the field is set when a row is created and can't be edited afterwards (form disables it, the service never overwrites it)">Lock</th>
                  <th className="text-center py-1.5 px-2 w-12" title="Include in the text-search box (STRING/TEXT fields)">Search</th>
                  <th className="text-center py-1.5 px-2 w-12" title="Include in the filter bar (enum/boolean/date/numeric fields)">Filter</th>
                  <th className="text-center py-1.5 px-2 w-28">Constraints</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {entity.fields.map((field, fIdx) => {
                  const fErr = eErr?.fields?.[fIdx]
                  const fieldKey = field.uid ?? `i${fIdx}`
                  // A generated key requires a single PK (JPA IDENTITY can't target one column of a composite key).
                  const canGenerate = !!field.primaryKey && pkCount === 1 && (field.type === 'LONG' || field.type === 'INTEGER' || field.type === 'UUID')
                  const isNumeric = field.type === 'LONG' || field.type === 'INTEGER' || field.type === 'BIG_DECIMAL'
                  const isString = field.type === 'STRING'
                  // Per-field search/filter eligibility mirrors the backend collection loops:
                  // search → STRING/TEXT; filter bar → non-PK enum/boolean/temporal/numeric.
                  const isTextSearch = isString || field.type === 'TEXT'
                  const isTemporal = field.type === 'LOCAL_DATE' || field.type === 'LOCAL_DATE_TIME'
                  const isFilterableType = !field.primaryKey
                    && (field.type === 'ENUM' || field.type === 'BOOLEAN' || isTemporal || isNumeric)
                  // Constraints are type-gated: STRING → length/pattern/email, numeric → min/max,
                  // ENUM → values; every non-generated field can also carry a default value, so
                  // only a generated key has no expander.
                  const hasConstraintControls = !(field.primaryKey && field.generated)
                  const hasConstraintsSet = field.length != null || field.min != null || field.max != null
                    || Boolean(field.pattern) || Boolean(field.email) || (field.enumValues?.length ?? 0) > 0
                    || Boolean(field.defaultValue)
                  const hasConstraintErr = Boolean(
                    fErr?.length || fErr?.min || fErr?.max || fErr?.pattern || fErr?.email || fErr?.enumValues || fErr?.defaultValue)
                  const rowKey = `${entityKey}-${fieldKey}`
                  // Force open on error so the message is never hidden behind a collapsed panel.
                  const isOpen = hasConstraintControls && (expandedFields.has(rowKey) || hasConstraintErr)
                  return (
                  <Fragment key={fieldKey}>
                  <tr className="border-t border-outline-variant" data-row-uid={field.uid}>
                    <td className="py-1.5 px-2 align-top">
                      <input
                        type="text"
                        aria-label="Field name"
                        aria-invalid={Boolean(fErr?.name)}
                        className={`w-full bg-background border rounded px-2 py-1 text-xs font-mono focus:ring-1 outline-none ${fErr?.name ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                        value={field.name}
                        onChange={e => updateField(eIdx, fIdx, { name: e.target.value })}
                        placeholder="fieldName"
                      />
                      {fErr?.name && <p className="mt-0.5 text-[11px] text-error">{fErr.name}</p>}
                    </td>
                    <td className="py-1.5 px-2 align-top">
                      <select
                        aria-label="Field type"
                        className="w-full bg-background border border-outline-variant rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                        value={field.type}
                        onChange={e => changeFieldType(eIdx, fIdx, e.target.value as FullstackFieldType)}
                      >
                        {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2 align-top">
                      <input
                        type="text"
                        aria-label="Display label"
                        className="w-full bg-background border border-outline-variant rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                        value={field.label ?? ''}
                        onChange={e => updateField(eIdx, fIdx, { label: e.target.value || undefined })}
                        placeholder={field.name || 'label'}
                        title="Display label for the generated UI. Leave blank to derive from the field name."
                      />
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Primary key" checked={!!field.primaryKey}
                        onChange={e => updateField(eIdx, fIdx, e.target.checked ? { primaryKey: true } : { primaryKey: false, generated: undefined })} />
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      <input type="checkbox" aria-label="Auto-generated value" checked={!!field.generated}
                        disabled={!canGenerate}
                        title={canGenerate ? undefined : (pkCount > 1 ? 'A generated key requires a single primary key' : 'Auto-generated applies to a LONG/INTEGER/UUID primary key only')}
                        className="h-4 w-4 accent-primary disabled:opacity-40 disabled:cursor-not-allowed"
                        onChange={e => updateField(eIdx, fIdx, { generated: e.target.checked })} />
                      {fErr?.generated && <p className="mt-0.5 text-[11px] text-error">{fErr.generated}</p>}
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Required (not null)" checked={!!field.required}
                        onChange={e => updateField(eIdx, fIdx, { required: e.target.checked })} />
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Unique" checked={!!field.unique}
                        onChange={e => updateField(eIdx, fIdx, { unique: e.target.checked })} />
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      {field.primaryKey ? (
                        <span className="text-secondary/40" title="Primary keys are already locked after create" aria-hidden="true">—</span>
                      ) : (
                        <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Locked after create" checked={!!field.readOnly}
                          title="Locked after create: set on create, not editable afterwards"
                          onChange={e => updateField(eIdx, fIdx, { readOnly: e.target.checked || undefined })} />
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      {isTextSearch ? (
                        <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Include in search" checked={field.searchable !== false}
                          title="Include this field in the text-search box"
                          onChange={e => updateField(eIdx, fIdx, { searchable: e.target.checked ? undefined : false })} />
                      ) : (
                        <span className="text-secondary/40" title="Search applies to STRING/TEXT fields only" aria-hidden="true">—</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      {isFilterableType ? (
                        <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Include in filter bar" checked={field.filterable !== false}
                          title="Include this field in the filter bar"
                          onChange={e => updateField(eIdx, fIdx, { filterable: e.target.checked ? undefined : false })} />
                      ) : (
                        <span className="text-secondary/40" title="Filters apply to non-PK enum/boolean/date/numeric fields only" aria-hidden="true">—</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      {hasConstraintControls ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(rowKey)}
                          aria-expanded={isOpen}
                          aria-label={isOpen ? 'Hide constraints' : 'Edit constraints'}
                          title={hasConstraintErr ? 'Constraint error — fix below'
                            : hasConstraintsSet ? 'Constraints set — edit'
                            : 'Add constraints'}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                            hasConstraintErr ? 'text-error hover:bg-error/10'
                              : hasConstraintsSet ? 'text-primary hover:bg-primary/10'
                              : 'text-secondary hover:text-primary hover:bg-primary/10'}`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            {isOpen ? 'expand_less' : 'tune'}
                          </span>
                          {hasConstraintErr
                            ? <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>error</span>
                            : (hasConstraintsSet && !isOpen && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />)}
                        </button>
                      ) : (
                        <span className="text-secondary/40" title="A generated key takes no constraints or default" aria-hidden="true">—</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right align-top">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveField(eIdx, fIdx, -1)}
                          disabled={fIdx === 0}
                          className="p-1 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary"
                          title="Move field up (earlier column / form row)"
                          aria-label="Move field up"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_upward</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(eIdx, fIdx, 1)}
                          disabled={fIdx === entity.fields.length - 1}
                          className="p-1 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary"
                          title="Move field down"
                          aria-label="Move field down"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_downward</span>
                        </button>
                        <button
                          onClick={() => duplicateField(eIdx, fIdx)}
                          className="p-1 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Duplicate field"
                          aria-label="Duplicate field"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                        </button>
                        <button
                          onClick={() => removeField(eIdx, fIdx)}
                          className="p-1 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
                          title="Remove field"
                          aria-label="Remove field"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-background/30">
                      <td colSpan={12} className="px-2 pb-3 pt-0 align-top">
                        <FieldConstraintsPanel
                          field={field}
                          fErr={fErr}
                          isString={isString}
                          isNumeric={isNumeric}
                          onUpdate={updates => updateField(eIdx, fIdx, updates)}
                        />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
            <div className="mt-2 flex items-center gap-1">
              <button
                onClick={() => addField(eIdx)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                Add field
              </button>
              <button
                type="button"
                onClick={() => setQuickAddFor(prev => prev === entityKey ? null : entityKey)}
                aria-expanded={quickAddFor === entityKey}
                className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                title="Add many fields at once from a pasted list (one per line)"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>playlist_add</span>
                Paste fields…
              </button>
            </div>
            {quickAddFor === entityKey && (
              <QuickAddFields
                onAdd={fields => addFields(eIdx, fields)}
                onClose={() => setQuickAddFor(null)}
              />
            )}
          </div>

          <RelationsEditor
            relations={entity.relations ?? []}
            entityNames={entityNames}
            onChange={rels => updateRelations(eIdx, rels)}
            errors={eErr?.relations}
            addDisabledReason={entity.viewQuery
              ? 'A SELECT-backed view maps to a query, not a table, so it cannot own a foreign key.'
              : undefined}
          />
          </>)}
        </div>
        )
      })}

      {entities.length === 0 ? (
        <div
          data-error={noEntities ? '' : undefined}
          className={`flex flex-col items-center text-center gap-3 px-6 py-12 rounded-xl border-2 border-dashed ${noEntities ? 'border-error/40' : 'border-outline-variant'}`}
        >
          <span className="material-symbols-outlined text-secondary/60" style={{ fontSize: '40px' }}>table_chart</span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-on-surface">No entities yet</p>
            <p className="text-xs text-secondary max-w-xs">
              Add an entity to define its fields and relations — pick an example above, or import from DDL/SELECT.
            </p>
            {noEntities && (
              <p className="text-[11px] text-error flex items-center justify-center gap-1" role="alert">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
                At least one entity is required to generate.
              </p>
            )}
          </div>
          <button
            onClick={addEntity}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:opacity-90 transition-opacity active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Add entity
          </button>
        </div>
      ) : (
        <button
          onClick={addEntity}
          className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary text-secondary hover:text-primary text-sm font-medium transition-colors"
        >
          + Add entity
        </button>
      )}
    </div>
  )
}

/** Expanded constraint editor for a single field — shows only the constraints valid for the
 *  field's type (STRING → length/pattern/email, numeric → min/max, ENUM → values). Replaces
 *  the old always-on constraint columns, so no disabled cells are ever shown. */
function FieldConstraintsPanel({ field, fErr, isString, isNumeric, onUpdate }: {
  field: FullstackFieldDef
  fErr?: FieldErrors
  isString: boolean
  isNumeric: boolean
  onUpdate: (updates: Partial<FullstackFieldDef>) => void
}) {
  const inputClass = (error?: string) =>
    `w-full bg-background border rounded px-2 py-1.5 text-xs tabular-nums focus:ring-1 outline-none ${
      error ? 'border-error focus:ring-error/20 focus:border-error'
        : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`
  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-3 rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-3">
      {isString && (
        <>
          <ConstraintBox label="Max length" error={fErr?.length}>
            <input
              type="number"
              min={1}
              aria-label="Max length"
              aria-invalid={Boolean(fErr?.length)}
              className={inputClass(fErr?.length)}
              value={field.length ?? ''}
              placeholder="e.g. 200"
              onChange={e => onUpdate({ length: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </ConstraintBox>
          <ConstraintBox label="Pattern (regex)" error={fErr?.pattern} wide>
            <input
              type="text"
              aria-label="Regex pattern"
              aria-invalid={Boolean(fErr?.pattern)}
              className={`${inputClass(fErr?.pattern)} font-mono`}
              value={field.pattern ?? ''}
              placeholder="[A-Z]{3}"
              onChange={e => onUpdate({ pattern: e.target.value === '' ? undefined : e.target.value })}
            />
          </ConstraintBox>
          <label className="flex items-center gap-1.5 text-xs text-secondary self-center cursor-pointer pt-4">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              aria-label="Email format"
              checked={!!field.email}
              onChange={e => onUpdate({ email: e.target.checked })}
            />
            Email format
          </label>
        </>
      )}
      {isNumeric && (
        <>
          <ConstraintBox label="Min" error={fErr?.min}>
            <input
              type="number"
              aria-label="Minimum value"
              aria-invalid={Boolean(fErr?.min)}
              className={inputClass(fErr?.min)}
              value={field.min ?? ''}
              onChange={e => onUpdate({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </ConstraintBox>
          <ConstraintBox label="Max" error={fErr?.max}>
            <input
              type="number"
              aria-label="Maximum value"
              aria-invalid={Boolean(fErr?.max)}
              className={inputClass(fErr?.max)}
              value={field.max ?? ''}
              onChange={e => onUpdate({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </ConstraintBox>
        </>
      )}
      {field.type === 'ENUM' && (
        <ConstraintBox label="Enum values" error={fErr?.enumValues} wide>
          <EnumValuesEditor
            values={field.enumValues ?? []}
            onChange={vals => onUpdate({ enumValues: vals })}
            invalid={Boolean(fErr?.enumValues)}
          />
        </ConstraintBox>
      )}
      <ConstraintBox label="Default value" error={fErr?.defaultValue}>
        <DefaultValueInput field={field} invalid={Boolean(fErr?.defaultValue)} className={inputClass(fErr?.defaultValue)}
          onChange={v => onUpdate({ defaultValue: v === '' ? undefined : v })} />
      </ConstraintBox>
    </div>
  )
}

/** Type-aware control for a field's default: booleans and enums pick from their values, dates
 *  use native pickers, everything else is text (the server type-checks it again). */
function DefaultValueInput({ field, invalid, className, onChange }: {
  field: FullstackFieldDef; invalid: boolean; className: string; onChange: (v: string) => void
}) {
  const value = field.defaultValue ?? ''
  const common = { 'aria-label': 'Default value', 'aria-invalid': invalid, className, title: 'Initial value: entity field initializer, the form\'s starting value and the demo-data seed' }
  if (field.type === 'BOOLEAN') {
    return (
      <select {...common} value={value.toLowerCase()} onChange={e => onChange(e.target.value)}>
        <option value="">none</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }
  if (field.type === 'ENUM') {
    return (
      <select {...common} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">none</option>
        {(field.enumValues ?? []).map(v => <option key={v} value={v}>{v}</option>)}
        {value && !(field.enumValues ?? []).includes(value) && <option value={value}>{value}</option>}
      </select>
    )
  }
  if (field.type === 'LOCAL_DATE') return <input {...common} type="date" value={value} onChange={e => onChange(e.target.value)} />
  if (field.type === 'LOCAL_DATE_TIME') return <input {...common} type="datetime-local" value={value} onChange={e => onChange(e.target.value)} />
  const placeholder = field.type === 'UUID' ? '00000000-0000-…'
    : field.type === 'LONG' || field.type === 'INTEGER' ? '0'
    : field.type === 'BIG_DECIMAL' ? '0.00' : 'none'
  return (
    <input {...common} type="text" inputMode={field.type === 'STRING' || field.type === 'TEXT' ? undefined : 'decimal'}
      value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
  )
}

/** Labeled wrapper for one constraint control inside FieldConstraintsPanel. `wide` lets the
 *  pattern/enum editors grow to fill remaining width. */
function ConstraintBox({ label, error, wide, children }: {
  label: string; error?: string; wide?: boolean; children: React.ReactNode
}) {
  return (
    <div className={wide ? 'min-w-[16rem] flex-1' : 'w-28'}>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-secondary mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-[11px] text-error">{error}</p>}
    </div>
  )
}
