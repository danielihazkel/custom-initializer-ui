import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FullstackEntityDef } from '../../types'
import {
  ACCESS_LEVELS, CREATOR, DEFAULT_ACCESS, MAX_OWNERS, ROW_MODES, accessProblem, accessSummary, cleanAccess, ownerChoices, readLevel,
  rowMode, syncAccess, writeLevel,
} from './access'
import { lintModel } from './lint'
import { EntitySettingsPanel, settingsSummary } from './EntitySettingsPanel'
import { validateEntities } from './validation'
import { requestFromSnapshot } from './snapshot'
import { SCHEMA } from './schema'

const pk = { name: 'id', type: 'LONG' as const, primaryKey: true, generated: true }
const entity = (access?: FullstackEntityDef['access']): FullstackEntityDef =>
  ({ name: 'Note', fields: [pk, { name: 'text', type: 'STRING' }], ...(access ? { access } : {}) })

describe('entity access levels', () => {
  it('reads its levels and defaults from the schema document', () => {
    expect(ACCESS_LEVELS).toEqual(SCHEMA.accessLevels)
    expect(ACCESS_LEVELS).toEqual(['SIGNED_IN', 'USER', 'ADMIN'])
    expect(DEFAULT_ACCESS).toEqual({ read: 'USER', write: 'ADMIN' })
    expect(readLevel(entity())).toBe('USER')
    expect(writeLevel(entity())).toBe('ADMIN')
    expect(readLevel(entity({ read: 'ADMIN' }))).toBe('ADMIN')
  })

  it('writes only what differs from the default', () => {
    // An entity nobody touched keeps the shape it had before access levels existed.
    expect(cleanAccess(undefined)).toBeUndefined()
    expect(cleanAccess({ read: 'USER', write: 'ADMIN' })).toBeUndefined()
    expect(cleanAccess({ read: 'SIGNED_IN', write: 'ADMIN' })).toEqual({ read: 'SIGNED_IN' })
    expect(cleanAccess({ read: 'USER', write: 'USER' })).toEqual({ write: 'USER' })
  })

  it('refuses writing open to more people than reading, as the server does', () => {
    expect(accessProblem(entity())).toBeUndefined()
    expect(accessProblem(entity({ read: 'SIGNED_IN', write: 'USER' }))).toBeUndefined()
    expect(accessProblem(entity({ read: 'ADMIN' }))).toBeUndefined()
    expect(accessProblem(entity({ read: 'ADMIN', write: 'USER' })))
      .toBe('Write (Users) cannot be open to more people than read (Admins)')
    const result = validateEntities([entity({ read: 'ADMIN', write: 'USER' })])
    expect(result.entities[0]?.access).toContain('cannot be open to more people')
    expect(validateEntities([entity({ read: 'SIGNED_IN' })]).entities[0]?.access).toBeUndefined()
  })

  it('reaches the request as it was set, and not at all when it was not', () => {
    const snapshot = {
      meta: { groupId: 'com.menora', artifactId: 'demo', name: 'demo', description: '', version: '1.0.0', packaging: 'jar',
        packageName: 'com.menora.demo', domainPackage: '', bootVersion: '3.2.1', javaVersion: '21', locale: 'en' },
      entities: [entity({ read: 'SIGNED_IN' }), { ...entity(), name: 'Plain' }],
      selectedDeps: ['web'], scaffoldOpts: [], backendSet: 'spring-jpa-crud', frontendSet: 'react-tailwind-crud',
    } as unknown as Parameters<typeof requestFromSnapshot>[0]
    const request = requestFromSnapshot(snapshot)
    expect(request.entities[0].access).toEqual({ read: 'SIGNED_IN' })
    expect(request.entities[1]).not.toHaveProperty('access')
  })

  it('is set in the entity’s Settings panel and shown in its summary', () => {
    const onUpdate = vi.fn()
    const { rerender, container } = render(
      <EntitySettingsPanel entity={entity()} onUpdate={onUpdate} onTickView={() => {}} />,
    )
    const read = screen.getByLabelText('Who may read') as HTMLSelectElement
    const write = screen.getByLabelText('Who may write') as HTMLSelectElement
    expect(read.value).toBe('USER')
    expect(write.value).toBe('ADMIN')
    expect(Array.from(read.options).map(o => o.textContent)).toEqual(['Anyone signed in', 'Users', 'Admins'])

    fireEvent.change(read, { target: { value: 'SIGNED_IN' } })
    expect(onUpdate).toHaveBeenLastCalledWith({ access: { read: 'SIGNED_IN' } })
    // Back to the default: the setting goes, not a spelled-out default.
    rerender(<EntitySettingsPanel entity={entity({ read: 'SIGNED_IN' })} onUpdate={onUpdate} onTickView={() => {}} />)
    fireEvent.change(screen.getByLabelText('Who may read'), { target: { value: 'USER' } })
    expect(onUpdate).toHaveBeenLastCalledWith({ access: undefined })

    // A problem is shown where it is set.
    rerender(<EntitySettingsPanel entity={entity({ read: 'ADMIN', write: 'USER' })} onUpdate={onUpdate} onTickView={() => {}}
      errors={{ fields: {}, access: 'Write (Users) cannot be open to more people than read (Admins)' }} />)
    expect(container.querySelector('[data-entity-access] [data-error]')?.textContent).toContain('cannot be open to more people')
    expect(screen.getByLabelText('Who may write').getAttribute('aria-invalid')).toBe('true')

    // A read-only entity has nothing to write.
    rerender(<EntitySettingsPanel entity={{ ...entity(), readOnly: true }} onUpdate={onUpdate} onTickView={() => {}} />)
    expect((screen.getByLabelText('Who may write') as HTMLSelectElement).disabled).toBe(true)

    expect(settingsSummary(entity())).toEqual([])
    expect(settingsSummary(entity({ read: 'SIGNED_IN', write: 'USER' }))).toEqual(['read: anyone signed in · write: users'])
    expect(accessSummary(entity({ read: 'ADMIN' }))).toBe('read: admins · write: admins')
  })
})

describe('rows that belong to users (access.owners / access.rows)', () => {
  const USERS = { read: 'USER', write: 'USER' } as const
  const claim = (access?: FullstackEntityDef['access'], extra: Partial<FullstackEntityDef> = {}): FullstackEntityDef => ({
    name: 'Claim',
    fields: [
      { ...pk, uid: 'f-id' },
      { uid: 'f-title', name: 'title', type: 'STRING' },
      { uid: 'f-reviewer', name: 'reviewer', type: 'STRING' },
      { uid: 'f-amount', name: 'amount', type: 'BIG_DECIMAL' },
    ],
    ...(access ? { access } : {}),
    ...extra,
  })

  it('reads its modes from the schema document', () => {
    expect(ROW_MODES).toEqual(['OWN', 'OWN_WRITES'])
    expect(CREATOR).toBe('createdBy')
    expect(MAX_OWNERS).toBe(4)
    expect(rowMode(claim())).toBe('ALL')
    // Owners without a mode: users see only their own rows.
    expect(rowMode(claim({ ...USERS, owners: ['createdBy'] }))).toBe('OWN')
    expect(rowMode(claim({ ...USERS, owners: ['createdBy'], rows: 'OWN_WRITES' }))).toBe('OWN_WRITES')
  })

  it('offers the creator and the text fields that can hold a user id', () => {
    expect(ownerChoices(claim()).map(c => c.name)).toEqual(['createdBy', 'title', 'reviewer'])
    const computed = claim()
    computed.fields[2] = { ...computed.fields[2], formula: 'title' }
    expect(ownerChoices(computed).map(c => c.name)).toEqual(['createdBy', 'title'])
  })

  it('writes owners and leaves the default mode out', () => {
    expect(cleanAccess({ ...USERS, owners: ['createdBy'], rows: 'OWN' })).toEqual({ write: 'USER', owners: ['createdBy'] })
    expect(cleanAccess({ ...USERS, owners: ['reviewer'], rows: 'OWN_WRITES' })).toEqual({ write: 'USER', owners: ['reviewer'], rows: 'OWN_WRITES' })
    // No owners is no limit, whatever the mode says.
    expect(cleanAccess({ read: 'USER', write: 'ADMIN', owners: [], rows: 'OWN' })).toBeUndefined()
  })

  it('refuses what the server refuses', () => {
    expect(accessProblem(claim({ ...USERS, owners: ['createdBy', 'reviewer'] }))).toBeUndefined()
    expect(accessProblem(claim({ ...USERS, owners: ['nobody'] }))).toContain("Owner 'nobody' is not a field")
    expect(accessProblem(claim({ ...USERS, owners: ['amount'] }))).toContain('a user id is kept in a STRING field')
    expect(accessProblem(claim({ ...USERS, owners: ['createdBy', 'CreatedBy'] }))).toContain('named twice')
    expect(accessProblem(claim({ ...USERS, rows: 'OWN' }))).toContain('needs owners')
    expect(accessProblem(claim({ read: 'ADMIN', write: 'ADMIN', owners: ['createdBy'] }))).toContain('admins are never limited')
    expect(accessProblem(claim({ read: 'USER', write: 'ADMIN', owners: ['createdBy'], rows: 'OWN_WRITES' }))).toContain('Only admins change')
    expect(accessProblem(claim({ ...USERS, owners: ['createdBy'] }, { readOnly: true }))).toContain('has no creator')
    expect(accessProblem(claim({ ...USERS, owners: ['createdBy'] }, { viewQuery: 'select 1' }))).toContain('SELECT-backed view')
    expect(accessProblem(claim({ ...USERS, owners: ['createdBy'] }), { auditOff: true })).toContain('audit columns')
    expect(accessProblem(claim({ ...USERS, owners: ['reviewer'] }), { composedBy: 'Order' })).toContain("part of 'Order'")
    const workflow = { statusField: 'status', assigneeField: 'reviewer', transitions: [] } as unknown as FullstackEntityDef['workflow']
    expect(accessProblem(claim({ ...USERS, owners: ['reviewer'] }, { workflow }))).toContain("workflow's assignee")
    expect(accessProblem(claim({ ...USERS, owners: ['createdBy', 'reviewer'] }, { workflow }))).toBeUndefined()

    // Through the model's validation: an entity's own audit switch, and a composing parent.
    const off = validateEntities([claim({ ...USERS, owners: ['createdBy'] }, { opts: { audit: false } })])
    expect(off.entities[0]?.access).toContain('audit columns')
    const parent: FullstackEntityDef = {
      name: 'Report', fields: [pk],
      relations: [{ type: 'ONE_TO_MANY', fieldName: 'claims', targetEntity: 'Claim', composition: true }],
    } as FullstackEntityDef
    const composed = validateEntities([parent, claim({ ...USERS, owners: ['reviewer'] })])
    expect(composed.entities[1]?.access).toContain("part of 'Report'")
  })

  it('follows a renamed owner field and drops one that is gone', () => {
    const before = claim({ ...USERS, owners: ['createdBy', 'reviewer'] })
    const renamed = { ...before, fields: before.fields.map(f => f.uid === 'f-reviewer' ? { ...f, name: 'checker' } : f) }
    expect(syncAccess(before, renamed).access?.owners).toEqual(['createdBy', 'checker'])
    const removed = { ...before, fields: before.fields.filter(f => f.uid !== 'f-reviewer') }
    expect(syncAccess(before, removed).access?.owners).toEqual(['createdBy'])
    // The last owner gone: rows belong to nobody again.
    const only = claim({ ...USERS, owners: ['reviewer'], rows: 'OWN_WRITES' })
    const gone = { ...only, fields: only.fields.filter(f => f.uid !== 'f-reviewer') }
    expect(syncAccess(only, gone).access).toEqual({ write: 'USER' })
    // Nothing to follow: the entity is returned as it is.
    expect(syncAccess(before, before)).toBe(before)
  })

  it('is set in the Settings panel: whose rows, and who a row belongs to', () => {
    const onUpdate = vi.fn()
    const { rerender, container } = render(
      <EntitySettingsPanel entity={claim(USERS)} onUpdate={onUpdate} onTickView={() => {}} />,
    )
    const rows = screen.getByLabelText('Whose rows') as HTMLSelectElement
    expect(rows.value).toBe('ALL')
    expect(container.querySelector('[data-entity-owners]')).toBeNull()

    // Limiting rows starts with the creator as their owner.
    fireEvent.change(rows, { target: { value: 'OWN' } })
    expect(onUpdate).toHaveBeenLastCalledWith({ access: { write: 'USER', owners: ['createdBy'] } })

    const owned = claim({ ...USERS, owners: ['createdBy'] })
    rerender(<EntitySettingsPanel entity={owned} onUpdate={onUpdate} onTickView={() => {}} />)
    expect((screen.getByLabelText('Whose rows') as HTMLSelectElement).value).toBe('OWN')
    const boxes = Array.from(container.querySelectorAll<HTMLInputElement>('[data-entity-owners] input'))
    expect(boxes.map(b => b.checked)).toEqual([true, false, false])
    fireEvent.click(boxes[2])
    expect(onUpdate).toHaveBeenLastCalledWith({ access: { write: 'USER', owners: ['createdBy', 'reviewer'] } })

    fireEvent.change(screen.getByLabelText('Whose rows'), { target: { value: 'OWN_WRITES' } })
    expect(onUpdate).toHaveBeenLastCalledWith({ access: { write: 'USER', owners: ['createdBy'], rows: 'OWN_WRITES' } })
    fireEvent.change(screen.getByLabelText('Whose rows'), { target: { value: 'ALL' } })
    expect(onUpdate).toHaveBeenLastCalledWith({ access: { write: 'USER' } })

    expect(settingsSummary(owned)).toEqual(['read: users · write: users · own rows only'])
    expect(accessSummary(claim({ ...USERS, owners: ['reviewer'], rows: 'OWN_WRITES' }))).toBe('read: users · write: users · own rows to change')
    // A view has no rows of its own.
    rerender(<EntitySettingsPanel entity={claim(undefined, { viewQuery: 'select 1', readOnly: true })} onUpdate={onUpdate} onTickView={() => {}} />)
    expect(screen.queryByLabelText('Whose rows')).toBeNull()
  })

  it('notes what the unassigned queue shows users kept to their own rows', () => {
    const workflow = { statusField: 'status', assigneeField: 'reviewer', transitions: [] } as unknown as FullstackEntityDef['workflow']
    const model = (access: FullstackEntityDef['access']) => lintModel([claim(access, { workflow })], [], ['ldap-auth-rest'])
    expect(model({ ...USERS, owners: ['createdBy', 'reviewer'] }).some(i => i.rule === 'own-rows-unassigned')).toBe(true)
    expect(model({ ...USERS, owners: ['createdBy', 'reviewer'], rows: 'OWN_WRITES' }).some(i => i.rule === 'own-rows-unassigned')).toBe(false)
    expect(model(USERS).some(i => i.rule === 'own-rows-unassigned')).toBe(false)
  })
})
