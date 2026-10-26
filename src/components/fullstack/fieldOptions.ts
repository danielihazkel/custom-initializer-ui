import type { FullstackEntityDef, FullstackFieldDef } from '../../types'
import { enumLabel } from './enumLabels'
import { humanize } from './naming'

/**
 * How the page editor names fields, relations and enum values in its selects and chips: the label
 * the generated UI shows, with the raw identifier after it only when the two really differ
 * (`Order state (status)`, `פתוח (OPEN)`), so the option reads as a user would see it but still
 * says which column it is.
 */

const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/** `label`, plus `(raw)` unless it is just the identifier spelled out. */
export function optionText(label: string, raw: string): string {
  const l = label.trim()
  if (!l) return raw
  return bare(l) === bare(raw) ? l : `${l} (${raw})`
}

/** A field: its label (or humanized name). */
/** An entity in a picker: its label, with its name after it when they differ. */
export function entityOption(e: Pick<FullstackEntityDef, 'name' | 'label'>): string {
  return optionText(e.label ?? '', e.name)
}

export function fieldOption(f: Pick<FullstackFieldDef, 'name' | 'label'>): string {
  return optionText(f.label?.trim() || humanize(f.name), f.name)
}

/** A MANY_TO_ONE relation, by its field name. */
export function relationOption(fieldName: string): string {
  return optionText(humanize(fieldName), fieldName)
}

/** A field or relation of `entity` by key — the audit pair and unknown keys read as they are. */
export function keyOption(entity: FullstackEntityDef | undefined, key: string): string {
  const field = entity?.fields.find(f => f.name === key)
  if (field) return fieldOption(field)
  if (entity?.relations?.some(r => r.fieldName === key)) return relationOption(key)
  if (key === 'createdAt') return 'Created (createdAt)'
  if (key === 'updatedAt') return 'Updated (updatedAt)'
  return key
}

/** One value of an enum or boolean field, as the generated UI labels it. */
export function enumValueOption(f: Pick<FullstackFieldDef, 'type' | 'enumLabels'> | undefined, value: string): string {
  if (!f) return value
  if (f.type === 'BOOLEAN') return value === 'true' ? 'Yes (true)' : value === 'false' ? 'No (false)' : value
  if (f.type === 'ENUM') return optionText(enumLabel(f, value), value)
  return value
}
