import type { FullstackEntityDef } from '../../types'
import { entityOptApplicability, summarizeEntity } from './summary'
import { joinColumnOf, pluralize, toCamelCase, toSnakeCase, uniqueName } from './naming'
import { newUid } from './uid'
import { ambiguousMoves, stateLabel, unreachableStates } from './workflow'
import { isTextualType } from './fieldTypes'
import { cleanAccess } from './access'
import { t, tn } from '../../i18n'

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

/**
 * `entity` as the join entity of a many-to-many: a generated key and nothing else of its own, two
 * required links to two different single-key tables, and nothing pointing at it. The first link
 * names the owner.
 */
function joinEntityShape(entity: FullstackEntityDef, entities: FullstackEntityDef[], byName: Map<string, FullstackEntityDef>) {
  if (entity.viewQuery != null || entity.workflow) return null
  if (entity.fields.length !== 1 || !entity.fields[0].primaryKey || !entity.fields[0].generated) return null
  const relations = entity.relations ?? []
  if (relations.length !== 2 || relations.some(r => r.type !== 'MANY_TO_ONE' || !r.required || !r.fieldName.trim())) return null
  const [ownerRel, targetRel] = relations
  const owner = byName.get(ownerRel.targetEntity.trim().toLowerCase())
  const target = byName.get(targetRel.targetEntity.trim().toLowerCase())
  if (!owner || !target || owner === target || owner === entity || target === entity) return null
  const linkable = (e: FullstackEntityDef) => e.viewQuery == null && e.fields.filter(f => f.primaryKey).length === 1
  if (!linkable(owner) || !linkable(target)) return null
  const self = entity.name.trim().toLowerCase()
  if (entities.some(e => (e.relations ?? []).some(r => r.targetEntity.trim().toLowerCase() === self))) return null
  return { owner, target, ownerRel, targetRel }
}

function replaceEntity(model: LintModel, uid: string | undefined, patch: (e: FullstackEntityDef) => FullstackEntityDef): LintModel {
  return { ...model, entities: model.entities.map(e => e.uid === uid ? patch(e) : e) }
}

export function lintModel(entities: FullstackEntityDef[], scaffoldOpts: string[], selectedDeps: string[]): LintIssue[] {
  const issues: LintIssue[] = []
  const byName = new Map(entities.filter(e => e.name.trim()).map(e => [e.name.trim().toLowerCase(), e]))

  for (const entity of entities) {
    const name = entity.name.trim() || t('(unnamed)')
    const uid = entity.uid
    const isView = entity.viewQuery != null

    // Relation targets are shown by their first text field; without one the dropdown shows ids.
    for (const rel of entity.relations ?? []) {
      // A one-to-many shows its rows' own columns, not one label per row.
      if (rel.type === 'ONE_TO_MANY') continue
      const target = byName.get(rel.targetEntity.trim().toLowerCase())
      if (!target || labelField(target)) continue
      const targetName = target.name.trim()
      const hasNameField = target.fields.some(f => f.name.trim().toLowerCase() === 'name')
      issues.push({
        id: `label-field:${uid}:${rel.uid ?? rel.fieldName}`,
        rule: 'label-field',
        severity: 'warn',
        entityUid: target.uid,
        message: t('{field} points at {target}, which has no text field — its dropdown and table column will show ids.', { field: `${name}.${rel.fieldName.trim() || '?'}`, target: targetName }),
        fix: hasNameField || target.viewQuery != null ? undefined : {
          label: t('Add a required "name" field to {target}', { target: targetName }),
          apply: m => replaceEntity(m, target.uid, e => ({
            ...e,
            fields: [...e.fields, { uid: newUid(), name: 'name', type: 'STRING', required: true, length: 120 }],
          })),
        },
      })
    }

    // Search box: only STRING/TEXT fields feed it, and only while at least one is opted in.
    const textFields = entity.fields.filter(f => isTextualType(f.type))
    if (textFields.length > 0 && textFields.every(f => f.searchable === false)) {
      issues.push({
        id: `no-search:${uid}`,
        rule: 'no-search',
        severity: 'info',
        entityUid: uid,
        message: t('{entity}: every text field is excluded from search, so the page gets no search box.', { entity: name }),
        fix: {
          label: textFields[0].name.trim()
            ? t('Include {field} in search', { field: textFields[0].name.trim() })
            : t('Include the first text field in search'),
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
        ? (isView || entity.readOnly ? t('it needs a writable entity') : t('it needs an enum or boolean field'))
        : view === 'gallery' ? t('it needs an image field') : t('it needs a date field')
      issues.push({
        id: `view-dropped:${uid}:${view}`,
        rule: 'view-dropped',
        severity: 'warn',
        entityUid: uid,
        message: t('{entity}: the {view} view will not be generated — {why}.', { entity: name, view, why }),
        fix: {
          label: t('Untick {view} on {entity}', { view, entity: name }),
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
        message: t('{entity} has only key fields — its form and table will carry no data.', { entity: name }),
      })
    }

    // Nothing but a generated key and two required links: the join entity of a many-to-many. As a
    // relation it is a multi-pick control in the owner's form instead of a third page of id pairs.
    const join = joinEntityShape(entity, entities, byName)
    if (join) {
      const { owner, target, ownerRel, targetRel } = join
      const ownerName = owner.name.trim()
      const targetName = target.name.trim()
      const taken = [...owner.fields.map(f => f.name), ...(owner.relations ?? []).map(r => r.fieldName)]
      const fieldName = uniqueName(pluralize(toCamelCase(targetName)), taken)
      // The table and columns the model had, so a schema that already exists still fits.
      const joinTable = entity.tableName?.trim() || toSnakeCase(name)
      issues.push({
        id: `join-entity-to-m2m:${uid}`,
        rule: 'join-entity-to-m2m',
        severity: 'info',
        entityUid: uid,
        message: t('{entity} only links {owner} and {target} — a many-to-many relation on {owner} does the same with a multi-pick control and no page of its own.', { entity: name, owner: ownerName, target: targetName }),
        fix: {
          label: t('Replace {entity} with {relation} (many-to-many)', { entity: name, relation: `${ownerName}.${fieldName}` }),
          apply: m => ({
            ...m,
            entities: m.entities.filter(e => e.uid !== uid).map(e => e.uid !== owner.uid ? e : {
              ...e,
              relations: [
                ...(e.relations ?? []),
                {
                  uid: newUid(), type: 'MANY_TO_MANY' as const, fieldName, targetEntity: targetName, required: false,
                  joinTable, joinColumn: joinColumnOf(ownerRel), inverseJoinColumn: joinColumnOf(targetRel),
                },
              ],
            }),
          }),
        },
      })
    }

    // A workflow: a state nothing leads to, two steps a board drag cannot tell apart, roles without LDAP.
    if (entity.workflow) {
      for (const state of unreachableStates(entity)) {
        issues.push({
          id: `workflow-unreachable:${uid}:${state}`,
          rule: 'workflow-unreachable',
          severity: 'info',
          entityUid: uid,
          message: t('{entity}: no step of its workflow leads to {state}, and new rows start elsewhere — it is never reached.', { entity: name, state: stateLabel(state) }),
        })
      }
      for (const move of ambiguousMoves(entity.workflow)) {
        issues.push({
          id: `workflow-ambiguous:${uid}:${move.from}>${move.to}`,
          rule: 'workflow-ambiguous',
          severity: 'warn',
          entityUid: uid,
          message: t('{entity}: {steps} both move {from} to {to}, so dragging a card between those lanes asks the user to pick on the record.', {
            entity: name, steps: move.names.join(t(' and ')), from: stateLabel(move.from), to: stateLabel(move.to),
          }),
        })
      }
      if (entity.workflow.transitions.some(t => (t.roles?.length ?? 0) > 0) && !selectedDeps.some(d => LDAP_DEPS.includes(d))) {
        issues.push({
          id: `workflow-roles:${uid}`,
          rule: 'workflow-roles',
          severity: 'warn',
          entityUid: uid,
          message: t('{entity}: its workflow limits steps to roles, which come from LDAP groups — the project has no ldap-auth dependency.', { entity: name }),
          fix: { label: t('Add ldap-auth-rest'), apply: m => ({ ...m, selectedDeps: [...m.selectedDeps, 'ldap-auth-rest'] }) },
        })
      }
    }

    // A unique column with a default: the second row created from the form collides.
    for (const f of entity.fields) {
      if (f.primaryKey || !f.unique || !f.defaultValue?.trim()) continue
      issues.push({
        id: `unique-default:${uid}:${f.uid ?? f.name}`,
        rule: 'unique-default',
        severity: 'warn',
        entityUid: uid,
        message: t('{field} is unique but has a default — the second row saved with the default answers 409.', { field: `${name}.${f.name.trim() || '?'}` }),
        fix: {
          label: f.name.trim() ? t('Clear the default on {field}', { field: f.name.trim() }) : t('Clear the default on the field'),
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
          message: t('{field} looks like a reference to {target} — as a relation it gets a dropdown, a filter and a label column instead of a bare number.', { field: `${name}.${fieldName}`, target: targetName }),
          fix: collides ? undefined : {
            label: t('Convert {field} to a relation to {target}', { field: fieldName, target: targetName }),
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
        message: t('{entity}: the {option} override has no effect ({reason}).', { entity: name, option: key, reason: a.reason ?? '' }),
        fix: {
          label: t('Set {option} back to inherit on {entity}', { option: key, entity: name }),
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
  // An entity's access levels are checked by the ldap-auth classes: without them the server
  // refuses the model (it would otherwise accept a setting that does nothing).
  const withAccess = entities.filter(e => cleanAccess(e.access))
  if (withAccess.length > 0 && !LDAP_DEPS.some(d => selectedDeps.includes(d))) {
    issues.push({
      id: 'access-needs-ldap',
      rule: 'access-needs-ldap',
      severity: 'warn',
      message: tn(withAccess.length,
        '{entities} sets access levels, which are checked against LDAP groups — the project has no ldap-auth dependency.',
        '{entities} set access levels, which are checked against LDAP groups — the project has no ldap-auth dependency.',
        { entities: withAccess.map(e => e.name).join(', ') }),
      // ldap-auth-rest is the template sets' default variant (groups from the LDAP REST service).
      fix: { label: t('Add ldap-auth-rest'), apply: m => ({ ...m, selectedDeps: [...m.selectedDeps, 'ldap-auth-rest'] }) },
    })
  }
  if (scaffoldOpts.includes('openapi') && !selectedDeps.includes('openapi')) {
    issues.push({
      id: 'openapi-adds-dep',
      rule: 'openapi-adds-dep',
      severity: 'info',
      message: t('OpenAPI annotations add the openapi starter to the build even though it is not in your dependency list.'),
      fix: { label: t('Add openapi to the dependencies'), apply: m => ({ ...m, selectedDeps: [...m.selectedDeps, 'openapi'] }) },
    })
  }

  return issues
}
