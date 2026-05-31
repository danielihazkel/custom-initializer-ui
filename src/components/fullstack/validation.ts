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
  packageName?: string
  domainPackage?: string
}

/** Validates the project-metadata fields. Mirrors the Backend tab's validateForm rules. */
export function validateMeta(
  meta: { groupId: string; artifactId: string; packageName: string; domainPackage?: string },
): MetaErrors {
  const errors: MetaErrors = {}
  if (!meta.artifactId.trim()) errors.artifactId = 'Required'
  else if (/\s/.test(meta.artifactId)) errors.artifactId = 'No spaces allowed'
  if (!meta.groupId.trim()) errors.groupId = 'Required'
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
}

export interface EntityErrors {
  name?: string
  pk?: string
  fields: Record<number, FieldErrors>
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
          const bad = values.find(v => !IDENTIFIER_RE.test(v) || RESERVED_JAVA_KEYWORDS.has(v.toLowerCase()))
          if (bad) fErr.enumValues = `Invalid value '${bad}'`
        }
      } else if ((field.enumValues?.length ?? 0) > 0) {
        // Mirrors the backend rule that enumValues are only allowed when type=ENUM.
        // The editor clears these on type change; this guards stale persisted/imported state.
        fErr.enumValues = 'Values apply to ENUM only'
      }

      if (field.length != null) {
        if (field.type !== 'STRING') fErr.length = 'Length applies to STRING only'
        else if (field.length <= 0) fErr.length = 'Length must be positive'
      }

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

    if (pkCount === 0) {
      eErr.pk = 'Mark exactly one field as the primary key (PK)'
      result.count += 1
    } else if (pkCount > 1) {
      eErr.pk = 'Only one field may be the primary key (PK)'
      result.count += 1
    }

    if (eErr.name) result.count += 1
    if (eErr.name || eErr.pk || Object.keys(eErr.fields).length > 0) {
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
