import { describe, it, expect } from 'vitest'
import { lintModel } from './lint'
import type { ExampleModel } from '../../types'
import seededExamples from './__fixtures__/fullstack-examples.json'
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

  describe('fk-lookalike', () => {
    const customer: FullstackEntityDef = { name: 'Customer', fields: [pk, { name: 'name', type: 'STRING' }] }

    it.each(['customerId', 'customer_id', 'CUSTOMERID'])('flags %s next to a Customer entity and converts it to a relation', fieldName => {
      const model = withUids([
        { name: 'Order', fields: [pk, { name: fieldName, type: 'LONG', required: true }, { name: 'total', type: 'BIG_DECIMAL' }] },
        customer,
      ])
      const issue = lintModel(model, [], []).find(i => i.rule === 'fk-lookalike')!
      expect(issue.severity).toBe('warn')
      expect(issue.entityUid).toBe(model[0].uid)
      expect(issue.message).toContain(`Order.${fieldName} looks like a reference to Customer`)
      const fixed = issue.fix!.apply({ entities: model, scaffoldOpts: [], selectedDeps: [] })
      expect(fixed.entities[0].fields.map(f => f.name)).toEqual(['id', 'total'])
      expect(fixed.entities[0].relations).toEqual([
        expect.objectContaining({ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer', required: true }),
      ])
      expect(lintModel(fixed.entities, [], []).some(i => i.rule === 'fk-lookalike')).toBe(false)
    })

    it('carries a non-required column as an optional relation and handles multi-word names', () => {
      const model = withUids([
        { name: 'Line', fields: [pk, { name: 'order_item_id', type: 'UUID' }] },
        { name: 'OrderItem', fields: [{ name: 'id', type: 'UUID', primaryKey: true, generated: true }, { name: 'sku', type: 'STRING' }] },
      ])
      const issue = lintModel(model, [], []).find(i => i.rule === 'fk-lookalike')!
      const fixed = issue.fix!.apply({ entities: model, scaffoldOpts: [], selectedDeps: [] })
      expect(fixed.entities[0].relations?.[0]).toEqual(expect.objectContaining({ fieldName: 'orderItem', targetEntity: 'OrderItem', required: false }))
    })

    it('stays quiet for keys, strings, views, composite targets, type mismatches and existing relations', () => {
      const quiet = (entities: FullstackEntityDef[]) => rules(entities).filter(i => i.rule === 'fk-lookalike')
      // The field is itself (part of) the key.
      expect(quiet([{ name: 'Enrolment', fields: [{ name: 'customerId', type: 'LONG', primaryKey: true }, { name: 'n', type: 'STRING' }] }, customer])).toEqual([])
      // A STRING column called customerId is not a foreign key.
      expect(quiet([{ name: 'Order', fields: [pk, { name: 'customerId', type: 'STRING' }] }, customer])).toEqual([])
      // Views can't declare relations; a view can't be targeted either.
      expect(quiet([{ name: 'Report', viewQuery: 'select 1 as id', fields: [pk, { name: 'customerId', type: 'LONG' }] }, customer])).toEqual([])
      expect(quiet([{ name: 'Order', fields: [pk, { name: 'customerId', type: 'LONG' }] }, { name: 'Customer', viewQuery: 'select 1 as id', fields: [pk] }])).toEqual([])
      // Composite-key targets can't be addressed by one column.
      expect(quiet([{ name: 'Order', fields: [pk, { name: 'customerId', type: 'LONG' }] },
        { name: 'Customer', fields: [{ name: 'a', type: 'LONG', primaryKey: true }, { name: 'b', type: 'LONG', primaryKey: true }] }])).toEqual([])
      // The key types differ.
      expect(quiet([{ name: 'Order', fields: [pk, { name: 'customerId', type: 'INTEGER' }] }, customer])).toEqual([])
      // The relation already exists (the column is something else the user kept on purpose).
      expect(quiet([{ name: 'Order', fields: [pk, { name: 'customerId', type: 'LONG' }], relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }] }, customer])).toEqual([])
    })

    it('offers no fix when the relation name would collide with a field', () => {
      const issue = rules([
        { name: 'Order', fields: [pk, { name: 'customerId', type: 'LONG' }, { name: 'customer', type: 'STRING' }] },
        customer,
      ]).find(i => i.rule === 'fk-lookalike')!
      expect(issue).toBeTruthy()
      expect(issue.fix).toBeUndefined()
    })
  })

  it('has nothing to say about a clean model', () => {
    expect(rules([{ name: 'Item', fields: [pk, { name: 'name', type: 'STRING', required: true }] }])).toEqual([])
  })
})

describe('built-in examples', () => {
  for (const example of seededExamples as ExampleModel[]) {
    it(`${example.name} raises no warnings`, () => {
      const warns = lintModel(withUids(example.entities), [], []).filter(i => i.severity === 'warn')
      expect(warns.map(i => i.message)).toEqual([])
    })
  }
})
