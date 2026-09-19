import type { FullstackFieldDef } from '../../types'

/** `IN_PROGRESS` → `In progress` — the display label the generator derives for an enum constant
 *  that has none set. Mirrors `EntityScaffoldContext.humanizeConstant`. */
export function humanizeConstant(constant: string): string {
  const words = constant.trim().split(/[_\s]+/).filter(Boolean).map(w => w.toLowerCase())
  if (words.length === 0) return ''
  return words.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
}

/** The label the generated UI shows for `value`: the explicit one (matched case-insensitively,
 *  as the server does), else the humanized constant. */
export function enumLabel(field: Pick<FullstackFieldDef, 'enumLabels'>, value: string): string {
  const explicit = lookupLabel(field.enumLabels, value)
  return explicit?.trim() || humanizeConstant(value)
}

/** The explicit label for `value`, if any. */
export function lookupLabel(labels: Record<string, string> | undefined, value: string): string | undefined {
  if (!labels) return undefined
  if (value in labels) return labels[value]
  const key = Object.keys(labels).find(k => k.trim().toLowerCase() === value.trim().toLowerCase())
  return key === undefined ? undefined : labels[key]
}

/** Drops labels whose value is gone (or blank) so the map never carries stale keys; `undefined`
 *  when nothing is left, so snapshots and the wire payload stay minimal. */
export function pruneLabels(labels: Record<string, string> | undefined, values: readonly string[]): Record<string, string> | undefined {
  if (!labels) return undefined
  const keep = new Set(values.map(v => v.trim().toLowerCase()))
  const next: Record<string, string> = {}
  for (const [k, v] of Object.entries(labels)) {
    if (keep.has(k.trim().toLowerCase()) && v.trim()) next[k] = v
  }
  return Object.keys(next).length > 0 ? next : undefined
}
