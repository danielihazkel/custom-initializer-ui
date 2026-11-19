import type { FullstackEntityDef } from '../../types'
import { formSectionsProblem } from './formSections'
import { workflowProblem } from './workflow'
import { accessProblem } from './access'
import { MAX_FILES, MAX_HELP, uniqueKeysProblem } from './uniqueKeys'
import { derivationProblem, rulesProblem } from './rules'
import { columnOf, joinColumnOf } from './naming'
import { DATABASE_LABELS, databaseOf, isSystemColumnOn, needsQuotes, tableOf } from './sqlNames'
import { compositionProblem, linksBetween, resolveLink } from './childLists'
import { LIMITS, NAME_RULES, RESERVED_KEYWORDS, isReservedEntityName, ownerOfGeneratedClass } from './schema'
import { isDecimalType, isKeyableType, isNumericType, isTextualType } from './fieldTypes'
import { t } from '../../i18n'

/**
 * Client-side mirror of the backend `FullstackRequestValidator` so users see problems
 * inline before submitting. The server remains the source of truth — these checks just
 * surface the same rules early and gate the Generate button.
 */

// RESERVED_JAVA_KEYWORDS of FullstackRequestValidator.java, from the schema document.
const RESERVED_JAVA_KEYWORDS = RESERVED_KEYWORDS

// ASCII Java identifiers — the backend holds names to the same rule (FullstackRequestValidator.IDENTIFIER_RULE).
const IDENTIFIER_RE = NAME_RULES.identifier

// Valid Java package: dot-separated identifiers. Mirrors PACKAGE_NAME_RE in projectUtils.ts.
const PACKAGE_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/

export interface MetaErrors {
  groupId?: string
  artifactId?: string
  name?: string
  version?: string
  packageName?: string
  domainPackage?: string
  bootVersion?: string
  javaVersion?: string
}

// Maven coordinates: a version is a dotted/dashed token (`1.0.0`, `0.0.1-SNAPSHOT`, `2024.1`).
// The server only rejects a bad one at Generate, so the editor flags it up front.
const MAVEN_VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** The version ids the server knows. A restored preset or share link can carry a version that
 *  has since left the catalog; the server rejects it with a 400 only at Generate, so the editor
 *  flags it up front. An empty list means the catalog hasn't loaded — nothing is flagged. */
export interface VersionCatalog {
  bootVersions: string[]
  javaVersions: string[]
}

/** `/metadata/client` spells Boot versions the Initializr v1 way (`3.2.1.RELEASE`); the catalog id
 *  the fullstack endpoint stores and the templates pin is `3.2.1`. Compare and send the latter. */
export function canonicalVersion(v: string): string {
  return v.endsWith('.RELEASE') ? v.slice(0, -'.RELEASE'.length) : v
}

/** Validates the project-metadata fields. Mirrors the Backend tab's validateForm rules. */
export function validateMeta(
  meta: { groupId: string; artifactId: string; name?: string; version?: string; packageName: string; domainPackage?: string; bootVersion?: string; javaVersion?: string },
  catalog?: VersionCatalog,
): MetaErrors {
  const errors: MetaErrors = {}
  if (catalog) {
    const boots = catalog.bootVersions.map(canonicalVersion)
    if (boots.length > 0 && meta.bootVersion && !boots.includes(canonicalVersion(meta.bootVersion))) {
      errors.bootVersion = t('Not in the catalog ({version})', { version: meta.bootVersion })
    }
    if (catalog.javaVersions.length > 0 && meta.javaVersion && !catalog.javaVersions.includes(meta.javaVersion)) {
      errors.javaVersion = t('Not in the catalog ({version})', { version: meta.javaVersion })
    }
  }
  if (!meta.artifactId.trim()) errors.artifactId = t('Required')
  else if (/\s/.test(meta.artifactId)) errors.artifactId = t('No spaces allowed')
  if (!meta.groupId.trim()) errors.groupId = t('Required')
  // Both optional (blank = the server's default); when typed they must be usable in the pom.
  if (meta.name !== undefined && meta.name !== '' && !meta.name.trim()) errors.name = t('Blank — leave empty to use the artifact id')
  if (meta.version?.trim() && !MAVEN_VERSION_RE.test(meta.version.trim())) errors.version = t('Not a valid Maven version (e.g. 0.0.1-SNAPSHOT)')
  if (!meta.packageName.trim()) errors.packageName = t('Required')
  else if (!PACKAGE_NAME_RE.test(meta.packageName)) errors.packageName = t('Invalid Java package name')

  // Optional: blank means "same as Package Name". When set it must be valid and live at or
  // below the base package, mirroring the server's resolveDomainPackage check.
  const domain = meta.domainPackage?.trim()
  if (domain) {
    const base = meta.packageName.trim()
    if (!PACKAGE_NAME_RE.test(domain)) errors.domainPackage = t('Invalid Java package name')
    else if (base && domain !== base && !domain.startsWith(base + '.')) {
      errors.domainPackage = t('Must be the Package Name or a sub-package of it')
    }
  }
  return errors
}

export function countMetaErrors(e: MetaErrors): number {
  return Object.values(e).filter(Boolean).length
}

/** `required` is the whole message for a blank name ("Entity name is required"). */
function identifierError(value: string, required: string): string | undefined {
  if (!value.trim()) return required
  if (!IDENTIFIER_RE.test(value.trim())) return t('Not a valid identifier')
  if (RESERVED_JAVA_KEYWORDS.has(value.trim().toLowerCase())) return t('Reserved keyword')
  return undefined
}

export interface FieldErrors {
  name?: string
  enumValues?: string
  length?: string
  generated?: string
  min?: string
  max?: string
  pattern?: string
  email?: string
  defaultValue?: string
  column?: string
  currency?: string
  help?: string
  showWhen?: string
  formula?: string
  maxFiles?: string
}

/** Mirrors FullstackRequestValidator.SQL_NAME: column names are spliced into native SQL. A quoted
 *  name ("OrderDate", `OrderDate`, [OrderDate]) keeps its exact case in the generated entity. */
const COLUMN_RE = NAME_RULES.sqlName
const columnRule = () => t('Letters, digits and _ $ # @, or a quoted name like "OrderDate"')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?$/

/** Mirrors FullstackRequestValidator.normalizeDefault: a default must parse as the field's type.
 *  Returns a message, or undefined when the value is acceptable (or absent). */
export function defaultValueError(field: {
  type: FullstackEntityDef['fields'][number]['type']
  defaultValue?: string
  enumValues?: string[]
  length?: number
  generated?: boolean
  primaryKey?: boolean
}): string | undefined {
  const raw = field.defaultValue
  if (raw == null || raw.trim() === '') return undefined
  if (field.generated && field.primaryKey) return t('A generated key cannot have a default')
  const v = raw.trim()
  switch (field.type) {
    case 'LONG':
    case 'INTEGER':
      return /^[+-]?\d+$/.test(v) ? undefined : t('Must be a whole number')
    case 'BIG_DECIMAL':
      return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v) ? undefined : t('Must be a number')
    case 'FILE':
    case 'IMAGE':
      return t('A file is uploaded, not typed — it cannot have a default')
    case 'MONEY':
      // Two decimals at most — what the column keeps.
      return /^[+-]?(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(v) ? undefined : t('Must be an amount with at most two decimals')
    case 'LOCAL_TIME':
      return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v) ? undefined : t('Must be a time (HH:MM or HH:MM:SS)')
    case 'INSTANT':
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?Z$/.test(v) && !Number.isNaN(Date.parse(v))
        ? undefined : t('Must be a UTC instant (YYYY-MM-DDTHH:MM:SSZ)')
    case 'BOOLEAN':
      return /^(true|false)$/i.test(v) ? undefined : t('Must be true or false')
    case 'LOCAL_DATE':
      return ISO_DATE_RE.test(v) && !Number.isNaN(Date.parse(v)) ? undefined : t('Must be an ISO date (YYYY-MM-DD)')
    case 'LOCAL_DATE_TIME':
      return ISO_DATE_TIME_RE.test(v) && !Number.isNaN(Date.parse(v)) ? undefined : t('Must be an ISO date-time (YYYY-MM-DDTHH:MM[:SS])')
    case 'UUID':
      return UUID_RE.test(v) ? undefined : t('Must be a UUID')
    case 'ENUM': {
      const values = field.enumValues ?? []
      return values.some(e => e.toUpperCase() === v.toUpperCase()) ? undefined : t('Must be one of the enum values')
    }
    case 'STRING':
      return field.length != null && v.length > field.length ? t('Longer than the max length ({length})', { length: field.length }) : undefined
    default:
      return undefined
  }
}

/** Whether a default typed for `from` still parses as `to`, so a type change can keep it instead
 *  of silently wiping what the user typed. Only the lossless pairs carry over (STRING↔TEXT, and
 *  LONG↔INTEGER when the value fits an int); everything else returns undefined = clear it. */
export function carryDefaultAcrossTypes(
  from: FullstackEntityDef['fields'][number]['type'],
  to: FullstackEntityDef['fields'][number]['type'],
  value: string | undefined,
): string | undefined {
  if (value == null || value.trim() === '') return undefined
  if (from === to) return value
  const text = isTextualType(from) && isTextualType(to)
  if (text) return value
  const integral = (from === 'LONG' || from === 'INTEGER') && (to === 'LONG' || to === 'INTEGER')
  if (integral) {
    if (to === 'LONG') return value
    const n = Number(value.trim())
    return Number.isInteger(n) && n >= -2147483648 && n <= 2147483647 ? value : undefined
  }
  return undefined
}

export interface RelationErrors {
  fieldName?: string
  targetEntity?: string
  joinColumn?: string
  /** A MANY_TO_MANY's join table name, or the kind itself when this entity cannot own one. */
  joinTable?: string
  /** A ONE_TO_MANY's link: not one of the target's, ambiguous, or already listed. */
  mappedBy?: string
  /** Why a ONE_TO_MANY cannot be a composition. */
  composition?: string
  label?: string
}

export interface EntityErrors {
  name?: string
  /** The entity has no fields at all (the backend rejects it before any PK check). */
  noFields?: string
  pk?: string
  /** SELECT-backed view constraint (no generated PK, no relations). */
  view?: string
  /** The "SELECT view" box is ticked but the query is still blank. Counted like any error (the
   *  server would treat the entity as a plain table), but shown as a pending hint rather than a
   *  red banner — ticking the box is the first step of typing the query, not a mistake. */
  viewQuery?: string
  fields: Record<number, FieldErrors>
  relations?: Record<number, RelationErrors>
  /** The form sections name a field twice, one that is gone, or have no title. */
  formSections?: string
  /** Writing is open to more people than reading (the server's rule; see `access.ts`). */
  access?: string
  /** The workflow would be rejected (a state, field or role it names). */
  workflow?: string
  /** A unique key would be rejected (see `uniqueKeys.ts`). */
  uniqueKeys?: string
  /** A rule would be rejected (see `rules.ts`). */
  rules?: string
  /** The table's name cannot be written where the generator needs it (see `sqlNames.ts`). */
  tableName?: string
}

export interface FullstackErrors {
  entities: Record<number, EntityErrors>
  /** True when there are no entities at all — the backend rejects an empty list. */
  noEntities?: boolean
  /** Total number of distinct problems found — drives the Generate gate + summary. */
  count: number
}

/** `projectOpts` (the project's `opts.scaffold`) is needed for the one rule that depends on an
 *  option: optimistic locking takes the name `version` for itself. */
export function validateEntities(entities: FullstackEntityDef[], projectOpts: string[] = [],
                                 context: { ldapAuth?: boolean; deps?: readonly string[] } = {}): FullstackErrors {
  const result: FullstackErrors = { entities: {}, count: 0 }
  // The database the names are written for; unknown (no dependency list given) checks nothing about it.
  const database = context.deps ? databaseOf(context.deps) : undefined

  // The backend requires at least one entity (FullstackRequestValidator.java).
  if (entities.length === 0) {
    result.noEntities = true
    result.count += 1
    return result
  }

  // First pass: PK count per entity (case-insensitive), so a relation can resolve its target's
  // key shape — a MANY_TO_ONE may not point at a composite-PK entity (mirrors the backend guard).
  const pkCountByName = new Map<string, number>()
  // SELECT-backed views (lower name) — a MANY_TO_ONE may not target one.
  const viewNames = new Set<string>()
  for (const e of entities) {
    if (!e.name?.trim()) continue
    pkCountByName.set(e.name.trim().toLowerCase(), e.fields.filter(f => f.primaryKey).length)
    if (e.viewQuery != null) viewNames.add(e.name.trim().toLowerCase())
  }

  const seenEntityNames = new Map<string, number[]>() // lower name → entity indexes

  entities.forEach((entity, eIdx) => {
    const eErr: EntityErrors = { fields: {} }

    const nameErr = identifierError(entity.name, t('Entity name is required'))
    if (nameErr) eErr.name = nameErr
    // The generated code already names these (ReservedNames.java): a 400 on Generate otherwise.
    else if (isReservedEntityName(entity.name)) {
      eErr.name = t("'{name}' is a name the generated code already uses — pick another (a label can still say it)", { name: entity.name.trim() })
    } else {
      const owner = ownerOfGeneratedClass(entity.name, entities.filter(other => other !== entity).map(other => other.name))
      if (owner) eErr.name = t("'{owner}' already generates a class called {name} — pick another name", { owner, name: entity.name.trim() })
      const lower = entity.name.trim().toLowerCase()
      const bucket = seenEntityNames.get(lower) ?? []
      bucket.push(eIdx)
      seenEntityNames.set(lower, bucket)
    }

    // Field checks
    let pkCount = 0
    const seenFieldNames = new Map<string, number[]>()
    entity.fields.forEach((field, fIdx) => {
      const fErr: FieldErrors = {}
      const fNameErr = identifierError(field.name, t('Field name is required'))
      if (fNameErr) fErr.name = fNameErr
      else {
        const lower = field.name.trim().toLowerCase()
        const bucket = seenFieldNames.get(lower) ?? []
        bucket.push(fIdx)
        seenFieldNames.set(lower, bucket)
      }

      if (field.primaryKey) pkCount++

      if (field.type === 'ENUM') {
        const values = field.enumValues ?? []
        if (values.length === 0) {
          fErr.enumValues = t('At least one value required')
        } else {
          // Exact-case, like the server: Java keywords are lower-case, so NEW/DEFAULT are fine.
          const bad = values.find(v => !IDENTIFIER_RE.test(v) || RESERVED_JAVA_KEYWORDS.has(v))
          if (bad) fErr.enumValues = t("Invalid value '{value}'", { value: bad })
        }
        // Labels are optional. Mirrors FullstackRequestValidator.canonicalEnumLabels: each key
        // must be one of the values (case-insensitively), and a label must be non-blank and at
        // most 80 characters. The editor prunes keys when a value goes, so these only fire on a
        // hand-edited or imported model.
        const known = new Set(values.map(v => v.trim().toLowerCase()))
        for (const [key, label] of Object.entries(field.enumLabels ?? {})) {
          if (fErr.enumValues) break
          if (!known.has(key.trim().toLowerCase())) fErr.enumValues = t("Label for '{key}', which is not one of the values", { key })
          else if (!label.trim()) fErr.enumValues = t("Label for '{key}' is blank", { key })
          else if (label.trim().length > LIMITS.maxEnumLabel) fErr.enumValues = t("Label for '{key}' is too long (max {max} characters)", { key, max: LIMITS.maxEnumLabel })
        }
      } else if ((field.enumValues?.length ?? 0) > 0 || Object.keys(field.enumLabels ?? {}).length > 0) {
        // Mirrors the backend rule that enumValues/enumLabels are only allowed when type=ENUM.
        // The editor clears these on type change; this guards stale persisted/imported state.
        fErr.enumValues = t('Values apply to ENUM only')
      }

      if (field.length != null) {
        if (field.type !== 'STRING') fErr.length = t('Length applies to STRING only')
        else if (field.length <= 0) fErr.length = t('Length must be positive')
      }

      // 'generated' (auto-increment) only makes sense on an integral primary key. The editor
      // disables the checkbox otherwise, but guard stale persisted/imported state too.
      if (field.generated) {
        if (!field.primaryKey) fErr.generated = t('Only the primary key can be auto-generated')
        else if (field.type !== 'LONG' && field.type !== 'INTEGER' && field.type !== 'UUID') fErr.generated = t('Generated key must be LONG, INTEGER, or UUID')
      }

      // Numeric bounds: only on numeric types, min ≤ max. Regex/email: only on STRING.
      const isNumeric = isNumericType(field.type)
      if (field.min != null || field.max != null) {
        if (!isNumeric) {
          if (field.min != null) fErr.min = t('Min applies to numeric fields only')
          if (field.max != null) fErr.max = t('Max applies to numeric fields only')
        } else {
          // Integral bounds must be whole (the DTO renders them into @Min/@Max, which take longs);
          // decimals are only meaningful on BIG_DECIMAL (@DecimalMin/@DecimalMax).
          if (!isDecimalType(field.type)) {
            const whole = (v: number) => Number.isInteger(v) && (field.type === 'LONG' || (v >= -2147483648 && v <= 2147483647))
            if (field.min != null && !whole(field.min)) fErr.min = field.type === 'INTEGER' && Number.isInteger(field.min) ? t('Out of the int range') : t('Must be a whole number')
            if (field.max != null && !whole(field.max)) fErr.max = field.type === 'INTEGER' && Number.isInteger(field.max) ? t('Out of the int range') : t('Must be a whole number')
          }
          if (!fErr.min && field.min != null && field.max != null && field.min > field.max) {
            fErr.min = t('Min must be ≤ Max')
          }
        }
      }
      // Regex syntax is deliberately not checked here: the server compiles it with
      // java.util.regex.Pattern, and JS rejects Java-only constructs (possessive quantifiers,
      // \p{Alpha} without the u flag), so a client-side RegExp check would block valid input.
      if (field.pattern != null && field.pattern !== '' && field.type !== 'STRING') {
        fErr.pattern = t('Pattern applies to STRING only')
      }
      if (field.email && field.type !== 'STRING') fErr.email = t('Email applies to STRING only')

      const defErr = defaultValueError(field)
      if (defErr) fErr.defaultValue = defErr

      if (field.help && field.help.trim().length > MAX_HELP) fErr.help = t('At most {max} characters', { max: MAX_HELP })
      // Several files in one field (FullstackRequestValidator's maxFiles rules).
      if (field.maxFiles != null) {
        if (field.type !== 'FILE' && field.type !== 'IMAGE') fErr.maxFiles = t('Several files apply to FILE and IMAGE only')
        else if (!Number.isInteger(field.maxFiles) || field.maxFiles < 1 || field.maxFiles > MAX_FILES) {
          fErr.maxFiles = t('Between 1 and {max}', { max: MAX_FILES })
        } else if (field.showWhen?.trim()) fErr.maxFiles = t('A field with several files cannot be shown on a condition')
      }
      const derived = derivationProblem(entity, field, entities)
      if (derived) fErr[derived.part] = derived.message
      // A currency is a MONEY field's, three letters (the backend upper-cases it; blank = ILS).
      if (field.currency?.trim()) {
        if (field.type !== 'MONEY') fErr.currency = t('Currency applies to MONEY only')
        else if (!/^[A-Za-z]{3}$/.test(field.currency.trim())) fErr.currency = t('A three-letter code such as ILS or USD')
      }
      // A key travels in URLs and relation ids, which these types are not fit for.
      if (field.primaryKey && !isKeyableType(field.type)) {
        fErr.generated = t('A {type} field cannot be the key', { type: field.type })
      }

      if (field.column?.trim()) {
        if (entity.viewQuery != null) fErr.column = t('A view maps fields by their names')
        else if (!COLUMN_RE.test(field.column.trim())) fErr.column = columnRule()
      }

      // A column every table of the project's database already has cannot be a model's column.
      if (database && entity.viewQuery == null && field.name.trim() && !fErr.name && isSystemColumnOn(columnOf(field), database)) {
        fErr.name = t('{column} is a column every table on {database} already has — give the field another name or a column of its own',
          { column: columnOf(field), database: DATABASE_LABELS[database] })
      }

      if (Object.keys(fErr).length > 0) {
        eErr.fields[fIdx] = fErr
        result.count += Object.keys(fErr).length
      }
    })

    // Optimistic locking adds a `version` property and column (FullstackRequestValidator.checkVersionName).
    const locking = (entity.opts?.optimisticLocking ?? projectOpts.includes('optimisticLocking'))
      && !entity.readOnly && entity.viewQuery == null
    if (locking) {
      entity.fields.forEach((field, fIdx) => {
        const taken = field.name.trim().toLowerCase() === 'version' || field.column?.trim().toLowerCase() === 'version'
        const existing = eErr.fields[fIdx] ?? {}
        if (taken && !existing.name) {
          existing.name = t("'version' is taken by optimistic locking — rename it, or turn locking off for this entity")
          eErr.fields[fIdx] = existing
          result.count += 1
        }
      })
    }

    // Duplicate field names within the entity
    for (const idxs of seenFieldNames.values()) {
      if (idxs.length > 1) {
        idxs.forEach(i => {
          const existing = eErr.fields[i] ?? {}
          if (!existing.name) {
            existing.name = t('Duplicate field name')
            eErr.fields[i] = existing
            result.count += 1
          }
        })
      }
    }

    if (entity.fields.length === 0) {
      // Mirrors FullstackRequestValidator ("has no fields"); the PK rule would only confuse here.
      eErr.noFields = t('Add at least one field')
      result.count += 1
    } else if (pkCount === 0) {
      eErr.pk = t('Mark at least one field as the primary key (PK)')
      result.count += 1
    } else if (pkCount > 1 && entity.fields.some(f => f.primaryKey && f.generated)) {
      // Composite keys are allowed, but a generated key requires a single PK (JPA IDENTITY).
      eErr.pk = t('A generated key requires a single primary key')
      result.count += 1
    }

    // SELECT-backed view: maps to @Subselect, so no auto-generated PK and no relations (v1). The
    // editor's "SELECT-backed view" tick sets viewQuery to '' until the query is typed; the server
    // would quietly treat a blank query as a plain table, so block that here.
    const isView = entity.viewQuery != null
    if (isView) {
      // Both rules are independent (the backend raises each on its own), so report both.
      const viewErrors: string[] = []
      if (!entity.viewQuery!.trim()) {
        eErr.viewQuery = t('Enter the SELECT query or untick "SELECT view"')
        result.count += 1
      }
      if (entity.fields.some(f => f.generated)) viewErrors.push(t('A view cannot have a generated primary key'))
      if ((entity.relations?.length ?? 0) > 0) viewErrors.push(t('A view cannot declare relations'))
      if (viewErrors.length > 0) {
        eErr.view = viewErrors.join('; ')
        result.count += viewErrors.length
      }
    }

    // Relations (MANY_TO_ONE). fieldName must be a unique, valid identifier across fields and
    // relations; targetEntity must exist and not be a composite-PK entity.
    const relations = entity.relations ?? []
    const listedLinks = new Set<string>()
    relations.forEach((rel, rIdx) => {
      const rErr: RelationErrors = {}
      const nameErr = identifierError(rel.fieldName, t('Relation field name is required'))
      if (nameErr) {
        rErr.fieldName = nameErr
      } else {
        const lower = rel.fieldName.trim().toLowerCase()
        const clashesField = entity.fields.some(f => f.name.trim().toLowerCase() === lower)
        const clashesRel = relations.slice(0, rIdx).some(r => r.fieldName.trim().toLowerCase() === lower)
        if (clashesField || clashesRel) rErr.fieldName = t('Name collides with a field or relation')
      }
      const target = rel.targetEntity?.trim()
      if (!target) {
        rErr.targetEntity = t('Select a target entity')
      } else {
        const targetPkCount = pkCountByName.get(target.toLowerCase())
        if (targetPkCount === undefined) rErr.targetEntity = t("Unknown entity '{name}'", { name: target })
        // A one-to-many holds no key of its target, so its rows may be keyed any way.
        else if (targetPkCount > 1 && rel.type !== 'ONE_TO_MANY') rErr.targetEntity = t("Can't target a composite-PK entity")
        else if (viewNames.has(target.toLowerCase())) rErr.targetEntity = t("Can't target a view")
      }
      if (rel.joinColumn?.trim() && !COLUMN_RE.test(rel.joinColumn.trim())) {
        rErr.joinColumn = columnRule()
      }
      if ((rel.label?.trim().length ?? 0) > LIMITS.maxRelationLabel) {
        rErr.label = t('Label is too long (max {max} characters)', { max: LIMITS.maxRelationLabel })
      }
      // A ONE_TO_MANY reads a link the target holds: which one must be settled, and no two
      // lists may read the same one.
      if (rel.type === 'ONE_TO_MANY' && target && !rErr.targetEntity) {
        const child = entities.find(e => e.name.trim().toLowerCase() === target.toLowerCase())
        const link = resolveLink(rel, entity.name, linksBetween(child, entity.name))
        if (link.problem) {
          rErr[link.problem.on] = link.problem.message
        } else {
          const key = `${target.toLowerCase()}>${link.mappedBy!.toLowerCase()}`
          if (listedLinks.has(key)) rErr.mappedBy = t('Lists the same rows as another one-to-many of this entity')
          listedLinks.add(key)
          if (rel.composition) {
            const problem = compositionProblem(entity, rel, link.mappedBy!, entities)
            if (problem) rErr.composition = problem
          }
        }
      }
      // A MANY_TO_MANY keeps one key of each side in its join table, so both sides need a single
      // one, and an entity cannot be both ends of it.
      if (rel.type === 'MANY_TO_MANY') {
        if (target && !rErr.targetEntity && target.toLowerCase() === entity.name.trim().toLowerCase()) {
          rErr.targetEntity = t("Can't link an entity to itself this way — add a join entity")
        }
        if (pkCount > 1) rErr.joinTable = t('A composite-key entity cannot own a many-to-many')
        else if (rel.joinTable?.trim() && !COLUMN_RE.test(rel.joinTable.trim())) rErr.joinTable = columnRule()
      }
      if (Object.keys(rErr).length > 0) {
        eErr.relations = eErr.relations ?? {}
        eErr.relations[rIdx] = rErr
        result.count += Object.keys(rErr).length
      }
    })

    // Two members on one column — mirrors FullstackRequestValidator.checkColumnClashes, which only
    // looks where an explicit column is involved.
    const byColumn = new Map<string, { explicit: boolean; mark: () => void }[]>()
    const addMember = (column: string, explicit: boolean, mark: () => void) => {
      if (!column) return
      const key = column.toLowerCase()
      byColumn.set(key, [...(byColumn.get(key) ?? []), { explicit, mark }])
    }
    entity.fields.forEach((field, fIdx) => {
      if (!field.name.trim()) return
      addMember(columnOf(field), Boolean(field.column?.trim()), () => {
        const existing = eErr.fields[fIdx] ?? {}
        if (!existing.column) {
          existing.column = t('Column {column} is used twice', { column: columnOf(field) })
          eErr.fields[fIdx] = existing
          result.count += 1
        }
      })
    })
    relations.forEach((rel, rIdx) => {
      // Only a foreign key is a column of this table: a many-to-many's are in its join table,
      // a one-to-many's in its target's.
      if (!rel.fieldName.trim() || rel.type !== 'MANY_TO_ONE') return
      addMember(joinColumnOf(rel), Boolean(rel.joinColumn?.trim()), () => {
        eErr.relations = eErr.relations ?? {}
        const existing = eErr.relations[rIdx] ?? {}
        if (!existing.joinColumn) {
          existing.joinColumn = t('Column {column} is used twice', { column: joinColumnOf(rel) })
          eErr.relations[rIdx] = existing
          result.count += 1
        }
      })
    })
    for (const members of byColumn.values()) {
      if (members.length > 1 && members.some(m => m.explicit)) members.forEach(m => m.mark())
    }

    if (eErr.name) result.count += 1
    const sectionsErr = formSectionsProblem(entity)
    if (sectionsErr) {
      eErr.formSections = sectionsErr
      result.count += 1
    }
    const accessErr = accessProblem(entity)
    if (accessErr) {
      eErr.access = accessErr
      result.count += 1
    }
    const workflowErr = workflowProblem(entity, { ...context, audited: entity.opts?.audit ?? projectOpts.includes('audit') })
    if (workflowErr) {
      eErr.workflow = workflowErr
      result.count += 1
    }
    const composed = entities.some(other => (other.relations ?? []).some(r => r.type === 'ONE_TO_MANY' && r.composition
      && r.targetEntity.trim().toLowerCase() === entity.name.trim().toLowerCase()))
    const keysErr = uniqueKeysProblem(entity, composed)
    if (keysErr) {
      eErr.uniqueKeys = keysErr
      result.count += 1
    }
    const rulesErr = rulesProblem(entity, entities)
    if (rulesErr) {
      eErr.rules = rulesErr
      result.count += 1
    }
    // A parent counts its child rows in SQL written into its mapping, which cannot name a table
    // that has to be quoted (FullstackProjectAssembler.checkCountedTables).
    if (database && entity.viewQuery == null && needsQuotes(tableOf(entity), database)) {
      const self = entity.name.trim().toLowerCase()
      const parent = (entity.relations ?? []).filter(r => r.type === 'MANY_TO_ONE')
        .map(r => entities.find(e => e.name.trim().toLowerCase() === r.targetEntity.trim().toLowerCase()))
        .find(p => p && (projectOpts.includes('inverseCollections')
          || (p.relations ?? []).some(r => r.type === 'ONE_TO_MANY' && r.targetEntity.trim().toLowerCase() === self)))
      if (parent) {
        eErr.tableName = t('{child}’s table ({table}) has to be quoted on {database}, which the SQL that counts a {parent}’s {child} rows cannot do — give {child} a table name that needs no quotes',
          { child: entity.name.trim(), table: tableOf(entity), database: DATABASE_LABELS[database], parent: parent.name.trim() })
        result.count += 1
      }
    }
    const hasRelErrs = eErr.relations && Object.keys(eErr.relations).length > 0
    if (eErr.name || eErr.noFields || eErr.pk || eErr.view || eErr.viewQuery || eErr.formSections || eErr.access || eErr.workflow || eErr.uniqueKeys || eErr.rules || eErr.tableName || Object.keys(eErr.fields).length > 0 || hasRelErrs) {
      result.entities[eIdx] = eErr
    }
  })

  // Duplicate entity names (case-insensitive)
  for (const idxs of seenEntityNames.values()) {
    if (idxs.length > 1) {
      idxs.forEach(i => {
        const existing = result.entities[i] ?? { fields: {} }
        if (!existing.name) {
          existing.name = t('Duplicate entity name')
          result.entities[i] = existing
          result.count += 1
        }
      })
    }
  }

  return result
}
