import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackRelationDef } from '../../types'
import { linkIndexKey, linkKey, linksBetween, parseLinkIndex, renameLinkInChildLists, resolveLink } from './childLists'
import { validateEntities } from './validation'
import { summarizeEntity } from './summary'

const id = { name: 'id', type: 'LONG' as const, primaryKey: true, generated: true }
const name = { name: 'name', type: 'STRING' as const }

const account: FullstackEntityDef = { name: 'Account', fields: [id, name] }
const transfer: FullstackEntityDef = {
  name: 'Transfer', fields: [id],
  relations: [
    { type: 'MANY_TO_ONE', fieldName: 'source', targetEntity: 'Account', required: true },
    { type: 'MANY_TO_ONE', fieldName: 'target', targetEntity: 'account', required: true },
    { type: 'MANY_TO_MANY', fieldName: 'watchers', targetEntity: 'Account' },
  ],
}
const order: FullstackEntityDef = { name: 'Order', fields: [id, name] }
const line: FullstackEntityDef = {
  name: 'OrderLine', fields: [id],
  relations: [{ type: 'MANY_TO_ONE', fieldName: 'order', targetEntity: 'Order', required: true }],
}

const list = (over: Partial<FullstackRelationDef>): FullstackRelationDef =>
  ({ type: 'ONE_TO_MANY', fieldName: 'lines', targetEntity: 'OrderLine', ...over })

describe('the links a one-to-many can read', () => {
  it('are the target’s foreign keys to the owner, whatever the case — never its sets', () => {
    expect(linksBetween(transfer, 'Account')).toEqual(['source', 'target'])
    expect(linksBetween(line, 'order')).toEqual(['order'])
    expect(linksBetween(line, 'Account')).toEqual([])
    expect(linksBetween(undefined, 'Account')).toEqual([])
  })

  it('travel as one string, so a card compares them by value', () => {
    const index = parseLinkIndex(linkIndexKey([account, transfer, order, line]))
    expect(index.get(linkKey('Transfer', 'Account'))).toEqual(['source', 'target'])
    expect(index.get(linkKey('orderline', 'ORDER'))).toEqual(['order'])
    expect(index.get(linkKey('Order', 'OrderLine'))).toBeUndefined()
    expect(parseLinkIndex('').size).toBe(0)
  })

  it('resolve to the one named, else the only one — and say which control to fix otherwise', () => {
    expect(resolveLink(list({}), 'Order', ['order'])).toEqual({ mappedBy: 'order' })
    expect(resolveLink(list({ mappedBy: 'ORDER' }), 'Order', ['order'])).toEqual({ mappedBy: 'order' })
    expect(resolveLink(list({}), 'Order', []).problem).toEqual({
      on: 'targetEntity', message: 'OrderLine has no many-to-one to Order — add that relation to OrderLine first',
    })
    expect(resolveLink(list({ targetEntity: 'Transfer' }), 'Account', ['source', 'target']).problem).toEqual({
      on: 'mappedBy', message: 'Transfer links here more than once — pick one: source, target',
    })
    expect(resolveLink(list({ mappedBy: 'sender', targetEntity: 'Transfer' }), 'Account', ['source', 'target']).problem?.on).toBe('mappedBy')
  })

  it('follow a rename of the link they name', () => {
    const entities: FullstackEntityDef[] = [
      { ...account, relations: [list({ fieldName: 'outgoing', targetEntity: 'Transfer', mappedBy: 'source' }), list({ fieldName: 'incoming', targetEntity: 'Transfer', mappedBy: 'target' })] },
      transfer,
    ]
    const renamed = renameLinkInChildLists(entities, 'Transfer', 'source', 'payer')
    expect(renamed[0].relations?.map(r => r.mappedBy)).toEqual(['payer', 'target'])
    expect(renamed[1]).toBe(transfer)
    // Nothing named it: the same array, so nothing re-renders.
    expect(renameLinkInChildLists(entities, 'Transfer', 'memo', 'note')).toBe(entities)
    expect(renameLinkInChildLists(entities, 'Order', 'source', 'payer')).toBe(entities)
  })
})

describe('validating a one-to-many', () => {
  const errorsOf = (owner: FullstackEntityDef, rest: FullstackEntityDef[]) => validateEntities([owner, ...rest]).entities[0]?.relations

  it('accepts a list whose link is the only one, or named', () => {
    expect(validateEntities([{ ...order, relations: [list({})] }, line]).count).toBe(0)
    expect(validateEntities([
      { ...account, relations: [list({ fieldName: 'outgoing', targetEntity: 'Transfer', mappedBy: 'source' }), list({ fieldName: 'incoming', targetEntity: 'Transfer', mappedBy: 'target' })] },
      transfer,
    ]).count).toBe(0)
  })

  it('lists rows keyed any way: a composite-key child is fine', () => {
    const composite: FullstackEntityDef = {
      name: 'OrderLine', fields: [{ name: 'orderNo', type: 'LONG', primaryKey: true }, { name: 'lineNo', type: 'INTEGER', primaryKey: true }],
      relations: line.relations,
    }
    expect(validateEntities([{ ...order, relations: [list({})] }, composite]).count).toBe(0)
  })

  it('says what is missing under the control that fixes it', () => {
    expect(errorsOf({ ...order, relations: [list({ targetEntity: 'Account' })] }, [account])?.[0].targetEntity)
      .toBe('Account has no many-to-one to Order — add that relation to Account first')
    expect(errorsOf({ ...account, relations: [list({ targetEntity: 'Transfer' })] }, [transfer])?.[0].mappedBy)
      .toContain('pick one: source, target')
    expect(errorsOf({ ...account, relations: [list({ targetEntity: 'Transfer', mappedBy: 'sender' })] }, [transfer])?.[0].mappedBy)
      .toBe("Transfer has no many-to-one 'sender' to Account")
    const twice = errorsOf({ ...order, relations: [list({}), list({ fieldName: 'items', mappedBy: 'order' })] }, [line])
    expect(twice?.[0]).toBeUndefined()
    expect(twice?.[1].mappedBy).toBe('Lists the same rows as another one-to-many of this entity')
  })

  it('is not a column of the owner and not one of its filters', () => {
    // A field may spell the column a foreign key of that name would have had.
    const owner: FullstackEntityDef = { ...order, fields: [id, { name: 'legacy', type: 'LONG', column: 'lines_id' }], relations: [list({})] }
    expect(validateEntities([owner, line]).count).toBe(0)
    expect(summarizeEntity({ ...order, relations: [list({})] }, []).filters).not.toContain('linesId')
    expect(summarizeEntity(line, []).filters).toContain('orderId')
  })
})
