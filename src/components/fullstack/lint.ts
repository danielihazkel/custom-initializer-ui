import type { FullstackEntityDef } from '../../types'
import { entityOptApplicability, summarizeEntity } from './summary'
import { toCamelCase } from './naming'
import { newUid } from './uid'

/**
 * Model lint: things that are *valid* (the server would accept them) but will produce a
 * generated app that surprises the user — a relation dropdown full of ids, a search box that
 * never appears, a view that was ticked but silently dropped. Each issue carries a one-click
 * fix where one is obvious. Validation errors (things the server rejects) stay in validation.ts.
 */
export interface LintModel {
  entities: FullstackEntityDef[]
  scaffoldOpts: string[]
  selectedDeps: string[]
}

export interface LintFix {
  label: string
  apply(model: LintModel): LintModel
}

export interface LintIssue {
  /** Stable per-rule id (plus the entity uid) so the panel can key rows and tests can find them. */
  id: string
  rule: string
  severity: 'warn' | 'info'
  /** The entity card this concerns, for "show me". */
  entityUid?: string
  message: string
  fix?: LintFix
}

const LDAP_DEPS = ['ldap-auth', 'ldap-auth-rest']

/** Scalar types a hand-typed foreign key column comes as. */
const FK_TYPES = new Set(['LONG', 'INTEGER', 'UUID'])

/** The first non-key STRING field — what the generated relation dropdown labels rows by. */
function labelField(entity: FullstackEntityDef) {
  return entity.fields.find(f => !f.primaryKey && f.type === 'STRING')
}

function replaceEntity(model: LintModel, uid: string | undefined, patch: (e: FullstackEntityDef) => FullstackEntityDef): LintModel {
  return { ...model, entities: model.entities.map(e => e.uid === uid ? patch(e) : e) }
}

export function lintModel(entities: FullstackEntityDef[], scaffoldOpts: string[], selectedDeps: string[]): LintIssue[] {
  const issues: LintIssue[] = []
  const byName = new Map(entities.filter(e => e.name.trim()).map(e => [e.name.trim().toLowerCase(), e]))

  for (const entity of entities) {
    const name = entity.name.trim() || '(unnamed)'
    const uid = entity.uid
    const isView = entity.viewQuery != null

    // Relation targets are shown by their first text field; without one the dropdown shows ids.
    for (const rel of entity.relations ?? []) {
      const target = byName.get(rel.targetEntity.trim().toLowerCase())
      if (!target || labelField(target)) continue
      const targetName = target.name.trim()
      const hasNameField = target.fields.some(f => f.name.trim().toLowerCase() === 'name')
      issues.push({
        id: `label-field:${uid}:${rel.uid ?? rel.fieldName}`,
        rule: 'label-field',
        severity: 'warn',
        entityUid: target.uid,
        message: `${name}.${rel.fieldName.trim() || '?'} points at ${targetName}, which has no text field — its dropdown and table column will show ids.`,
        fix: hasNameField || target.viewQuery != null ? undefined : {
          label: `Add a required "name" field to ${targetName}`,
          apply: m => replaceEntity(m, target.uid, e => ({
            ...e,
            fields: [...e.fields, { uid: newUid(), name: 'name', type: 'STRING', required: true, length: 120 }],
          })),
        },
      })
    }

    // Search box: only STRING/TEXT fields feed it, and only while at least one is opted in.
    const textFields = entity.fields.filter(f => f.type === 'STRING' || f.type === 'TEXT')
    if (textFields.length > 0 && textFields.every(f => f.searchable === false)) {
      issues.push({
        id: `no-search:${uid}`,
        rule: 'no-search',
        severity: 'info',
        entityUid: uid,
        message: `${name}: every text field is excluded from search, so the page gets no search box.`,
        fix: {
          label: `Include ${textFields[0].name.trim() || 'the first text field'} in search`,
          apply: m => replaceEntity(m, uid, e => ({
            ...e, fields: e.fields.map(f => f.uid === textFields[0].uid ? { ...f, searchable: undefined } : f),
          })),
        },
      })
    }

    // A ticked view the generator will drop (kanban needs an enum/boolean + writable; calendar a date).
    const requested = entity.listViews ?? (entity.listView ? [entity.listView] : [])
    const rendered = new Set(summarizeEntity(entity).views.map(v => v.name))
    for (const view of requested) {
      if (rendered.has(view)) continue
      const why = view === 'kanban'
        ? (isView || entity.readOnly ? 'it needs a writable entity' : 'it needs an enum or boolean field')
        : 'it needs a date field'
      issues.push({
        id: `view-dropped:${uid}:${view}`,
        rule: 'view-dropped',
        severity: 'warn',
        entityUid: uid,
        message: `${name}: the ${view} view will not be generated — ${why}.`,
        fix: {
          label: `Untick ${view} on ${name}`,
          apply: m => replaceEntity(m, uid, e => {
            const next = (e.listViews ?? (e.listView ? [e.listView] : [])).filter(v => v !== view)
            return { ...e, listViews: (next.length ? next : ['table']) as FullstackEntityDef['listViews'], listView: undefined }
          }),
        },
      })
    }

    // Only key fields → a form with nothing to type and a table with nothing to show. A join
    // entity (keys + relations) is fine: its relations render as dropdowns and columns.
    if (entity.fields.length > 0 && entity.fields.every(f => f.primaryKey) && (entity.relations ?? []).length === 0) {
      issues.push({
        id: `only-keys:${uid}`,
        rule: 'only-keys',
        severity: 'warn',
        entityUid: uid,
        message: `${name} has only key fields — its form and table will carry no data.`,
      })
    }

    // A unique column with a default: the second row created from the form collides.
    for (const f of entity.fields) {
      if (f.primaryKey || !f.unique || !f.defaultValue?.trim()) continue
      issues.push({
        id: `unique-default:${uid}:${f.uid ?? f.name}`,
        rule: 'unique-default',
        severity: 'warn',
        entityUid: uid,
        message: `${name}.${f.name.trim() || '?'} is unique but has a default — the second row saved with the default answers 409.`,
        fix: {
          label: `Clear the default on ${f.name.trim() || 'the field'}`,
          apply: m => replaceEntity(m, uid, e => ({
            ...e, fields: e.fields.map(x => x.uid === f.uid ? { ...x, defaultValue: undefined } : x),
          })),
        },
      })
    }

    // A `<Entity>Id` scalar beside an entity of that name is almost always a foreign key typed by
    // hand, or imported from DDL whose referenced table was outside the paste. As a relation it
    // gets a dropdown, a filter and a label column instead of a bare number box. Views can't
    // declare relations, so they are left alone.
    if (!isView) {
      for (const f of entity.fields) {
        if (f.primaryKey || !FK_TYPES.has(f.type)) continue
        const fieldName = f.name.trim()
        const match = /^(.+?)_?id$/i.exec(fieldName)
        if (!match) continue
        const target = byName.get(match[1].replace(/_/g, '').toLowerCase())
        if (!target || target === entity || target.viewQuery != null) continue
        const targetPks = target.fields.filter(p => p.primaryKey)
        if (targetPks.length !== 1 || targetPks[0].type !== f.type) continue
        const targetName = target.name.trim()
        const relationName = toCamelCase(targetName)
        const sameName = (n: string) => n.trim().toLowerCase() === relationName.toLowerCase()
        if ((entity.relations ?? []).some(r => sameName(r.fieldName))) continue
        const collides = entity.fields.some(x => x !== f && sameName(x.name))
        issues.push({
          id: `fk-lookalike:${uid}:${f.uid ?? fieldName}`,
          rule: 'fk-lookalike',
          severity: 'warn',
          entityUid: uid,
          message: `${name}.${fieldName} looks like a reference to ${targetName} — as a relation it gets a dropdown, a filter and a label column instead of a bare number.`,
          fix: collides ? undefined : {
            label: `Convert ${fieldName} to a relation to ${targetName}`,
            apply: m => replaceEntity(m, uid, e => ({
              ...e,
              fields: e.fields.filter(x => x.uid !== f.uid),
              relations: [
                ...(e.relations ?? []),
                { uid: newUid(), type: 'MANY_TO_ONE', fieldName: relationName, targetEntity: targetName, required: Boolean(f.required) },
              ],
            })),
          },
        })
      }
    }

    // Per-entity override switched On for something the entity can't carry (mirrors the server's
    // silent drop), listed here as well as next to the switch so the aggregate view has it.
    const applicability = entityOptApplicability(entity)
    for (const [key, value] of Object.entries(entity.opts ?? {})) {
      const a = applicability[key as keyof typeof applicability]
      if (value !== true || !a || a.applicable) continue
      issues.push({
        id: `override-no-effect:${uid}:${key}`,
        rule: 'override-no-effect',
        severity: 'info',
        entityUid: uid,
        message: `${name}: the ${key} override has no effect (${a.reason}).`,
        fix: {
          label: `Set ${key} back to inherit on ${name}`,
          apply: m => replaceEntity(m, uid, e => {
            const opts = { ...(e.opts ?? {}) }
            delete opts[key as keyof typeof opts]
            return { ...e, opts: Object.keys(opts).length ? opts : undefined }
          }),
        },
      })
    }
  }

  // Project-wide options that depend on the dependency list.
  if (scaffoldOpts.includes('secured') && !LDAP_DEPS.some(d => selectedDeps.includes(d))) {
    issues.push({
      id: 'secured-needs-ldap',
      rule: 'secured-needs-ldap',
      severity: 'warn',
      message: 'Permission hints are on, but no LDAP auth dependency is selected — the option generates nothing.',
      // ldap-auth-rest is the template sets' default variant (groups from the LDAP REST service).
      fix: { label: 'Add ldap-auth-rest', apply: m => ({ ...m, selectedDeps: [...m.selectedDeps, 'ldap-auth-rest'] }) },
    })
  }
  if (scaffoldOpts.includes('openapi') && !selectedDeps.includes('openapi')) {
    issues.push({
      id: 'openapi-adds-dep',
      rule: 'openapi-adds-dep',
      severity: 'info',
      message: 'OpenAPI annotations add the openapi starter to the build even though it is not in your dependency list.',
      fix: { label: 'Add openapi to the dependencies', apply: m => ({ ...m, selectedDeps: [...m.selectedDeps, 'openapi'] }) },
    })
  }

  return issues
}
