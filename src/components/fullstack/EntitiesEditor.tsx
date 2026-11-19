import { Fragment, memo, useDeferredValue, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { linkIndexKey, parseLinkIndex, type LinkIndex } from './childLists'
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
import { toSnakeCase, uniqueName } from './naming'
import { FieldChips } from './FieldChips'
import { EntitySettingsPanel, settingsSummary } from './EntitySettingsPanel'
import { syncFormSections } from './formSections'
import { syncWorkflow } from './workflow'
import { MAX_FILES, MAX_HELP, syncUniqueKeys } from './uniqueKeys'
import { syncRules } from './rules'
import { ModelEntities } from './modelEntities'
import { WorkflowPanel, workflowSummary } from './WorkflowPanel'
import { EntityUiPreview } from './EntityUiPreview'
import { EntityCodePanel } from './EntityCodePanel'
import type { EntityCodeFile } from './entityCode'
import { ENTITY_OPT_LABELS, PROJECT_ONLY_OPTS } from './scaffoldOptions'
import { joinEntity } from './joinEntity'
import { enumLabel, pruneLabels } from './enumLabels'
import { DEFAULT_CURRENCY, FIELD_TYPES, FIELD_TYPE_LABELS, isAttachmentType, isDateType, isDecimalType, isKeyableType, isNumericType, isTextualType } from './fieldTypes'
import { t, tn, useLang } from '../../i18n'

/** A one-click follow-up on a notice — "Undo" after a removal. */
export type NoticeAction = { label: string; onClick: () => void }


/** Field-table density. Compact hides the Label column (the label moves into the row's More
 *  panel and shows as a chip) and tightens the row padding. */
export type EditorDensity = 'comfortable' | 'compact'

interface Props {
  entities: FullstackEntityDef[]
  onChange: (entities: FullstackEntityDef[]) => void
  errors?: Record<number, EntityErrors>
  /** A problem only the server found (a Generate / Explore 400), on the entity it names — and its
   *  field or relation, when it names one. Shown on that card until the model changes. */
  serverIssue?: EntityServerIssue | null
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
  /** The generated files for one entity, out of the last Explore preview. Omitted (with
   *  `codeState`) the Code button does not render at all. */
  onCodeFiles?: (entity: FullstackEntityDef) => EntityCodeFile[]
  codeState?: {
    hasPreview: boolean
    loading: boolean
    /** The model has changed since the preview was taken. */
    stale: boolean
    onExplore: () => void
  }
  /** Whether an LDAP auth dependency is selected (a workflow's roles need one). */
  ldapAuth?: boolean
  /** Adds a dependency (the workflow panel's "Add ldap-auth-rest"). */
  onAddDep?: (dep: string) => void
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
  if (e.workflow) n += 1
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

/** A server-side problem on one entity (see `serverIssue.ts`): which, and where in it. */
export interface EntityServerIssue {
  entity: number
  field?: number
  relation?: number
  panel?: 'workflow' | 'formSections'
  message: string
}

/** What the server's message is about, in the model's own names. */
function serverIssueSubject(entity: FullstackEntityDef, issue: EntityServerIssue): string {
  const field = issue.field != null ? entity.fields[issue.field] : undefined
  if (field) return t('field “{name}”', { name: field.name.trim() || `#${issue.field! + 1}` })
  const relation = issue.relation != null ? entity.relations?.[issue.relation] : undefined
  if (relation) return t('relation “{name}”', { name: relation.fieldName.trim() || `#${issue.relation! + 1}` })
  if (issue.panel === 'workflow') return t('this entity’s workflow')
  if (issue.panel === 'formSections') return t('this entity’s form sections')
  return t('this entity')
}

function newField(): FullstackFieldDef {
  return { uid: newUid(), name: '', type: 'STRING' }
}

type PanelKind = 'settings' | 'overrides' | 'workflow' | 'preview' | 'code'

/** The default for an omitted `projectOpts` — one array, so the memoized cards can compare it. */
const NO_OPTS: string[] = []

const ICON_BTN = 'p-1.5 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary'
const SMALL_ICON_BTN = 'p-1 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary'

/** Memoized: the Fullstack tab re-renders on every edit anywhere (the layout designer, the setup
 *  panel), and redrawing every entity card for those was most of the cost of a keystroke. */
export const EntitiesEditor = memo(function EntitiesEditor({
  entities, onChange: onChangeRaw, errors, serverIssue, noEntities, collapsed, onToggleCollapsed, onDestructive, projectOpts = NO_OPTS, onNotice,
  onRowAdded, lintCounts, onShowLint, density = 'comfortable', visibleUids, previewCtx, onGoToOptions, onCodeFiles, codeState,
  ldapAuth, onAddDep,
}: Props) {
  // A memo component: it re-renders in a new language because it reads the language itself.
  useLang()
  // Every edit keeps the entity's form sections in step: a renamed field or relation is renamed
  // there, a removed one dropped.
  const onChange = (next: FullstackEntityDef[]) => onChangeRaw(next.map(e => {
    const before = e.uid ? entities.find(x => x.uid === e.uid) : undefined
    return before && before !== e ? syncRules(before, syncUniqueKeys(before, syncWorkflow(before, syncFormSections(before, e)))) : e
  }))
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
    const label = removed?.name.trim() || t('(unnamed)')
    onDestructive?.(t('Removed entity {entity}', { entity: label }))
    onChange(entities.filter((_, i) => i !== idx))
    onNotice?.(t('Removed entity {entity}', { entity: label }), { label: t('Undo'), onClick: () => restoreEntity(removed, idx) })
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
    onNotice?.(t('Added {entity} — a join entity with required relations to {owner} and {target}', { entity: entity.name, owner: owner.name.trim(), target }))
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
    const numeric = isNumericType(type)
    if (!numeric) { updates.min = undefined; updates.max = undefined }
    if (type !== 'STRING') { updates.pattern = undefined; updates.email = undefined }
    // The search/filter opt-out flags only apply to eligible types — clear them when leaving.
    if (!isTextualType(type)) updates.searchable = undefined
    // A currency belongs to money; a key cannot be one of the types a URL cannot carry.
    if (type !== 'MONEY') updates.currency = undefined
    if (!isKeyableType(type)) { updates.primaryKey = undefined; updates.generated = undefined }
    // A file has no typed default, and every upload is its own file.
    if (isAttachmentType(type)) { updates.unique = undefined }
    const temporal = isDateType(type)
    if (!(type === 'ENUM' || type === 'BOOLEAN' || temporal || numeric)) updates.filterable = undefined
    // A default is typed per field type: keep it across the lossless pairs (STRING↔TEXT,
    // LONG↔INTEGER), otherwise drop it.
    const kept = carryDefaultAcrossTypes(field.type, type, field.defaultValue)
    updates.defaultValue = kept
    updateField(eIdx, fIdx, updates)

    const dropped: string[] = []
    const cleared = (key: keyof FullstackFieldDef) => key in updates && updates[key] === undefined && field[key] != null
    if (cleared('length')) dropped.push(t('length {n}', { n: field.length! }))
    if (cleared('enumValues') && field.enumValues?.length) {
      dropped.push(Object.keys(field.enumLabels ?? {}).length
        ? tn(field.enumValues.length, '{n} enum value and their labels', '{n} enum values and their labels')
        : tn(field.enumValues.length, '{n} enum value', '{n} enum values'))
    }
    if (cleared('pattern') && field.pattern) dropped.push(t('pattern'))
    if (cleared('email') && field.email) dropped.push(t('email check'))
    if (cleared('min')) dropped.push(t('min {n}', { n: field.min! }))
    if (cleared('max')) dropped.push(t('max {n}', { n: field.max! }))
    if (cleared('generated') && field.generated) dropped.push(t('auto-generated'))
    if (cleared('searchable') && field.searchable === false) dropped.push(t('search opt-out'))
    if (cleared('filterable') && field.filterable === false) dropped.push(t('filter opt-out'))
    if (field.defaultValue?.trim() && kept === undefined) dropped.push(t('default "{value}"', { value: field.defaultValue.trim() }))
    if (dropped.length === 0) return
    const before = { ...field }
    const ownerUid = owner.uid
    onNotice?.(
      t('Changed {field} to {type} — cleared {what}', { field: field.name.trim() || t('the field'), type, what: dropped.join(', ') }),
      { label: t('Undo'), onClick: () => restoreField(ownerUid, before, fIdx) },
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
  // All entity names (non-blank) — valid FK targets for the relations editor. Kept as the same
  // array while the names are unchanged, so a field edit leaves the other cards alone; deferred, so
  // typing an entity's name redraws the other cards' target lists after the keystroke, not in it.
  const entityNamesKey = useDeferredValue(entities.map(e => e.name.trim()).filter(Boolean).join('\n'))
  const entityNames = useMemo(() => (entityNamesKey ? entityNamesKey.split('\n') : []), [entityNamesKey])
  // Which foreign keys point where — what a one-to-many can read. Compared by value, like the names.
  const linkKey = useDeferredValue(linkIndexKey(entities))
  const linkIndex = useMemo(() => parseLinkIndex(linkKey), [linkKey])
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
        column: undefined,
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
    const label = t('Removed field {field} from {entity}', { field: removed?.name.trim() || t('(unnamed)'), entity: owner?.name.trim() || t('(unnamed)') })
    onDestructive?.(label)
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: e.fields.filter((_, j) => j !== fIdx) }
    }))
    if (removed) onNotice?.(label, { label: t('Undo'), onClick: () => restoreField(owner?.uid, removed, fIdx) })
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
      focusWithinRow(uid, 'textarea[data-view-query]')
    }
  }

  const helpers: CardApi = {
    moveEntity, togglePanel, duplicateEntity, removeEntity, updateEntity, tickView, setEntityOpt, updateField,
    changeFieldType, toggleExpand, expand, moveField, duplicateField, removeField, addField, setQuickAddFor,
    addFields, updateRelations, restoreRelation, addJoinEntity,
  }
  const helpersRef = useRef(helpers)
  helpersRef.current = helpers
  const [api] = useState(() => Object.fromEntries(Object.keys(helpers).map(name => [
    name, (...args: unknown[]) => (helpersRef.current[name as keyof CardApi] as (...a: unknown[]) => unknown)(...args),
  ])) as unknown as CardApi)
  /** One card's expanded field rows, as a string — equal strings let the card skip rendering. */
  const expandedRowsOf = (entityKey: string) => {
    const prefix = `${entityKey}-`
    let rows = ''
    for (const key of expandedFields) if (key.startsWith(prefix)) rows += rows ? `\n${key}` : key
    return rows
  }
  let visibleCount = 0

  return (
    <ModelEntities.Provider value={entities}>
    <div className="space-y-6">
      {entities.map((entity, eIdx) => {
        if (visibleUids && !(entity.uid && visibleUids.has(entity.uid))) return null
        visibleCount += 1
        const entityKey = entity.uid ?? `i${eIdx}`
        const panelKind = panelFor?.key === entityKey ? panelFor.kind : null
        return (
          <EntityCard
            key={entityKey}
            entity={entity}
            eIdx={eIdx}
            entityCount={entities.length}
            eErr={errors?.[eIdx]}
            serverIssue={serverIssue?.entity === eIdx ? serverIssue : undefined}
            lintCount={lintCounts?.get(entityKey) ?? 0}
            isCollapsed={Boolean(collapsed?.has(entityKey))}
            panelKind={panelKind}
            expandedRows={expandedRowsOf(entityKey)}
            quickAddOpen={quickAddFor === entityKey}
            entityNames={entityNames}
            linkIndex={linkIndex}
            previewEntities={panelKind === 'preview' ? entities : undefined}
            dnd={dnd}
            dndKey={dnd.stateKey}
            density={density}
            projectOpts={projectOpts}
            previewCtx={previewCtx}
            codeState={codeState}
            onCodeFiles={onCodeFiles}
            onGoToOptions={onGoToOptions}
            ldapAuth={ldapAuth}
            onAddDep={onAddDep}
            onShowLint={onShowLint}
            onToggleCollapsed={onToggleCollapsed}
            onNotice={onNotice}
            api={api}
          />
        )
      })}

      {visibleUids && entities.length > 0 && visibleCount === 0 && (
        <p className="text-xs text-secondary text-center py-6" data-no-match>
          {t('No entity matches the filter. Clear it in the outline to see all {n} entities.', { n: entities.length })}
        </p>
      )}

      {entities.length === 0 ? (
        <div
          data-error={noEntities ? '' : undefined}
          className={`flex flex-col items-center text-center gap-3 px-6 py-12 rounded-xl border-2 border-dashed ${noEntities ? 'border-error/40' : 'border-outline-variant'}`}
        >
          <span className="material-symbols-outlined text-secondary/60" style={{ fontSize: '40px' }}>table_chart</span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-on-surface">{t('No entities yet')}</p>
            <p className="text-xs text-secondary max-w-xs">
              {t('Add an entity to define its fields and relations — pick an example above, or import from DDL/SELECT.')}
            </p>
            {noEntities && (
              <p className="text-[11px] text-error flex items-center justify-center gap-1" role="alert">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
                {t('At least one entity is required to generate.')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={addEntity}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:opacity-90 transition-opacity active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            {t('Add entity')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={addEntity}
          className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary text-secondary hover:text-primary text-sm font-medium transition-colors"
        >
          + {t('Add entity')}
        </button>
      )}
    </div>
    </ModelEntities.Provider>
  )
})

/** What every card calls back into: the editor's helpers, through one object whose identity never
 *  changes and that always runs the editor's latest render — so a card that skipped a render still
 *  edits the current list, never the one it last saw. */
interface CardApi {
  moveEntity(idx: number, delta: -1 | 1): void
  togglePanel(key: string, kind: PanelKind): void
  duplicateEntity(idx: number): void
  removeEntity(idx: number): void
  updateEntity(idx: number, updates: Partial<FullstackEntityDef>): void
  tickView(eIdx: number, key: string, uid: string | undefined, checked: boolean): void
  setEntityOpt(eIdx: number, key: FullstackEntityOptKey, value: boolean | undefined): void
  updateField(eIdx: number, fIdx: number, updates: Partial<FullstackFieldDef>): void
  changeFieldType(eIdx: number, fIdx: number, type: FullstackFieldType): void
  toggleExpand(key: string): void
  expand(key: string): void
  moveField(eIdx: number, fIdx: number, delta: -1 | 1): void
  duplicateField(eIdx: number, fIdx: number): void
  removeField(eIdx: number, fIdx: number): void
  addField(eIdx: number): void
  setQuickAddFor: Dispatch<SetStateAction<string | null>>
  addFields(eIdx: number, fields: FullstackFieldDef[]): void
  updateRelations(eIdx: number, relations: FullstackRelationDef[]): void
  restoreRelation(ownerUid: string | undefined, relation: FullstackRelationDef, idx: number): void
  addJoinEntity(eIdx: number, target: string): void
}

interface EntityCardProps {
  entity: FullstackEntityDef
  eIdx: number
  entityCount: number
  eErr?: EntityErrors
  /** Set only on the card the server's issue names (the others keep their props, and their render). */
  serverIssue?: EntityServerIssue
  lintCount: number
  isCollapsed: boolean
  /** The secondary panel open on this card, if any. */
  panelKind: PanelKind | null
  /** This card's expanded field rows (`${entityKey}-${fieldKey}`), newline-joined so it compares by value. */
  expandedRows: string
  quickAddOpen: boolean
  entityNames: string[]
  /** Every (child, parent) pair's foreign keys — the links a one-to-many can read. */
  linkIndex: LinkIndex
  /** The whole model, only while this card's UI preview is open (it draws relation pickers). */
  previewEntities?: FullstackEntityDef[]
  dnd: ReturnType<typeof useDragReorder>
  dndKey: string
  density: EditorDensity
  projectOpts: string[]
  previewCtx?: Props['previewCtx']
  codeState?: Props['codeState']
  onCodeFiles?: Props['onCodeFiles']
  onGoToOptions?: Props['onGoToOptions']
  ldapAuth?: boolean
  onAddDep?: Props['onAddDep']
  onShowLint?: Props['onShowLint']
  onToggleCollapsed?: Props['onToggleCollapsed']
  onNotice?: Props['onNotice']
  api: CardApi
}

/** One entity's card. Memoized: typing in one card used to redraw every other card too, which on
 *  a model of a dozen entities was most of the cost of a keystroke. `api` is stable and `dnd` is
 *  compared through `dndKey`; every other prop by identity. */
const EntityCard = memo(function EntityCard({
  entity, eIdx, entityCount, eErr, serverIssue, lintCount, isCollapsed, panelKind, expandedRows, quickAddOpen, entityNames, linkIndex,
  previewEntities, dnd, density, projectOpts, previewCtx, codeState, onCodeFiles, onGoToOptions, ldapAuth, onAddDep,
  onShowLint, onToggleCollapsed, onNotice, api,
}: EntityCardProps) {
  // A memo component: it re-renders in a new language because it reads the language itself.
  useLang()
  const entityKey = entity.uid ?? `i${eIdx}`
  const expanded = useMemo(() => new Set(expandedRows ? expandedRows.split('\n') : []), [expandedRows])
  const compact = density === 'compact'
  const cell = compact ? 'py-1 px-1.5' : 'py-1.5 px-2'
  const fieldColumns = compact ? 9 : 10
            // Mirror the backend down-grade rules so the picker only offers a mode the entity supports:
    // kanban groups by an ENUM/BOOLEAN field and writes the value back (needs a writable entity);
    // calendar places records by a LOCAL_DATE/LOCAL_DATE_TIME field.
    const isView = entity.viewQuery != null
    const kanbanOk = !entity.readOnly && !isView
      && entity.fields.some(f => f.type === 'ENUM' || f.type === 'BOOLEAN')
    const calendarOk = entity.fields.some(f => isDateType(f.type))
    // Which list views are enabled (back-compat: fall back to the legacy single listView, else table).
    const views: string[] = entity.listViews ?? (entity.listView ? [entity.listView] : ['table'])
    const VIEW_ORDER = ['table', 'cards', 'kanban', 'calendar', 'gallery']
    const viewOptions = [
      { key: 'table', label: t('Table'), applicable: true, hint: '' },
      { key: 'cards', label: t('Cards'), applicable: true, hint: '' },
      { key: 'kanban', label: t('Kanban'), applicable: kanbanOk, hint: t('Needs an enum/boolean field') },
      { key: 'calendar', label: t('Calendar'), applicable: calendarOk, hint: t('Needs a date field') },
      { key: 'gallery', label: t('Gallery'), applicable: entity.fields.some(f => f.type === 'IMAGE'), hint: t('Needs an image field') },
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
      api.updateEntity(eIdx, { listViews: next as FullstackEntityDef['listViews'], listView: undefined })
    }
            // Loop-invariant: hoisted out of the per-field map below.
    const pkCount = entity.fields.filter(f => f.primaryKey).length
    const errCount = countEntityErrors(eErr)
                    const relCount = entity.relations?.length ?? 0
    const summary = summarizeEntity(entity, projectOpts)
    const optApplicability = entityOptApplicability(entity)
    const cardDrop = dnd.indicatorFor('entities', eIdx)
    const settingsChips = settingsSummary(entity)
    // A problem inside Settings (blank query, generated PK / relations on a view) forces it open.
    const settingsForced = Boolean(eErr?.viewQuery || eErr?.formSections || eErr?.access || eErr?.uniqueKeys || eErr?.rules || eErr?.tableName)
    const settingsOpen = settingsForced || panelKind === 'settings'
    const overridesOpen = panelKind === 'overrides'
    // A workflow problem forces its panel open, like Settings.
    const workflowOpen = Boolean(eErr?.workflow) || panelKind === 'workflow'
    const workflowChip = workflowSummary(entity)
    const previewOpen = panelKind === 'preview'
    const codeOpen = panelKind === 'code'
    const overrideCount = entity.opts ? Object.keys(entity.opts).length : 0
    return (
    <div
      key={entityKey}
      data-entity-index={eIdx}
      data-row-uid={entity.uid}
      {...dnd.rowProps('entities', eIdx)}
      className={`border rounded-2xl p-5 glass-card shadow-sm space-y-4 ${errCount > 0 ? 'border-error/40' : 'border-outline-variant'} ${
        cardDrop === 'before' ? 'border-t-4 border-t-primary' : cardDrop === 'after' ? 'border-b-4 border-b-primary' : ''} ${
        dnd.isDragging('entities', eIdx) ? 'opacity-40' : ''}`}
    >
      {serverIssue && (
        <p role="alert" data-error data-server-issue tabIndex={-1}
           className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-xs text-error outline-none focus-visible:ring-2 focus-visible:ring-error/40">
          <span className="font-semibold">{t('The server rejected {subject}:', { subject: serverIssueSubject(entity, serverIssue) })}</span>{' '}
          {serverIssue.message}
        </p>
      )}
      {/* Header: identity (row 1), then the generated-page behaviour with the endpoint
          headline on its right (row 2), then the derivation detail behind one disclosure.
          Secondary attributes (labels, mapping, read-only, SELECT view) live behind Settings,
          so the header stays two rows deep on a laptop. */}
      <div className="rounded-lg bg-primary/[0.04] px-3 py-2.5 space-y-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {entityCount > 1 && (
              <span
                {...dnd.handleProps('entities', eIdx)}
                role="button"
                aria-label={t('Drag to reorder entity')}
                title={t('Drag to reorder (entity order = nav order in the generated app)')}
                className="material-symbols-outlined -ms-2 cursor-grab active:cursor-grabbing text-secondary/60 hover:text-secondary select-none shrink-0"
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
                aria-label={isCollapsed ? t('Expand entity') : t('Collapse entity')}
                title={isCollapsed ? t('Expand') : t('Collapse')}
                className="p-0.5 -ms-1 rounded text-secondary hover:text-on-surface hover:bg-primary/10 transition-colors shrink-0"
              >
                <span className={`material-symbols-outlined ${isCollapsed ? 'flip-rtl' : ''}`} style={{ fontSize: '20px' }}>
                  {isCollapsed ? 'chevron_right' : 'expand_more'}
                </span>
              </button>
            )}
            <div className="flex-1 max-w-sm">
              <input
                type="text"
                dir="ltr"
                aria-label={t('Entity name')}
                aria-invalid={Boolean(eErr?.name)}
                className={`w-full bg-background border rounded px-3 py-2 text-sm font-mono text-on-surface focus:ring-2 outline-none ${eErr?.name ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                placeholder="User, Order, Product…"
                value={entity.name}
                onChange={e => api.updateEntity(eIdx, { name: e.target.value })}
              />
              {eErr?.name && <p className="mt-1 text-[11px] text-error">{eErr.name}</p>}
            </div>
            {isCollapsed && (
              <span className="hidden sm:inline-flex items-center gap-2 text-[11px] text-secondary shrink-0">
                <span>{tn(entity.fields.length, '{n} field', '{n} fields')}</span>
                {relCount > 0 && <span>· {tn(relCount, '{n} relation', '{n} relations')}</span>}
                {(entity.readOnly || isView) && <span>· {isView ? t('SELECT view') : t('read-only')}</span>}
                <span className="font-mono">· <span dir="ltr">{summary.path}</span></span>
              </span>
            )}
            {errCount > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error/10 text-error text-[11px] font-semibold shrink-0"
                title={tn(errCount, '{n} issue on this entity', '{n} issues on this entity')}
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
                title={tn(lintCount, '{n} suggestion for this entity — click to see', '{n} suggestions for this entity — click to see')}
                aria-label={tn(lintCount, '{n} suggestion for {entity}', '{n} suggestions for {entity}', { entity: entity.name.trim() || t('this entity') })}
                data-lint-badge
              >
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>lightbulb</span>
                {lintCount}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {entityCount > 1 && (
              <>
                <button type="button" onClick={() => api.moveEntity(eIdx, -1)} disabled={eIdx === 0} className={ICON_BTN}
                        title={t('Move entity up (earlier in the generated nav)')} aria-label={t('Move entity up')}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_upward</span>
                </button>
                <button type="button" onClick={() => api.moveEntity(eIdx, 1)} disabled={eIdx === entityCount - 1} className={ICON_BTN}
                        title={t('Move entity down')} aria-label={t('Move entity down')}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_downward</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => api.togglePanel(entityKey, 'preview')}
              aria-pressed={previewOpen}
              className={`p-1.5 rounded transition-colors ${previewOpen ? 'text-primary bg-primary/10' : 'text-secondary hover:text-primary hover:bg-primary/10'}`}
              title={t('Preview the generated list page and form for this entity (a mock, drawn here)')}
              aria-label={t('Preview UI')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>preview</span>
            </button>
            {onCodeFiles && (
              <button
                type="button"
                onClick={() => api.togglePanel(entityKey, 'code')}
                aria-pressed={codeOpen}
                className={`p-1.5 rounded transition-colors ${codeOpen ? 'text-primary bg-primary/10' : 'text-secondary hover:text-primary hover:bg-primary/10'}`}
                title={t('The code this entity generates, from the last Explore preview')}
                aria-label={t('Generated code')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>code</span>
              </button>
            )}
            <button type="button" onClick={() => api.duplicateEntity(eIdx)} className={ICON_BTN} title={t('Duplicate entity')} aria-label={t('Duplicate entity')}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>content_copy</span>
            </button>
            <button
              type="button"
              onClick={() => api.removeEntity(eIdx)}
              className="p-1.5 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
              title={t('Remove entity')}
              aria-label={t('Remove entity')}
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
              onClick={() => api.togglePanel(entityKey, 'settings')}
              aria-expanded={settingsOpen}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${settingsOpen || settingsChips.length > 0 ? 'text-primary bg-primary/10' : 'text-secondary hover:text-primary hover:bg-primary/5'}`}
              title={t('Display labels, schema / table name, SELECT-backed view')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>settings</span>
              {t('Settings')}
            </button>
            {settingsChips.length > 0 && !settingsOpen && (
              <span className="text-[11px] text-secondary truncate max-w-[18rem]" title={settingsChips.join(' · ')} data-settings-summary>
                {settingsChips.join(' · ')}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => api.togglePanel(entityKey, 'overrides')}
            aria-expanded={overridesOpen}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${overrideCount > 0 || overridesOpen ? 'text-primary bg-primary/10' : 'text-secondary hover:text-primary hover:bg-primary/5'}`}
            title={t('Turn a project-wide scaffolding option on or off for this entity only')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>tune</span>
            {t('Overrides')}{overrideCount > 0 ? ` (${overrideCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => api.togglePanel(entityKey, 'workflow')}
            aria-expanded={workflowOpen}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${workflowChip || workflowOpen ? 'text-primary bg-primary/10' : 'text-secondary hover:text-primary hover:bg-primary/5'}`}
            title={workflowChip ?? t('States, the steps between them, who may take each, and who a row is assigned to')}
            data-workflow-toggle
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>account_tree</span>
            {t('Workflow')}{workflowChip ? ` (${entity.workflow!.transitions.length})` : ''}
          </button>
          <div
            className="flex items-center gap-1.5 text-xs text-secondary shrink-0"
            title={t('Which list views the generated page includes. A runtime toggle appears when you pick 2+; the first (Table > Cards > Kanban > Calendar) is the initial mode.')}
          >
            <span>{t('Views')}</span>
            <div className="inline-flex rounded border border-outline-variant overflow-hidden" role="group" aria-label={t('List views')}>
              {viewOptions.map(opt => {
                const selected = views.includes(opt.key)
                // Disabled blocks *adding* an unsupported view (an already-selected one can
                // still be removed, so it never gets stuck after its field is deleted) and
                // removing the last remaining view — a page needs at least one.
                const lastRemaining = selected && views.length === 1
                const interactive = (opt.applicable || selected) && !lastRemaining
                const title = lastRemaining ? t('At least one view is required') : opt.applicable ? undefined : opt.hint
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
          {/* The headline of what this card generates, on the row that configures it. The
              breakdown (views / search / filters) is one disclosure down. */}
          <span className="ms-auto inline-flex items-center gap-1.5 text-[11px] text-secondary shrink-0" data-entity-summary dir="ltr">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>api</span>
            <span className="font-semibold tracking-wide">{summary.verbs.join(' ')}</span>
            <code className="font-mono text-on-surface">{summary.path}</code>
          </span>
        </div>
        )}
        {/* Everything this card will generate, derived from the same rules the backend
            applies — so the effect of the Search/Filter checkboxes and the view picker is
            visible without an Explore round-trip. One disclosure, because it is reference
            material: the headline on the row above is what you read while working. */}
        {!isCollapsed && (
        <details className="text-[11px]" data-entity-generates>
          <summary className="cursor-pointer select-none text-secondary hover:text-on-surface inline-flex items-center gap-1 flex-wrap">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>list_alt</span>
            {tn(summary.endpoints.length, 'Generates {n} endpoint', 'Generates {n} endpoints')}
            <span className="text-secondary/70">
              {' · '}{tn(summary.views.length, '{n} list view', '{n} list views')}
              {' · '}{t('{n} searchable', { n: summary.search.length })}
              {' · '}{tn(summary.filters.length, '{n} filter', '{n} filters')}
            </span>
            {summary.opts.length > 0 && <span className="text-secondary/70"> · {summary.opts.map(o => (ENTITY_OPT_LABELS as Record<string, { label: string } | undefined>)[o]?.label ?? o).join(', ')}</span>}
          </summary>
          <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <ul className="grid grid-cols-1 gap-y-0.5 font-mono text-on-surface" dir="ltr">
              {summary.endpoints.map(ep => (
                <li key={`${ep.method} ${ep.path}`} className="flex items-baseline gap-2 min-w-0">
                  <span className="w-14 shrink-0 text-[10px] font-bold tracking-wide text-secondary">{ep.method}</span>
                  <span className="truncate">{ep.path}</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-secondary">
              <dt className="font-semibold">{t('views')}</dt>
              <dd className="text-on-surface">{summary.views.map(v => {
                const name = viewOptions.find(o => o.key === v.name)?.label ?? v.name
                return v.by ? t('{view} (by {field})', { view: name, field: v.by }) : name
              }).join(', ')}</dd>
              <dt className="font-semibold" title={t('Fields included in the text-search box')}>{t('search')}</dt>
              <dd className="text-on-surface">{summary.search.length ? summary.search.join(', ') : '—'}</dd>
              <dt className="font-semibold" title={t('Fields that get a filter control')}>{t('filters')}</dt>
              <dd className="text-on-surface">{summary.filters.length ? summary.filters.join(', ') : '—'}</dd>
            </dl>
          </div>
        </details>
        )}
      </div>

      {!isCollapsed && (<>
      {settingsOpen && (
        <EntitySettingsPanel
          entity={entity}
          errors={eErr}
          onUpdate={updates => api.updateEntity(eIdx, updates)}
          onTickView={checked => api.tickView(eIdx, entityKey, entity.uid, checked)}
        />
      )}
      {workflowOpen && (
        <WorkflowPanel
          entity={entity}
          error={eErr?.workflow}
          onChange={workflow => api.updateEntity(eIdx, { workflow })}
          ldapAuth={ldapAuth}
          onAddDep={onAddDep}
        />
      )}
      {overridesOpen && (
        <div className="rounded-lg border border-outline-variant bg-background/50 px-3 py-2.5 space-y-2" data-entity-overrides>
          <p className="text-[11px] text-secondary">
            {t('Per-entity overrides of the project-wide Options. Inherit follows the project setting (shown in brackets); On/Off forces it for this entity only.')}
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
                      aria-label={t('{option} override', { option: ENTITY_OPT_LABELS[key].label })}
                      className={`bg-background border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/20 ${current === 'inherit' ? 'border-outline-variant text-secondary' : 'border-primary/50 text-on-surface'}`}
                      value={current}
                      onChange={e => api.setEntityOpt(eIdx, key, e.target.value === 'inherit' ? undefined : e.target.value === 'on')}
                    >
                      <option value="inherit">{projectOn ? t('Inherit (on)') : t('Inherit (off)')}</option>
                      <option value="on">{t('On')}</option>
                      <option value="off">{t('Off')}</option>
                    </select>
                  </span>
                  {noEffect && (
                    <span data-opt-no-effect className={`inline-flex items-center gap-1 text-[10px] ${value === true ? 'text-warning' : 'text-secondary'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>info</span>
                      {t('Has no effect: {reason}', { reason: noEffect })}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
          {/* The flags that have no per-entity switch, with their project value, so nobody
              hunts this panel for an OpenAPI or demo-data override that cannot exist. */}
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-secondary border-t border-outline-variant pt-2" data-project-only-opts>
            <span>{t('Project-wide only:')}</span>
            {PROJECT_ONLY_OPTS.map((opt, i) => (
              <span key={opt.value}>
                {opt.label} <span className="font-mono">({projectOpts.includes(opt.value) ? t('on') : t('off')})</span>{i < PROJECT_ONLY_OPTS.length - 1 ? ',' : '.'}
              </span>
            ))}
            {onGoToOptions && (
              <button type="button" onClick={onGoToOptions} className="font-semibold text-primary underline hover:no-underline">
                {t('Go to Options')}
              </button>
            )}
          </p>
        </div>
      )}
      {codeOpen && onCodeFiles && (
        <EntityCodePanel
          files={onCodeFiles(entity)}
          hasPreview={Boolean(codeState?.hasPreview)}
          previewLoading={Boolean(codeState?.loading)}
          stale={codeState?.stale}
          onExplore={() => codeState?.onExplore()}
        />
      )}
      {previewOpen && (
        <EntityUiPreview
          entity={entity}
          entities={previewEntities ?? []}
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
              <th className={`text-start ${cell}`}>{t('Name')}</th>
              <th className={`text-start ${cell}`}>{t('Type')}</th>
              {!compact && <th className={`text-start ${cell}`} title={t('Display label for the generated UI (defaults to the field name)')}>{t('Label')}</th>}
              <th className={`text-center ${cell} w-12`} title={t('Primary key (@Id). Tick more than one for a composite key.')}>PK</th>
              <th className={`text-center ${cell} w-12`} title={t('Generated by the database on insert (IDENTITY for LONG/INTEGER, UUID generator for UUID). Primary key only.')}>{t('Gen')}</th>
              <th className={`text-center ${cell} w-12`} title={t('Required: NOT NULL column + @NotNull/@NotBlank on the DTO + a required form field')}>{t('Req')}</th>
              <th className={`text-center ${cell} w-12`} title={t('Unique: a unique constraint on the column; a duplicate value answers 409')}>{t('Uniq')}</th>
              <th className={`text-start ${cell}`} title={t('Constraints, default value, lock-after-create, search / filter inclusion')}>{t('More')}</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {entity.fields.map((field, fIdx) => {
              const fErr = eErr?.fields?.[fIdx]
              const fieldKey = field.uid ?? `i${fIdx}`
              // A generated key requires a single PK (JPA IDENTITY can't target one column of a composite key).
              const canGenerate = !!field.primaryKey && pkCount === 1 && (field.type === 'LONG' || field.type === 'INTEGER' || field.type === 'UUID')
              const isNumeric = isNumericType(field.type)
              const isString = field.type === 'STRING'
              // Per-field search/filter eligibility mirrors the backend collection loops:
              // search → STRING/TEXT; filter bar → non-PK enum/boolean/temporal/numeric.
              const isTextSearch = isTextualType(field.type)
              const isTemporal = isDateType(field.type)
              const isFilterableType = !field.primaryKey
                && (field.type === 'ENUM' || field.type === 'BOOLEAN' || isTemporal || isNumeric)
              // A generated key takes no constraints, default, lock or search/filter — its
              // More panel only exists in compact mode, for the display label.
              const generatedKey = Boolean(field.primaryKey && field.generated)
              const hasMorePanel = !generatedKey || compact
              const hasErr = Boolean(
                fErr?.length || fErr?.min || fErr?.max || fErr?.pattern || fErr?.email || fErr?.enumValues || fErr?.defaultValue || fErr?.currency || fErr?.help || fErr?.showWhen || fErr?.formula)
              const rowKey = `${entityKey}-${fieldKey}`
              // Force open on error so the message is never hidden behind a collapsed panel.
              const isOpen = hasMorePanel && (expanded.has(rowKey) || hasErr)
              const fieldList = `fields:${eIdx}`
              const rowDrop = dnd.indicatorFor(fieldList, fIdx)
              return (
              <Fragment key={fieldKey}>
              <tr
                className={`${rowDrop ? dropIndicatorClass(rowDrop) : 'border-t border-outline-variant'} ${dnd.isDragging(fieldList, fIdx) ? 'opacity-40' : ''} ${
                  serverIssue?.field === fIdx ? 'bg-error/10' : ''}`}
                data-server-issue-row={serverIssue?.field === fIdx ? '' : undefined}
                data-row-uid={field.uid}
                {...dnd.rowProps(fieldList, fIdx)}
              >
                <td className="py-1.5 ps-1 align-top">
                  {entity.fields.length > 1 && (
                    <span
                      {...dnd.handleProps(fieldList, fIdx)}
                      role="button"
                      aria-label={t('Drag to reorder field')}
                      title={t('Drag to reorder (field order = column / form order in the generated app)')}
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
                    dir="ltr"
                    aria-label={t('Field name')}
                    aria-invalid={Boolean(fErr?.name)}
                    className={`w-full bg-background border rounded px-2 py-1 text-xs font-mono focus:ring-1 outline-none ${fErr?.name ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                    value={field.name}
                    onChange={e => api.updateField(eIdx, fIdx, { name: e.target.value })}
                    placeholder="fieldName"
                  />
                  {fErr?.name && <p className="mt-0.5 text-[11px] text-error">{fErr.name}</p>}
                </td>
                <td className={`${cell} align-top`}>
                  <select
                    aria-label={t('Field type')}
                    className="w-full bg-background border border-outline-variant rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                    value={field.type}
                    onChange={e => api.changeFieldType(eIdx, fIdx, e.target.value as FullstackFieldType)}
                  >
                    {FIELD_TYPES.map(type => <option key={type} value={type}>{FIELD_TYPE_LABELS[type] ?? type}</option>)}
                  </select>
                </td>
                {!compact && (
                  <td className={`${cell} align-top`}>
                    <input
                      type="text"
                      dir="auto"
                      aria-label={t('Display label')}
                      className="w-full bg-background border border-outline-variant rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                      value={field.label ?? ''}
                      onChange={e => api.updateField(eIdx, fIdx, { label: e.target.value || undefined })}
                      placeholder={field.name || t('label')}
                      title={t('Display label for the generated UI. Leave blank to derive from the field name.')}
                    />
                  </td>
                )}
                <td className={`${cell} text-center align-top`}>
                  <input type="checkbox" className="h-4 w-4 accent-primary" aria-label={t('Primary key')} checked={!!field.primaryKey}
                    onChange={e => api.updateField(eIdx, fIdx, e.target.checked ? { primaryKey: true } : { primaryKey: false, generated: undefined })} />
                </td>
                <td className={`${cell} text-center align-top`}>
                  <input type="checkbox" aria-label={t('Auto-generated value')} checked={!!field.generated}
                    disabled={!canGenerate}
                    title={canGenerate ? undefined : (pkCount > 1 ? t('A generated key requires a single primary key') : t('Auto-generated applies to a LONG/INTEGER/UUID primary key only'))}
                    className="h-4 w-4 accent-primary disabled:opacity-40 disabled:cursor-not-allowed"
                    onChange={e => api.updateField(eIdx, fIdx, { generated: e.target.checked })} />
                  {fErr?.generated && <p className="mt-0.5 text-[11px] text-error">{fErr.generated}</p>}
                </td>
                <td className={`${cell} text-center align-top`}>
                  <input type="checkbox" className="h-4 w-4 accent-primary" aria-label={t('Required (not null)')} checked={!!field.required}
                    onChange={e => api.updateField(eIdx, fIdx, { required: e.target.checked })} />
                </td>
                <td className={`${cell} text-center align-top`}>
                  <input type="checkbox" className="h-4 w-4 accent-primary" aria-label={t('Unique')} checked={!!field.unique}
                    onChange={e => api.updateField(eIdx, fIdx, { unique: e.target.checked })} />
                </td>
                <td className={`${cell} align-top`}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {hasMorePanel ? (
                      <button
                        type="button"
                        onClick={() => api.toggleExpand(rowKey)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? t('Hide field details') : t('Edit field details')}
                        title={hasErr ? t('Problem in this field — fix below') : isOpen ? t('Hide') : t('Constraints, default, lock, search / filter')}
                        className={`inline-flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-medium transition-colors ${
                          hasErr ? 'text-error hover:bg-error/10' : 'text-secondary hover:text-primary hover:bg-primary/10'}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          {isOpen ? 'expand_less' : 'tune'}
                        </span>
                        {hasErr && <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>error</span>}
                      </button>
                    ) : (
                      <span className="text-secondary/40 px-1.5" title={t('A generated key takes no constraints or default')} aria-hidden="true">—</span>
                    )}
                    {!isOpen && <FieldChips field={field} includeLabel={compact} onOpen={() => api.expand(rowKey)} />}
                  </div>
                </td>
                <td className={`${cell} text-end align-top`}>
                  <div className="flex items-center justify-end gap-0.5">
                    <button type="button" onClick={() => api.moveField(eIdx, fIdx, -1)} disabled={fIdx === 0} className={SMALL_ICON_BTN}
                            title={t('Move field up (earlier column / form row)')} aria-label={t('Move field up')}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_upward</span>
                    </button>
                    <button type="button" onClick={() => api.moveField(eIdx, fIdx, 1)} disabled={fIdx === entity.fields.length - 1} className={SMALL_ICON_BTN}
                            title={t('Move field down')} aria-label={t('Move field down')}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_downward</span>
                    </button>
                    <button type="button" onClick={() => api.duplicateField(eIdx, fIdx)} className={SMALL_ICON_BTN} title={t('Duplicate field')} aria-label={t('Duplicate field')}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => api.removeField(eIdx, fIdx)}
                      className="p-1 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
                      title={t('Remove field')}
                      aria-label={t('Remove field')}
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
                      showColumn={!isView}
                      onUpdate={updates => api.updateField(eIdx, fIdx, updates)}
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
            onClick={() => api.addField(eIdx)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
            {t('Add field')}
          </button>
          <button
            type="button"
            onClick={() => api.setQuickAddFor(prev => prev === entityKey ? null : entityKey)}
            aria-expanded={quickAddOpen}
            className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
            title={t('Add many fields at once from a pasted list (one per line)')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>playlist_add</span>
            {t('Paste fields…')}
          </button>
        </div>
        {quickAddOpen && (
          <QuickAddFields
            onAdd={fields => api.addFields(eIdx, fields)}
            onClose={() => api.setQuickAddFor(null)}
          />
        )}
      </div>

      <RelationsEditor
        relations={entity.relations ?? []}
        entityNames={entityNames}
        linkIndex={linkIndex}
        fieldNames={entity.fields.map(f => f.name)}
        onChange={rels => api.updateRelations(eIdx, rels)}
        onRemoved={(rel, rIdx) => onNotice?.(
          t('Removed relation {relation} from {entity}', { relation: rel.fieldName.trim() || t('(unnamed)'), entity: entity.name.trim() || t('(unnamed)') }),
          { label: t('Undo'), onClick: () => api.restoreRelation(entity.uid, rel, rIdx) },
        )}
        onAddJoinEntity={isView || !entity.name.trim() ? undefined : target => api.addJoinEntity(eIdx, target)}
        errors={eErr?.relations}
        ownerName={entity.name}
        showInverse={projectOpts.includes('inverseCollections')}
        addDisabledReason={isView
          ? t('A SELECT-backed view maps to a query, not a table, so it cannot own a foreign key.')
          : undefined}
      />
      </>)}
    </div>
    )
}, (a, b) => {
  for (const k of Object.keys(a) as (keyof EntityCardProps)[]) {
    if (k === 'api' || k === 'dnd') continue
    if (!Object.is(a[k], b[k])) return false
  }
  return true
})

/** Expanded per-field editor: constraints valid for the field's type (STRING → length/pattern/
 *  email, numeric → min/max, ENUM → values), the default value, and the behaviour flags that used
 *  to be table columns (lock after create, search / filter inclusion; plus the display label in
 *  compact density). Only controls that apply to the field are shown. */
function FieldMorePanel({ field, fErr, isString, isNumeric, isTextSearch, isFilterableType, showLabel, showColumn, onUpdate }: {
  field: FullstackFieldDef
  fErr?: FieldErrors
  isString: boolean
  isNumeric: boolean
  isTextSearch: boolean
  isFilterableType: boolean
  showLabel: boolean
  /** Table-backed entities only — a SELECT view maps fields by their names. */
  showColumn: boolean
  onUpdate: (updates: Partial<FullstackFieldDef>) => void
}) {
  const inputClass = (error?: string) =>
    `w-full bg-background border rounded px-2 py-1.5 text-xs tabular-nums focus:ring-1 outline-none ${
      error ? 'border-error focus:ring-error/20 focus:border-error'
        : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`
  // A generated key takes no constraints; neither does a file, which has nothing to constrain.
  const takesConstraints = !(field.primaryKey && field.generated) && !isAttachmentType(field.type)
  const hasBehaviour = !field.primaryKey || isTextSearch
  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-3 rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-3" data-field-more>
      {showLabel && (
        <ConstraintBox label={t('Display label')} wide>
          <input
            type="text"
            dir="auto"
            aria-label={t('Display label')}
            className={inputClass()}
            value={field.label ?? ''}
            onChange={e => onUpdate({ label: e.target.value || undefined })}
            placeholder={field.name || t('label')}
            title={t('Display label for the generated UI. Leave blank to derive from the field name.')}
          />
        </ConstraintBox>
      )}
      {showColumn && (
        <ConstraintBox label={t('DB column')} error={fErr?.column}>
          <input
            type="text"
            dir="ltr"
            aria-label={t('DB column')}
            aria-invalid={Boolean(fErr?.column)}
            className={`${inputClass(fErr?.column)} font-mono`}
            value={field.column ?? ''}
            onChange={e => onUpdate({ column: e.target.value || undefined })}
            placeholder={toSnakeCase(field.name.trim()) || t('column')}
            title={t('The database column, exactly as the schema spells it. Leave blank to derive it from the field name. Filled in by Import from DDL.')}
          />
        </ConstraintBox>
      )}
      {!(field.primaryKey && field.generated) && (
        <ConstraintBox label={t('Help text')} wide error={fErr?.help}>
          <input
            type="text"
            dir="auto"
            aria-label={t('Help text')}
            aria-invalid={Boolean(fErr?.help)}
            className={inputClass(fErr?.help)}
            value={field.help ?? ''}
            maxLength={MAX_HELP + 50}
            onChange={e => onUpdate({ help: e.target.value === '' ? undefined : e.target.value })}
            placeholder={t('Shown under the input')}
            title={t("A hint under the field's input in the generated form.")}
            data-field-help
          />
        </ConstraintBox>
      )}
      {(field.type === 'FILE' || field.type === 'IMAGE') && !field.primaryKey && (
        <ConstraintBox label={t('Several files')} error={fErr?.maxFiles}>
          <span className="flex items-center gap-2" data-field-several-files>
            <input
              type="checkbox"
              aria-label={t('Several files')}
              checked={field.maxFiles != null}
              onChange={e => onUpdate({ maxFiles: e.target.checked ? 10 : undefined })}
              title={t('The field holds a list of files instead of one (kept in a table of its own).')}
            />
            {field.maxFiles != null && (
              <input
                type="number"
                min={1}
                max={MAX_FILES}
                aria-label={t('At most')}
                aria-invalid={Boolean(fErr?.maxFiles)}
                className={`${inputClass(fErr?.maxFiles)} w-20`}
                value={field.maxFiles}
                onChange={e => onUpdate({ maxFiles: e.target.value === '' ? 1 : Number(e.target.value) })}
                title={t('At most this many files (1–{max}).', { max: MAX_FILES })}
              />
            )}
          </span>
        </ConstraintBox>
      )}
      {!field.primaryKey && (
        <ConstraintBox label={t('Show when')} wide error={fErr?.showWhen}>
          <input
            type="text"
            dir="ltr"
            aria-label={t('Show when')}
            aria-invalid={Boolean(fErr?.showWhen)}
            className={`${inputClass(fErr?.showWhen)} font-mono`}
            value={field.showWhen ?? ''}
            spellCheck={false}
            onChange={e => onUpdate({ showWhen: e.target.value === '' ? undefined : e.target.value })}
            placeholder={t("always — or e.g. status == 'REJECTED'")}
            title={t('Shown in the form only while this holds; a save clears the field while it does not. A required field is required only while shown.')}
            data-field-show-when
          />
        </ConstraintBox>
      )}
      {!field.primaryKey && (
        <ConstraintBox label={t('Computed as')} wide error={fErr?.formula}>
          <input
            type="text"
            dir="ltr"
            aria-label={t('Computed as')}
            aria-invalid={Boolean(fErr?.formula)}
            className={`${inputClass(fErr?.formula)} font-mono`}
            value={field.formula ?? ''}
            spellCheck={false}
            onChange={e => onUpdate({ formula: e.target.value === '' ? undefined : e.target.value })}
            placeholder={t('entered — or e.g. quantity * unitPrice')}
            title={t("Computed by the server on every save from the row's other fields (a stored column). The form shows it read-only.")}
            data-field-formula
          />
        </ConstraintBox>
      )}
      {takesConstraints && isString && (
        <>
          <ConstraintBox label={t('Max length')} error={fErr?.length}>
            <input
              type="number"
              min={1}
              aria-label={t('Max length')}
              aria-invalid={Boolean(fErr?.length)}
              className={inputClass(fErr?.length)}
              value={field.length ?? ''}
              placeholder={t('e.g. 200')}
              onChange={e => onUpdate({ length: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </ConstraintBox>
          <ConstraintBox label={t('Pattern (regex)')} error={fErr?.pattern} wide>
            <input
              type="text"
              dir="ltr"
              aria-label={t('Regex pattern')}
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
              aria-label={t('Email format')}
              checked={!!field.email}
              onChange={e => onUpdate({ email: e.target.checked })}
            />
            {t('Email format')}
          </label>
        </>
      )}
      {takesConstraints && isNumeric && (
        <>
          <ConstraintBox label={t('Min')} error={fErr?.min}>
            <input
              type="number"
              aria-label={t('Minimum value')}
              aria-invalid={Boolean(fErr?.min)}
              className={inputClass(fErr?.min)}
              value={field.min ?? ''}
              onChange={e => onUpdate({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </ConstraintBox>
          <ConstraintBox label={t('Max')} error={fErr?.max}>
            <input
              type="number"
              aria-label={t('Maximum value')}
              aria-invalid={Boolean(fErr?.max)}
              className={inputClass(fErr?.max)}
              value={field.max ?? ''}
              onChange={e => onUpdate({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </ConstraintBox>
        </>
      )}
      {takesConstraints && field.type === 'ENUM' && (
        <ConstraintBox label={t('Enum values')} error={fErr?.enumValues} wide>
          <EnumValuesEditor
            values={field.enumValues ?? []}
            onChange={vals => onUpdate({ enumValues: vals, enumLabels: pruneLabels(field.enumLabels, vals) })}
            labels={field.enumLabels}
            onLabelsChange={labels => onUpdate({ enumLabels: labels })}
            invalid={Boolean(fErr?.enumValues)}
          />
        </ConstraintBox>
      )}
      {field.type === 'MONEY' && (
        <ConstraintBox label={t('Currency')} error={fErr?.currency}>
          <input
            dir="ltr"
            aria-label={t('Currency')}
            aria-invalid={Boolean(fErr?.currency)}
            className={inputClass(fErr?.currency)}
            value={field.currency ?? ''}
            placeholder={DEFAULT_CURRENCY}
            maxLength={3}
            title={t('ISO 4217 code the amounts are printed in (ILS, USD, EUR…). Blank = ILS.')}
            onChange={e => onUpdate({ currency: e.target.value.trim() === '' ? undefined : e.target.value.toUpperCase() })}
          />
        </ConstraintBox>
      )}
      {takesConstraints && (
        <ConstraintBox label={t('Default value')} error={fErr?.defaultValue}>
          <DefaultValueInput field={field} invalid={Boolean(fErr?.defaultValue)} className={inputClass(fErr?.defaultValue)}
            onChange={v => onUpdate({ defaultValue: v === '' ? undefined : v })} />
        </ConstraintBox>
      )}
      {hasBehaviour && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 basis-full pt-1 border-t border-outline-variant/60" data-field-behaviour>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">{t('Behaviour')}</span>
          {!field.primaryKey && (
            <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer"
                   title={t("Locked after create: set when a row is created and can't be edited afterwards (form disables it, the service never overwrites it)")}>
              <input type="checkbox" className="h-4 w-4 accent-primary" aria-label={t('Locked after create')} checked={!!field.readOnly}
                onChange={e => onUpdate({ readOnly: e.target.checked || undefined })} />
              {t('Locked after create')}
            </label>
          )}
          {isTextSearch && (
            <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer" title={t('Include this field in the text-search box')}>
              <input type="checkbox" className="h-4 w-4 accent-primary" aria-label={t('Include in search')} checked={field.searchable !== false}
                onChange={e => onUpdate({ searchable: e.target.checked ? undefined : false })} />
              {t('In search')}
            </label>
          )}
          {isFilterableType && (
            <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer" title={t('Include this field in the filter bar')}>
              <input type="checkbox" className="h-4 w-4 accent-primary" aria-label={t('Include in filter bar')} checked={field.filterable !== false}
                onChange={e => onUpdate({ filterable: e.target.checked ? undefined : false })} />
              {t('In filter bar')}
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
  const common = { 'aria-label': t('Default value'), 'aria-invalid': invalid, className, title: t("Initial value: entity field initializer, the form's starting value and the demo-data seed") }
  if (field.type === 'BOOLEAN') {
    return (
      <select {...common} value={value.toLowerCase()} onChange={e => onChange(e.target.value)}>
        <option value="">{t('none')}</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }
  if (field.type === 'ENUM') {
    return (
      <select {...common} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{t('none')}</option>
        {(field.enumValues ?? []).map(v => <option key={v} value={v}>{field.enumLabels ? `${v} — ${enumLabel(field, v)}` : v}</option>)}
        {value && !(field.enumValues ?? []).includes(value) && <option value={value}>{value}</option>}
      </select>
    )
  }
  if (field.type === 'LOCAL_DATE') return <input {...common} type="date" value={value} onChange={e => onChange(e.target.value)} />
  if (field.type === 'LOCAL_DATE_TIME') return <input {...common} type="datetime-local" value={value} onChange={e => onChange(e.target.value)} />
  if (field.type === 'LOCAL_TIME') return <input {...common} type="time" value={value} onChange={e => onChange(e.target.value)} />
  const placeholder = field.type === 'UUID' ? '00000000-0000-…'
    : field.type === 'LONG' || field.type === 'INTEGER' ? '0'
    : isDecimalType(field.type) ? '0.00'
    : field.type === 'INSTANT' ? '2026-01-31T08:00:00Z' : t('none')
  return (
    <input {...common} type="text" inputMode={isTextualType(field.type) ? undefined : 'decimal'}
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
