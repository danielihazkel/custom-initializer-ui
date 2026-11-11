import { describe, it, expect } from 'vitest'
import { inverseCollectionName, relationLabel, toCamelCase, toPascalCase } from './naming'

describe('inverseCollectionName mirrors EntityScaffoldContext.inverseCollectionName', () => {
  it('is the owner\'s plural for a single link', () => {
    expect(inverseCollectionName('OrderLine', 'order', 'Order', [{ targetEntity: 'Order' }, { targetEntity: 'Product' }]))
      .toBe('orderLines')
  })

  it('tells two links to one target apart by their relation', () => {
    const links = [{ targetEntity: 'Account' }, { targetEntity: 'account' }]
    expect(inverseCollectionName('Transfer', 'source', 'Account', links)).toBe('transfersBySource')
    expect(inverseCollectionName('Transfer', 'target', 'Account', links)).toBe('transfersByTarget')
  })
})

describe('toPascalCase / toCamelCase mirror gen/Naming.java', () => {
  it('handles separators, camel humps and all-caps identifiers', () => {
    expect(toPascalCase('order_item')).toBe('OrderItem')
    expect(toPascalCase('order-item')).toBe('OrderItem')
    expect(toPascalCase('orderItem')).toBe('OrderItem')
    expect(toPascalCase('OrderItem')).toBe('OrderItem')
    expect(toPascalCase('TD_APP_STP')).toBe('TdAppStp')
    expect(toPascalCase('')).toBe('')
    expect(toCamelCase('OrderItem')).toBe('orderItem')
    expect(toCamelCase('order_item')).toBe('orderItem')
    expect(toCamelCase('')).toBe('')
  })
})

describe('relationLabel', () => {
  it('is the label of the relation, else its field name in words', () => {
    expect(relationLabel({ fieldName: 'billTo' })).toBe('Bill to')
    expect(relationLabel({ fieldName: 'billTo', label: '   ' })).toBe('Bill to')
    expect(relationLabel({ fieldName: 'customer', label: ' Client ' })).toBe('Client')
  })
})
