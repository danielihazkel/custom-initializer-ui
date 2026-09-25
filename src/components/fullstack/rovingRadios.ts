import type { KeyboardEvent } from 'react'

// The editor's radio groups are rows of buttons (role="radio" inside role="radiogroup"). By the
// ARIA pattern a group is one Tab stop — its checked option, else its first — and the arrow keys
// move and pick within it. Both are applied once, at the section root, rather than per group.

const RADIOS = '[role="radio"]:not([disabled])'

/** One Tab stop per radio group under `root`: the checked option, else the first enabled one. */
export function syncRadioTabStops(root: HTMLElement | null): void {
  if (!root) return
  root.querySelectorAll<HTMLElement>('[role="radiogroup"]').forEach(group => {
    const radios = Array.from(group.querySelectorAll<HTMLElement>(RADIOS)).filter(r => r.closest('[role="radiogroup"]') === group)
    const stop = radios.find(r => r.getAttribute('aria-checked') === 'true') ?? radios[0]
    radios.forEach(r => { r.tabIndex = r === stop ? 0 : -1 })
  })
}

const NEXT = new Set(['ArrowRight', 'ArrowDown'])
const PREVIOUS = new Set(['ArrowLeft', 'ArrowUp'])

/** Arrow keys (Home/End) on a radio move to the next option of its group and pick it. Right-to-left
 *  pages swap the horizontal arrows, as the platform does. */
export function handleRadioKeys(event: KeyboardEvent<HTMLElement>): void {
  const target = event.target as HTMLElement
  if (target.getAttribute('role') !== 'radio') return
  const group = target.closest('[role="radiogroup"]')
  if (!group) return
  const radios = Array.from(group.querySelectorAll<HTMLElement>(RADIOS)).filter(r => r.closest('[role="radiogroup"]') === group)
  const at = radios.indexOf(target)
  if (at < 0 || radios.length < 2) return
  const rtl = getComputedStyle(target).direction === 'rtl'
  let key = event.key
  if (rtl && key === 'ArrowRight') key = 'ArrowLeft'
  else if (rtl && key === 'ArrowLeft') key = 'ArrowRight'
  let to: number
  if (NEXT.has(key)) to = (at + 1) % radios.length
  else if (PREVIOUS.has(key)) to = (at - 1 + radios.length) % radios.length
  else if (key === 'Home') to = 0
  else if (key === 'End') to = radios.length - 1
  else return
  event.preventDefault()
  const next = radios[to]
  radios.forEach(r => { r.tabIndex = r === next ? 0 : -1 })
  next.focus()
  next.click()
}
