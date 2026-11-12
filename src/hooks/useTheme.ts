import { useSyncExternalStore } from 'react'

/**
 * Whether the app is in its dark theme.
 *
 * The theme is the `light` / `dark` class on `<html>` — set before first paint by the script in
 * `index.html` and afterwards by `App.tsx`'s toggle. Reading the class (rather than passing the
 * toggle's state down) lets a component deep in a lazy chunk follow the theme without a prop or
 * a context: the code viewers need it, because CodeMirror takes its theme as a prop, not from CSS.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function isDark(): boolean {
  return !document.documentElement.classList.contains('light')
}

export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, isDark, () => true)
}
