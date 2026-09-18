import { describe, it, expect } from 'vitest'
import { toCamelCase, toPascalCase } from './naming'

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
