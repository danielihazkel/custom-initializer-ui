import { FULLSTACK_ENTITY_OPT_KEYS, type FullstackEntityDef, type FullstackEntityOptKey } from '../../types'
import { entityOptApplicability } from './summary'
import { t } from '../../i18n'

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
 *
 * The words are getters, read in the site's language each time they are shown.
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
  /** The server still takes the key (older models name it) but it does nothing: not offered. */
  retired?: boolean
}

export const SCAFFOLD_OPTIONS: ScaffoldOption[] = [
  {
    value: 'audit', perEntity: true,
    get label() { return t('Audit (who and when)') },
    get hint() { return t('createdAt / updatedAt and createdBy / updatedBy (the signed-in user) via JPA auditing; a "Changed by me" filter on the list') },
    get entityHint() { return t('created/updated at and by') },
  },
  {
    value: 'softDelete', perEntity: true,
    get label() { return t('Soft delete') },
    get hint() { return t('deleted flag + Hibernate @SQLDelete/@SQLRestriction; delete toast gets a real Undo') },
    get entityHint() { return t('deleted flag + restore endpoint') },
  },
  {
    value: 'inverseCollections', perEntity: false,
    get label() { return t('Inverse collections') },
    get hint() { return t('Read-only @OneToMany on the referenced side') },
  },
  {
    value: 'tests', perEntity: true,
    get label() { return t('Tests') },
    get hint() { return t('An API test per entity (its real endpoints on an in-memory H2, whatever the database), and Vitest tests of its form checks and list page') },
    get entityHint() { return t('API test + form-check and list-page tests') },
  },
  {
    value: 'openapi', perEntity: false,
    get label() { return t('OpenAPI annotations') },
    get hint() { return t('springdoc @Tag/@Operation on every controller; adds the openapi starter') },
  },
  {
    value: 'secured', perEntity: false, retired: true,
    get label() { return t('Permission hints') },
    get hint() { return t("Retired: with ldap-auth or ldap-auth-rest selected every endpoint is checked, at each entity's access levels (entity Settings)") },
  },
  {
    value: 'csvExport', perEntity: true,
    get label() { return t('CSV export') },
    get hint() { return t('GET /export.csv (streamed, honors search/filters/sort) + Export button') },
    get entityHint() { return t('GET /export.csv + Export button') },
  },
  {
    value: 'xlsxExport', perEntity: true,
    get label() { return t('Excel export') },
    get hint() { return t('GET /export.xlsx — the list as a workbook (column names as the UI shows them, numbers as numbers), streamed like the CSV + an Excel button') },
    get entityHint() { return t('GET /export.xlsx + Excel button') },
  },
  {
    value: 'history', perEntity: true,
    get label() { return t('Change history') },
    get hint() { return t('Every change to a row kept with who made it and the values before and after (table app_change_log); a History tab on the record, and Restore this version for admins') },
    get entityHint() { return t('GET /{id}/history + History tab + restore') },
  },
  {
    value: 'events', perEntity: true,
    get label() { return t('Events') },
    get hint() { return t('Every change to a row sent out through an outbox (table app_outbox): to a Kafka topic per entity with the kafka dependency, to the webhooks the app is configured with, and to open browsers, whose lists and bell refresh at once') },
    get entityHint() { return t('change events (Kafka, webhooks, live refresh)') },
  },
  {
    value: 'savedViews', perEntity: true,
    get label() { return t('Saved views') },
    get hint() { return t('A Views menu on the list: its search, filters, sort and columns kept under a name on the server (/api/views), per user, shareable, one the default') },
    get entityHint() { return t('Views menu + /api/views for this list') },
  },
  {
    value: 'csvImport', perEntity: true,
    get label() { return t('CSV import') },
    get hint() { return t('POST /import (every row checked, all saved or none) + Import button with column matching') },
    get entityHint() { return t('POST /import + Import button') },
  },
  {
    value: 'bulkDelete', perEntity: true,
    get label() { return t('Bulk delete') },
    get hint() { return t('Select rows, DELETE /bulk across all') },
    get entityHint() { return t('row selection + DELETE /bulk') },
  },
  {
    value: 'bulkUpdate', perEntity: true,
    get label() { return t('Bulk edit') },
    get hint() { return t('Select rows, set one field, PATCH /bulk across all') },
    get entityHint() { return t('row selection + PATCH /bulk') },
  },
  {
    value: 'inlineEdit', perEntity: true,
    get label() { return t('Inline cell edit') },
    get hint() { return t("Edit a table cell in place (a pencil on hover), saved with the row's PUT") },
    get entityHint() { return t('table cells edited in place') },
  },
  {
    value: 'optimisticLocking', perEntity: true,
    get label() { return t('Optimistic locking') },
    get hint() { return t("@Version column: a save over someone else's newer change gets a 409, and the form offers to reload or overwrite") },
    get entityHint() { return t('@Version + stale-save notice') },
  },
  {
    value: 'seedData', perEntity: false,
    get label() { return t('Demo data') },
    get hint() { return t('Seeds 8 rows per entity on first start (parents before children); off via app.demo-data.enabled=false') },
  },
  {
    value: 'rtl', perEntity: false,
    get label() { return t('RTL layout') },
    get hint() { return t('dir="rtl" + Hebrew lang; mirrored right-to-left UI') },
  },
]

/** RTL only touches the generated SPA, so it renders in the Frontend section, not with the
 *  per-entity scaffolding extras. */
export const RTL_OPTION = SCAFFOLD_OPTIONS.find(o => o.value === 'rtl')!

/** The Options-section list: everything but the frontend-only RTL flag and what is retired. */
export const OPTIONS_SECTION = SCAFFOLD_OPTIONS.filter(o => o.value !== 'rtl' && !o.retired)

/** Flags an entity cannot override — they either touch every entity at once (inverse
 *  collections, demo data) or the build (OpenAPI, permission hints). */
export const PROJECT_ONLY_OPTS = OPTIONS_SECTION.filter(o => !o.perEntity)

/** Labels for the per-entity override panel, derived from the same list (getters, like its words). */
export const ENTITY_OPT_LABELS: Record<FullstackEntityOptKey, { label: string; hint: string }> = Object.fromEntries(
  FULLSTACK_ENTITY_OPT_KEYS.map(key => {
    const opt = SCAFFOLD_OPTIONS.find(o => o.value === key)
    if (!opt?.perEntity) throw new Error(`scaffoldOptions: ${key} is a per-entity opt key but is not listed as perEntity`)
    return [key, { get label() { return opt.label }, get hint() { return opt.entityHint ?? opt.hint } }]
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
    const name = entity.name.trim() || t('(unnamed)')
    if (entity.opts?.[key] === false) {
      coverage.excluded.push({ uid, name, reason: t('opted out on the entity') })
      continue
    }
    const a = entityOptApplicability(entity)[key]
    if (!a.applicable) coverage.excluded.push({ uid, name, reason: a.reason ?? t('not applicable') })
    else coverage.applies.push({ uid, name })
  }
  return coverage
}
