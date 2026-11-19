import type { FullstackEntityDef, FullstackPageRole, FullstackTransition, FullstackWorkflow } from '../../types'
import { Labeled, inputClass } from './controls'
import {
  MAX_TRANSITIONS, MAX_TRANSITION_LABEL, NOTIFY_RECIPIENTS, WORKFLOW_ROLES, assigneeFieldChoices, dueFieldChoices, finalStates,
  type NotifyRecipient,
  initialState, newTransition, newWorkflow, requirableNames, stateLabel, statusFieldChoices, unreachableStates,
  workflowStates, workflowUnavailableReason,
} from './workflow'
import { t, tc, tn } from '../../i18n'

interface Props {
  entity: FullstackEntityDef
  error?: string
  onChange: (workflow: FullstackWorkflow | undefined) => void
  /** Whether an LDAP auth dependency is selected: transitions can only be limited to roles with one. */
  ldapAuth?: boolean
  /** Adds a dependency (the "Add ldap-auth-rest" shortcut next to the roles). */
  onAddDep?: (dep: string) => void
}

/** Read in the site's language each time (getters). */
const NOTIFY_LABELS: Record<NotifyRecipient, string> = {
  get assignee() { return t('Assignee') },
  get creator() { return t('Creator') },
  get ADMIN() { return t('Admins') },
  get USER() { return t('Users') },
}
const NOTIFY_HINTS: Record<NotifyRecipient, string> = {
  get assignee() { return t('Whoever the row is assigned to after the move') },
  get creator() { return t('Whoever created the row (needs the audit option)') },
  get ADMIN() { return t('The addresses set for ADMIN in the app’s configuration (app.events.mail.roles)') },
  get USER() { return t('The addresses set for USER in the app’s configuration (app.events.mail.roles)') },
}

const CHIP = 'px-2 py-0.5 rounded-full border text-[11px] transition-colors'
const chip = (on: boolean) => `${CHIP} ${on ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-secondary hover:text-on-surface'}`

/** One-line summary for the card while the panel is closed. */
export function workflowSummary(entity: FullstackEntityDef): string | undefined {
  const wf = entity.workflow
  if (!wf) return undefined
  const n = wf.transitions.length
  return wf.assigneeField
    ? tn(n, '{n} step over {field}, assigned', '{n} steps over {field}, assigned', { field: wf.statusField })
    : tn(n, '{n} step over {field}', '{n} steps over {field}', { field: wf.statusField })
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
          {t('A workflow moves each {entity} through the values of an enum field by named steps — submit, approve, reject — each optionally limited to a role and asking for fields. Rows can be claimed by a user and listed in an inbox.', {
            entity: entity.name.trim() || t('record'),
          })}
        </p>
        <button
          type="button"
          disabled={Boolean(unavailable)}
          title={unavailable}
          onClick={() => onChange(newWorkflow(entity))}
          className="inline-flex items-center gap-1 rounded border border-primary/40 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">account_tree</span>
          {t('Add a workflow')}
        </button>
        {unavailable && <p className="text-[11px] text-secondary">{unavailable}.</p>}
      </div>
    )
  }

  const states = workflowStates(entity)
  const set = (patch: Partial<FullstackWorkflow>) => onChange({ ...wf, ...patch })
  const setTransition = (i: number, patch: Partial<FullstackTransition>) =>
    set({ transitions: wf.transitions.map((tr, j) => (j === i ? { ...tr, ...patch } : tr)) })
  const toggle = <T extends string>(list: readonly T[] | undefined, value: T): T[] =>
    (list ?? []).includes(value) ? (list ?? []).filter(v => v !== value) : [...(list ?? []), value]
  const finals = finalStates(entity)
  const unreachable = unreachableStates(entity)
  const requirable = requirableNames(entity)

  return (
    <div className="rounded-lg border border-outline-variant bg-background/50 px-3 py-3 space-y-3" data-entity-workflow>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Labeled label={t('Status field')} hint={t('Its values are the states; only the steps below change it')}>
          <select aria-label={t('Status field')} className={inputClass()} value={wf.statusField}
                  onChange={e => set({ statusField: e.target.value, initial: undefined, transitions: [] })}>
            {!statusFieldChoices(entity).some(f => f.name === wf.statusField) && <option value={wf.statusField}>{wf.statusField || '—'}</option>}
            {statusFieldChoices(entity).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
        </Labeled>
        <Labeled label={t('Starts in')} hint={t('Where a new row begins')}>
          <select aria-label={t('Initial state')} className={inputClass()} value={wf.initial ?? ''}
                  onChange={e => set({ initial: e.target.value || undefined })}>
            <option value="">{initialState(entity) ? t('{state} (default)', { state: stateLabel(initialState(entity)!) }) : '—'}</option>
            {states.map(s => <option key={s} value={s}>{stateLabel(s)}</option>)}
          </select>
        </Labeled>
        <Labeled label={t('Assigned to')} hint={t('A text field holding the user id — enables Claim / Release and the inbox')}>
          <select aria-label={t('Assignee field')} className={inputClass()} value={wf.assigneeField ?? ''}
                  onChange={e => set({ assigneeField: e.target.value || undefined })}>
            <option value="">{t('No assignment')}</option>
            {assigneeFieldChoices(entity).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
        </Labeled>
        <Labeled label={t('Due by')} hint={t('A date the inbox sorts and flags overdue by')}>
          <select aria-label={t('Due field')} className={inputClass()} value={wf.dueField ?? ''}
                  onChange={e => set({ dueField: e.target.value || undefined })}>
            <option value="">{t('None')}</option>
            {dueFieldChoices(entity).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
        </Labeled>
      </div>
      <label className="flex items-start gap-2 text-xs text-on-surface" data-workflow-moves>
        <input
          type="checkbox"
          className="mt-0.5 accent-primary"
          checked={Boolean(wf.trackMoves)}
          aria-label={t('Keep a log of moves')}
          onChange={e => set({ trackMoves: e.target.checked ? true : undefined })}
        />
        <span>
          {t('Keep a log of moves')}
          <span className="block text-[11px] text-secondary">
            {t('Every step of a row — who, when, how long in the state it left — in a table of its own (app_workflow_move): a History section on the record page and the time-in-state widget read it')}
          </span>
        </span>
      </label>

      <div className="space-y-2" role="list" aria-label={t('Transitions')}>
        {wf.transitions.map((tr, i) => {
          const n = i + 1
          return (
            <div key={i} role="listitem" className="rounded border border-outline-variant bg-background px-2.5 py-2 space-y-1.5" data-workflow-transition={i}>
              <div className="flex flex-wrap items-center gap-2">
                <input type="text" dir="ltr" aria-label={t('Transition {n} name', { n })} className={`${inputClass()} max-w-[10rem] font-mono py-1 text-xs`}
                       value={tr.name} placeholder="approve" onChange={e => setTransition(i, { name: e.target.value })} />
                <input type="text" aria-label={t('Transition {n} label', { n })} className={`${inputClass()} max-w-[12rem] py-1 text-xs`}
                       value={tr.label ?? ''} maxLength={MAX_TRANSITION_LABEL} placeholder={t('Button label (optional)')}
                       onChange={e => setTransition(i, { label: e.target.value || undefined })} />
                <span className="text-[11px] text-secondary">{tc('transition', 'to')}</span>
                <select aria-label={t('Transition {n} target', { n })} className={`${inputClass()} max-w-[10rem] py-1 text-xs`} value={tr.to}
                        onChange={e => setTransition(i, { to: e.target.value, from: tr.from.filter(s => s !== e.target.value) })}>
                  {!states.includes(tr.to) && <option value={tr.to}>{tr.to || '—'}</option>}
                  {states.map(s => <option key={s} value={s}>{stateLabel(s)}</option>)}
                </select>
                <button type="button" aria-label={t('Remove transition {name}', { name: tr.name || n })} title={t('Remove this step')}
                        className="ms-auto p-1 rounded text-secondary hover:text-error hover:bg-error/10"
                        onClick={() => set({ transitions: wf.transitions.filter((_, j) => j !== i) })}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">close</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('Transition {n} moves from', { n })}>
                <span className="w-12 text-[11px] text-secondary">{t('from')}</span>
                {states.filter(s => s !== tr.to).map(s => (
                  <button key={s} type="button" aria-pressed={tr.from.includes(s)} className={chip(tr.from.includes(s))}
                          onClick={() => setTransition(i, { from: toggle(tr.from, s) })}>{stateLabel(s)}</button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('Transition {n} roles', { n })}>
                <span className="w-12 text-[11px] text-secondary">{t('who')}</span>
                <button type="button" aria-pressed={!tr.roles?.length} className={chip(!tr.roles?.length)}
                        onClick={() => setTransition(i, { roles: undefined })}>{t('Anyone')}</button>
                {WORKFLOW_ROLES.map(role => (
                  <button key={role} type="button" aria-pressed={Boolean(tr.roles?.includes(role))} className={chip(Boolean(tr.roles?.includes(role)))}
                          disabled={ldapAuth === false && !tr.roles?.includes(role)}
                          title={ldapAuth === false ? t('Roles come from LDAP groups — add ldap-auth-rest first') : undefined}
                          onClick={() => {
                            const roles = toggle<FullstackPageRole>(tr.roles, role)
                            setTransition(i, { roles: roles.length ? roles : undefined })
                          }}>{role}</button>
                ))}
                {ldapAuth === false && onAddDep && (
                  <button type="button" className="text-[11px] font-medium text-primary hover:underline" onClick={() => onAddDep('ldap-auth-rest')}>
                    {t('Add ldap-auth-rest')}
                  </button>
                )}
              </div>
              {requirable.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('Transition {n} asks for', { n })}>
                  <span className="w-12 text-[11px] text-secondary">{t('asks for')}</span>
                  {requirable.map(name => (
                    <button key={name} type="button" aria-pressed={Boolean(tr.requires?.includes(name))} className={chip(Boolean(tr.requires?.includes(name)))}
                            onClick={() => {
                              const requires = toggle(tr.requires, name)
                              setTransition(i, { requires: requires.length ? requires : undefined })
                            }}>{name}</button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('Transition {n} e-mails', { n })} data-workflow-notify={i}>
                <span className="w-12 text-[11px] text-secondary">{t('e-mails')}</span>
                {NOTIFY_RECIPIENTS.map(who => {
                  const on = Boolean(tr.notify?.includes(who))
                  const noAssignee = who === 'assignee' && !wf.assigneeField
                  return (
                    <button key={who} type="button" aria-pressed={on} className={chip(on)}
                            disabled={noAssignee && !on}
                            title={noAssignee ? t('{hint} — pick the "Assigned to" field first', { hint: NOTIFY_HINTS[who] }) : NOTIFY_HINTS[who]}
                            onClick={() => {
                              const notify = toggle<NotifyRecipient>(tr.notify, who)
                              setTransition(i, { notify: notify.length ? notify : undefined })
                            }}>{NOTIFY_LABELS[who]}</button>
                  )
                })}
                {!tr.notify?.length && <span className="text-[11px] text-secondary">{t('nobody')}</span>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={wf.transitions.length >= MAX_TRANSITIONS || states.length < 2}
                onClick={() => set({ transitions: [...wf.transitions, newTransition(entity)] })}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">add</span>
          {tc('workflow', 'Add step')}
        </button>
        <button type="button" onClick={() => onChange(undefined)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-secondary hover:text-error hover:bg-error/10">
          {t('Remove workflow')}
        </button>
        <span className="ms-auto text-[11px] text-secondary" data-workflow-states>
          {finals.length > 0 && t('Final: {states}', { states: finals.map(stateLabel).join(', ') })}
          {unreachable.length > 0 && <> · {t('never reached: {states}', { states: unreachable.map(stateLabel).join(', ') })}</>}
        </span>
      </div>
      {error && <p className="text-[11px] text-error" role="alert">{error}</p>}
    </div>
  )
}
