import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { FullstackEntityDef } from '../../types'
import { keyableMembers, syncUniqueKeys, uniqueKeysProblem } from './uniqueKeys'
import { validateEntities } from './validation'
import { EntitySettingsPanel } from './EntitySettingsPanel'

const task = (over: Partial<FullstackEntityDef> = {}): FullstackEntityDef => ({
  uid: 't',
  name: 'Task',
  fields: [
    { uid: 'f-id', name: 'id', type: 'LONG', primaryKey: true, generated: true },
    { uid: 'f-title', name: 'title', type: 'STRING' },
    { uid: 'f-status', name: 'status', type: 'ENUM', enumValues: ['TODO', 'DONE'] },
    { uid: 'f-done', name: 'done', type: 'BOOLEAN' },
    { uid: 'f-code', name: 'code', type: 'STRING', pattern: '[A-Z]{3}' },
    { uid: 'f-notes', name: 'notes', type: 'TEXT' },
  ],
  relations: [{ uid: 'r-project', type: 'MANY_TO_ONE', fieldName: 'project', targetEntity: 'Project' }],
  ...over,
})

describe('unique keys', () => {
  it('may name non-key fields but long texts, and many-to-one links', () => {
    expect(keyableMembers(task()).map(m => m.name)).toEqual(['title', 'status', 'done', 'code', 'project'])
  })

  it('follow a renamed field or link and drop what is gone', () => {
    const before = task({ uniqueKeys: [{ fields: ['project', 'title'] }, { fields: ['title', 'status'] }] })
    const renamed = syncUniqueKeys(before, {
      ...before,
      fields: before.fields.map(f => (f.uid === 'f-title' ? { ...f, name: 'name' } : f)),
      relations: [{ ...before.relations![0], fieldName: 'board' }],
    })
    expect(renamed.uniqueKeys).toEqual([{ fields: ['board', 'name'] }, { fields: ['name', 'status'] }])
    // The status goes: its key is left with one field and goes with it.
    const removed = syncUniqueKeys(before, { ...before, fields: before.fields.filter(f => f.uid !== 'f-status') })
    expect(removed.uniqueKeys).toEqual([{ fields: ['project', 'title'] }])
    // Nothing touched: the same object.
    const same = { ...before, label: 'Tasks' }
    expect(syncUniqueKeys(before, same)).toBe(same)
  })

  it('are checked as the server checks them', () => {
    const problem = (keys: string[][], composed = false) =>
      uniqueKeysProblem(task({ uniqueKeys: keys.map(fields => ({ fields })) }), composed)
    expect(problem([['project', 'title']])).toBeUndefined()
    expect(problem([['title']])).toMatch(/two or more/)
    expect(problem([['title', 'nope']])).toMatch(/“nope”, which is not one of its fields/)
    expect(problem([['id', 'title']])).toMatch(/primary key “id”/)
    expect(problem([['notes', 'title']])).toMatch(/a long text/)
    expect(problem([['title', 'Title']])).toMatch(/twice/)
    expect(problem([['project', 'title'], ['title', 'project']])).toMatch(/Unique key 2 is over the same fields/)
    expect(problem([['status', 'done', 'code']])).toMatch(/enums, yes\/no fields and patterned texts only/)
    expect(problem([['status', 'project']])).toBeUndefined()
    expect(problem([['project', 'title']], true)).toMatch(/inside their parent’s form/)
    expect(uniqueKeysProblem(task({ viewQuery: 'select 1', uniqueKeys: [{ fields: ['a', 'b'] }] }))).toMatch(/SELECT-backed view/)
  })

  it('count in the editor’s validation, a composed child’s included', () => {
    const order: FullstackEntityDef = {
      uid: 'o', name: 'Project',
      fields: [{ uid: 'p-id', name: 'id', type: 'LONG', primaryKey: true, generated: true }],
      relations: [{ uid: 'p-tasks', type: 'ONE_TO_MANY', fieldName: 'tasks', targetEntity: 'Task', composition: true }],
    }
    const errors = validateEntities([order, task({ uniqueKeys: [{ fields: ['project', 'title'] }] })])
    expect(errors.entities[1]?.uniqueKeys).toMatch(/inside their parent’s form/)
  })

  it('a help text over the limit is an error on its field', () => {
    const long = task()
    long.fields[1] = { ...long.fields[1], help: 'x'.repeat(301) }
    expect(validateEntities([long]).entities[0]?.fields[1]?.help).toBe('At most 300 characters')
  })

  it('are edited as chips in the entity settings', () => {
    const onUpdate = vi.fn()
    render(<EntitySettingsPanel entity={task()} onUpdate={onUpdate} onTickView={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Add key/ }))
    expect(onUpdate).toHaveBeenLastCalledWith({ uniqueKeys: [{ fields: [] }] })

    onUpdate.mockClear()
    render(<EntitySettingsPanel entity={task({ uniqueKeys: [{ fields: ['project'] }] })} onUpdate={onUpdate} onTickView={() => {}} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'title in unique key 1' }))
    expect(onUpdate).toHaveBeenLastCalledWith({ uniqueKeys: [{ fields: ['project', 'title'] }] })
    fireEvent.click(screen.getByRole('button', { name: 'Remove unique key 1' }))
    expect(onUpdate).toHaveBeenLastCalledWith({ uniqueKeys: undefined })
  })
})
