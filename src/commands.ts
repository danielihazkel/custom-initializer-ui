import { useSyncExternalStore } from 'react'

/**
 * A tiny registry so a view can contribute actions to the global ⌘K palette without App.tsx
 * knowing the view's internals. A view registers its actions in an effect (and clears them on
 * unmount); the palette reads them through {@link useRegisteredCommands}.
 */
export interface PaletteAction {
  id: string
  title: string
  description?: string
  /** Material Symbols icon name. */
  icon: string
  /** Group label shown at the right of the row. */
  group: string
  run: () => void
  /** Keyboard hint shown in the row (display only). */
  shortcut?: string
}

let actions: PaletteAction[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

/** Replaces the registered actions; returns a disposer that clears them again. */
export function registerCommands(next: PaletteAction[]): () => void {
  actions = next
  emit()
  return () => {
    if (actions === next) {
      actions = []
      emit()
    }
  }
}

export function useRegisteredCommands(): PaletteAction[] {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => actions,
    () => actions,
  )
}
