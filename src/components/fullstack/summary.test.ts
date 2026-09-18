import { describe, it, expect } from 'vitest'
import { entityOptApplicability, summarizeEntity } from './summary'
import { pluralize, toKebabCase, toSnakeCase } from './naming'
import { moveItem } from './reorder'

describe('naming mirrors gen/Naming.java', () => {
  it('snake / kebab / plural', () => {
    expect(toSnakeCase('OrderItem')).toBe('order_item')
    expect(toSnakeCase('TD_APP_STP')).toBe('td_app_stp')
    expect(toKebabCase('OrderItem')).toBe('order-item')
    expect(pluralize('category')).toBe('categories')
    expect(pluralize('box')).toBe('boxes')
    expect(pluralize('status')).toBe('statuses')
    expect(pluralize('orders')).toBe('orders')
    expect(pluralize('day')).toBe('days')
  })
})

describe('summarizeEntity', () => {
  it('derives endpoints, views, search and filters from the field metadata', () => {
    const s = summarizeEntity({
      name: 'OrderItem',
      listViews: ['table', 'kanban', 'calendar'],
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true, generated: true },
        { name: 'title', type: 'STRING' },
        { name: 'body', type: 'TEXT', searchable: false },
        { name: 'status', type: 'ENUM', enumValues: ['A', 'B'] },
        { name: 'qty', type: 'INTEGER', filterable: false },
        { name: 'shipOn', type: 'LOCAL_DATE' },
      ],
      relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
    })
    expect(s.path).toBe('/api/order-items')
    expect(s.verbs).toEqual(['GET', 'POST', 'PUT', 'DELETE'])
    expect(s.views).toEqual([{ name: 'table' }, { name: 'kanban', by: 'status' }, { name: 'calendar', by: 'shipOn' }])
    expect(s.search).toEqual(['title'])
    expect(s.filters).toEqual(['status', 'shipOn', 'customerId'])
  })

  it('drops kanban on a read-only entity and falls back to table when nothing survives', () => {
    const s = summarizeEntity({
      name: 'Report', readOnly: true, listViews: ['kanban'],
      fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'flag', type: 'BOOLEAN' }],
    })
    expect(s.verbs).toEqual(['GET'])
    expect(s.views).toEqual([{ name: 'table' }])
  })
})

describe('moveItem', () => {
  it('moves within bounds and copies otherwise', () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
    expect(moveItem([1, 2, 3], 2, 1)).toEqual([1, 3, 2])
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
  })
})

describe('entityOptApplicability mirrors the *Applicable flags in EntityScaffoldContext', () => {
  const pk = { name: 'id', type: 'LONG' as const, primaryKey: true, generated: true }
  it('everything applies to a plain writable entity with an editable field', () => {
    const a = entityOptApplicability({ name: 'Order', fields: [pk, { name: 'total', type: 'BIG_DECIMAL' }] })
    expect(Object.values(a).every(v => v.applicable)).toBe(true)
  })
  it('composite keys lose soft delete and the bulk ops but keep audit', () => {
    const a = entityOptApplicability({ name: 'Line', fields: [
      { name: 'orderId', type: 'LONG', primaryKey: true }, { name: 'sku', type: 'STRING', primaryKey: true }, { name: 'qty', type: 'INTEGER' },
    ] })
    expect(a.audit.applicable).toBe(true)
    expect(a.softDelete).toEqual({ applicable: false, reason: 'composite primary key' })
    expect(a.bulkDelete.reason).toBe('composite primary key')
    expect(a.bulkUpdate.reason).toBe('composite primary key')
  })
  it('read-only entities and views lose every write-side flag, naming the cause', () => {
    const ro = entityOptApplicability({ name: 'Log', readOnly: true, fields: [pk, { name: 'msg', type: 'STRING' }] })
    expect(ro.audit).toEqual({ applicable: false, reason: 'read-only entity' })
    const view = entityOptApplicability({ name: 'Stats', viewQuery: 'select 1 as id', fields: [pk] })
    expect(view.softDelete.reason).toBe('SELECT-backed view')
    expect(view.csvExport.applicable).toBe(true)
    expect(view.tests.applicable).toBe(true)
  })
  it('bulk edit needs at least one editable non-key field', () => {
    const a = entityOptApplicability({ name: 'Tag', fields: [pk, { name: 'code', type: 'STRING', readOnly: true }] })
    expect(a.bulkUpdate).toEqual({ applicable: false, reason: 'no editable field' })
    expect(a.bulkDelete.applicable).toBe(true)
  })
})
