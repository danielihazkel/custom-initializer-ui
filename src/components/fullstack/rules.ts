import type { FullstackEntityDef, FullstackFieldDef, FullstackRule } from '../../types'
import { LIMITS } from './schema'
import { checkExpr, ExprError, renameInExpr, renameNamesInExpr, type ExprType } from './expr'
import { t } from '../../i18n'

/** Mirrors FullstackRequestValidator.MAX_RULES / MAX_RULE_MESSAGE. */
export const MAX_RULES = LIMITS.maxRules
export const MAX_RULE_MESSAGE = LIMITS.maxRuleMessage

/** One rule's problem, by the part it is in (the editor shows each under its input). */
export interface RuleProblem {
  index: number
  part: 'when' | 'check' | 'message' | 'field'
  message: string
}

/** The first problem of each rule, or an entity-wide one at index -1. Rows edited inside their
 *  parent's form have rules too: the parent's save checks each row by them. */
export function ruleProblems(entity: FullstackEntityDef, entities: readonly FullstackEntityDef[] = []): RuleProblem[] {
  const rules = entity.rules ?? []
  if (rules.length === 0) return []
  if (entity.readOnly || entity.viewQuery != null) {
    return [{ index: -1, part: 'check', message: t('A read-only entity is never saved, so it has no rules to check') }]
  }
  if (rules.length > MAX_RULES) return [{ index: -1, part: 'check', message: t('At most {max} rules', { max: MAX_RULES }) }]
  const out: RuleProblem[] = []
  rules.forEach((rule, index) => {
    const problem = ruleProblem(entity, rule, entities)
    if (problem) out.push({ index, ...problem })
  })
  return out
}

function ruleProblem(entity: FullstackEntityDef, rule: FullstackRule, entities: readonly FullstackEntityDef[]): Omit<RuleProblem, 'index'> | undefined {
  if (!rule.check.trim()) return { part: 'check', message: t('Write the condition every row must meet') }
  let refs: string[]
  try {
    refs = checkExpr(rule.check, entity, 'BOOL', entities)
  } catch (e) {
    if (e instanceof ExprError) return { part: 'check', message: e.describe() }
    throw e
  }
  if (rule.when?.trim()) {
    try {
      checkExpr(rule.when, entity, 'BOOL', entities)
    } catch (e) {
      if (e instanceof ExprError) return { part: 'when', message: e.describe() }
      throw e
    }
  }
  if (!rule.message.trim()) return { part: 'message', message: t('Write the message a user sees') }
  if (rule.message.trim().length > MAX_RULE_MESSAGE) return { part: 'message', message: t('At most {max} characters', { max: MAX_RULE_MESSAGE }) }
  if (rule.field?.trim()) {
    if (!entity.fields.some(f => f.name.toLowerCase() === rule.field!.trim().toLowerCase())) {
      return { part: 'field', message: t('“{field}” is not one of its fields', { field: rule.field }) }
    }
  } else if (refs.length === 0) {
    return { part: 'field', message: t('The check reads no field: say which field the message is shown on') }
  }
  return undefined
}

/** What a formula of a field of this type must come out as; null: the type cannot be computed. */
export function formulaType(type: FullstackFieldDef['type']): ExprType | null {
  switch (type) {
    case 'INTEGER': case 'LONG': case 'BIG_DECIMAL': case 'MONEY': return 'NUMBER'
    case 'STRING': case 'TEXT': case 'MARKDOWN': return 'TEXT'
    case 'BOOLEAN': return 'BOOL'
    case 'LOCAL_DATE': return 'DATE'
    case 'LOCAL_DATE_TIME': return 'DATETIME'
    case 'INSTANT': return 'INSTANT'
    case 'LOCAL_TIME': return 'TIME'
    default: return null
  }
}

/**
 * Why a field's show-when or formula would be rejected (FullstackRequestValidator.checkDerivations
 * and the workflow's check), by the part it is in; undefined when both are fine.
 */
export function derivationProblem(entity: FullstackEntityDef, field: FullstackFieldDef,
                                  entities: readonly FullstackEntityDef[] = []): { part: 'showWhen' | 'formula'; message: string } | undefined {
  const showWhen = field.showWhen?.trim()
  const formula = field.formula?.trim()
  if (!showWhen && !formula) return undefined
  const part = formula ? 'formula' : 'showWhen'
  if (entity.readOnly || entity.viewQuery != null) {
    return {
      part,
      message: formula
        ? t('A read-only entity is never saved, so it has no computed fields')
        : t('A read-only entity is never saved, so it has no show-when conditions'),
    }
  }
  if (field.primaryKey) return { part, message: t('The primary key is never hidden or computed') }
  const wf = entity.workflow
  if (wf && (field.name === wf.statusField || field.name === wf.assigneeField)) {
    return { part, message: t('The workflow’s moves set it: it cannot be hidden or computed') }
  }
  if (showWhen) {
    if (formula) return { part: 'showWhen', message: t('A computed field is not edited, so it has no show-when') }
    try {
      if (checkExpr(showWhen, entity, 'BOOL', entities).includes(field.name)) return { part: 'showWhen', message: t('It reads the field itself') }
    } catch (e) {
      if (e instanceof ExprError) return { part: 'showWhen', message: e.describe() }
      throw e
    }
  }
  if (formula) {
    const wanted = formulaType(field.type)
    if (!wanted) return { part: 'formula', message: t('A {type} field cannot be computed', { type: field.type }) }
    if (field.required) return { part: 'formula', message: t('A computed field is set by the server, so it is never required') }
    if (field.defaultValue != null && field.defaultValue !== '') return { part: 'formula', message: t('A computed field has no default') }
    try {
      for (const ref of checkExpr(formula, entity, wanted, entities)) {
        if (entity.fields.find(f => f.name === ref)?.formula?.trim()) {
          return { part: 'formula', message: t('It reads “{field}”, which is computed too (a formula reads entered fields only)', { field: ref }) }
        }
      }
    } catch (e) {
      if (e instanceof ExprError) return { part: 'formula', message: e.describe() }
      throw e
    }
  }
  return undefined
}

/** A one-line summary of an entity's rule problems for the validation count, or undefined. */
export function rulesProblem(entity: FullstackEntityDef, entities: readonly FullstackEntityDef[] = []): string | undefined {
  const problems = ruleProblems(entity, entities)
  if (problems.length === 0) return undefined
  const p = problems[0]
  return p.index < 0 ? p.message : t('Rule {n}: {message}', { n: p.index + 1, message: p.message })
}

/**
 * An entity's rules after an edit: a renamed field (matched by uid) is renamed in every rule that
 * reads it and in the field a message is shown on. A field that is gone is left for the check to
 * point out — a rule is the user's writing, not something to drop.
 */
export function syncRules(before: FullstackEntityDef, after: FullstackEntityDef): FullstackEntityDef {
  const hasExpressions = after.fields.some(f => f.showWhen || f.formula)
  if (!after.rules?.length && !hasExpressions) return after
  const renamed: [string, string][] = []
  for (const f of after.fields) {
    const was = f.uid ? before.fields.find(x => x.uid === f.uid) : undefined
    if (was && was.name !== f.name && was.name && f.name) renamed.push([was.name, f.name])
  }
  if (renamed.length === 0) return after
  let changed = false
  // A field's show-when and formula read the others too.
  const fields = after.fields.map(f => {
    if (!f.showWhen && !f.formula) return f
    let { showWhen, formula } = f
    for (const [from, to] of renamed) {
      if (showWhen) showWhen = renameInExpr(showWhen, from, to)
      if (formula) formula = renameInExpr(formula, from, to)
    }
    if (showWhen === f.showWhen && formula === f.formula) return f
    changed = true
    return { ...f, ...(showWhen !== undefined ? { showWhen } : {}), ...(formula !== undefined ? { formula } : {}) }
  })
  const rules = (after.rules ?? []).map(rule => {
    let { when, check, field } = rule
    for (const [from, to] of renamed) {
      check = renameInExpr(check, from, to)
      if (when) when = renameInExpr(when, from, to)
      if (field === from) field = to
    }
    if (check === rule.check && when === rule.when && field === rule.field) return rule
    changed = true
    return { ...rule, check, ...(when !== undefined ? { when } : {}), ...(field !== undefined ? { field } : {}) }
  })
  if (!changed) return after
  return { ...after, fields, ...(after.rules ? { rules } : {}) }
}

/** Each entity's rules, show-when conditions and formulas with every name passed through `rename`. */
function renameInEntity(e: FullstackEntityDef, rename: (name: string) => string): FullstackEntityDef {
  let changed = false
  const fields = e.fields.map(f => {
    const showWhen = f.showWhen ? renameNamesInExpr(f.showWhen, rename) : f.showWhen
    const formula = f.formula ? renameNamesInExpr(f.formula, rename) : f.formula
    if (showWhen === f.showWhen && formula === f.formula) return f
    changed = true
    return { ...f, ...(showWhen !== undefined ? { showWhen } : {}), ...(formula !== undefined ? { formula } : {}) }
  })
  const rules = (e.rules ?? []).map(rule => {
    const check = renameNamesInExpr(rule.check, rename)
    const when = rule.when ? renameNamesInExpr(rule.when, rename) : rule.when
    if (check === rule.check && when === rule.when) return rule
    changed = true
    return { ...rule, check, ...(when !== undefined ? { when } : {}) }
  })
  return changed ? { ...e, fields, ...(e.rules ? { rules } : {}) } : e
}

/** `entity`'s link `from` renamed `to`: its expressions read `to.field` where they read `from.field`. */
export function renameLinkInRules(entities: FullstackEntityDef[], entity: string, from: string, to: string): FullstackEntityDef[] {
  let changed = false
  const next = entities.map(e => {
    if (e.name.trim().toLowerCase() !== entity.trim().toLowerCase()) return e
    const out = renameInEntity(e, name => (name.startsWith(`${from}.`) ? `${to}.${name.slice(from.length + 1)}` : name))
    changed ||= out !== e
    return out
  })
  return changed ? next : entities
}

/** `target`'s field `from` renamed `to`: every entity that links to it reads `link.to` where it read `link.from`. */
export function renameLinkedFieldInRules(entities: FullstackEntityDef[], target: string, from: string, to: string): FullstackEntityDef[] {
  let changed = false
  const next = entities.map(e => {
    const links = (e.relations ?? []).filter(r => r.type === 'MANY_TO_ONE'
      && r.targetEntity.trim().toLowerCase() === target.trim().toLowerCase()).map(r => r.fieldName)
    if (links.length === 0) return e
    const out = renameInEntity(e, name => (links.some(l => name === `${l}.${from}`) ? `${name.slice(0, name.indexOf('.'))}.${to}` : name))
    changed ||= out !== e
    return out
  })
  return changed ? next : entities
}
