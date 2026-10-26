import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import {
  describePresetValue, keptPresetFilter, presetValueProblem, relationOfPresetKey, relationPresetProblem,
  renameRelationInPages, validatePages,
} from './pageLayout'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  { name: 'Region', fields: [{ name: 'code', type: 'STRING', primaryKey: true }] },
  {
    name: 'Order',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID', 'SHIPPED'] },
      { name: 'urgent', type: 'BOOLEAN' },
    ],
    relations: [
      { type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' },
      { type: 'MANY_TO_ONE', fieldName: 'region', targetEntity: 'Region' },
    ],
  },
]
const order = entities[2]
const status = order.fields[1]

const problems = (presetFilter: Record<string, string>) => validatePages(
  [{ id: 'orders', type: 'entity-list', entity: 'Order', presetFilter }], entities).problems

describe('multi-value and relation presets', () => {
  it('takes any of several enum values, but one boolean', () => {
    expect(presetValueProblem(status, 'OPEN,PAID')).toBeUndefined()
    expect(presetValueProblem(status, 'OPEN,LOST')).toBe('“LOST” is not one of the values of status')
    expect(presetValueProblem(status, 'OPEN,')).toBe('has an empty value')
    expect(presetValueProblem(order.fields[2], 'true,false')).toBe('expected true or false')
    expect(describePresetValue(status, 'OPEN,PAID')).toBe('OPEN or PAID')
  })

  it('checks relation ids against the target key, keyed by the filter param', () => {
    expect(relationOfPresetKey(order, 'customerId')?.fieldName).toBe('customer')
    expect(relationOfPresetKey(order, 'Customer')?.fieldName).toBe('customer')
    expect(relationOfPresetKey(order, 'status')).toBeUndefined()
    expect(relationPresetProblem('3, 7', entities[0])).toBeUndefined()
    expect(relationPresetProblem('3,x', entities[0])).toBe('“x” is not a whole number')
    expect(relationPresetProblem('north', entities[1])).toBeUndefined()
    expect(relationPresetProblem('a b', entities[1])).toBe('“a b” may hold only letters, digits and . _ ~ -')

    expect(problems({ customerId: '3,7', status: 'OPEN,PAID' })).toEqual([])
    expect(problems({ customerId: 'abc' })).toEqual(['Page “orders” filters customer on “abc”, which “abc” is not a whole number'])
    expect(problems({ buyerId: '1' })).toEqual(['Page “orders” filters on “buyerId”, which Order no longer has'])
  })

  it('keeps relation presets across a retarget and follows a relation rename', () => {
    expect(keptPresetFilter({ customerId: '3', status: 'OPEN,PAID' }, order)).toEqual({ customerId: '3', status: 'OPEN,PAID' })
    expect(keptPresetFilter({ customerId: '3' }, entities[0])).toBeUndefined()

    const pages: FullstackPageDef[] = [
      { id: 'orders', type: 'entity-list', entity: 'Order', presetFilter: { customerId: '3' } },
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order', presetFilter: { customerId: '3' } }] },
    ]
    const renamed = renameRelationInPages(pages, 'Order', 'customer', 'buyer')
    expect(renamed[0].presetFilter).toEqual({ buyerId: '3' })
    expect(renamed[1].widgets?.[0].presetFilter).toEqual({ buyerId: '3' })
  })
})
