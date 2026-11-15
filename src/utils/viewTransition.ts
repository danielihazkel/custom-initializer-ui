import { flushSync } from 'react-dom'

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> }
}

interface Options {
  /** Put on `<html data-transition>` for the transition's length, so CSS can style this kind. */
  name?: string
  /** Where the change came from on screen — the theme reveal grows from the button. */
  origin?: { x: number; y: number }
}

/**
 * Runs a state update inside a browser view transition: the page before and after are
 * cross-faded (or whatever `index.css` says for `name`) by the compositor, at no cost in script
 * or bundle. Where the API is missing, or the user has motion off, the update simply runs.
 *
 * The update is flushed synchronously: the browser snapshots the page the moment the callback
 * returns, so React must have rendered by then.
 */
export function withViewTransition(update: () => void, { name, origin }: Options = {}): void {
  const doc = document as TransitionDocument
  const root = document.documentElement
  const still = root.classList.contains('motion-off')
    || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  if (typeof doc.startViewTransition !== 'function' || still) {
    update()
    return
  }
  if (name) root.dataset.transition = name
  if (origin) {
    root.style.setProperty('--vt-x', `${origin.x}px`)
    root.style.setProperty('--vt-y', `${origin.y}px`)
  }
  const transition = doc.startViewTransition(() => { flushSync(update) })
  const done = () => { if (name && root.dataset.transition === name) delete root.dataset.transition }
  transition.finished.then(done, done)
}
