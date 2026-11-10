/**
 * What a fullstack request may say, as the backend states it: `GET /metadata/fullstack/schema`
 * (`FullstackSchema.java`), read here from the checked-in copy `fullstack-schema.json`.
 *
 * The editor mirrors the backend's validators so a problem shows on the control that causes it
 * rather than as a 400 on Generate. The numbers, name rules and reserved names those mirrors
 * need used to be retyped in half a dozen files and drifted; they now come from this document.
 * The closed lists that are also TypeScript unions (page types, widget kinds, field types, …)
 * stay written out — a union cannot be read from JSON — and `schemaParity.test.ts` holds each
 * of them to the document.
 *
 * Refresh the copy with `npm run sync:schema` after the backend's `FullstackSchemaTest` golden
 * file changes; `fixturesInSync.test.ts` fails while the two differ.
 */
import raw from './fullstack-schema.json'

export const SCHEMA = raw

/** The validators' numeric limits (`FullstackPageValidator`, `FullstackRequestValidator`). */
export const LIMITS = raw.limits

/** The closed sets of numbers a control offers (pager sizes, refresh intervals, lane sizes). */
export const CHOICES = raw.choices

/** A Java regex the backend matches whole (`Matcher.matches`), as an anchored JS one. */
const whole = (pattern: string) => new RegExp(/^\^.*\$$/.test(pattern) ? pattern : `^(?:${pattern})$`)

/** The name rules, compiled. */
export const NAME_RULES = {
  /** Entity, field and relation names: ASCII Java identifiers. */
  identifier: whole(raw.names.identifier),
  /** Table, schema, column and join-column names, quoted forms included. */
  sqlName: whole(raw.names.sqlName),
  pageId: whole(raw.names.pageId),
  transitionName: whole(raw.names.transitionName),
}

/** Java keywords — no entity, field, relation or enum constant may be one. */
export const RESERVED_KEYWORDS: ReadonlySet<string> = new Set(raw.names.reservedKeywords)

const RESERVED_ENTITY_NAMES: ReadonlySet<string> = new Set(raw.names.reservedEntityNames)

/**
 * Whether the generator refuses `name` as an entity's name because the class or component it
 * would generate collides with one the generated code already has (`Page`, `Table`, `Dashboard`…
 * — `ReservedNames.java`). Matched ignoring case, like the backend.
 */
export function isReservedEntityName(name: string): boolean {
  return RESERVED_ENTITY_NAMES.has(name.trim().toLowerCase())
}

/**
 * The entity whose generated class `name` would take (`OrderDto` beside `Order`), or undefined —
 * `ReservedNames.ownerOfGeneratedClass`. `others` are the other entities' names.
 */
export function ownerOfGeneratedClass(name: string, others: readonly string[]): string | undefined {
  const lower = name.trim().toLowerCase()
  for (const suffix of raw.names.generatedClassSuffixes) {
    const s = suffix.toLowerCase()
    if (lower.length <= s.length || !lower.endsWith(s)) continue
    const stem = lower.slice(0, -s.length)
    const owner = others.find(other => other.trim().toLowerCase() === stem)
    if (owner) return owner
  }
  return undefined
}

/** Scaffold option names an entity may override for itself. */
export const PER_ENTITY_OPTION_KEYS: readonly string[] = raw.scaffoldOptions.filter(o => o.perEntity).map(o => o.key)

/** Every scaffold option name the backend accepts in `opts.scaffold`. */
export const SCAFFOLD_OPTION_KEYS: readonly string[] = raw.scaffoldOptions.map(o => o.key)

/** Field-type aliases the backend parses (`FieldType.ALIASES`), lower-cased → the type. */
export const BACKEND_TYPE_ALIASES: Readonly<Record<string, string>> = Object.fromEntries(
  raw.fieldTypes.flatMap(t => t.aliases.map(alias => [alias.toLowerCase(), t.type])),
)
