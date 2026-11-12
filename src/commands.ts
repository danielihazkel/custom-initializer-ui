import { useSyncExternalStore } from 'react'

/**
 * A tiny registry so any part of the app can contribute actions to the global ⌘K palette without
 * `App.tsx` knowing its internals. The component that owns a piece of state registers the actions
 * on it in an effect (and clears them on unmount); the palette reads them through
 * {@link useRegisteredCommands}.
 *
 * Actions are registered **per scope**, so several owners coexist: the active view (`view`, the
 * default — the Fullstack tab), the pieces of the Backend tab (its header actions, the dependency
 * picker's wizards, the preset picker), and `App` itself (`global`: the tabs, the theme, help).
 * Registering a scope again replaces what that scope held.
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

/** `global` is listed last: what the current view offers comes before "go to another tab". */
const GLOBAL_SCOPE = 'global'

const scopes = new Map<string, PaletteAction[]>()
let actions: PaletteAction[] = []
const listeners = new Set<() => void>()

function rebuild() {
  const merged: PaletteAction[] = []
  for (const [scope, list] of scopes) if (scope !== GLOBAL_SCOPE) merged.push(...list)
  merged.push(...(scopes.get(GLOBAL_SCOPE) ?? []))
  actions = merged
  for (const l of listeners) l()
}

/** Replaces the actions of one scope; returns a disposer that clears them again. */
export function registerCommands(next: PaletteAction[], scope = 'view'): () => void {
  scopes.set(scope, next)
  rebuild()
  return () => {
    if (scopes.get(scope) === next) {
      scopes.delete(scope)
      rebuild()
    }
  }
}

/**
 * Runs a registered action by its id; false when nobody has registered it. For a part of the page
 * that wants what another part owns ("Save as preset" from the next-steps card, which is the
 * preset picker's) without the two being wired together.
 */
export function runCommand(id: string): boolean {
  const action = actions.find(a => a.id === id)
  action?.run()
  return action !== undefined
}

export function useRegisteredCommands(): PaletteAction[] {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => actions,
    () => actions,
  )
}
