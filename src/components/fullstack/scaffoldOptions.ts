import { FULLSTACK_ENTITY_OPT_KEYS, type FullstackEntityDef, type FullstackEntityOptKey } from '../../types'
import { entityOptApplicability } from './summary'

/**
 * The one description of every `opts.scaffold` flag the editor offers — the Options section, the
 * per-entity Overrides panel and the coverage line under each option all read this list, so the
 * two can never describe the same flag in different words again.
 *
 * Each value matches a backend `optScaffold<Option>` gate — keep it in step with
 * FullstackProjectGenerationConfiguration (backend) and FullstackStarterController.renderFrontend
 * (frontend): an opt missing here is unreachable from the UI. `perEntity` marks the flags an entity
 * can override through `EntityDefinitionDto.opts` (exactly `FULLSTACK_ENTITY_OPT_KEYS`); the rest
 * are project-wide only. `requiresAnyDep`: the backend silently no-ops the opt unless one of these
 * deps is selected, so the editor warns inline instead of letting the user discover the missing
 * scaffolding in the ZIP.
 */
export interface ScaffoldOption {
  value: string
  label: string
  /** What the option adds, project-wide. */
  hint: string
  /** What it changes on one entity — the Overrides panel's wording. Falls back to `hint`. */
  entityHint?: string
  perEntity: boolean
  requiresAnyDep?: string[]
}

export const SCAFFOLD_OPTIONS: ScaffoldOption[] = [
  { value: 'audit', label: 'Audit timestamps', hint: 'createdAt / updatedAt via JPA auditing', entityHint: 'createdAt / updatedAt columns', perEntity: true },
  { value: 'softDelete', label: 'Soft delete', hint: 'deleted flag + Hibernate @SQLDelete/@SQLRestriction; delete toast gets a real Undo', entityHint: 'deleted flag + restore endpoint', perEntity: true },
  { value: 'inverseCollections', label: 'Inverse collections', hint: 'Read-only @OneToMany on the referenced side', perEntity: false },
  { value: 'tests', label: 'Controller tests', hint: 'Per-entity @WebMvcTest', entityHint: '@WebMvcTest for this entity', perEntity: true },
  { value: 'openapi', label: 'OpenAPI annotations', hint: 'springdoc @Tag/@Operation on every controller; adds the openapi starter', perEntity: false },
  { value: 'secured', label: 'Permission hints', hint: 'Commented @RequiresPermission per endpoint; needs ldap-auth or ldap-auth-rest selected', perEntity: false, requiresAnyDep: ['ldap-auth', 'ldap-auth-rest'] },
  { value: 'csvExport', label: 'CSV export', hint: 'GET /export.csv (streamed, honors search/filters/sort) + Export button', entityHint: 'GET /export.csv + Export button', perEntity: true },
  { value: 'csvImport', label: 'CSV import', hint: 'POST /import (every row checked, all saved or none) + Import button with column matching', entityHint: 'POST /import + Import button', perEntity: true },
  { value: 'bulkDelete', label: 'Bulk delete', hint: 'Select rows, DELETE /bulk across all', entityHint: 'row selection + DELETE /bulk', perEntity: true },
  { value: 'bulkUpdate', label: 'Bulk edit', hint: 'Select rows, set one field, PATCH /bulk across all', entityHint: 'row selection + PATCH /bulk', perEntity: true },
  { value: 'seedData', label: 'Demo data', hint: 'Seeds 8 rows per entity on first start (parents before children); off via app.demo-data.enabled=false', perEntity: false },
  { value: 'rtl', label: 'RTL layout', hint: 'dir="rtl" + Hebrew lang; mirrored right-to-left UI', perEntity: false },
]

/** RTL only touches the generated SPA, so it renders in the Frontend section, not with the
 *  per-entity scaffolding extras. */
export const RTL_OPTION = SCAFFOLD_OPTIONS.find(o => o.value === 'rtl')!

/** The Options-section list: everything but the frontend-only RTL flag. */
export const OPTIONS_SECTION = SCAFFOLD_OPTIONS.filter(o => o.value !== 'rtl')

/** Flags an entity cannot override — they either touch every entity at once (inverse
 *  collections, demo data) or the build (OpenAPI, permission hints). */
export const PROJECT_ONLY_OPTS = OPTIONS_SECTION.filter(o => !o.perEntity)

/** Labels for the per-entity override panel, derived from the same list. */
export const ENTITY_OPT_LABELS: Record<FullstackEntityOptKey, { label: string; hint: string }> = Object.fromEntries(
  FULLSTACK_ENTITY_OPT_KEYS.map(key => {
    const opt = SCAFFOLD_OPTIONS.find(o => o.value === key)
    if (!opt?.perEntity) throw new Error(`scaffoldOptions: ${key} is a per-entity opt key but is not listed as perEntity`)
    return [key, { label: opt.label, hint: opt.entityHint ?? opt.hint }]
  }),
) as Record<FullstackEntityOptKey, { label: string; hint: string }>

export function isEntityOptKey(value: string): value is FullstackEntityOptKey {
  return (FULLSTACK_ENTITY_OPT_KEYS as string[]).includes(value)
}

export interface OptCoverage {
  /** Entities the (checked) project option will take effect on. */
  applies: { uid: string; name: string }[]
  /** Entities it will not reach, and why — an explicit Off override, or something the entity
   *  can't carry (a view can't be audited, a composite key can't be soft-deleted…). */
  excluded: { uid: string; name: string; reason: string }[]
}

/** Which entities a checked project-wide option actually reaches, mirroring the backend's
 *  `override ?? projectOpt` resolution and the `*Applicable` derivations. */
export function optCoverage(entities: FullstackEntityDef[], key: FullstackEntityOptKey): OptCoverage {
  const coverage: OptCoverage = { applies: [], excluded: [] }
  for (const entity of entities) {
    const uid = entity.uid ?? entity.name
    const name = entity.name.trim() || '(unnamed)'
    if (entity.opts?.[key] === false) {
      coverage.excluded.push({ uid, name, reason: 'opted out on the entity' })
      continue
    }
    const a = entityOptApplicability(entity)[key]
    if (!a.applicable) coverage.excluded.push({ uid, name, reason: a.reason ?? 'not applicable' })
    else coverage.applies.push({ uid, name })
  }
  return coverage
}
