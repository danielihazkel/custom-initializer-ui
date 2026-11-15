import { describe, expect, it } from 'vitest'
import type { FullstackEntityDef } from '../../types'
import { renameEntityInRelations } from './relationRefs'

const id = { name: 'id', type: 'LONG' as const, primaryKey: true, generated: true }

const model = (): FullstackEntityDef[] => [
  { name: 'Customer', fields: [id] },
  { name: 'Product', fields: [id] },
  {
    name: 'Order', fields: [id], relations: [
      { type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer', required: true },
      { type: 'MANY_TO_ONE', fieldName: 'product', targetEntity: 'Product' },
    ],
  },
  { name: 'Invoice', fields: [id], relations: [{ type: 'MANY_TO_ONE', fieldName: 'billedTo', targetEntity: 'customer' }] },
]

describe('renameEntityInRelations', () => {
  it('re-aims every relation at the renamed entity, whatever its case', () => {
    const next = renameEntityInRelations(model(), 'Customer', 'Client')
    expect(next[2].relations!.map(r => r.targetEntity)).toEqual(['Client', 'Product'])
    expect(next[3].relations![0].targetEntity).toBe('Client')
  })

  it('keeps the rest of each relation and leaves other entities as they were', () => {
    const before = model()
    const next = renameEntityInRelations(before, 'Customer', 'Client')
    expect(next[2].relations![0]).toEqual({ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Client', required: true })
    expect(next[0]).toBe(before[0])
    expect(next[1]).toBe(before[1])
  })

  it('returns the same array when nothing points at the old name', () => {
    const before = model()
    expect(renameEntityInRelations(before, 'Warehouse', 'Depot')).toBe(before)
  })

  it('does nothing for a blank or unchanged name', () => {
    const before = model()
    expect(renameEntityInRelations(before, 'Customer', '  ')).toBe(before)
    expect(renameEntityInRelations(before, '', 'Client')).toBe(before)
    expect(renameEntityInRelations(before, 'Customer', 'Customer')).toBe(before)
  })
})
