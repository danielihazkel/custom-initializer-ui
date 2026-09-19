import type { FullstackEntityDef } from '../../types'

/**
 * Client-side mirror of the backend `FullstackRequestValidator` so users see problems
 * inline before submitting. The server remains the source of truth — these checks just
 * surface the same rules early and gate the Generate button.
 */

// Mirrors RESERVED_JAVA_KEYWORDS in FullstackRequestValidator.java.
const RESERVED_JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'null',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'true', 'false', 'try', 'void', 'volatile', 'while', 'yield',
  'record', 'sealed', 'permits', 'var',
])

// Close enough to Character.isJavaIdentifier* for a UI hint (ASCII identifiers).
const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

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
      errors.bootVersion = `Not in the catalog (${meta.bootVersion})`
    }
    if (catalog.javaVersions.length > 0 && meta.javaVersion && !catalog.javaVersions.includes(meta.javaVersion)) {
      errors.javaVersion = `Not in the catalog (${meta.javaVersion})`
    }
  }
  if (!meta.artifactId.trim()) errors.artifactId = 'Required'
  else if (/\s/.test(meta.artifactId)) errors.artifactId = 'No spaces allowed'
  if (!meta.groupId.trim()) errors.groupId = 'Required'
  // Both optional (blank = the server's default); when typed they must be usable in the pom.
  if (meta.name !== undefined && meta.name !== '' && !meta.name.trim()) errors.name = 'Blank — leave empty to use the artifact id'
  if (meta.version?.trim() && !MAVEN_VERSION_RE.test(meta.version.trim())) errors.version = 'Not a valid Maven version (e.g. 0.0.1-SNAPSHOT)'
  if (!meta.packageName.trim()) errors.packageName = 'Required'
  else if (!PACKAGE_NAME_RE.test(meta.packageName)) errors.packageName = 'Invalid Java package name'

  // Optional: blank means "same as Package Name". When set it must be valid and live at or
  // below the base package, mirroring the server's resolveDomainPackage check.
  const domain = meta.domainPackage?.trim()
  if (domain) {
    const base = meta.packageName.trim()
    if (!PACKAGE_NAME_RE.test(domain)) errors.domainPackage = 'Invalid Java package name'
    else if (base && domain !== base && !domain.startsWith(base + '.')) {
      errors.domainPackage = 'Must be the Package Name or a sub-package of it'
    }
  }
  return errors
}

export function countMetaErrors(e: MetaErrors): number {
  return Object.values(e).filter(Boolean).length
}

function identifierError(value: string, label: string): string | undefined {
  if (!value.trim()) return `${label} is required`
  if (!IDENTIFIER_RE.test(value.trim())) return `Not a valid identifier`
  if (RESERVED_JAVA_KEYWORDS.has(value.trim().toLowerCase())) return `Reserved keyword`
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
}

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
  if (field.generated && field.primaryKey) return 'A generated key cannot have a default'
  const v = raw.trim()
  switch (field.type) {
    case 'LONG':
    case 'INTEGER':
      return /^[+-]?\d+$/.test(v) ? undefined : 'Must be a whole number'
    case 'BIG_DECIMAL':
      return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v) ? undefined : 'Must be a number'
    case 'BOOLEAN':
      return /^(true|false)$/i.test(v) ? undefined : 'Must be true or false'
    case 'LOCAL_DATE':
      return ISO_DATE_RE.test(v) && !Number.isNaN(Date.parse(v)) ? undefined : 'Must be an ISO date (YYYY-MM-DD)'
    case 'LOCAL_DATE_TIME':
      return ISO_DATE_TIME_RE.test(v) && !Number.isNaN(Date.parse(v)) ? undefined : 'Must be an ISO date-time (YYYY-MM-DDTHH:MM[:SS])'
    case 'UUID':
      return UUID_RE.test(v) ? undefined : 'Must be a UUID'
    case 'ENUM': {
      const values = field.enumValues ?? []
      return values.some(e => e.toUpperCase() === v.toUpperCase()) ? undefined : 'Must be one of the enum values'
    }
    case 'STRING':
      return field.length != null && v.length > field.length ? `Longer than the max length (${field.length})` : undefined
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
  const text = (from === 'STRING' || from === 'TEXT') && (to === 'STRING' || to === 'TEXT')
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
}

export interface FullstackErrors {
  entities: Record<number, EntityErrors>
  /** True when there are no entities at all — the backend rejects an empty list. */
  noEntities?: boolean
  /** Total number of distinct problems found — drives the Generate gate + summary. */
  count: number
}

export function validateEntities(entities: FullstackEntityDef[]): FullstackErrors {
  const result: FullstackErrors = { entities: {}, count: 0 }

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

    const nameErr = identifierError(entity.name, 'Entity name')
    if (nameErr) eErr.name = nameErr
    else {
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
      const fNameErr = identifierError(field.name, 'Field name')
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
          fErr.enumValues = 'At least one value required'
        } else {
          // Exact-case, like the server: Java keywords are lower-case, so NEW/DEFAULT are fine.
          const bad = values.find(v => !IDENTIFIER_RE.test(v) || RESERVED_JAVA_KEYWORDS.has(v))
          if (bad) fErr.enumValues = `Invalid value '${bad}'`
        }
        // Labels are optional. Mirrors FullstackRequestValidator.canonicalEnumLabels: each key
        // must be one of the values (case-insensitively), and a label must be non-blank and at
        // most 80 characters. The editor prunes keys when a value goes, so these only fire on a
        // hand-edited or imported model.
        const known = new Set(values.map(v => v.trim().toLowerCase()))
        for (const [key, label] of Object.entries(field.enumLabels ?? {})) {
          if (fErr.enumValues) break
          if (!known.has(key.trim().toLowerCase())) fErr.enumValues = `Label for '${key}', which is not one of the values`
          else if (!label.trim()) fErr.enumValues = `Label for '${key}' is blank`
          else if (label.trim().length > 80) fErr.enumValues = `Label for '${key}' is too long (max 80 characters)`
        }
      } else if ((field.enumValues?.length ?? 0) > 0 || Object.keys(field.enumLabels ?? {}).length > 0) {
        // Mirrors the backend rule that enumValues/enumLabels are only allowed when type=ENUM.
        // The editor clears these on type change; this guards stale persisted/imported state.
        fErr.enumValues = 'Values apply to ENUM only'
      }

      if (field.length != null) {
        if (field.type !== 'STRING') fErr.length = 'Length applies to STRING only'
        else if (field.length <= 0) fErr.length = 'Length must be positive'
      }

      // 'generated' (auto-increment) only makes sense on an integral primary key. The editor
      // disables the checkbox otherwise, but guard stale persisted/imported state too.
      if (field.generated) {
        if (!field.primaryKey) fErr.generated = 'Only the primary key can be auto-generated'
        else if (field.type !== 'LONG' && field.type !== 'INTEGER' && field.type !== 'UUID') fErr.generated = 'Generated key must be LONG, INTEGER, or UUID'
      }

      // Numeric bounds: only on numeric types, min ≤ max. Regex/email: only on STRING.
      const isNumeric = field.type === 'LONG' || field.type === 'INTEGER' || field.type === 'BIG_DECIMAL'
      if (field.min != null || field.max != null) {
        if (!isNumeric) {
          if (field.min != null) fErr.min = 'Min applies to numeric fields only'
          if (field.max != null) fErr.max = 'Max applies to numeric fields only'
        } else {
          // Integral bounds must be whole (the DTO renders them into @Min/@Max, which take longs);
          // decimals are only meaningful on BIG_DECIMAL (@DecimalMin/@DecimalMax).
          if (field.type !== 'BIG_DECIMAL') {
            const whole = (v: number) => Number.isInteger(v) && (field.type === 'LONG' || (v >= -2147483648 && v <= 2147483647))
            if (field.min != null && !whole(field.min)) fErr.min = field.type === 'INTEGER' && Number.isInteger(field.min) ? 'Out of the int range' : 'Must be a whole number'
            if (field.max != null && !whole(field.max)) fErr.max = field.type === 'INTEGER' && Number.isInteger(field.max) ? 'Out of the int range' : 'Must be a whole number'
          }
          if (!fErr.min && field.min != null && field.max != null && field.min > field.max) {
            fErr.min = 'Min must be ≤ Max'
          }
        }
      }
      // Regex syntax is deliberately not checked here: the server compiles it with
      // java.util.regex.Pattern, and JS rejects Java-only constructs (possessive quantifiers,
      // \p{Alpha} without the u flag), so a client-side RegExp check would block valid input.
      if (field.pattern != null && field.pattern !== '' && field.type !== 'STRING') {
        fErr.pattern = 'Pattern applies to STRING only'
      }
      if (field.email && field.type !== 'STRING') fErr.email = 'Email applies to STRING only'

      const defErr = defaultValueError(field)
      if (defErr) fErr.defaultValue = defErr

      if (Object.keys(fErr).length > 0) {
        eErr.fields[fIdx] = fErr
        result.count += Object.keys(fErr).length
      }
    })

    // Duplicate field names within the entity
    for (const idxs of seenFieldNames.values()) {
      if (idxs.length > 1) {
        idxs.forEach(i => {
          const existing = eErr.fields[i] ?? {}
          if (!existing.name) {
            existing.name = 'Duplicate field name'
            eErr.fields[i] = existing
            result.count += 1
          }
        })
      }
    }

    if (entity.fields.length === 0) {
      // Mirrors FullstackRequestValidator ("has no fields"); the PK rule would only confuse here.
      eErr.noFields = 'Add at least one field'
      result.count += 1
    } else if (pkCount === 0) {
      eErr.pk = 'Mark at least one field as the primary key (PK)'
      result.count += 1
    } else if (pkCount > 1 && entity.fields.some(f => f.primaryKey && f.generated)) {
      // Composite keys are allowed, but a generated key requires a single PK (JPA IDENTITY).
      eErr.pk = 'A generated key requires a single primary key'
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
        eErr.viewQuery = 'Enter the SELECT query or untick "SELECT view"'
        result.count += 1
      }
      if (entity.fields.some(f => f.generated)) viewErrors.push('A view cannot have a generated primary key')
      if ((entity.relations?.length ?? 0) > 0) viewErrors.push('A view cannot declare relations')
      if (viewErrors.length > 0) {
        eErr.view = viewErrors.join('; ')
        result.count += viewErrors.length
      }
    }

    // Relations (MANY_TO_ONE). fieldName must be a unique, valid identifier across fields and
    // relations; targetEntity must exist and not be a composite-PK entity.
    const relations = entity.relations ?? []
    relations.forEach((rel, rIdx) => {
      const rErr: RelationErrors = {}
      const nameErr = identifierError(rel.fieldName, 'Relation field name')
      if (nameErr) {
        rErr.fieldName = nameErr
      } else {
        const lower = rel.fieldName.trim().toLowerCase()
        const clashesField = entity.fields.some(f => f.name.trim().toLowerCase() === lower)
        const clashesRel = relations.slice(0, rIdx).some(r => r.fieldName.trim().toLowerCase() === lower)
        if (clashesField || clashesRel) rErr.fieldName = 'Name collides with a field or relation'
      }
      const target = rel.targetEntity?.trim()
      if (!target) {
        rErr.targetEntity = 'Select a target entity'
      } else {
        const targetPkCount = pkCountByName.get(target.toLowerCase())
        if (targetPkCount === undefined) rErr.targetEntity = `Unknown entity '${target}'`
        else if (targetPkCount > 1) rErr.targetEntity = "Can't target a composite-PK entity"
        else if (viewNames.has(target.toLowerCase())) rErr.targetEntity = "Can't target a view"
      }
      if (Object.keys(rErr).length > 0) {
        eErr.relations = eErr.relations ?? {}
        eErr.relations[rIdx] = rErr
        result.count += Object.keys(rErr).length
      }
    })

    if (eErr.name) result.count += 1
    const hasRelErrs = eErr.relations && Object.keys(eErr.relations).length > 0
    if (eErr.name || eErr.noFields || eErr.pk || eErr.view || eErr.viewQuery || Object.keys(eErr.fields).length > 0 || hasRelErrs) {
      result.entities[eIdx] = eErr
    }
  })

  // Duplicate entity names (case-insensitive)
  for (const idxs of seenEntityNames.values()) {
    if (idxs.length > 1) {
      idxs.forEach(i => {
        const existing = result.entities[i] ?? { fields: {} }
        if (!existing.name) {
          existing.name = 'Duplicate entity name'
          result.entities[i] = existing
          result.count += 1
        }
      })
    }
  }

  return result
}
