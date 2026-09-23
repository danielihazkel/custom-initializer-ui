import { describe, it, expect } from 'vitest'
import { reconcileKeys } from './rowKeys'

type Row = { id: string }
const id = (r: Row) => r.id

describe('reconcileKeys', () => {
  const a = { id: 'a' }; const b = { id: 'b' }; const c = { id: 'c' }

  it('keeps each row’s key through a reorder and a removal', () => {
    expect(reconcileKeys([a, b, c], ['ka', 'kb', 'kc'], [c, a, b], id)).toEqual(['kc', 'ka', 'kb'])
    expect(reconcileKeys([a, b, c], ['ka', 'kb', 'kc'], [a, c], id)).toEqual(['ka', 'kc'])
  })

  it('matches rebuilt rows by identity, and an edited row by its position', () => {
    // An undo rebuilds every object; the ids still match.
    expect(reconcileKeys([a, b], ['ka', 'kb'], [{ id: 'b' }, { id: 'a' }], id)).toEqual(['kb', 'ka'])
    // Renaming a row changes its id, but it stays where it was.
    expect(reconcileKeys([a, b], ['ka', 'kb'], [{ id: 'renamed' }, b], id)).toEqual(['ka', 'kb'])
  })

  it('mints a key for an inserted row without stealing its neighbour’s', () => {
    const keys = reconcileKeys([a, b], ['ka', 'kb'], [a, { id: 'new' }, b], id)
    expect(keys[0]).toBe('ka')
    expect(keys[2]).toBe('kb')
    expect(keys[1]).not.toMatch(/^k[ab]$/)
  })
})
