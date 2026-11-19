import { describe, it, expect } from 'vitest'
import { lintModel } from './lint'
import { validateEntities } from './validation'
import { databaseOf, isKeywordOn, isSystemColumnOn, needsQuotes, tableOf } from './sqlNames'
import { withUids } from './uid'
import type { FullstackEntityDef } from '../../types'

const pk: FullstackEntityDef['fields'][number] = { name: 'id', type: 'LONG', primaryKey: true, generated: true }

/** A setting with keyword-named columns, in a table called `values`; batches that point at it, in `user`. */
const model = (): FullstackEntityDef[] => [
  {
    name: 'Setting', tableName: 'values',
    fields: [pk, { name: 'key', type: 'STRING' }, { name: 'order', type: 'INTEGER' }, { name: 'comment', type: 'STRING' }],
  },
  {
    name: 'Batch', tableName: 'user',
    fields: [pk, { name: 'name', type: 'STRING' }],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'setting', targetEntity: 'Setting', required: true }],
  },
]

describe('SQL names (the backend’s SchemaNames and SqlKeywords, mirrored)', () => {
  it('names the database a project’s dependencies select, H2 when none', () => {
    expect(databaseOf(['web', 'data-jpa'])).toBe('h2')
    expect(databaseOf(['web', 'oracle', 'postgresql'])).toBe('postgresql')
    expect(databaseOf(['mssql'])).toBe('mssql')
  })

  it('knows each database’s own keywords, ignoring case, and leaves a quoted name alone', () => {
    expect(isKeywordOn('order', 'h2')).toBe(true)
    expect(isKeywordOn('Value', 'h2')).toBe(true)
    expect(isKeywordOn('value', 'postgresql')).toBe(false)
    expect(isKeywordOn('comment', 'oracle')).toBe(true)
    expect(isKeywordOn('comment', 'h2')).toBe(false)
    expect(isKeywordOn('"order"', 'h2')).toBe(false)
    expect(needsQuotes('"Order"', 'h2')).toBe(true)
    expect(needsQuotes('orders', 'h2')).toBe(false)
    expect(isSystemColumnOn('xmin', 'postgresql')).toBe(true)
    expect(isSystemColumnOn('xmin', 'h2')).toBe(false)
  })

  it('derives a table as the generator does', () => {
    expect(tableOf({ name: 'OrderLine', fields: [] })).toBe('order_lines')
    expect(tableOf({ name: 'Value', fields: [] })).toBe('values')
    expect(tableOf({ name: 'Value', tableName: ' settings ', fields: [] })).toBe('settings')
  })
})

describe('lint: names the generator writes in quotes', () => {
  it('says which names are keywords on the project’s database', () => {
    const issues = lintModel(withUids(model()), [], ['web', 'data-jpa', 'h2'])
    const setting = issues.find(i => i.rule === 'sql-keyword' && i.message.startsWith('Setting'))!
    expect(setting.severity).toBe('info')
    expect(setting.message).toContain('values, key, order are keywords on H2')
    expect(setting.message).not.toContain('comment')
    // PostgreSQL takes key bare.
    const onPostgres = lintModel(withUids(model()), [], ['postgresql']).find(i => i.rule === 'sql-keyword' && i.message.startsWith('Setting'))!
    expect(onPostgres.message).toContain('values, order are keywords on PostgreSQL')
  })

  it('warns that a link to an entity whose table has to be quoted shows its id', () => {
    const issue = lintModel(withUids(model()), [], []).find(i => i.rule === 'quoted-table-label')!
    expect(issue.severity).toBe('warn')
    expect(issue.message).toContain('Setting’s table (values) has to be quoted on H2, so Batch.setting will show its id')
    // Named something a formula can write, there is nothing to say.
    const renamed = model()
    renamed[0].tableName = 'settings'
    expect(lintModel(withUids(renamed), [], []).some(i => i.rule === 'quoted-table-label')).toBe(false)
  })

  it('says how a field computed from the clock is kept', () => {
    const withFormula = (formula: string) => lintModel(withUids([{
      name: 'Ticket',
      fields: [pk, { name: 'openedOn', type: 'LOCAL_DATE' }, { name: 'daysOpen', type: 'INTEGER', formula }],
    }]), [], []).find(i => i.rule === 'computed-clock')
    expect(withFormula('daysBetween(openedOn, today())')?.message).toContain('shows it as it stands now')
    expect(withFormula('daysBetween(project.startsOn, today())')?.message).toContain('stays that way until the next save')
    expect(withFormula('daysBetween(openedOn, openedOn)')).toBeUndefined()
  })
})

describe('validation: names the server refuses for the project’s database', () => {
  it('refuses a column every table of the database already has', () => {
    const entities: FullstackEntityDef[] = [{ name: 'Entry', fields: [pk, { name: 'xmin', type: 'INTEGER' }] }]
    expect(validateEntities(entities, [], { deps: ['postgresql'] }).entities[0].fields[1].name)
      .toBe('xmin is a column every table on PostgreSQL already has — give the field another name or a column of its own')
    expect(validateEntities(entities, [], { deps: ['h2'] }).count).toBe(0)
    // Without a dependency list nothing is known about the database.
    expect(validateEntities(entities).count).toBe(0)
  })

  it('refuses a child list over a table that has to be quoted', () => {
    const counted = validateEntities(model(), ['inverseCollections'], { deps: ['h2'] })
    expect(counted.entities[1].tableName).toContain('Batch’s table (user) has to be quoted on H2')
    expect(counted.count).toBe(1)
    // Not counted, not refused; and a declared one-to-many counts it as the option does.
    expect(validateEntities(model(), [], { deps: ['h2'] }).count).toBe(0)
    const declared = model()
    declared[0].relations = [{ type: 'ONE_TO_MANY', fieldName: 'batches', targetEntity: 'Batch' }]
    expect(validateEntities(declared, [], { deps: ['h2'] }).entities[1].tableName).toBeDefined()
    declared[1].tableName = 'batches'
    expect(validateEntities(declared, [], { deps: ['h2'] }).count).toBe(0)
  })
})
