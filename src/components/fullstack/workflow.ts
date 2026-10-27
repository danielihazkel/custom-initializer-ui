import type { FullstackEntityDef, FullstackFieldDef, FullstackTransition, FullstackWorkflow } from '../../types'

/** Mirrors FullstackRequestValidator (parseWorkflow). */
export const MAX_TRANSITIONS = 20
export const MAX_TRANSITION_LABEL = 40
export const WORKFLOW_ROLES = ['ADMIN', 'USER'] as const
const TRANSITION_NAME = /^[a-z][A-Za-z0-9]{0,39}$/

const same = (a: string | undefined, b: string | undefined) => a != null && b != null && a.trim().toLowerCase() === b.trim().toLowerCase()
const fieldOf = (entity: FullstackEntityDef, name: string | undefined) => entity.fields.find(f => same(f.name, name))
const upper = (s: string) => s.trim().toUpperCase()
const isDate = (f: FullstackFieldDef) => f.type === 'LOCAL_DATE' || f.type === 'LOCAL_DATE_TIME'

/** The enum fields a workflow can move: non-key and filterable (the list, inbox and board filter by it). */
export function statusFieldChoices(entity: FullstackEntityDef): FullstackFieldDef[] {
  return entity.fields.filter(f => f.name.trim() && !f.primaryKey && f.type === 'ENUM' && f.filterable !== false && (f.enumValues ?? []).length > 0)
}

/** The text fields that can hold who a row is assigned to. */
export function assigneeFieldChoices(entity: FullstackEntityDef): FullstackFieldDef[] {
  return entity.fields.filter(f => f.name.trim() && !f.primaryKey && !f.unique && f.type === 'STRING')
}

/** The dates a row can be due by. */
export function dueFieldChoices(entity: FullstackEntityDef): FullstackFieldDef[] {
  return entity.fields.filter(f => f.name.trim() && !f.primaryKey && isDate(f))
}

/** What a transition can ask for: fields and relations, never a key, a read-only field or the status. */
export function requirableNames(entity: FullstackEntityDef): string[] {
  const status = entity.workflow?.statusField
  return [
    ...entity.fields.filter(f => f.name.trim() && !f.primaryKey && !f.readOnly && !same(f.name, status)).map(f => f.name),
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
  if (entity.readOnly || entity.viewQuery != null) return 'A read-only entity cannot change state'
  if (entity.fields.filter(f => f.primaryKey).length !== 1) return 'A workflow needs a single primary key'
  if (statusFieldChoices(entity).length === 0) return 'Add a filterable enum field for its states (e.g. status)'
  return undefined
}

/** Why the server would reject the entity's workflow (FullstackRequestValidator.parseWorkflow), or undefined. */
export function workflowProblem(entity: FullstackEntityDef, context: { ldapAuth?: boolean } = {}): string | undefined {
  const wf = entity.workflow
  if (!wf) return undefined
  const unavailable = workflowUnavailableReason(entity)
  if (unavailable && unavailable !== 'Add a filterable enum field for its states (e.g. status)') return unavailable
  const status = fieldOf(entity, wf.statusField)
  if (!wf.statusField?.trim()) return 'Pick the status field'
  if (!status) return `“${wf.statusField}” is no longer a field`
  if (status.primaryKey || status.type !== 'ENUM' || status.filterable === false) return `“${status.name}” must be a filterable, non-key enum field`
  const states = workflowStates(entity)
  const isState = (s: string) => states.includes(upper(s))
  if (wf.initial && !isState(wf.initial)) return `“${wf.initial}” is not a state of ${status.name}`
  if (wf.initial && status.defaultValue && upper(status.defaultValue) !== upper(wf.initial)) {
    return `Starts in ${upper(wf.initial)}, but ${status.name} defaults to ${upper(status.defaultValue)}`
  }
  if (wf.assigneeField) {
    const f = fieldOf(entity, wf.assigneeField)
    if (!f || f.primaryKey || f.unique || f.type !== 'STRING') return `The assignee “${wf.assigneeField}” must be a non-key, non-unique text field`
    if (entity.fields.some(x => same(x.name, 'inbox'))) return 'A field named “inbox” clashes with the inbox queue — rename it'
  }
  if (wf.dueField) {
    const f = fieldOf(entity, wf.dueField)
    if (!f || f.primaryKey || !isDate(f)) return `The due date “${wf.dueField}” must be a non-key date field`
  }
  if (wf.transitions.length === 0) return 'Add at least one transition'
  if (wf.transitions.length > MAX_TRANSITIONS) return `At most ${MAX_TRANSITIONS} transitions`
  const names = new Set<string>()
  const requirable = requirableNames(entity).map(n => n.toLowerCase())
  for (const t of wf.transitions) {
    const at = `Transition “${t.name || '?'}”`
    if (!TRANSITION_NAME.test(t.name)) return `${at}: the name starts with a lower-case letter, then letters and digits (max 40)`
    if (names.has(t.name)) return `Two transitions are named “${t.name}”`
    names.add(t.name)
    if ((t.label?.trim().length ?? 0) > MAX_TRANSITION_LABEL) return `${at}: the label is over ${MAX_TRANSITION_LABEL} characters`
    if (t.from.length === 0) return `${at} needs the states it moves from`
    const bad = [...t.from, t.to].find(s => !s || !isState(s))
    if (bad !== undefined) return `${at}: “${bad}” is not a state of ${status.name}`
    if (t.from.some(s => upper(s) === upper(t.to))) return `${at} moves from ${upper(t.to)} to itself`
    if ((t.roles?.length ?? 0) > 0 && context.ldapAuth === false) return `${at} has roles, which need the ldap-auth or ldap-auth-rest dependency`
    const seen = new Set<string>()
    for (const r of t.requires ?? []) {
      if (!requirable.includes(r.toLowerCase())) return `${at} asks for “${r}”, which it cannot set`
      if (seen.has(r.toLowerCase())) return `${at} asks for “${r}” twice`
      seen.add(r.toLowerCase())
    }
  }
  return undefined
}

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
  const names = new Set([...after.fields.map(f => f.name), ...(after.relations ?? []).map(r => r.fieldName)])
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
  return JSON.stringify(next) === JSON.stringify(wf) ? after : { ...after, workflow: next }
}
