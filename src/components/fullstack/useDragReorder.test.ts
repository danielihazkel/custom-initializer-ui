import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { dropIndicatorClass, useDragReorder } from './useDragReorder'
import type { DragEvent } from 'react'

/** A minimal DragEvent: the hook only reads clientY, the row's rect, and dataTransfer. */
function dragEvent(clientY: number, top = 0, height = 20): DragEvent<HTMLElement> {
  const currentTarget = {
    getBoundingClientRect: () => ({ top, height, bottom: top + height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) }),
    contains: () => false,
  } as unknown as HTMLElement
  return {
    clientY,
    currentTarget,
    relatedTarget: null,
    preventDefault: vi.fn(),
    dataTransfer: { effectAllowed: '', dropEffect: '', setData: vi.fn() },
  } as unknown as DragEvent<HTMLElement>
}

describe('useDragReorder', () => {
  it('drops a row after a later row: to = target index (source removal shifts the rest up)', () => {
    const onMove = vi.fn()
    const { result } = renderHook(() => useDragReorder(onMove))
    act(() => result.current.handleProps('fields', 0).onDragStart(dragEvent(5)))
    expect(result.current.isDragging('fields', 0)).toBe(true)
    // Lower half of row 2 → "after" row 2 → index 3 before removal, 2 after.
    act(() => result.current.rowProps('fields', 2).onDrop(dragEvent(15)))
    expect(onMove).toHaveBeenCalledWith('fields', 0, 2)
    expect(result.current.isDragging('fields', 0)).toBe(false)
  })

  it('drops a row before an earlier row: to = target index', () => {
    const onMove = vi.fn()
    const { result } = renderHook(() => useDragReorder(onMove))
    act(() => result.current.handleProps('fields', 3).onDragStart(dragEvent(5)))
    // Upper half of row 1 → "before" row 1.
    act(() => result.current.rowProps('fields', 1).onDrop(dragEvent(3)))
    expect(onMove).toHaveBeenCalledWith('fields', 3, 1)
  })

  it('ignores drops onto a different list and no-op drops onto its own slot', () => {
    const onMove = vi.fn()
    const { result } = renderHook(() => useDragReorder(onMove))
    act(() => result.current.handleProps('a', 1).onDragStart(dragEvent(5)))
    act(() => result.current.rowProps('b', 0).onDrop(dragEvent(3)))
    expect(onMove).not.toHaveBeenCalled()
    act(() => result.current.handleProps('a', 1).onDragStart(dragEvent(5)))
    // "after" row 0 is exactly where row 1 already sits.
    act(() => result.current.rowProps('a', 0).onDrop(dragEvent(15)))
    expect(onMove).not.toHaveBeenCalled()
  })

  it('shows the drop line on the hovered row and hides it for slots that would not move anything', () => {
    const { result } = renderHook(() => useDragReorder(vi.fn()))
    act(() => result.current.handleProps('a', 0).onDragStart(dragEvent(5)))
    act(() => result.current.rowProps('a', 2).onDragOver(dragEvent(3)))
    expect(result.current.indicatorFor('a', 2)).toBe('before')
    expect(result.current.indicatorFor('a', 1)).toBeNull()
    act(() => result.current.rowProps('a', 1).onDragOver(dragEvent(3)))
    // "before" row 1 is where row 0 already is.
    expect(result.current.indicatorFor('a', 1)).toBeNull()
    act(() => result.current.handleProps('a', 0).onDragEnd())
    expect(result.current.indicatorFor('a', 2)).toBeNull()
  })

  it('maps positions to the border classes', () => {
    expect(dropIndicatorClass('before')).toContain('border-t-2')
    expect(dropIndicatorClass('after')).toContain('border-b-2')
    expect(dropIndicatorClass(null)).toBe('')
  })
})
