import type { FullstackFieldDef } from '../../types'

/** The compact tags a field row shows for everything that lives inside its "More" panel, so a
 *  closed panel never hides a setting: constraints, default, lock and search/filter opt-outs
 *  (and the display label when the Label column is hidden). Pure — pinned by uiPreview.test.ts. */
export function fieldChips(field: FullstackFieldDef, opts: { includeLabel?: boolean } = {}): string[] {
  const chips: string[] = []
  if (opts.includeLabel && field.label?.trim()) chips.push(`“${field.label.trim()}”`)
  if (field.length != null) chips.push(`len ${field.length}`)
  if (field.min != null && field.max != null) chips.push(`${field.min}–${field.max}`)
  else if (field.min != null) chips.push(`min ${field.min}`)
  else if (field.max != null) chips.push(`max ${field.max}`)
  if (field.pattern) chips.push('regex')
  if (field.email) chips.push('email')
  if (field.type === 'ENUM') chips.push(`${field.enumValues?.length ?? 0} value${(field.enumValues?.length ?? 0) === 1 ? '' : 's'}${Object.keys(field.enumLabels ?? {}).length > 0 ? ', labelled' : ''}`)
  if (field.defaultValue?.trim()) chips.push(`= ${field.defaultValue.trim()}`)
  if (field.readOnly && !field.primaryKey) chips.push('locked')
  if (field.searchable === false) chips.push('no search')
  if (field.filterable === false) chips.push('no filter')
  return chips
}

interface Props {
  field: FullstackFieldDef
  includeLabel?: boolean
  /** Opens the row's More panel — a chip is a shortcut to the control that set it. */
  onOpen: () => void
}

export function FieldChips({ field, includeLabel, onOpen }: Props) {
  const chips = fieldChips(field, { includeLabel })
  if (chips.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-field-chips>
      {chips.map(chip => (
        <button
          key={chip}
          type="button"
          onClick={onOpen}
          className="max-w-[9rem] truncate px-1.5 py-px rounded border border-outline-variant/70 bg-surface-container-low text-[10px] font-mono text-secondary hover:text-primary hover:border-primary/50 transition-colors"
          title="Edit in the More panel"
        >
          {chip}
        </button>
      ))}
    </span>
  )
}
