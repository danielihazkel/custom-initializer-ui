import { useCallback, useRef } from 'react'

/**
 * A function whose identity never changes but that always runs the latest `fn` — for callbacks
 * handed to memoized children, which would otherwise re-render whenever the parent does (the
 * pattern DependencySelector's `toggle` spells out by hand). Call it from event handlers and
 * effects, not during render.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn)
  ref.current = fn
  return useCallback((...args: A) => ref.current(...args), [])
}
