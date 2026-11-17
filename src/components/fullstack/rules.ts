import type { FullstackEntityDef, FullstackRule } from '../../types'
import { LIMITS } from './schema'
import { checkExpr, ExprError, renameInExpr } from './expr'

/** Mirrors FullstackRequestValidator.MAX_RULES / MAX_RULE_MESSAGE. */
export const MAX_RULES = LIMITS.maxRules
export const MAX_RULE_MESSAGE = LIMITS.maxRuleMessage

/** One rule's problem, by the part it is in (the editor shows each under its input). */
export interface RuleProblem {
  index: number
  part: 'when' | 'check' | 'message' | 'field'
  message: string
}

/** The first problem of each rule, or an entity-wide one at index -1. */
export function ruleProblems(entity: FullstackEntityDef, composedChild = false): RuleProblem[] {
  const rules = entity.rules ?? []
  if (rules.length === 0) return []
  if (entity.readOnly || entity.viewQuery != null) {
    return [{ index: -1, part: 'check', message: 'A read-only entity is never saved, so it has no rules to check' }]
  }
  if (composedChild) {
    return [{ index: -1, part: 'check', message: 'Rows edited inside their parent’s form cannot have rules yet: a save of the parent does not check them' }]
  }
  if (rules.length > MAX_RULES) return [{ index: -1, part: 'check', message: `At most ${MAX_RULES} rules` }]
  const out: RuleProblem[] = []
  rules.forEach((rule, index) => {
    const problem = ruleProblem(entity, rule)
    if (problem) out.push({ index, ...problem })
  })
  return out
}

function ruleProblem(entity: FullstackEntityDef, rule: FullstackRule): Omit<RuleProblem, 'index'> | undefined {
  if (!rule.check.trim()) return { part: 'check', message: 'Write the condition every row must meet' }
  let refs: string[]
  try {
    refs = checkExpr(rule.check, entity)
  } catch (e) {
    if (e instanceof ExprError) return { part: 'check', message: e.describe() }
    throw e
  }
  if (rule.when?.trim()) {
    try {
      checkExpr(rule.when, entity)
    } catch (e) {
      if (e instanceof ExprError) return { part: 'when', message: e.describe() }
      throw e
    }
  }
  if (!rule.message.trim()) return { part: 'message', message: 'Write the message a user sees' }
  if (rule.message.trim().length > MAX_RULE_MESSAGE) return { part: 'message', message: `At most ${MAX_RULE_MESSAGE} characters` }
  if (rule.field?.trim()) {
    if (!entity.fields.some(f => f.name.toLowerCase() === rule.field!.trim().toLowerCase())) {
      return { part: 'field', message: `“${rule.field}” is not one of its fields` }
    }
  } else if (refs.length === 0) {
    return { part: 'field', message: 'The check reads no field: say which field the message is shown on' }
  }
  return undefined
}

/** A one-line summary of an entity's rule problems for the validation count, or undefined. */
export function rulesProblem(entity: FullstackEntityDef, composedChild = false): string | undefined {
  const problems = ruleProblems(entity, composedChild)
  if (problems.length === 0) return undefined
  const p = problems[0]
  return p.index < 0 ? p.message : `Rule ${p.index + 1}: ${p.message}`
}

/**
 * An entity's rules after an edit: a renamed field (matched by uid) is renamed in every rule that
 * reads it and in the field a message is shown on. A field that is gone is left for the check to
 * point out — a rule is the user's writing, not something to drop.
 */
export function syncRules(before: FullstackEntityDef, after: FullstackEntityDef): FullstackEntityDef {
  if (!after.rules?.length) return after
  const renamed: [string, string][] = []
  for (const f of after.fields) {
    const was = f.uid ? before.fields.find(x => x.uid === f.uid) : undefined
    if (was && was.name !== f.name && was.name && f.name) renamed.push([was.name, f.name])
  }
  if (renamed.length === 0) return after
  let changed = false
  const rules = after.rules.map(rule => {
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
  return changed ? { ...after, rules } : after
}
