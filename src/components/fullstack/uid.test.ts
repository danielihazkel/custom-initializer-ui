import { describe, it, expect } from 'vitest'
import { withUids, stripUids, cloneWithNewUids, newUid, reconcileUids } from './uid'
import type { FullstackEntityDef } from '../../types'

const entity: FullstackEntityDef = {
  name: 'Order',
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true, generated: true },
    { name: 'status', type: 'ENUM', enumValues: ['NEW', 'DONE'] },
  ],
  relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
}

describe('uid helpers', () => {
  it('withUids stamps every entity, field and relation and preserves existing uids', () => {
    const [stamped] = withUids([entity])
    expect(stamped.uid).toBeTruthy()
    expect(stamped.fields.every(f => f.uid)).toBe(true)
    expect(stamped.relations?.every(r => r.uid)).toBe(true)
    const [again] = withUids([stamped])
    expect(again.uid).toBe(stamped.uid)
    expect(again.fields[0].uid).toBe(stamped.fields[0].uid)
  })

  it('stripUids removes uids at every level so the wire payload matches the DTOs', () => {
    const [stripped] = stripUids(withUids([entity]))
    expect(stripped).not.toHaveProperty('uid')
    for (const f of stripped.fields) expect(f).not.toHaveProperty('uid')
    for (const r of stripped.relations ?? []) expect(r).not.toHaveProperty('uid')
    expect(stripped).toEqual(entity)
  })

  it('cloneWithNewUids yields distinct uids and does not share nested arrays', () => {
    const [src] = withUids([entity])
    const copy = cloneWithNewUids(src)
    expect(copy.uid).not.toBe(src.uid)
    expect(copy.fields[1].uid).not.toBe(src.fields[1].uid)
    expect(copy.fields[1].enumValues).not.toBe(src.fields[1].enumValues)
    expect(copy.fields[1].enumValues).toEqual(src.fields[1].enumValues)
  })

  it('newUid is unique across calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newUid()))
    expect(ids.size).toBe(200)
  })
})

describe('stripUids drops the client-only sourceSql', () => {
  it('keeps the imported DDL out of the wire payload, presets and share links', () => {
    const [stripped] = stripUids(withUids([{ ...entity, sourceSql: 'CREATE TABLE orders (id BIGINT)' }]))
    expect(stripped).not.toHaveProperty('sourceSql')
    expect(stripped).toEqual(entity)
  })
})

describe('reconcileUids', () => {
  it('keeps the uid of rows that survive an undo, matching by name then by position', () => {
    const [order, customer] = withUids([entity, { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }] }])
    // The restored snapshot has no uids, a renamed second field and the entities swapped.
    const restored: FullstackEntityDef[] = [
      { name: 'customer', fields: [{ name: 'ID', type: 'LONG', primaryKey: true }] },
      { name: 'Order', fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }, { name: 'state', type: 'ENUM', enumValues: ['NEW'] }], relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }] },
    ]
    const [c, o] = reconcileUids([order, customer], restored)
    expect(c.uid).toBe(customer.uid)
    expect(c.fields[0].uid).toBe(customer.fields[0].uid)
    expect(o.uid).toBe(order.uid)
    expect(o.fields[0].uid).toBe(order.fields[0].uid)
    expect(o.fields[1].uid).toBe(order.fields[1].uid) // renamed → positional fallback
    expect(o.relations?.[0].uid).toBe(order.relations?.[0].uid)
  })

  it('gives unmatched rows fresh uids and never hands out the same uid twice', () => {
    const [order] = withUids([entity])
    const [a, b] = reconcileUids([order], [{ ...entity }, { name: 'Order', fields: [] }])
    expect(a.uid).toBe(order.uid)
    expect(b.uid).toBeTruthy()
    expect(b.uid).not.toBe(order.uid)
  })
})
