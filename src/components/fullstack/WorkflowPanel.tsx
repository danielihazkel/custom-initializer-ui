import type { FullstackEntityDef, FullstackPageRole, FullstackTransition, FullstackWorkflow } from '../../types'
import { Labeled, inputClass } from './controls'
import {
  MAX_TRANSITIONS, MAX_TRANSITION_LABEL, WORKFLOW_ROLES, assigneeFieldChoices, dueFieldChoices, finalStates,
  initialState, newTransition, newWorkflow, requirableNames, stateLabel, statusFieldChoices, unreachableStates,
  workflowStates, workflowUnavailableReason,
} from './workflow'

interface Props {
  entity: FullstackEntityDef
  error?: string
  onChange: (workflow: FullstackWorkflow | undefined) => void
  /** Whether an LDAP auth dependency is selected: transitions can only be limited to roles with one. */
  ldapAuth?: boolean
  /** Adds a dependency (the "Add ldap-auth-rest" shortcut next to the roles). */
  onAddDep?: (dep: string) => void
}

const CHIP = 'px-2 py-0.5 rounded-full border text-[11px] transition-colors'
const chip = (on: boolean) => `${CHIP} ${on ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-secondary hover:text-on-surface'}`

/** One-line summary for the card while the panel is closed. */
export function workflowSummary(entity: FullstackEntityDef): string | undefined {
  const wf = entity.workflow
  if (!wf) return undefined
  const n = wf.transitions.length
  return `${n} step${n === 1 ? '' : 's'} over ${wf.statusField}${wf.assigneeField ? ', assigned' : ''}`
}

/**
 * An entity's workflow ("human tasks"): which enum field holds its state, where a new row starts,
 * who it is assigned to and when it is due, and the moves between states — each optionally
 * limited to roles and asking for fields. The generated app offers only the moves a row can make,
 * and locks the status everywhere else.
 */
export function WorkflowPanel({ entity, error, onChange, ldapAuth, onAddDep }: Props) {
  const wf = entity.workflow
  if (!wf) {
    const unavailable = workflowUnavailableReason(entity)
    return (
      <div className="rounded-lg border border-outline-variant bg-background/50 px-3 py-3 space-y-2" data-entity-workflow>
        <p className="text-[11px] text-secondary">
          A workflow moves each {entity.name.trim() || 'record'} through the values of an enum field by named steps — submit, approve,
          reject — each optionally limited to a role and asking for fields. Rows can be claimed by a user and listed in an inbox.
        </p>
        <button
          type="button"
          disabled={Boolean(unavailable)}
          title={unavailable}
          onClick={() => onChange(newWorkflow(entity))}
          className="inline-flex items-center gap-1 rounded border border-primary/40 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">account_tree</span>
          Add a workflow
        </button>
        {unavailable && <p className="text-[11px] text-secondary">{unavailable}.</p>}
      </div>
    )
  }

  const states = workflowStates(entity)
  const set = (patch: Partial<FullstackWorkflow>) => onChange({ ...wf, ...patch })
  const setTransition = (i: number, patch: Partial<FullstackTransition>) =>
    set({ transitions: wf.transitions.map((t, j) => (j === i ? { ...t, ...patch } : t)) })
  const toggle = <T extends string>(list: readonly T[] | undefined, value: T): T[] =>
    (list ?? []).includes(value) ? (list ?? []).filter(v => v !== value) : [...(list ?? []), value]
  const finals = finalStates(entity)
  const unreachable = unreachableStates(entity)
  const requirable = requirableNames(entity)

  return (
    <div className="rounded-lg border border-outline-variant bg-background/50 px-3 py-3 space-y-3" data-entity-workflow>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Labeled label="Status field" hint="Its values are the states; only the steps below change it">
          <select aria-label="Status field" className={inputClass()} value={wf.statusField}
                  onChange={e => set({ statusField: e.target.value, initial: undefined, transitions: [] })}>
            {!statusFieldChoices(entity).some(f => f.name === wf.statusField) && <option value={wf.statusField}>{wf.statusField || '—'}</option>}
            {statusFieldChoices(entity).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
        </Labeled>
        <Labeled label="Starts in" hint="Where a new row begins">
          <select aria-label="Initial state" className={inputClass()} value={wf.initial ?? ''}
                  onChange={e => set({ initial: e.target.value || undefined })}>
            <option value="">{initialState(entity) ? `${stateLabel(initialState(entity)!)} (default)` : '—'}</option>
            {states.map(s => <option key={s} value={s}>{stateLabel(s)}</option>)}
          </select>
        </Labeled>
        <Labeled label="Assigned to" hint="A text field holding the user id — enables Claim / Release and the inbox">
          <select aria-label="Assignee field" className={inputClass()} value={wf.assigneeField ?? ''}
                  onChange={e => set({ assigneeField: e.target.value || undefined })}>
            <option value="">No assignment</option>
            {assigneeFieldChoices(entity).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
        </Labeled>
        <Labeled label="Due by" hint="A date the inbox sorts and flags overdue by">
          <select aria-label="Due field" className={inputClass()} value={wf.dueField ?? ''}
                  onChange={e => set({ dueField: e.target.value || undefined })}>
            <option value="">None</option>
            {dueFieldChoices(entity).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
        </Labeled>
      </div>

      <div className="space-y-2" role="list" aria-label="Transitions">
        {wf.transitions.map((t, i) => (
          <div key={i} role="listitem" className="rounded border border-outline-variant bg-background px-2.5 py-2 space-y-1.5" data-workflow-transition={i}>
            <div className="flex flex-wrap items-center gap-2">
              <input type="text" aria-label={`Transition ${i + 1} name`} className={`${inputClass()} max-w-[10rem] font-mono py-1 text-xs`}
                     value={t.name} placeholder="approve" onChange={e => setTransition(i, { name: e.target.value })} />
              <input type="text" aria-label={`Transition ${i + 1} label`} className={`${inputClass()} max-w-[12rem] py-1 text-xs`}
                     value={t.label ?? ''} maxLength={MAX_TRANSITION_LABEL} placeholder="Button label (optional)"
                     onChange={e => setTransition(i, { label: e.target.value || undefined })} />
              <span className="text-[11px] text-secondary">to</span>
              <select aria-label={`Transition ${i + 1} target`} className={`${inputClass()} max-w-[10rem] py-1 text-xs`} value={t.to}
                      onChange={e => setTransition(i, { to: e.target.value, from: t.from.filter(s => s !== e.target.value) })}>
                {!states.includes(t.to) && <option value={t.to}>{t.to || '—'}</option>}
                {states.map(s => <option key={s} value={s}>{stateLabel(s)}</option>)}
              </select>
              <button type="button" aria-label={`Remove transition ${t.name || i + 1}`} title="Remove this step"
                      className="ml-auto p-1 rounded text-secondary hover:text-error hover:bg-error/10"
                      onClick={() => set({ transitions: wf.transitions.filter((_, j) => j !== i) })}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">close</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Transition ${i + 1} moves from`}>
              <span className="w-12 text-[11px] text-secondary">from</span>
              {states.filter(s => s !== t.to).map(s => (
                <button key={s} type="button" aria-pressed={t.from.includes(s)} className={chip(t.from.includes(s))}
                        onClick={() => setTransition(i, { from: toggle(t.from, s) })}>{stateLabel(s)}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Transition ${i + 1} roles`}>
              <span className="w-12 text-[11px] text-secondary">who</span>
              <button type="button" aria-pressed={!t.roles?.length} className={chip(!t.roles?.length)}
                      onClick={() => setTransition(i, { roles: undefined })}>Anyone</button>
              {WORKFLOW_ROLES.map(role => (
                <button key={role} type="button" aria-pressed={Boolean(t.roles?.includes(role))} className={chip(Boolean(t.roles?.includes(role)))}
                        disabled={ldapAuth === false && !t.roles?.includes(role)}
                        title={ldapAuth === false ? 'Roles come from LDAP groups — add ldap-auth-rest first' : undefined}
                        onClick={() => {
                          const roles = toggle<FullstackPageRole>(t.roles, role)
                          setTransition(i, { roles: roles.length ? roles : undefined })
                        }}>{role}</button>
              ))}
              {ldapAuth === false && onAddDep && (
                <button type="button" className="text-[11px] font-medium text-primary hover:underline" onClick={() => onAddDep('ldap-auth-rest')}>
                  Add ldap-auth-rest
                </button>
              )}
            </div>
            {requirable.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Transition ${i + 1} asks for`}>
                <span className="w-12 text-[11px] text-secondary">asks for</span>
                {requirable.map(name => (
                  <button key={name} type="button" aria-pressed={Boolean(t.requires?.includes(name))} className={chip(Boolean(t.requires?.includes(name)))}
                          onClick={() => {
                            const requires = toggle(t.requires, name)
                            setTransition(i, { requires: requires.length ? requires : undefined })
                          }}>{name}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={wf.transitions.length >= MAX_TRANSITIONS || states.length < 2}
                onClick={() => set({ transitions: [...wf.transitions, newTransition(entity)] })}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">add</span>
          Add step
        </button>
        <button type="button" onClick={() => onChange(undefined)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-secondary hover:text-error hover:bg-error/10">
          Remove workflow
        </button>
        <span className="ml-auto text-[11px] text-secondary" data-workflow-states>
          {finals.length > 0 && <>Final: {finals.map(stateLabel).join(', ')}</>}
          {unreachable.length > 0 && <> · never reached: {unreachable.map(stateLabel).join(', ')}</>}
        </span>
      </div>
      {error && <p className="text-[11px] text-error" role="alert">{error}</p>}
    </div>
  )
}
