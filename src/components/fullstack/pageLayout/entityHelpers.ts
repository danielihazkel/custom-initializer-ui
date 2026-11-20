import type { FullstackEntityDef } from '../../../types'

/**
 * Three small questions about an entity or a name that every area asks. Reads none of the
 * folder's other modules.
 */

export const singlePk = (e: FullstackEntityDef) => e.fields.filter(f => f.primaryKey).length === 1

/** The values a preset filter on `field` can take: an enum's constants, a boolean's true/false. */
export const valuesOf = (field: { type: string; enumValues?: string[] } | undefined): string[] =>
  field?.type === 'BOOLEAN' ? ['true', 'false'] : (field?.enumValues ?? [])

export const sameName = (a: string | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()
