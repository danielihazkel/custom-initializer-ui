import type { FullstackEntityDef, FullstackListAction, FullstackListView } from '../../../types'
import { t } from '../../../i18n'
import { isDateType, isSortableType } from '../fieldTypes'
import { humanize, relationLabel } from '../naming'
import { summarizeEntity } from '../summary'

/**
 * How a list opens: the columns it may show, what it may be sorted by, the views its entity
 * offers, and the actions a list page can hide.
 */

/** Whether the generated list of `entity` carries the audit columns (EntityScaffoldContext's
 *  `auditApplicable`): the entity's own override, else the project's `audit` opt, on a writable entity. */
export function auditOn(entity: FullstackEntityDef | undefined, scaffoldOpts: string[] = []): boolean {
  if (!entity || entity.readOnly || entity.viewQuery != null) return false
  return entity.opts?.audit ?? scaffoldOpts.includes('audit')
}

export interface ListColumnOption {
  key: string
  label: string
  /** The generated list endpoint sorts by every field and the audit pair, never by a relation. */
  sortable: boolean
  kind: 'field' | 'relation' | 'audit'
}

/** The columns a list page can show, in the generated order: every field, every MANY_TO_ONE
 *  relation (by field name) and, when audit applies, Created/Updated. */
export function listColumns(entity: FullstackEntityDef | undefined, scaffoldOpts: string[] = []): ListColumnOption[] {
  if (!entity) return []
  const out: ListColumnOption[] = entity.fields
    .filter(f => f.name.trim())
    .map(f => ({ key: f.name, label: f.label?.trim() || humanize(f.name), sortable: isSortableType(f.type), kind: 'field' as const }))
  for (const r of entity.relations ?? []) {
    if (r.type === 'MANY_TO_ONE' && r.fieldName.trim()) out.push({ key: r.fieldName, label: relationLabel(r), sortable: false, kind: 'relation' })
  }
  if (auditOn(entity, scaffoldOpts)) {
    out.push({ key: 'createdAt', label: t('Created'), sortable: true, kind: 'audit' }, { key: 'updatedAt', label: t('Updated'), sortable: true, kind: 'audit' },
      { key: 'createdBy', label: t('Created by'), sortable: true, kind: 'audit' }, { key: 'updatedBy', label: t('Updated by'), sortable: true, kind: 'audit' })
  }
  return out
}

/** The column keys a list page may open sorted by (the generated controller's SORTABLE). */
export function sortableKeys(entity: FullstackEntityDef | undefined, scaffoldOpts: string[] = []): string[] {
  return listColumns(entity, scaffoldOpts).filter(c => c.sortable).map(c => c.key)
}

/** The views the generated page of `entity` offers, in its order — the ticked list views minus the
 *  ones its fields cannot support (EntityScaffoldContext.emittedListViews). */
export function enabledListViews(entity: FullstackEntityDef | undefined): FullstackListView[] {
  if (!entity) return ['table']
  return summarizeEntity(entity).views.map(v => v.name as FullstackListView)
}

/** Why `view` is not offered on `entity`, or undefined when it is. */
export function viewDisabledReason(entity: FullstackEntityDef | undefined, view: FullstackListView): string | undefined {
  if (!entity || enabledListViews(entity).includes(view)) return undefined
  const readOnly = Boolean(entity.readOnly) || entity.viewQuery != null
  if (view === 'kanban' && readOnly) return t('Kanban needs a writable entity')
  if (view === 'kanban' && !entity.fields.some(f => f.type === 'ENUM' || f.type === 'BOOLEAN')) return t('Kanban needs an enum or boolean field')
  if (view === 'calendar' && !entity.fields.some(f => isDateType(f.type))) return t('Calendar needs a date field')
  if (view === 'gallery' && !entity.fields.some(f => f.type === 'IMAGE')) return t('Gallery needs an image field')
  return t('Not ticked in the list views of {entity}', { entity: entity.name })
}

/** The list actions a list page can leave out, in the order the generator keeps them. */
export const LIST_ACTIONS: { value: FullstackListAction; readonly label: string; readonly hint: string }[] = [
  { value: 'new', get label() { return t('New') }, get hint() { return t('The New button, the empty list’s offer and the n shortcut') } },
  { value: 'edit', get label() { return t('Edit') }, get hint() { return t('Edit on a row, the side pane and the quick look; inline cells and dragging a card') } },
  { value: 'delete', get label() { return t('Delete') }, get hint() { return t('Delete on a row and in the side pane') } },
  { value: 'export', get label() { return t('Export') }, get hint() { return t('Export CSV and Excel (the csvExport and xlsxExport options)') } },
  { value: 'import', get label() { return t('Import') }, get hint() { return t('Import CSV (the csvImport option)') } },
  { value: 'bulk', get label() { return t('Bulk actions') }, get hint() { return t('Row checkboxes and the bulk bar (bulkDelete / bulkUpdate)') } },
]
