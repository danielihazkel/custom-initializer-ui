import type { FullstackFieldType } from '../../types'

/**
 * What kind of thing a field type is — the editor's mirror of the predicates on the backend's
 * `FieldType.java`. The rules that depend on a type (what may be filtered, charted, searched,
 * keyed) are asked here rather than spelt as lists of type names where they are used, so a new
 * type is placed once.
 */

/** Every field type, in the order the type picker lists them. `schemaParity.test.ts` holds it to the backend's. */
export const FIELD_TYPES: FullstackFieldType[] = [
  'STRING', 'TEXT', 'MARKDOWN', 'LONG', 'INTEGER', 'BIG_DECIMAL', 'MONEY', 'BOOLEAN',
  'LOCAL_DATE', 'LOCAL_DATE_TIME', 'LOCAL_TIME', 'INSTANT', 'UUID', 'ENUM',
]

/** What the picker calls a type whose name does not say it. */
export const FIELD_TYPE_LABELS: Partial<Record<FullstackFieldType, string>> = {
  MARKDOWN: 'MARKDOWN (rich text)',
  MONEY: 'MONEY (amount + currency)',
  LOCAL_TIME: 'LOCAL_TIME (time of day)',
  INSTANT: 'INSTANT (UTC timestamp)',
}

/** A number: bounds, sums, averages, range filters. Money is one. */
export const isNumericType = (t: FullstackFieldType) => t === 'LONG' || t === 'INTEGER' || t === 'BIG_DECIMAL' || t === 'MONEY'

/** A number with decimals — its bounds and default need not be whole. */
export const isDecimalType = (t: FullstackFieldType) => t === 'BIG_DECIMAL' || t === 'MONEY'

/** Long text: a TEXT column and a textarea. Markdown is long text shown formatted. */
export const isLongTextType = (t: FullstackFieldType) => t === 'TEXT' || t === 'MARKDOWN'

/** Text the generated search box looks in. */
export const isTextualType = (t: FullstackFieldType) => t === 'STRING' || isLongTextType(t)

/**
 * A date the generated app can filter, chart and put on a calendar: a local date or date-time.
 * Not a bare time of day, and not an instant — those are shown and sorted only.
 */
export const isDateType = (t: FullstackFieldType) => t === 'LOCAL_DATE' || t === 'LOCAL_DATE_TIME'

/** Whether a field of this type may be (part of) the primary key — `FieldType.keyable()`. */
export const isKeyableType = (t: FullstackFieldType) =>
  t !== 'LOCAL_TIME' && t !== 'INSTANT' && t !== 'MONEY' && t !== 'MARKDOWN'

/** The currency a MONEY field has when it names none (`FieldDefinition.DEFAULT_CURRENCY`). */
export const DEFAULT_CURRENCY = 'ILS'
