import { Fragment, useRef, useState } from 'react'
import {
  FULLSTACK_ENTITY_OPT_KEYS,
  type FullstackEntityDef, type FullstackEntityOptKey, type FullstackFieldDef, type FullstackFieldType, type FullstackRelationDef,
} from '../../types'
import { carryDefaultAcrossTypes, type EntityErrors, type FieldErrors } from './validation'
import { EnumValuesEditor } from './EnumValuesEditor'
import { RelationsEditor } from './RelationsEditor'
import { cloneWithNewUids, newUid } from './uid'
import { focusRowWhenRendered, focusWithinRow } from './focus'
import { moveItem } from './reorder'
import { entityOptApplicability, summarizeEntity } from './summary'
import { QuickAddFields } from './QuickAddFields'
import { dropIndicatorClass, useDragReorder } from './useDragReorder'
import { uniqueName } from './naming'
import { FieldChips } from './FieldChips'
import { EntitySettingsPanel, settingsSummary } from './EntitySettingsPanel'
import { EntityUiPreview } from './EntityUiPreview'
import { ENTITY_OPT_LABELS, PROJECT_ONLY_OPTS } from './scaffoldOptions'
import { joinEntity } from './joinEntity'
import { enumLabel, pruneLabels } from './enumLabels'

/** A one-click follow-up on a notice — "Undo" after a removal. */
export type NoticeAction = { label: string; onClick: () => void }

const FIELD_TYPES: FullstackFieldType[] = [
  'STRING', 'TEXT', 'LONG', 'INTEGER', 'BOOLEAN',
  'LOCAL_DATE', 'LOCAL_DATE_TIME', 'BIG_DECIMAL', 'UUID', 'ENUM',
]

/** Field-table density. Compact hides the Label column (the label moves into the row's More
 *  panel and shows as a chip) and tightens the row padding. */
export type EditorDensity = 'comfortable' | 'compact'

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
  /** Non-error notices worth a toast (e.g. a default value dropped by a type change). A removal
   *  passes an Undo `action` that puts the specific row back. */
  onNotice?: (message: string, action?: NoticeAction) => void
  /** A row was just added (add, duplicate, join entity, undo-restore) — the parent brings it on
   *  screen even when the outline filter or a collapsed card would hide it. */
  onRowAdded?: (uid: string) => void
  /** Lint suggestions per entity uid — shown as an amber badge next to the red error badge. */
  lintCounts?: Map<string, number>
  /** Open the suggestions panel filtered to one entity (the amber badge's click). */
  onShowLint?: (uid: string) => void
  density?: EditorDensity
  /** When set, only these entity uids render (the navigator's filter). */
  visibleUids?: Set<string>
  /** Language/direction of the generated app, for the per-entity UI preview. */
  previewCtx?: { locale: 'en' | 'he'; rtl: boolean }
  /** Jump to the project-wide Options section (the Overrides panel's "Go to Options"). */
  onGoToOptions?: () => void
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
  if (e.viewQuery) n += 1
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

type PanelKind = 'settings' | 'overrides' | 'preview'

const ICON_BTN = 'p-1.5 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary'
const SMALL_ICON_BTN = 'p-1 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary'

export function EntitiesEditor({
  entities, onChange, errors, noEntities, collapsed, onToggleCollapsed, onDestructive, projectOpts = [], onNotice,
  onRowAdded, lintCounts, onShowLint, density = 'comfortable', visibleUids, previewCtx, onGoToOptions,
}: Props) {
  // The latest list for the Undo closures on removal toasts: they fire after later edits, and must
  // re-insert into the list as it is *then*, not as it was when the row went.
  const entitiesRef = useRef(entities)
  entitiesRef.current = entities
  // One secondary panel open per card at a time: Settings (labels / mapping / SELECT view),
  // Overrides (per-entity opts) or the UI preview. Keyed by entity uid so it follows its card.
  const [panelFor, setPanelFor] = useState<{ key: string; kind: PanelKind } | null>(null)
  function togglePanel(key: string, kind: PanelKind) {
    setPanelFor(prev => (prev?.key === key && prev.kind === kind ? null : { key, kind }))
  }
  function setEntityOpt(eIdx: number, key: FullstackEntityOptKey, value: boolean | undefined) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      const next = { ...(e.opts ?? {}) }
      if (value === undefined) delete next[key]
      else next[key] = value
      return { ...e, opts: Object.keys(next).length > 0 ? next : undefined }
    }))
  }
  // Which field rows have their More panel expanded, keyed by `${entityUid}-${fieldUid}` so the
  // open panel follows its row through duplicate/remove. Rows with an error force open (see isOpen).
  const [expandedFields, setExpandedFields] = useState<Set<string>>(() => new Set())
  function toggleExpand(key: string) {
    setExpandedFields(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }
  function expand(key: string) {
    setExpandedFields(prev => (prev.has(key) ? prev : new Set(prev).add(key)))
  }
  // Which entity has its "Paste fields" panel open (one at a time is plenty).
  const [quickAddFor, setQuickAddFor] = useState<string | null>(null)
  // Drag-and-drop reordering for the entity list ('entities') and each entity's fields
  // ('fields:<entity index>'). One hook serves every list, since the cards render in a loop.
  const dnd = useDragReorder((list, from, to) => {
    if (list === 'entities') {
      onChange(moveItem(entities, from, to))
      return
    }
    const eIdx = Number(list.slice('fields:'.length))
    onChange(entities.map((e, i) => i === eIdx ? { ...e, fields: moveItem(e.fields, from, to) } : e))
  })

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
    const removed = entities[idx]
    const label = removed?.name.trim() || '(unnamed)'
    onDestructive?.(`Removed entity ${label}`)
    onChange(entities.filter((_, i) => i !== idx))
    onNotice?.(`Removed entity ${label}`, { label: 'Undo', onClick: () => restoreEntity(removed, idx) })
  }
  /** Puts a removed entity back at its old position (or the end if the list shrank). */
  function restoreEntity(entity: FullstackEntityDef, idx: number) {
    const current = entitiesRef.current
    if (entity.uid && current.some(e => e.uid === entity.uid)) return
    const next = [...current]
    next.splice(Math.min(idx, next.length), 0, entity)
    onChange(next)
    if (entity.uid) onRowAdded?.(entity.uid)
  }
  function addEntity() {
    const entity = newEntity()
    onChange([...entities, entity])
    if (entity.uid) onRowAdded?.(entity.uid)
    focusRowWhenRendered(entity.uid)
  }
  /** Many-to-many workaround the generator supports today: a join entity between this entity and
   *  `target`, inserted right after this card. */
  function addJoinEntity(eIdx: number, target: string) {
    const owner = entities[eIdx]
    if (!owner?.name.trim()) return
    const entity = joinEntity(owner.name, target, entities.map(e => e.name))
    onChange([...entities.slice(0, eIdx + 1), entity, ...entities.slice(eIdx + 1)])
    if (entity.uid) onRowAdded?.(entity.uid)
    focusRowWhenRendered(entity.uid)
    onNotice?.(`Added ${entity.name} — a join entity with required relations to ${owner.name.trim()} and ${target}`)
  }
  function duplicateEntity(idx: number) {
    const src = entities[idx]
    // Deep copy (fresh uids) so edits to the clone don't mutate the original; the physical
    // mapping is intentionally dropped since two entities can't share a table. The name is
    // uniquified so duplicating twice never yields two identical "XCopy" rows.
    const copy: FullstackEntityDef = {
      ...cloneWithNewUids(src),
      name: src.name.trim() ? uniqueName(`${src.name.trim()}Copy`, entities.map(e => e.name)) : '',
      tableName: undefined,
      schema: undefined,
    }
    onChange([...entities.slice(0, idx + 1), copy, ...entities.slice(idx + 1)])
    if (copy.uid) onRowAdded?.(copy.uid)
    focusRowWhenRendered(copy.uid)
  }
  function updateField(eIdx: number, fIdx: number, updates: Partial<FullstackFieldDef>) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: e.fields.map((f, j) => j === fIdx ? { ...f, ...updates } : f) }
    }))
  }
  // Changing a field's type clears attributes that no longer apply, so we never send
  // an orphaned length (non-STRING) or enumValues (non-ENUM) — the backend rejects both. Every
  // cleared attribute is named in one notice, with Undo, since the user typed each of them.
  function changeFieldType(eIdx: number, fIdx: number, type: FullstackFieldType) {
    const owner = entities[eIdx]
    const field = owner?.fields[fIdx]
    if (!owner || !field || field.type === type) return
    const updates: Partial<FullstackFieldDef> = { type }
    if (type !== 'STRING') updates.length = undefined
    if (type !== 'ENUM') { updates.enumValues = undefined; updates.enumLabels = undefined }
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
    // A default is typed per field type: keep it across the lossless pairs (STRING↔TEXT,
    // LONG↔INTEGER), otherwise drop it.
    const kept = carryDefaultAcrossTypes(field.type, type, field.defaultValue)
    updates.defaultValue = kept
    updateField(eIdx, fIdx, updates)

    const dropped: string[] = []
    const cleared = (key: keyof FullstackFieldDef) => key in updates && updates[key] === undefined && field[key] != null
    if (cleared('length')) dropped.push(`length ${field.length}`)
    if (cleared('enumValues') && field.enumValues?.length) dropped.push(`${field.enumValues.length} enum value${field.enumValues.length === 1 ? '' : 's'}${Object.keys(field.enumLabels ?? {}).length ? ' and their labels' : ''}`)
    if (cleared('pattern') && field.pattern) dropped.push('pattern')
    if (cleared('email') && field.email) dropped.push('email check')
    if (cleared('min')) dropped.push(`min ${field.min}`)
    if (cleared('max')) dropped.push(`max ${field.max}`)
    if (cleared('generated') && field.generated) dropped.push('auto-generated')
    if (cleared('searchable') && field.searchable === false) dropped.push('search opt-out')
    if (cleared('filterable') && field.filterable === false) dropped.push('filter opt-out')
    if (field.defaultValue?.trim() && kept === undefined) dropped.push(`default "${field.defaultValue.trim()}"`)
    if (dropped.length === 0) return
    const before = { ...field }
    const ownerUid = owner.uid
    onNotice?.(
      `Changed ${field.name.trim() || 'the field'} to ${type} — cleared ${dropped.join(', ')}`,
      { label: 'Undo', onClick: () => restoreField(ownerUid, before, fIdx) },
    )
  }
  /** Puts a field back into its entity — replacing the row with the same uid if it is still
   *  there (type-change undo), else re-inserting at its old index (removal undo). */
  function restoreField(ownerUid: string | undefined, field: FullstackFieldDef, idx: number) {
    const current = entitiesRef.current
    const eIdx = current.findIndex(e => e.uid === ownerUid)
    if (eIdx < 0) return
    onChange(current.map((e, i) => {
      if (i !== eIdx) return e
      const at = e.fields.findIndex(f => f.uid === field.uid)
      if (at >= 0) return { ...e, fields: e.fields.map((f, j) => (j === at ? field : f)) }
      const fields = [...e.fields]
      fields.splice(Math.min(idx, fields.length), 0, field)
      return { ...e, fields }
    }))
    if (ownerUid) onRowAdded?.(ownerUid)
  }
  /** Re-inserts a removed relation into its entity at its old index. */
  function restoreRelation(ownerUid: string | undefined, relation: FullstackRelationDef, idx: number) {
    const current = entitiesRef.current
    const eIdx = current.findIndex(e => e.uid === ownerUid)
    if (eIdx < 0) return
    onChange(current.map((e, i) => {
      if (i !== eIdx) return e
      if ((e.relations ?? []).some(r => r.uid === relation.uid)) return e
      const relations = [...(e.relations ?? [])]
      relations.splice(Math.min(idx, relations.length), 0, relation)
      return { ...e, relations }
    }))
    if (ownerUid) onRowAdded?.(ownerUid)
  }

  function updateRelations(eIdx: number, relations: FullstackRelationDef[]) {
    updateEntity(eIdx, { relations })
  }
  // All entity names (non-blank) — valid FK targets for the relations editor.
  const entityNames = entities.map(e => e.name.trim()).filter(Boolean)
  function duplicateField(eIdx: number, fIdx: number) {
    let copyUid: string | undefined
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      const src = e.fields[fIdx]
      const taken = [...e.fields.map(f => f.name), ...(e.relations ?? []).map(r => r.fieldName)]
      const copy: FullstackFieldDef = {
        ...src,
        uid: newUid(),
        name: src.name.trim() ? uniqueName(`${src.name.trim()}Copy`, taken) : '',
        enumValues: src.enumValues ? [...src.enumValues] : undefined,
        enumLabels: src.enumLabels ? { ...src.enumLabels } : undefined,
      }
      copyUid = copy.uid
      return { ...e, fields: [...e.fields.slice(0, fIdx + 1), copy, ...e.fields.slice(fIdx + 1)] }
    }))
    focusRowWhenRendered(copyUid)
  }
  function removeField(eIdx: number, fIdx: number) {
    const owner = entities[eIdx]
    const removed = owner?.fields[fIdx]
    const label = `Removed field ${removed?.name.trim() || '(unnamed)'} from ${owner?.name.trim() || '(unnamed)'}`
    onDestructive?.(label)
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: e.fields.filter((_, j) => j !== fIdx) }
    }))
    if (removed) onNotice?.(label, { label: 'Undo', onClick: () => restoreField(owner?.uid, removed, fIdx) })
  }
  function addField(eIdx: number) {
    const field = newField()
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: [...e.fields, field] }
    }))
    focusRowWhenRendered(field.uid)
  }
  // Ticking "SELECT view" is the first step of typing the query: open Settings and put the
  // caret in the textarea rather than leaving a red error for the user to hunt down.
  function tickView(eIdx: number, key: string, uid: string | undefined, checked: boolean) {
    updateEntity(eIdx, { viewQuery: checked ? '' : undefined })
    if (checked) {
      setPanelFor({ key, kind: 'settings' })
      focusWithinRow(uid, 'textarea[aria-label="View SELECT query"]')
    }
  }

  const compact = density === 'compact'
  const cell = compact ? 'py-1 px-1.5' : 'py-1.5 px-2'
  const fieldColumns = compact ? 9 : 10
  let visibleCount = 0

  return (
    <div className="space-y-6">
      {entities.map((entity, eIdx) => {
        if (visibleUids && !(entity.uid && visibleUids.has(entity.uid))) return null
        visibleCount += 1
        const eErr = errors?.[eIdx]
        // Mirror the backend down-grade rules so the picker only offers a mode the entity supports:
        // kanban groups by an ENUM/BOOLEAN field and writes the value back (needs a writable entity);
        // calendar places records by a LOCAL_DATE/LOCAL_DATE_TIME field.
        const isView = entity.viewQuery != null
        const kanbanOk = !entity.readOnly && !isView
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
          // Toggle and re-sort into canonical order so the first (= the generated page's initial
          // mode) is deterministic regardless of click order. The last remaining view can't be
          // removed — its button is disabled below, so an empty set never gets here.
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
        const lintCount = lintCounts?.get(entityKey) ?? 0
        const isCollapsed = Boolean(collapsed?.has(entityKey))
        const relCount = entity.relations?.length ?? 0
        const summary = summarizeEntity(entity, projectOpts)
        const optApplicability = entityOptApplicability(entity)
        const cardDrop = dnd.indicatorFor('entities', eIdx)
        const settingsChips = settingsSummary(entity)
        // A problem inside Settings (blank query, generated PK / relations on a view) forces it open.
        const settingsForced = Boolean(eErr?.viewQuery)
        const settingsOpen = settingsForced || (panelFor?.key === entityKey && panelFor.kind === 'settings')
        const overridesOpen = panelFor?.key === entityKey && panelFor.kind === 'overrides'
        const previewOpen = panelFor?.key === entityKey && panelFor.kind === 'preview'
        const overrideCount = entity.opts ? Object.keys(entity.opts).length : 0
        return (
        <div
          key={entityKey}
          data-entity-index={eIdx}
          data-row-uid={entity.uid}
          {...dnd.rowProps('entities', eIdx)}
          className={`border rounded-xl p-5 bg-surface-container shadow-sm space-y-4 ${errCount > 0 ? 'border-error/40' : 'border-outline-variant'} ${
            cardDrop === 'before' ? 'border-t-4 border-t-primary' : cardDrop === 'after' ? 'border-b-4 border-b-primary' : ''} ${
            dnd.isDragging('entities', eIdx) ? 'opacity-40' : ''}`}
        >
          {/* Header: identity (row 1) split from the generated-page behaviour (row 2). The
              secondary attributes (labels, mapping, SELECT view) live behind Settings. */}
          <div className="rounded-lg bg-primary/[0.04] border border-outline-variant px-3 py-2.5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {entities.length > 1 && (
                  <span
                    {...dnd.handleProps('entities', eIdx)}
                    role="button"
                    aria-label="Drag to reorder entity"
                    title="Drag to reorder (entity order = nav order in the generated app)"
                    className="material-symbols-outlined -ml-2 cursor-grab active:cursor-grabbing text-secondary/60 hover:text-secondary select-none shrink-0"
                    style={{ fontSize: '20px' }}
                  >
                    drag_indicator
                  </span>
                )}
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
                    {(entity.readOnly || isView) && <span>· {isView ? 'view' : 'read-only'}</span>}
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
                {lintCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onShowLint?.(entityKey)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning text-[11px] font-semibold shrink-0 hover:bg-warning/25 transition-colors"
                    title={`${lintCount} suggestion${lintCount === 1 ? '' : 's'} for this entity — click to see`}
                    aria-label={`${lintCount} suggestion${lintCount === 1 ? '' : 's'} for ${entity.name.trim() || 'this entity'}`}
                    data-lint-badge
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>lightbulb</span>
                    {lintCount}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {entities.length > 1 && (
                  <>
                    <button type="button" onClick={() => moveEntity(eIdx, -1)} disabled={eIdx === 0} className={ICON_BTN}
                            title="Move entity up (earlier in the generated nav)" aria-label="Move entity up">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_upward</span>
                    </button>
                    <button type="button" onClick={() => moveEntity(eIdx, 1)} disabled={eIdx === entities.length - 1} className={ICON_BTN}
                            title="Move entity down" aria-label="Move entity down">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_downward</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => togglePanel(entityKey, 'preview')}
                  aria-pressed={previewOpen}
                  className={`p-1.5 rounded transition-colors ${previewOpen ? 'text-primary bg-primary/10' : 'text-secondary hover:text-primary hover:bg-primary/10'}`}
                  title="Preview the generated list page and form for this entity"
                  aria-label="Preview UI"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>preview</span>
                </button>
                <button type="button" onClick={() => duplicateEntity(eIdx)} className={ICON_BTN} title="Duplicate entity" aria-label="Duplicate entity">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>content_copy</span>
                </button>
                <button
                  type="button"
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
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {/* Settings: display labels, schema/table, SELECT view — summarised when closed. */}
              <span className="inline-flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => togglePanel(entityKey, 'settings')}
                  aria-expanded={settingsOpen}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${settingsOpen || settingsChips.length > 0 ? 'text-primary bg-primary/10' : 'text-secondary hover:text-primary hover:bg-primary/5'}`}
                  title="Display labels, schema / table name, SELECT-backed view"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>settings</span>
                  Settings
                </button>
                {settingsChips.length > 0 && !settingsOpen && (
                  <span className="text-[11px] text-secondary truncate max-w-[18rem]" title={settingsChips.join(' · ')} data-settings-summary>
                    {settingsChips.join(' · ')}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => togglePanel(entityKey, 'overrides')}
                aria-expanded={overridesOpen}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${overrideCount > 0 || overridesOpen ? 'text-primary bg-primary/10' : 'text-secondary hover:text-primary hover:bg-primary/5'}`}
                title="Turn a project-wide scaffolding option on or off for this entity only"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>tune</span>
                Overrides{overrideCount > 0 ? ` (${overrideCount})` : ''}
              </button>
              <label
                className="flex items-center gap-1.5 text-xs text-secondary shrink-0 cursor-pointer"
                title={isView ? 'A SELECT-backed view is always read-only' : 'Generate GET-only scaffolding (no create/update/delete)'}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  aria-label="Read-only"
                  checked={Boolean(entity.readOnly) || isView}
                  disabled={isView}
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
                    // Disabled blocks *adding* an unsupported view (an already-selected one can
                    // still be removed, so it never gets stuck after its field is deleted) and
                    // removing the last remaining view — a page needs at least one.
                    const lastRemaining = selected && views.length === 1
                    const interactive = (opt.applicable || selected) && !lastRemaining
                    const title = lastRemaining ? 'At least one view is required' : opt.applicable ? undefined : opt.hint
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        aria-pressed={selected}
                        disabled={!interactive}
                        title={title}
                        onClick={() => toggleView(opt.key)}
                        className={`px-2 py-1 transition-colors ${selected ? 'bg-primary text-on-primary' : 'bg-background text-secondary hover:text-on-surface'} ${interactive ? '' : lastRemaining ? 'cursor-default' : 'opacity-40 cursor-not-allowed'}`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
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
            {/* The full endpoint list, opts included — what a checkbox in Options actually adds here. */}
            {!isCollapsed && (
            <details className="text-[11px]" data-entity-generates>
              <summary className="cursor-pointer select-none text-secondary hover:text-on-surface inline-flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>list_alt</span>
                Generates {summary.endpoints.length} endpoint{summary.endpoints.length === 1 ? '' : 's'}
                {summary.opts.length > 0 && <span className="text-secondary/70"> · {summary.opts.join(', ')}</span>}
              </summary>
              <ul className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-on-surface">
                {summary.endpoints.map(ep => (
                  <li key={`${ep.method} ${ep.path}`} className="flex items-baseline gap-2 min-w-0">
                    <span className="w-14 shrink-0 text-[10px] font-bold tracking-wide text-secondary">{ep.method}</span>
                    <span className="truncate">{ep.path}</span>
                  </li>
                ))}
              </ul>
            </details>
            )}
          </div>

          {!isCollapsed && (<>
          {settingsOpen && (
            <EntitySettingsPanel
              entity={entity}
              errors={eErr}
              onUpdate={updates => updateEntity(eIdx, updates)}
              onTickView={checked => tickView(eIdx, entityKey, entity.uid, checked)}
            />
          )}
          {overridesOpen && (
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
                  // The backend silently drops a flag the entity can't carry (a view can't be
                  // audited, a composite key can't be soft-deleted…) — say so next to the switch.
                  const resolvedOn = value ?? projectOn
                  const applicability = optApplicability[key]
                  const noEffect = resolvedOn && !applicability.applicable ? applicability.reason : undefined
                  return (
                    <label key={key} className="flex flex-col gap-1 text-xs">
                      <span className="flex items-center justify-between gap-2">
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
                      </span>
                      {noEffect && (
                        <span data-opt-no-effect className={`inline-flex items-center gap-1 text-[10px] ${value === true ? 'text-warning' : 'text-secondary'}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>info</span>
                          Has no effect: {noEffect}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
              {/* The flags that have no per-entity switch, with their project value, so nobody
                  hunts this panel for an OpenAPI or demo-data override that cannot exist. */}
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-secondary border-t border-outline-variant pt-2" data-project-only-opts>
                <span>Project-wide only:</span>
                {PROJECT_ONLY_OPTS.map((opt, i) => (
                  <span key={opt.value}>
                    {opt.label} <span className="font-mono">({projectOpts.includes(opt.value) ? 'on' : 'off'})</span>{i < PROJECT_ONLY_OPTS.length - 1 ? ',' : '.'}
                  </span>
                ))}
                {onGoToOptions && (
                  <button type="button" onClick={onGoToOptions} className="font-semibold text-primary underline hover:no-underline">
                    Go to Options
                  </button>
                )}
              </p>
            </div>
          )}
          {previewOpen && (
            <EntityUiPreview
              entity={entity}
              entities={entities}
              projectOpts={projectOpts}
              locale={previewCtx?.locale ?? 'en'}
              rtl={previewCtx?.rtl ?? false}
            />
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

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                  <th className="w-6"></th>
                  <th className={`text-left ${cell}`}>Name</th>
                  <th className={`text-left ${cell}`}>Type</th>
                  {!compact && <th className={`text-left ${cell}`} title="Display label for the generated UI (defaults to the field name)">Label</th>}
                  <th className={`text-center ${cell} w-12`} title="Primary key (@Id). Tick more than one for a composite key.">PK</th>
                  <th className={`text-center ${cell} w-12`} title="Generated by the database on insert (IDENTITY for LONG/INTEGER, UUID generator for UUID). Primary key only.">Gen</th>
                  <th className={`text-center ${cell} w-12`} title="Required: NOT NULL column + @NotNull/@NotBlank on the DTO + a required form field">Req</th>
                  <th className={`text-center ${cell} w-12`} title="Unique: a unique constraint on the column; a duplicate value answers 409">Uniq</th>
                  <th className={`text-left ${cell}`} title="Constraints, default value, lock-after-create, search / filter inclusion">More</th>
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
                  // A generated key takes no constraints, default, lock or search/filter — its
                  // More panel only exists in compact mode, for the display label.
                  const generatedKey = Boolean(field.primaryKey && field.generated)
                  const hasMorePanel = !generatedKey || compact
                  const hasErr = Boolean(
                    fErr?.length || fErr?.min || fErr?.max || fErr?.pattern || fErr?.email || fErr?.enumValues || fErr?.defaultValue)
                  const rowKey = `${entityKey}-${fieldKey}`
                  // Force open on error so the message is never hidden behind a collapsed panel.
                  const isOpen = hasMorePanel && (expandedFields.has(rowKey) || hasErr)
                  const fieldList = `fields:${eIdx}`
                  const rowDrop = dnd.indicatorFor(fieldList, fIdx)
                  return (
                  <Fragment key={fieldKey}>
                  <tr
                    className={`${rowDrop ? dropIndicatorClass(rowDrop) : 'border-t border-outline-variant'} ${dnd.isDragging(fieldList, fIdx) ? 'opacity-40' : ''}`}
                    data-row-uid={field.uid}
                    {...dnd.rowProps(fieldList, fIdx)}
                  >
                    <td className="py-1.5 pl-1 align-top">
                      {entity.fields.length > 1 && (
                        <span
                          {...dnd.handleProps(fieldList, fIdx)}
                          role="button"
                          aria-label="Drag to reorder field"
                          title="Drag to reorder (field order = column / form order in the generated app)"
                          className="material-symbols-outlined cursor-grab active:cursor-grabbing text-secondary/60 hover:text-secondary select-none"
                          style={{ fontSize: '16px' }}
                        >
                          drag_indicator
                        </span>
                      )}
                    </td>
                    <td className={`${cell} align-top`}>
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
                    <td className={`${cell} align-top`}>
                      <select
                        aria-label="Field type"
                        className="w-full bg-background border border-outline-variant rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                        value={field.type}
                        onChange={e => changeFieldType(eIdx, fIdx, e.target.value as FullstackFieldType)}
                      >
                        {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    {!compact && (
                      <td className={`${cell} align-top`}>
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
                    )}
                    <td className={`${cell} text-center align-top`}>
                      <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Primary key" checked={!!field.primaryKey}
                        onChange={e => updateField(eIdx, fIdx, e.target.checked ? { primaryKey: true } : { primaryKey: false, generated: undefined })} />
                    </td>
                    <td className={`${cell} text-center align-top`}>
                      <input type="checkbox" aria-label="Auto-generated value" checked={!!field.generated}
                        disabled={!canGenerate}
                        title={canGenerate ? undefined : (pkCount > 1 ? 'A generated key requires a single primary key' : 'Auto-generated applies to a LONG/INTEGER/UUID primary key only')}
                        className="h-4 w-4 accent-primary disabled:opacity-40 disabled:cursor-not-allowed"
                        onChange={e => updateField(eIdx, fIdx, { generated: e.target.checked })} />
                      {fErr?.generated && <p className="mt-0.5 text-[11px] text-error">{fErr.generated}</p>}
                    </td>
                    <td className={`${cell} text-center align-top`}>
                      <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Required (not null)" checked={!!field.required}
                        onChange={e => updateField(eIdx, fIdx, { required: e.target.checked })} />
                    </td>
                    <td className={`${cell} text-center align-top`}>
                      <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Unique" checked={!!field.unique}
                        onChange={e => updateField(eIdx, fIdx, { unique: e.target.checked })} />
                    </td>
                    <td className={`${cell} align-top`}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {hasMorePanel ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand(rowKey)}
                            aria-expanded={isOpen}
                            aria-label={isOpen ? 'Hide field details' : 'Edit field details'}
                            title={hasErr ? 'Problem in this field — fix below' : isOpen ? 'Hide' : 'Constraints, default, lock, search / filter'}
                            className={`inline-flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-medium transition-colors ${
                              hasErr ? 'text-error hover:bg-error/10' : 'text-secondary hover:text-primary hover:bg-primary/10'}`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                              {isOpen ? 'expand_less' : 'tune'}
                            </span>
                            {hasErr && <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>error</span>}
                          </button>
                        ) : (
                          <span className="text-secondary/40 px-1.5" title="A generated key takes no constraints or default" aria-hidden="true">—</span>
                        )}
                        {!isOpen && <FieldChips field={field} includeLabel={compact} onOpen={() => expand(rowKey)} />}
                      </div>
                    </td>
                    <td className={`${cell} text-right align-top`}>
                      <div className="flex items-center justify-end gap-0.5">
                        <button type="button" onClick={() => moveField(eIdx, fIdx, -1)} disabled={fIdx === 0} className={SMALL_ICON_BTN}
                                title="Move field up (earlier column / form row)" aria-label="Move field up">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_upward</span>
                        </button>
                        <button type="button" onClick={() => moveField(eIdx, fIdx, 1)} disabled={fIdx === entity.fields.length - 1} className={SMALL_ICON_BTN}
                                title="Move field down" aria-label="Move field down">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_downward</span>
                        </button>
                        <button type="button" onClick={() => duplicateField(eIdx, fIdx)} className={SMALL_ICON_BTN} title="Duplicate field" aria-label="Duplicate field">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                        </button>
                        <button
                          type="button"
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
                      <td colSpan={fieldColumns} className="px-2 pb-3 pt-0 align-top">
                        <FieldMorePanel
                          field={field}
                          fErr={fErr}
                          isString={isString}
                          isNumeric={isNumeric}
                          isTextSearch={isTextSearch}
                          isFilterableType={isFilterableType}
                          showLabel={compact}
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
                type="button"
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
            fieldNames={entity.fields.map(f => f.name)}
            onChange={rels => updateRelations(eIdx, rels)}
            onRemoved={(rel, rIdx) => onNotice?.(
              `Removed relation ${rel.fieldName.trim() || '(unnamed)'} from ${entity.name.trim() || '(unnamed)'}`,
              { label: 'Undo', onClick: () => restoreRelation(entity.uid, rel, rIdx) },
            )}
            onAddJoinEntity={isView || !entity.name.trim() ? undefined : target => addJoinEntity(eIdx, target)}
            errors={eErr?.relations}
            ownerName={entity.name}
            showInverse={projectOpts.includes('inverseCollections')}
            addDisabledReason={isView
              ? 'A SELECT-backed view maps to a query, not a table, so it cannot own a foreign key.'
              : undefined}
          />
          </>)}
        </div>
        )
      })}

      {visibleUids && entities.length > 0 && visibleCount === 0 && (
        <p className="text-xs text-secondary text-center py-6" data-no-match>
          No entity matches the filter. Clear it in the outline to see all {entities.length} entities.
        </p>
      )}

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
            type="button"
            onClick={addEntity}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:opacity-90 transition-opacity active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Add entity
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={addEntity}
          className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary text-secondary hover:text-primary text-sm font-medium transition-colors"
        >
          + Add entity
        </button>
      )}
    </div>
  )
}

/** Expanded per-field editor: constraints valid for the field's type (STRING → length/pattern/
 *  email, numeric → min/max, ENUM → values), the default value, and the behaviour flags that used
 *  to be table columns (lock after create, search / filter inclusion; plus the display label in
 *  compact density). Only controls that apply to the field are shown. */
function FieldMorePanel({ field, fErr, isString, isNumeric, isTextSearch, isFilterableType, showLabel, onUpdate }: {
  field: FullstackFieldDef
  fErr?: FieldErrors
  isString: boolean
  isNumeric: boolean
  isTextSearch: boolean
  isFilterableType: boolean
  showLabel: boolean
  onUpdate: (updates: Partial<FullstackFieldDef>) => void
}) {
  const inputClass = (error?: string) =>
    `w-full bg-background border rounded px-2 py-1.5 text-xs tabular-nums focus:ring-1 outline-none ${
      error ? 'border-error focus:ring-error/20 focus:border-error'
        : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`
  const takesConstraints = !(field.primaryKey && field.generated)
  const hasBehaviour = !field.primaryKey || isTextSearch
  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-3 rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-3" data-field-more>
      {showLabel && (
        <ConstraintBox label="Display label" wide>
          <input
            type="text"
            aria-label="Display label"
            className={inputClass()}
            value={field.label ?? ''}
            onChange={e => onUpdate({ label: e.target.value || undefined })}
            placeholder={field.name || 'label'}
            title="Display label for the generated UI. Leave blank to derive from the field name."
          />
        </ConstraintBox>
      )}
      {takesConstraints && isString && (
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
      {takesConstraints && isNumeric && (
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
      {takesConstraints && field.type === 'ENUM' && (
        <ConstraintBox label="Enum values" error={fErr?.enumValues} wide>
          <EnumValuesEditor
            values={field.enumValues ?? []}
            onChange={vals => onUpdate({ enumValues: vals, enumLabels: pruneLabels(field.enumLabels, vals) })}
            labels={field.enumLabels}
            onLabelsChange={labels => onUpdate({ enumLabels: labels })}
            invalid={Boolean(fErr?.enumValues)}
          />
        </ConstraintBox>
      )}
      {takesConstraints && (
        <ConstraintBox label="Default value" error={fErr?.defaultValue}>
          <DefaultValueInput field={field} invalid={Boolean(fErr?.defaultValue)} className={inputClass(fErr?.defaultValue)}
            onChange={v => onUpdate({ defaultValue: v === '' ? undefined : v })} />
        </ConstraintBox>
      )}
      {hasBehaviour && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 basis-full pt-1 border-t border-outline-variant/60" data-field-behaviour>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Behaviour</span>
          {!field.primaryKey && (
            <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer"
                   title="Locked after create: set when a row is created and can't be edited afterwards (form disables it, the service never overwrites it)">
              <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Locked after create" checked={!!field.readOnly}
                onChange={e => onUpdate({ readOnly: e.target.checked || undefined })} />
              Locked after create
            </label>
          )}
          {isTextSearch && (
            <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer" title="Include this field in the text-search box">
              <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Include in search" checked={field.searchable !== false}
                onChange={e => onUpdate({ searchable: e.target.checked ? undefined : false })} />
              In search
            </label>
          )}
          {isFilterableType && (
            <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer" title="Include this field in the filter bar">
              <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Include in filter bar" checked={field.filterable !== false}
                onChange={e => onUpdate({ filterable: e.target.checked ? undefined : false })} />
              In filter bar
            </label>
          )}
        </div>
      )}
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
        {(field.enumValues ?? []).map(v => <option key={v} value={v}>{field.enumLabels ? `${v} — ${enumLabel(field, v)}` : v}</option>)}
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

/** Labeled wrapper for one control inside FieldMorePanel. `wide` lets the pattern/enum/label
 *  editors grow to fill remaining width. */
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
