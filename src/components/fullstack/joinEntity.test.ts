import { describe, it, expect } from 'vitest'
import { joinEntity } from './joinEntity'
import { lintModel } from './lint'
import { validateEntities } from './validation'
import { withUids } from './uid'
import type { FullstackEntityDef } from '../../types'

const pk: FullstackEntityDef['fields'][number] = { name: 'id', type: 'LONG', primaryKey: true, generated: true }
const order: FullstackEntityDef = { name: 'Order', fields: [pk, { name: 'ref', type: 'STRING' }] }
const product: FullstackEntityDef = { name: 'Product', fields: [pk, { name: 'name', type: 'STRING' }] }

describe('joinEntity', () => {
  it('builds <Owner><Target> with a generated key and two required relations', () => {
    const join = joinEntity('Order', 'Product', ['Order', 'Product'])
    expect(join.name).toBe('OrderProduct')
    expect(join.fields).toEqual([expect.objectContaining({ name: 'id', type: 'LONG', primaryKey: true, generated: true })])
    expect(join.relations?.map(r => [r.fieldName, r.targetEntity, r.required])).toEqual([
      ['order', 'Order', true],
      ['product', 'Product', true],
    ])
    expect(join.uid && join.fields[0].uid && join.relations?.every(r => r.uid)).toBeTruthy()
  })

  it('uniquifies the name against existing entities and keeps a self-join valid', () => {
    expect(joinEntity('Order', 'Product', ['Order', 'Product', 'OrderProduct']).name).toBe('OrderProduct2')
    const self = joinEntity('Employee', 'Employee', ['Employee'])
    expect(self.name).toBe('EmployeeEmployee')
    expect(self.relations?.map(r => r.fieldName)).toEqual(['employee', 'employee2'])
  })

  it('validates cleanly; until it has a column of its own, lint only says a many-to-many would do', () => {
    const model = withUids([order, product, joinEntity('Order', 'Product', ['Order', 'Product'])])
    expect(validateEntities(model).count).toBe(0)
    const mine = lintModel(model, [], []).filter(i => i.entityUid === model[2].uid)
    expect(mine.map(i => [i.rule, i.severity])).toEqual([['join-entity-to-m2m', 'info']])
    // The thing a join entity is for: something about each link.
    const withQuantity = model.map((e, i) => i === 2 ? { ...e, fields: [...e.fields, { uid: 'q', name: 'quantity', type: 'INTEGER' as const }] } : e)
    expect(lintModel(withQuantity, [], []).filter(i => i.entityUid === model[2].uid)).toEqual([])
  })
})
