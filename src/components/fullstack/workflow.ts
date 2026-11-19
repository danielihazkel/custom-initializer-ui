import type { FullstackEntityDef, FullstackFieldDef, FullstackTransition, FullstackWorkflow } from '../../types'
import { LIMITS, NAME_RULES } from './schema'
import { isDateType } from './fieldTypes'
import { t } from '../../i18n'

/** Mirrors FullstackRequestValidator (parseWorkflow). */
export const MAX_TRANSITIONS = LIMITS.maxTransitions
export const MAX_TRANSITION_LABEL = LIMITS.maxTransitionLabel
export const WORKFLOW_ROLES = ['ADMIN', 'USER'] as const
const TRANSITION_NAME = NAME_RULES.transitionName

const same = (a: string | undefined, b: string | undefined) => a != null && b != null && a.trim().toLowerCase() === b.trim().toLowerCase()
const fieldOf = (entity: FullstackEntityDef, name: string | undefined) => entity.fields.find(f => same(f.name, name))
const upper = (s: string) => s.trim().toUpperCase()
const isDate = (f: FullstackFieldDef) => isDateType(f.type)

/** The enum fields a workflow can move: non-key and filterable (the list, inbox and board filter by it). */
export function statusFieldChoices(entity: FullstackEntityDef): FullstackFieldDef[] {
  return entity.fields.filter(f => f.name.trim() && !f.primaryKey && f.type === 'ENUM' && f.filterable !== false && (f.enumValues ?? []).length > 0)
}

/** The text fields that can hold who a row is assigned to — never a required one: a task
 *  nobody has taken has no assignee. */
export function assigneeFieldChoices(entity: FullstackEntityDef): FullstackFieldDef[] {
  return entity.fields.filter(f => f.name.trim() && !f.primaryKey && !f.unique && !f.required && f.type === 'STRING')
}

/** The dates a row can be due by. */
export function dueFieldChoices(entity: FullstackEntityDef): FullstackFieldDef[] {
  return entity.fields.filter(f => f.name.trim() && !f.primaryKey && isDate(f))
}

/** What a transition can ask for: fields and relations, never a key, a read-only field, the
 *  status or the assignee (which changes by claiming and reassigning). */
export function requirableNames(entity: FullstackEntityDef): string[] {
  const status = entity.workflow?.statusField
  const assignee = entity.workflow?.assigneeField
  return [
    // A field with several files is not one value a move can ask for.
    ...entity.fields.filter(f => f.name.trim() && !f.primaryKey && !f.readOnly && f.maxFiles == null && !same(f.name, status) && !same(f.name, assignee)).map(f => f.name),
    ...(entity.relations ?? []).filter(r => r.type === 'MANY_TO_ONE' && r.fieldName.trim()).map(r => r.fieldName),
  ]
}

/** The workflow's states: its status field's values, upper-cased as the generated enum spells them. */
export function workflowStates(entity: FullstackEntityDef): string[] {
  return (fieldOf(entity, entity.workflow?.statusField)?.enumValues ?? []).map(upper)
}

/** Where a new row starts: the named initial state, else the field's default, else its first value. */
export function initialState(entity: FullstackEntityDef): string | undefined {
  const wf = entity.workflow
  const status = fieldOf(entity, wf?.statusField)
  if (!wf || !status) return undefined
  return wf.initial ? upper(wf.initial) : status.defaultValue ? upper(status.defaultValue) : workflowStates(entity)[0]
}

/** The states a row can still move on from — every state some transition leaves. */
export function openStates(wf: FullstackWorkflow): string[] {
  return [...new Set(wf.transitions.flatMap(t => t.from.map(upper)))]
}

/** The states no transition leaves: where a row's work is done. */
export function finalStates(entity: FullstackEntityDef): string[] {
  const open = new Set(entity.workflow ? openStates(entity.workflow) : [])
  return workflowStates(entity).filter(s => !open.has(s))
}

/** States a row can never reach: not where it starts, and no transition leads there. */
export function unreachableStates(entity: FullstackEntityDef): string[] {
  const wf = entity.workflow
  if (!wf) return []
  const reached = new Set([initialState(entity), ...wf.transitions.map(t => upper(t.to))])
  return workflowStates(entity).filter(s => !reached.has(s))
}

/** Pairs of states two transitions move between — a drag on a board cannot tell which is meant. */
export function ambiguousMoves(wf: FullstackWorkflow): { from: string; to: string; names: string[] }[] {
  const byPair = new Map<string, string[]>()
  for (const t of wf.transitions) {
    for (const from of t.from) {
      const key = `${upper(from)}>${upper(t.to)}`
      byPair.set(key, [...(byPair.get(key) ?? []), t.name])
    }
  }
  return [...byPair.entries()].filter(([, names]) => names.length > 1)
    .map(([key, names]) => ({ from: key.split('>')[0], to: key.split('>')[1], names }))
}

/** "submitted" → "toSubmitted": a transition name from the state it leads to. */
function nameFor(state: string, taken: string[]): string {
  const words = state.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  const base = `to${words.map(w => w[0].toUpperCase() + w.slice(1)).join('')}`.slice(0, 40) || 'move'
  let name = base
  for (let i = 2; taken.includes(name); i++) name = `${base}${i}`
  return name
}

/** "IN_REVIEW" → "In review". */
export function stateLabel(state: string): string {
  const words = state.replace(/_/g, ' ').trim().toLowerCase()
  return words ? words[0].toUpperCase() + words.slice(1) : state
}

/** A first workflow for `entity`: its first status-like enum, each value moving on to the next. */
export function newWorkflow(entity: FullstackEntityDef): FullstackWorkflow | undefined {
  const status = statusFieldChoices(entity)[0]
  if (!status) return undefined
  const states = (status.enumValues ?? []).map(upper)
  const transitions: FullstackTransition[] = []
  for (let i = 0; i + 1 < states.length; i++) {
    transitions.push({ name: nameFor(states[i + 1], transitions.map(t => t.name)), from: [states[i]], to: states[i + 1] })
  }
  if (transitions.length === 0) return undefined
  const assignee = assigneeFieldChoices(entity).find(f => /assign|owner|handler/i.test(f.name))
  const due = dueFieldChoices(entity).find(f => /due|deadline/i.test(f.name))
  return {
    statusField: status.name,
    ...(assignee ? { assigneeField: assignee.name } : {}),
    ...(due ? { dueField: due.name } : {}),
    transitions,
  }
}

/** A blank transition from the workflow's first open state to its next. */
export function newTransition(entity: FullstackEntityDef): FullstackTransition {
  const states = workflowStates(entity)
  const taken = entity.workflow?.transitions.map(t => t.name) ?? []
  const from = states[0] ?? ''
  const to = states[1] ?? states[0] ?? ''
  return { name: nameFor(to || 'move', taken), from: from ? [from] : [], to }
}

/** Why `entity` cannot carry a workflow at all, or undefined when it can. */
export function workflowUnavailableReason(entity: FullstackEntityDef): string | undefined {
  const blocker = workflowBlocker(entity)
  return blocker === 'read-only' ? t('A read-only entity cannot change state')
    : blocker === 'key' ? t('A workflow needs a single primary key')
      : blocker === 'no-status' ? t('Add a filterable enum field for its states (e.g. status)')
        : undefined
}

function workflowBlocker(entity: FullstackEntityDef): 'read-only' | 'key' | 'no-status' | undefined {
  if (entity.readOnly || entity.viewQuery != null) return 'read-only'
  if (entity.fields.filter(f => f.primaryKey).length !== 1) return 'key'
  if (statusFieldChoices(entity).length === 0) return 'no-status'
  return undefined
}

/** Why the server would reject the entity's workflow (FullstackRequestValidator.parseWorkflow), or undefined. */
export function workflowProblem(entity: FullstackEntityDef,
                                context: { ldapAuth?: boolean; audited?: boolean } = {}): string | undefined {
  const wf = entity.workflow
  if (!wf) return undefined
  const blocker = workflowBlocker(entity)
  if (blocker && blocker !== 'no-status') return workflowUnavailableReason(entity)
  const status = fieldOf(entity, wf.statusField)
  if (!wf.statusField?.trim()) return t('Pick the status field')
  if (!status) return t('“{field}” is no longer a field', { field: wf.statusField })
  if (status.primaryKey || status.type !== 'ENUM' || status.filterable === false) return t('“{field}” must be a filterable, non-key enum field', { field: status.name })
  const states = workflowStates(entity)
  const isState = (s: string) => states.includes(upper(s))
  if (wf.initial && !isState(wf.initial)) return t('“{state}” is not a state of {field}', { state: wf.initial, field: status.name })
  if (wf.initial && status.defaultValue && upper(status.defaultValue) !== upper(wf.initial)) {
    return t('Starts in {state}, but {field} defaults to {initial}', { state: upper(wf.initial), field: status.name, initial: upper(status.defaultValue) })
  }
  if (wf.assigneeField) {
    const f = fieldOf(entity, wf.assigneeField)
    if (!f || f.primaryKey || f.unique || f.type !== 'STRING') return t('The assignee “{field}” must be a non-key, non-unique text field', { field: wf.assigneeField })
    if (f.required) return t('The assignee “{field}” cannot be required — a task nobody has taken has none', { field: wf.assigneeField })
    if (entity.fields.some(x => same(x.name, 'inbox'))) return t('A field named “inbox” clashes with the inbox queue — rename it')
  }
  if (wf.dueField) {
    const f = fieldOf(entity, wf.dueField)
    if (!f || f.primaryKey || !isDate(f)) return t('The due date “{field}” must be a non-key date field', { field: wf.dueField })
  }
  if (wf.transitions.length === 0) return t('Add at least one transition')
  if (wf.transitions.length > MAX_TRANSITIONS) return t('At most {max} transitions', { max: MAX_TRANSITIONS })
  const names = new Set<string>()
  const requirable = requirableNames(entity).map(n => n.toLowerCase())
  for (const tr of wf.transitions) {
    const step = tr.name || '?'
    if (!TRANSITION_NAME.test(tr.name)) return t('Transition “{step}”: the name starts with a lower-case letter, then letters and digits (max 40)', { step })
    if (names.has(tr.name)) return t('Two transitions are named “{step}”', { step: tr.name })
    names.add(tr.name)
    if ((tr.label?.trim().length ?? 0) > MAX_TRANSITION_LABEL) return t('Transition “{step}”: the label is over {max} characters', { step, max: MAX_TRANSITION_LABEL })
    if (tr.from.length === 0) return t('Transition “{step}” needs the states it moves from', { step })
    const bad = [...tr.from, tr.to].find(s => !s || !isState(s))
    if (bad !== undefined) return t('Transition “{step}”: “{state}” is not a state of {field}', { step, state: bad, field: status.name })
    if (tr.from.some(s => upper(s) === upper(tr.to))) return t('Transition “{step}” moves from {state} to itself', { step, state: upper(tr.to) })
    if ((tr.roles?.length ?? 0) > 0 && context.ldapAuth === false) return t('Transition “{step}” has roles, which need the ldap-auth or ldap-auth-rest dependency', { step })
    const seen = new Set<string>()
    for (const r of tr.requires ?? []) {
      if (!requirable.includes(r.toLowerCase())) return t('Transition “{step}” asks for “{field}”, which it cannot set', { step, field: r })
      if (seen.has(r.toLowerCase())) return t('Transition “{step}” asks for “{field}” twice', { step, field: r })
      seen.add(r.toLowerCase())
    }
    for (const n of tr.notify ?? []) {
      if (!(NOTIFY_RECIPIENTS as readonly string[]).includes(n)) return t('Transition “{step}” e-mails “{recipient}” (expected assignee, creator, ADMIN or USER)', { step, recipient: n })
      if (n === 'assignee' && !wf.assigneeField) return t('Transition “{step}” e-mails the assignee, but the workflow assigns nobody', { step })
      // Who created a row is the audit option's created-by column (undefined: not known here).
      if (n === 'creator' && context.audited === false) return t('Transition “{step}” e-mails the creator, which needs the audit option on this entity', { step })
    }
  }
  return undefined
}

/** Whom a move can e-mail: the row's assignee, who created it, or the addresses set for a role. */
export const NOTIFY_RECIPIENTS = ['assignee', 'creator', 'ADMIN', 'USER'] as const
export type NotifyRecipient = typeof NOTIFY_RECIPIENTS[number]

/**
 * An entity's workflow after an edit: a renamed field or relation (matched by uid) is renamed
 * where the workflow names it; a removed assignee or due field is dropped, as is a requirement
 * that is gone. A removed status field leaves the workflow for the validator to point at.
 */
export function syncWorkflow(before: FullstackEntityDef, after: FullstackEntityDef): FullstackEntityDef {
  const wf = after.workflow
  if (!wf) return after
  const renamed = new Map<string, string>()
  for (const f of after.fields) {
    const was = f.uid ? before.fields.find(x => x.uid === f.uid) : undefined
    if (was && was.name !== f.name) renamed.set(was.name, f.name)
  }
  for (const r of after.relations ?? []) {
    const was = r.uid ? (before.relations ?? []).find(x => x.uid === r.uid) : undefined
    if (was && was.fieldName !== r.fieldName) renamed.set(was.fieldName, r.fieldName)
  }
  // A step asks for fields and foreign keys; a relation turned into a many-to-many drops out.
  const names = new Set([...after.fields.map(f => f.name),
    ...(after.relations ?? []).filter(r => r.type === 'MANY_TO_ONE').map(r => r.fieldName)])
  const follow = (n: string | undefined) => (n == null ? n : renamed.get(n) ?? n)
  const next: FullstackWorkflow = {
    ...wf,
    statusField: follow(wf.statusField) ?? wf.statusField,
    assigneeField: wf.assigneeField && names.has(follow(wf.assigneeField)!) ? follow(wf.assigneeField) : undefined,
    dueField: wf.dueField && names.has(follow(wf.dueField)!) ? follow(wf.dueField) : undefined,
    transitions: wf.transitions.map(t => (t.requires?.length
      ? { ...t, requires: t.requires.map(n => renamed.get(n) ?? n).filter(n => names.has(n)) }
      : t)),
  }
  if (!next.assigneeField) delete next.assigneeField
  if (!next.dueField) delete next.dueField
  // With no assignee left, a move cannot e-mail one.
  if (!next.assigneeField) {
    next.transitions = next.transitions.map(t => {
      if (!t.notify?.includes('assignee')) return t
      const notify = t.notify.filter(n => n !== 'assignee')
      const { notify: _dropped, ...rest } = t
      return notify.length ? { ...rest, notify } : rest
    })
  }
  return JSON.stringify(next) === JSON.stringify(wf) ? after : { ...after, workflow: next }
}
