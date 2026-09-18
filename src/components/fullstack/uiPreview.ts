import type { FullstackEntityDef, FullstackFieldDef } from '../../types'
import { humanize, pluralize, toPascalCase } from './naming'
import { entityOptApplicability, summarizeEntity } from './summary'

/**
 * View-model for the "Preview UI" mock on an entity card: what the generated list page and
 * form will show for this entity, derived client-side from the same rules the templates apply
 * (`EntityPage.tsx.mustache`, `EntityForm.tsx.mustache`, `Table.tsx`). Pure so it can be unit
 * tested; `EntityUiPreview.tsx` only renders it.
 */
export type PreviewColumnKind = 'key' | 'text' | 'number' | 'bool' | 'date' | 'enum' | 'relation' | 'audit'

export interface PreviewColumn {
  label: string
  kind: PreviewColumnKind
}

export type PreviewControlKind = 'text' | 'textarea' | 'number' | 'checkbox' | 'date' | 'datetime' | 'select' | 'uuid'

export interface PreviewControl {
  name: string
  label: string
  control: PreviewControlKind
  required: boolean
  /** Locked after create — the generated form disables it on edit. */
  locked: boolean
  /** Select options (enum constants, or a single "Choose <Target>…" placeholder for a relation). */
  options?: string[]
  /** Pre-filled starting value (`defaultValue`). */
  value?: string
  /** Small caption under the control: length limit, numeric bounds, pattern, email. */
  hint?: string
  isRelation?: boolean
}

export interface UiPreview {
  title: string
  titlePlural: string
  /** Enabled list views the page will actually render, generated order. */
  views: string[]
  columns: PreviewColumn[]
  form: PreviewControl[]
  showSearch: boolean
  /** Filter-bar controls, by label. */
  filters: string[]
  canCreate: boolean
  hasRowActions: boolean
  hasSelection: boolean
  hasExport: boolean
}

export interface UiPreviewContext {
  projectOpts: string[]
  /** Every entity in the model — relation columns/selects look up the target's label. */
  entities: FullstackEntityDef[]
}

function columnKind(f: FullstackFieldDef): PreviewColumnKind {
  if (f.primaryKey) return 'key'
  switch (f.type) {
    case 'LONG': case 'INTEGER': case 'BIG_DECIMAL': return 'number'
    case 'BOOLEAN': return 'bool'
    case 'LOCAL_DATE': case 'LOCAL_DATE_TIME': return 'date'
    case 'ENUM': return 'enum'
    default: return 'text'
  }
}

function controlKind(f: FullstackFieldDef): PreviewControlKind {
  switch (f.type) {
    case 'TEXT': return 'textarea'
    case 'LONG': case 'INTEGER': case 'BIG_DECIMAL': return 'number'
    case 'BOOLEAN': return 'checkbox'
    case 'LOCAL_DATE': return 'date'
    case 'LOCAL_DATE_TIME': return 'datetime'
    case 'ENUM': return 'select'
    case 'UUID': return 'uuid'
    default: return 'text'
  }
}

function controlHint(f: FullstackFieldDef): string | undefined {
  const parts: string[] = []
  if (f.email) parts.push('email')
  if (f.length != null) parts.push(`≤ ${f.length} chars`)
  if (f.min != null && f.max != null) parts.push(`${f.min} – ${f.max}`)
  else if (f.min != null) parts.push(`≥ ${f.min}`)
  else if (f.max != null) parts.push(`≤ ${f.max}`)
  if (f.pattern) parts.push(`/${f.pattern}/`)
  return parts.length ? parts.join(' · ') : undefined
}

export function fieldLabel(f: { name: string; label?: string }): string {
  return f.label?.trim() || humanize(f.name) || '(unnamed)'
}

export function buildUiPreview(entity: FullstackEntityDef, ctx: UiPreviewContext): UiPreview {
  const name = entity.name.trim() || 'Entity'
  const pascal = toPascalCase(name)
  const title = entity.label?.trim() || pascal
  const titlePlural = entity.labelPlural?.trim() || (entity.label?.trim() ? entity.label.trim() : pluralize(pascal))
  const readOnly = Boolean(entity.readOnly) || entity.viewQuery != null
  const summary = summarizeEntity(entity, ctx.projectOpts)
  const applicability = entityOptApplicability(entity)
  const optOn = (k: keyof typeof applicability) => (entity.opts?.[k] ?? ctx.projectOpts.includes(k)) && applicability[k].applicable
  const byName = new Map(ctx.entities.filter(e => e.name.trim()).map(e => [e.name.trim().toLowerCase(), e]))

  const columns: PreviewColumn[] = entity.fields.map(f => ({ label: fieldLabel(f), kind: columnKind(f) }))
  for (const r of entity.relations ?? []) {
    if (!r.fieldName.trim()) continue
    columns.push({ label: humanize(r.fieldName), kind: 'relation' })
  }
  if (optOn('audit')) columns.push({ label: 'Created', kind: 'audit' }, { label: 'Updated', kind: 'audit' })

  const form: PreviewControl[] = entity.fields
    .filter(f => !(f.primaryKey && f.generated))
    .map(f => ({
      name: f.name,
      label: fieldLabel(f),
      control: controlKind(f),
      required: Boolean(f.required) || Boolean(f.primaryKey),
      locked: Boolean(f.readOnly) && !f.primaryKey,
      options: f.type === 'ENUM' ? [...(f.enumValues ?? [])] : undefined,
      value: f.defaultValue?.trim() || undefined,
      hint: controlHint(f),
    }))
  for (const r of entity.relations ?? []) {
    if (!r.fieldName.trim()) continue
    const target = byName.get(r.targetEntity.trim().toLowerCase())
    const targetTitle = target?.label?.trim() || toPascalCase(r.targetEntity.trim() || 'target')
    form.push({
      name: r.fieldName,
      label: humanize(r.fieldName),
      control: 'select',
      required: Boolean(r.required),
      locked: false,
      options: [`Choose ${targetTitle}…`],
      isRelation: true,
    })
  }

  const filterLabels = summary.filters.map(fname => {
    const field = entity.fields.find(f => f.name === fname)
    if (field) return fieldLabel(field)
    const rel = (entity.relations ?? []).find(r => `${r.fieldName.trim()}Id` === fname)
    return rel ? humanize(rel.fieldName) : fname
  })

  return {
    title,
    titlePlural,
    views: summary.views.map(v => v.name),
    columns,
    form,
    showSearch: summary.search.length > 0,
    filters: filterLabels,
    canCreate: !readOnly,
    hasRowActions: !readOnly,
    hasSelection: optOn('bulkDelete') || optOn('bulkUpdate'),
    hasExport: optOn('csvExport'),
  }
}
