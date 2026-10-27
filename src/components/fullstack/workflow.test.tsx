import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { FullstackEntityDef, FullstackWorkflow } from '../../types'
import { lintModel } from './lint'
import { defaultWizardSteps, validatePages } from './pageLayout'
import { summarizeEntity } from './summary'
import { validateEntities } from './validation'
import { WorkflowPanel } from './WorkflowPanel'
import {
  ambiguousMoves, finalStates, initialState, newWorkflow, syncWorkflow, unreachableStates, workflowProblem,
} from './workflow'

const approvals: FullstackWorkflow = {
  statusField: 'status',
  assigneeField: 'assignee',
  dueField: 'dueOn',
  transitions: [
    { name: 'submit', from: ['DRAFT'], to: 'SUBMITTED' },
    { name: 'approve', from: ['SUBMITTED'], to: 'APPROVED', roles: ['ADMIN'] },
    { name: 'reject', label: 'Send back', from: ['SUBMITTED'], to: 'REJECTED', roles: ['ADMIN'], requires: ['reason'] },
  ],
}

const claim = (workflow: FullstackWorkflow | null = approvals): FullstackEntityDef => ({
  uid: 'c', name: 'Claim',
  fields: [
    { uid: 'f-id', name: 'id', type: 'LONG', primaryKey: true, generated: true },
    { uid: 'f-title', name: 'title', type: 'STRING', required: true },
    { uid: 'f-status', name: 'status', type: 'ENUM', enumValues: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ARCHIVED'] },
    { uid: 'f-assignee', name: 'assignee', type: 'STRING' },
    { uid: 'f-due', name: 'dueOn', type: 'LOCAL_DATE' },
    { uid: 'f-reason', name: 'reason', type: 'TEXT' },
  ],
  workflow: workflow ?? undefined,
})

describe('workflow', () => {
  it('reads its states as the generated app moves them', () => {
    const e = claim()
    expect(initialState(e)).toBe('DRAFT')
    expect(finalStates(e)).toEqual(['APPROVED', 'REJECTED', 'ARCHIVED'])
    expect(unreachableStates(e)).toEqual(['ARCHIVED'])
    expect(ambiguousMoves(approvals)).toEqual([])
    expect(ambiguousMoves({ ...approvals, transitions: [...approvals.transitions, { name: 'fastTrack', from: ['DRAFT', 'SUBMITTED'], to: 'APPROVED' }] }))
      .toEqual([{ from: 'SUBMITTED', to: 'APPROVED', names: ['approve', 'fastTrack'] }])
  })

  it('mirrors the server’s rules', () => {
    expect(workflowProblem(claim())).toBeUndefined()
    expect(workflowProblem(claim(), { ldapAuth: false })).toBe('Transition “approve” has roles, which need the ldap-auth or ldap-auth-rest dependency')
    expect(workflowProblem(claim({ ...approvals, statusField: 'title' }))).toBe('“title” must be a filterable, non-key enum field')
    expect(workflowProblem(claim({ ...approvals, transitions: [{ name: 'Go', from: ['DRAFT'], to: 'SUBMITTED' }] })))
      .toMatch(/the name starts with a lower-case letter/)
    expect(workflowProblem(claim({ ...approvals, transitions: [{ name: 'go', from: ['DRAFT', 'SUBMITTED'], to: 'SUBMITTED' }] })))
      .toBe('Transition “go” moves from SUBMITTED to itself')
    expect(workflowProblem(claim({ ...approvals, transitions: [{ name: 'go', from: ['LATER'], to: 'SUBMITTED' }] })))
      .toBe('Transition “go”: “LATER” is not a state of status')
    expect(workflowProblem(claim({ ...approvals, transitions: [{ name: 'go', from: ['DRAFT'], to: 'SUBMITTED', requires: ['status'] }] })))
      .toBe('Transition “go” asks for “status”, which it cannot set')
    expect(workflowProblem(claim({ ...approvals, assigneeField: 'reason' }))).toMatch(/must be a non-key, non-unique text field/)
    expect(workflowProblem({ ...claim(), readOnly: true })).toBe('A read-only entity cannot change state')
    // An entity error, counted towards Generate.
    const errors = validateEntities([claim()], [], { ldapAuth: false })
    expect(errors.entities[0]?.workflow).toMatch(/has roles/)
  })

  it('starts from the entity’s enum, each value moving on to the next', () => {
    const wf = newWorkflow(claim(null))!
    expect(wf.statusField).toBe('status')
    expect(wf.assigneeField).toBe('assignee')
    expect(wf.dueField).toBe('dueOn')
    expect(wf.transitions.map(t => `${t.name}:${t.from.join('|')}>${t.to}`)).toEqual([
      'toSubmitted:DRAFT>SUBMITTED', 'toApproved:SUBMITTED>APPROVED', 'toRejected:APPROVED>REJECTED', 'toArchived:REJECTED>ARCHIVED',
    ])
  })

  it('follows renames and drops what is gone', () => {
    const before = claim()
    const renamed = { ...before, fields: before.fields.map(f => (f.uid === 'f-reason' ? { ...f, name: 'rejectionReason' } : f.uid === 'f-status' ? { ...f, name: 'state' } : f)) }
    const synced = syncWorkflow(before, renamed).workflow!
    expect(synced.statusField).toBe('state')
    expect(synced.transitions[2].requires).toEqual(['rejectionReason'])
    const withoutDue = { ...before, fields: before.fields.filter(f => f.uid !== 'f-due' && f.uid !== 'f-assignee') }
    const dropped = syncWorkflow(before, withoutDue).workflow!
    expect(dropped.dueField).toBeUndefined()
    expect(dropped.assigneeField).toBeUndefined()
  })

  it('keeps the status out of a wizard, lists its endpoints and lints what a user would trip on', () => {
    expect(defaultWizardSteps(claim()).flatMap(s => s.fields)).not.toContain('status')
    const pages = [
      { id: 'claims', type: 'entity-list' as const, entity: 'Claim' },
      { id: 'new-claim', type: 'wizard' as const, entity: 'Claim', steps: [{ fields: ['title', 'status'] }] },
    ]
    const v = validatePages(pages, [claim()])
    expect(Object.values(v.byPage[1] ?? {}).join()).toContain('“status” is set by the workflow')
    expect(summarizeEntity(claim()).endpoints.map(ep => `${ep.method} ${ep.path}`)).toEqual(expect.arrayContaining([
      'POST /api/claims/{id}/transitions/{name}', 'POST /api/claims/{id}/claim', 'POST /api/claims/{id}/release',
    ]))
    const rules = lintModel([claim()], [], []).map(i => i.rule)
    expect(rules).toContain('workflow-unreachable')
    expect(rules).toContain('workflow-roles')
    const roles = lintModel([claim()], [], []).find(i => i.rule === 'workflow-roles')!
    expect(roles.fix!.apply({ entities: [claim()], scaffoldOpts: [], selectedDeps: [] }).selectedDeps).toEqual(['ldap-auth-rest'])
    expect(lintModel([claim()], [], ['ldap-auth-rest']).map(i => i.rule)).not.toContain('workflow-roles')
  })
})

describe('workflow panel', () => {
  it('adds a workflow, then edits a step', () => {
    const onChange = vi.fn()
    const { rerender } = render(<WorkflowPanel entity={claim(null)} onChange={onChange} ldapAuth />)
    fireEvent.click(screen.getByRole('button', { name: /Add a workflow/ }))
    const added = onChange.mock.calls[0][0] as FullstackWorkflow
    expect(added.transitions).toHaveLength(4)

    rerender(<WorkflowPanel entity={claim(approvals)} onChange={onChange} ldapAuth />)
    // reject asks for the reason; ask for the title too.
    fireEvent.click(screen.getByRole('group', { name: 'Transition 3 asks for' }).querySelector('button:nth-of-type(1)')!)
    const next = onChange.mock.calls[onChange.mock.calls.length - 1][0] as FullstackWorkflow
    expect(next.transitions[2].requires).toEqual(['reason', 'title'])
    expect(screen.getByText(/never reached: Archived/)).toBeTruthy()
  })

  it('offers roles only with an LDAP dependency, and a way to add one', () => {
    const onAddDep = vi.fn()
    render(<WorkflowPanel entity={claim(approvals)} onChange={() => {}} ldapAuth={false} onAddDep={onAddDep} />)
    const roles = screen.getByRole('group', { name: 'Transition 1 roles' })
    expect((roles.querySelector('button[aria-pressed="false"]') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getAllByRole('button', { name: 'Add ldap-auth-rest' })[0])
    expect(onAddDep).toHaveBeenCalledWith('ldap-auth-rest')
  })

  it('cannot add a workflow to an entity without states', () => {
    const plain: FullstackEntityDef = { name: 'Note', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'text', type: 'STRING' }] }
    render(<WorkflowPanel entity={plain} onChange={() => {}} />)
    expect((screen.getByRole('button', { name: /Add a workflow/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Add a filterable enum field/)).toBeTruthy()
  })
})
