import { useState, type DragEvent } from 'react'

/**
 * Native HTML5 drag-and-drop reordering for the editor's lists (entities, each entity's fields,
 * relations), without a dependency. One hook instance serves any number of lists, told apart by
 * a `list` key, because the entity cards are rendered in a loop where a per-list hook can't live.
 *
 * Only the grip handle is `draggable` (rows are full of inputs, and dragging from a text field
 * would fight text selection); the whole row is the drop target. The drop position is decided by
 * the pointer's vertical position within the row — upper half = before it, lower half = after it —
 * and `onMove(list, from, to)` receives the final index the row lands on (as `moveItem` expects).
 */
export type DropPosition = 'before' | 'after'

export interface DragReorder {
  /** Spread on the grip element. */
  handleProps(list: string, index: number): {
    draggable: true
    onDragStart: (e: DragEvent<HTMLElement>) => void
    onDragEnd: () => void
  }
  /** Spread on the row (drop target). */
  rowProps(list: string, index: number): {
    onDragOver: (e: DragEvent<HTMLElement>) => void
    onDragLeave: (e: DragEvent<HTMLElement>) => void
    onDrop: (e: DragEvent<HTMLElement>) => void
  }
  /** Where the dragged row would land relative to this row, while it hovers over it. */
  indicatorFor(list: string, index: number): DropPosition | null
  /** True for the row being dragged (so it can be dimmed). */
  isDragging(list: string, index: number): boolean
}

interface Hover { list: string; index: number; position: DropPosition }

function positionIn(e: DragEvent<HTMLElement>): DropPosition {
  const rect = e.currentTarget.getBoundingClientRect()
  return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

export function useDragReorder(onMove: (list: string, from: number, to: number) => void): DragReorder {
  const [drag, setDrag] = useState<{ list: string; index: number } | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)

  return {
    handleProps(list, index) {
      return {
        draggable: true,
        onDragStart: e => {
          e.dataTransfer.effectAllowed = 'move'
          // Some browsers need data set for the drag to start at all.
          e.dataTransfer.setData('text/plain', `${list}:${index}`)
          setDrag({ list, index })
        },
        onDragEnd: () => { setDrag(null); setHover(null) },
      }
    },
    rowProps(list, index) {
      return {
        onDragOver: e => {
          if (!drag || drag.list !== list) return
          e.preventDefault() // allows the drop
          e.dataTransfer.dropEffect = 'move'
          const position = positionIn(e)
          setHover(prev => prev && prev.list === list && prev.index === index && prev.position === position
            ? prev : { list, index, position })
        },
        onDragLeave: e => {
          // dragleave also fires when moving between a row's children — only clear on a real exit.
          const next = e.relatedTarget as Node | null
          if (next && e.currentTarget.contains(next)) return
          setHover(prev => prev && prev.list === list && prev.index === index ? null : prev)
        },
        onDrop: e => {
          if (!drag || drag.list !== list) return
          e.preventDefault()
          const position = positionIn(e)
          let to = position === 'before' ? index : index + 1
          if (drag.index < to) to -= 1 // removing the source shifts everything after it up by one
          if (to !== drag.index) onMove(list, drag.index, to)
          setDrag(null)
          setHover(null)
        },
      }
    },
    indicatorFor(list, index) {
      if (!hover || hover.list !== list || hover.index !== index) return null
      // Hovering the dragged row itself (or the slot it already occupies) moves nothing — no line.
      if (drag && drag.list === list && (drag.index === index
        || (hover.position === 'after' && drag.index === index + 1)
        || (hover.position === 'before' && drag.index === index - 1))) return null
      return hover.position
    },
    isDragging(list, index) {
      return drag !== null && drag.list === list && drag.index === index
    },
  }
}

/** Tailwind classes for the drop-line on a row. Replaces the row's own top/bottom border classes,
 *  so callers should switch between their normal border and this rather than concatenate. */
export function dropIndicatorClass(position: DropPosition | null): string {
  if (position === 'before') return 'border-t-2 border-t-primary'
  if (position === 'after') return 'border-b-2 border-b-primary'
  return ''
}
