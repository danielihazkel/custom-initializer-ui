import type { FullstackEntityDef, FullstackFieldDef, FullstackRelationDef } from '../../../types'
import { t } from '../../../i18n'
import { isDateType, isNumericType } from '../fieldTypes'
import { valuesOf } from './entityHelpers'

/**
 * Preset filters: which fields and links a page or widget can be pinned to, how a value is
 * written (a choice, several, a period, a range, ids) and what is wrong with one.
 */

/** The periods a date field can be preset to, ending on the day the app is opened. */
export const PRESET_PERIODS: { value: string; readonly label: string }[] = [
  { value: 'last:7d', get label() { return t('Last 7 days') } },
  { value: 'last:30d', get label() { return t('Last 30 days') } },
  { value: 'last:90d', get label() { return t('Last 90 days') } },
  { value: 'ytd', get label() { return t('This year') } },
  { value: '12m', get label() { return t('Last 12 months') } },
]

/** How a field is preset: a pick of its values, a date period or range, or a number range. */
export type PresetKind = 'choice' | 'date' | 'number'

export function presetKind(f: FullstackFieldDef): PresetKind {
  if (isDateType(f.type)) return 'date'
  if (isNumericType(f.type)) return 'number'
  return 'choice'
}

/** Every field a list, report or widget can be preset on: filterable enum/boolean, date and number fields. */
export function presettableFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? []).filter(f => !f.primaryKey && f.filterable !== false
    && (f.type === 'ENUM' || f.type === 'BOOLEAN' || presetKind(f) !== 'choice'))
}

/** The relations a list, report or widget can be preset on: every MANY_TO_ONE, keyed by its
 *  `<field>Id` filter param (the backend accepts the bare field name too, and keeps this). */
export function presettableRelations(entity: FullstackEntityDef | undefined): FullstackRelationDef[] {
  return (entity?.relations ?? []).filter(r => r.type === 'MANY_TO_ONE' && r.fieldName.trim() !== '')
}

/** The preset key of a relation: its filter param, `customerId`. */
export function relationPresetKey(r: Pick<FullstackRelationDef, 'fieldName'>): string {
  return `${r.fieldName}Id`
}

/** The relation a preset key names (`customerId`, or the bare `customer`), if any. */
export function relationOfPresetKey(entity: FullstackEntityDef | undefined, key: string): FullstackRelationDef | undefined {
  const k = key.trim().toLowerCase()
  return presettableRelations(entity).find(r => r.fieldName.toLowerCase() === k || relationPresetKey(r).toLowerCase() === k)
}

const UUID_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TEXT_ID = /^[A-Za-z0-9._~-]+$/

/** Why `value` is not a list of ids of `target` (mirrors FullstackPageValidator.relationIds), or undefined. */
export function relationPresetProblem(value: string, target: FullstackEntityDef | undefined): string | undefined {
  if (!value.trim()) return t('needs an id')
  const keyType = target?.fields.find(f => f.primaryKey)?.type
  for (const raw of value.split(',')) {
    const id = raw.trim()
    if (!id) return t('has an empty id')
    if (keyType === 'LONG' || keyType === 'INTEGER') {
      if (!/^-?\d+$/.test(id)) return t('“{id}” is not a whole number', { id })
    } else if (keyType === 'UUID') {
      if (!UUID_ID.test(id)) return t('“{id}” is not a UUID', { id })
    } else if (!TEXT_ID.test(id)) {
      return t('“{id}” may hold only letters, digits and . _ ~ -', { id })
    }
  }
  return undefined
}

/** The values of a multi-value preset (`OPEN,PAID` → both). */
export function presetValues(value: string): string[] {
  return value.split(',').map(v => v.trim()).filter(v => v !== '')
}

/** The two halves of a range value `a..b` (either blank), or null when it is not a range. */
export function parsePresetRange(value: string): { from: string; to: string } | null {
  const at = value.indexOf('..')
  if (at < 0) return null
  return { from: value.slice(0, at).trim(), to: value.slice(at + 2).trim() }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/

/** Why `value` is not a valid preset of `f` (mirrors FullstackPageValidator.presetFilter), or undefined. */
export function presetValueProblem(f: FullstackFieldDef, value: string): string | undefined {
  const v = value.trim()
  if (!v) return t('needs a value')
  switch (presetKind(f)) {
    case 'choice':
      if (f.type === 'BOOLEAN') return v === 'true' || v === 'false' ? undefined : t('expected true or false')
      if (v.split(',').some(part => part.trim() === '')) return t('has an empty value')
      for (const one of presetValues(v)) {
        if (!(f.enumValues ?? []).includes(one)) return t('“{value}” is not one of the values of {field}', { value: one, field: f.name })
      }
      return undefined
    case 'date': {
      if (PRESET_PERIODS.some(p => p.value === v.toLowerCase())) return undefined
      const range = parsePresetRange(v)
      if (!range) return t('needs a period or a date range (from..to)')
      if (!range.from && !range.to) return t('a range needs a from or a to')
      const ok = (d: string) => ISO_DAY.test(d) || (f.type === 'LOCAL_DATE_TIME' && ISO_DATE_TIME.test(d))
      if ((range.from && !ok(range.from)) || (range.to && !ok(range.to))) return t('dates must be yyyy-mm-dd')
      if (range.from && range.to && range.from > range.to) return t('from is after to')
      return undefined
    }
    case 'number': {
      const range = parsePresetRange(v)
      if (!range) return t('needs a number range (min..max)')
      if (!range.from && !range.to) return t('a range needs a min or a max')
      if ((range.from && !Number.isFinite(Number(range.from))) || (range.to && !Number.isFinite(Number(range.to)))) return t('min and max must be numbers')
      if (range.from && range.to && Number(range.from) > Number(range.to)) return t('min is above max')
      return undefined
    }
  }
}

/** A field's first sensible preset: its first value, the last 30 days, or "at least 0". */
export function defaultPresetValue(f: FullstackFieldDef): string {
  switch (presetKind(f)) {
    case 'date': return 'last:30d'
    case 'number': return '0..'
    default: return valuesOf(f)[0] ?? ''
  }
}

/** The periods as the generated app's preview names them — not the editor's words (the preview
 *  keeps English here, whatever the site's language). */
const PRESET_PERIOD_WORDS: Record<string, string> = {
  'last:7d': 'last 7 days', 'last:30d': 'last 30 days', 'last:90d': 'last 90 days', ytd: 'this year', '12m': 'last 12 months',
}

/** A preset as the generated UI would say it: "Placed on: last 30 days", "Total: 100 – 500", "Status: Open". */
export function describePresetValue(f: FullstackFieldDef, value: string): string {
  const period = PRESET_PERIOD_WORDS[value.trim().toLowerCase()]
  if (period) return period
  const range = presetKind(f) === 'choice' ? null : parsePresetRange(value)
  if (range) {
    if (range.from && range.to) return `${range.from} – ${range.to}`
    return range.from ? `≥ ${range.from}` : `≤ ${range.to}`
  }
  return presetValues(value).join(' or ')
}
