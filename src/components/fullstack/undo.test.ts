import { describe, it, expect } from 'vitest'
import { popUndo, pushUndo } from './undo'

describe('undo stack', () => {
  it('pushes newest last and pops it first', () => {
    let stack = pushUndo([], { label: 'a', snapshot: 1 })
    stack = pushUndo(stack, { label: 'b', snapshot: 2 })
    const { entry, rest } = popUndo(stack)
    expect(entry).toEqual({ label: 'b', snapshot: 2 })
    expect(rest).toEqual([{ label: 'a', snapshot: 1 }])
  })

  it('drops the oldest entries beyond the bound', () => {
    let stack: ReturnType<typeof pushUndo<number>> = []
    for (let i = 0; i < 5; i++) stack = pushUndo(stack, { label: String(i), snapshot: i }, 3)
    expect(stack.map(e => e.snapshot)).toEqual([2, 3, 4])
  })

  it('popping an empty stack yields null and the same stack', () => {
    const { entry, rest } = popUndo<number>([])
    expect(entry).toBeNull()
    expect(rest).toEqual([])
  })
})
