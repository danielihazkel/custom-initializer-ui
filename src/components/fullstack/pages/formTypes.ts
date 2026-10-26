import type { FullstackEntityDef, FullstackPageDef } from '../../../types'

export type Update = (index: number, patch: Partial<FullstackPageDef>) => void
/** Records an undo entry before a change that drops settings, and says what was dropped. */
export type Lossy = (label: string, dropped: string[]) => void
/** Records an undo entry before a part of a page is removed, and says so with an Undo. */
export type Removed = (label: string, detail?: string) => void
export interface FormProps {
  page: FullstackPageDef
  index: number
  entities: FullstackEntityDef[]
  errors: Record<string, string>
  update: Update
  lossy: Lossy
  removed?: Removed
}
