import { describe, it, expect } from 'vitest'
import { emptyHistory, popUndo, pushUndo, record, redoStep, undoStep } from './undo'

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

describe('undo/redo history', () => {
  it('walks back and forward through recorded edits', () => {
    // states: 0 --edit a--> 1 --edit b--> 2 (live)
    let h = record(emptyHistory<number>(), { label: 'a', snapshot: 0 })
    h = record(h, { label: 'b', snapshot: 1 })

    const u1 = undoStep(h, 2)!
    expect(u1.restore).toEqual({ label: 'b', snapshot: 1 })
    expect(u1.history.future).toEqual([{ label: 'b', snapshot: 2 }])

    const u2 = undoStep(u1.history, 1)!
    expect(u2.restore.snapshot).toBe(0)
    expect(undoStep(u2.history, 0)).toBeNull()

    const r1 = redoStep(u2.history, 0)!
    expect(r1.restore).toEqual({ label: 'a', snapshot: 1 })
    expect(r1.history.past).toEqual([{ label: 'a', snapshot: 0 }])
    const r2 = redoStep(r1.history, 1)!
    expect(r2.restore.snapshot).toBe(2)
    expect(redoStep(r2.history, 2)).toBeNull()
  })

  it('a new edit after an undo discards the redo branch', () => {
    let h = record(emptyHistory<number>(), { label: 'a', snapshot: 0 })
    h = undoStep(h, 1)!.history
    expect(h.future).toHaveLength(1)
    h = record(h, { label: 'c', snapshot: 0 })
    expect(h.future).toEqual([])
    expect(h.past.map(e => e.label)).toEqual(['c'])
  })
})
