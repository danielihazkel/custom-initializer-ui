import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FullstackEntityDef } from '../../types'
import { ACCESS_LEVELS, DEFAULT_ACCESS, accessProblem, accessSummary, cleanAccess, readLevel, writeLevel } from './access'
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
