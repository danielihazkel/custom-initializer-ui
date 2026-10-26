import type { DragEvent } from 'react'
import type { FullstackPageType, FullstackWidgetDef } from '../../../types'

/** What the library hands the canvas or the page strip while one of its cards is dragged. */
export type LibraryDrag =
  /** A widget kind, or (`def`) a suggested widget with its settings. */
  | { kind: 'widget'; widget: FullstackWidgetDef['kind']; def?: FullstackWidgetDef }
  | { kind: 'page'; type: FullstackPageType; pick?: string }
  | { kind: 'suggestion'; key: string }
  | { kind: 'my-template'; name: string }

export const LAYOUT_DRAG_MIME = 'application/x-menora-layout'

/** Starts a library drag. The payload rides on the event too (some browsers need data set for
 *  the drag to start at all), but the designer reads the one it keeps in state. */
export function startLibraryDrag(e: DragEvent<HTMLElement>, payload: LibraryDrag) {
  e.dataTransfer.effectAllowed = 'copy'
  const json = JSON.stringify(payload)
  try { e.dataTransfer.setData(LAYOUT_DRAG_MIME, json) } catch { /* some browsers only take text */ }
  e.dataTransfer.setData('text/plain', json)
}

/** True for a drop target of new pages (the strip); false for the canvas, which takes widgets. */
export function isPageDrag(drag: LibraryDrag | null): boolean {
  return drag != null && drag.kind !== 'widget'
}
