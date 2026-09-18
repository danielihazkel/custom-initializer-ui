import { describe, it, expect } from 'vitest'
import { lintModel } from './lint'
import { EXAMPLE_MODELS } from './examples'
import { withUids } from './uid'
import type { FullstackEntityDef } from '../../types'

const pk: FullstackEntityDef['fields'][number] = { name: 'id', type: 'LONG', primaryKey: true, generated: true }

function rules(entities: FullstackEntityDef[], opts: string[] = [], deps: string[] = []) {
  return lintModel(withUids(entities), opts, deps)
}

describe('lintModel', () => {
  it('warns when a relation target has no text field, with a fix that adds a name field', () => {
    const model = withUids([
      { name: 'Order', fields: [pk], relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }] },
      { name: 'Customer', fields: [pk, { name: 'active', type: 'BOOLEAN' }] },
    ])
    const issue = lintModel(model, [], []).find(i => i.rule === 'label-field')!
    expect(issue.severity).toBe('warn')
    expect(issue.entityUid).toBe(model[1].uid)
    expect(issue.message).toContain('Customer')
    const fixed = issue.fix!.apply({ entities: model, scaffoldOpts: [], selectedDeps: [] })
    expect(fixed.entities[1].fields.map(f => f.name)).toEqual(['id', 'active', 'name'])
    expect(lintModel(fixed.entities, [], []).some(i => i.rule === 'label-field')).toBe(false)
  })

  it('offers no fix when the target already has a "name" that is not a string, or is a view', () => {
    const issues = rules([
      { name: 'Order', fields: [pk], relations: [{ type: 'MANY_TO_ONE', fieldName: 'stat', targetEntity: 'Stat' }] },
      { name: 'Stat', fields: [pk, { name: 'name', type: 'INTEGER' }] },
    ])
    expect(issues.find(i => i.rule === 'label-field')?.fix).toBeUndefined()
  })

  it('flags a page whose every text field is excluded from search', () => {
    const model = withUids([{ name: 'Note', fields: [pk, { name: 'body', type: 'TEXT', searchable: false }] }])
    const issue = lintModel(model, [], []).find(i => i.rule === 'no-search')!
    expect(issue.severity).toBe('info')
    const fixed = issue.fix!.apply({ entities: model, scaffoldOpts: [], selectedDeps: [] })
    expect(fixed.entities[0].fields[1].searchable).toBeUndefined()
  })

  it('flags a ticked view the generator drops and unticks it on fix', () => {
    const model = withUids([{ name: 'Task', listViews: ['table', 'kanban', 'calendar'], fields: [pk, { name: 'title', type: 'STRING' }] }])
    const issues = lintModel(model, [], []).filter(i => i.rule === 'view-dropped')
    expect(issues.map(i => i.message)).toEqual([
      expect.stringContaining('kanban view will not be generated — it needs an enum or boolean field'),
      expect.stringContaining('calendar view will not be generated — it needs a date field'),
    ])
    const fixed = issues[0].fix!.apply({ entities: model, scaffoldOpts: [], selectedDeps: [] })
    expect(fixed.entities[0].listViews).toEqual(['table', 'calendar'])
  })

  it('flags key-only entities and unique fields with defaults', () => {
    const model = withUids([{ name: 'Tag', fields: [{ name: 'code', type: 'STRING', primaryKey: true }] },
      { name: 'User', fields: [pk, { name: 'email', type: 'STRING', unique: true, defaultValue: 'a@b.c' }] }])
    const issues = lintModel(model, [], [])
    expect(issues.some(i => i.rule === 'only-keys' && i.entityUid === model[0].uid)).toBe(true)
    const unique = issues.find(i => i.rule === 'unique-default')!
    const fixed = unique.fix!.apply({ entities: model, scaffoldOpts: [], selectedDeps: [] })
    expect(fixed.entities[1].fields[1].defaultValue).toBeUndefined()
  })

  it('reports an override switched on for nothing and resets it on fix', () => {
    const model = withUids([{ name: 'Log', readOnly: true, opts: { softDelete: true, csvExport: true }, fields: [pk, { name: 'msg', type: 'STRING' }] }])
    const issue = lintModel(model, [], []).find(i => i.rule === 'override-no-effect')!
    expect(issue.message).toContain('softDelete')
    const fixed = issue.fix!.apply({ entities: model, scaffoldOpts: [], selectedDeps: [] })
    expect(fixed.entities[0].opts).toEqual({ csvExport: true })
  })

  it('checks project options against the dependency list', () => {
    const secured = rules([{ name: 'A', fields: [pk, { name: 'n', type: 'STRING' }] }], ['secured', 'openapi'], ['web'])
    expect(secured.find(i => i.rule === 'secured-needs-ldap')?.fix!.apply({ entities: [], scaffoldOpts: [], selectedDeps: ['web'] }).selectedDeps).toEqual(['web', 'ldap-auth'])
    expect(secured.find(i => i.rule === 'openapi-adds-dep')?.severity).toBe('info')
    expect(rules([{ name: 'A', fields: [pk, { name: 'n', type: 'STRING' }] }], ['secured', 'openapi'], ['ldap-auth-rest', 'openapi'])).toEqual([])
  })

  it('has nothing to say about a clean model', () => {
    expect(rules([{ name: 'Item', fields: [pk, { name: 'name', type: 'STRING', required: true }] }])).toEqual([])
  })
})

describe('built-in examples', () => {
  for (const example of EXAMPLE_MODELS) {
    it(`${example.name} raises no warnings`, () => {
      const warns = lintModel(withUids(example.entities), [], []).filter(i => i.severity === 'warn')
      expect(warns.map(i => i.message)).toEqual([])
    })
  }
})
