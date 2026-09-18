import { describe, it, expect, vi, afterEach } from 'vitest'
import { focusWithoutClipping, resetClippedAncestors, scrollToElement, SCROLL_TOP_OFFSET } from './scroll'

/** A clipped ancestor (like the app's overflow-hidden <main>) around a target element. */
function clippedTree() {
  const main = document.createElement('main')
  main.style.overflow = 'hidden'
  const target = document.createElement('input')
  main.appendChild(target)
  document.body.appendChild(main)
  // jsdom never lays out, so fake the offsets a real browser would produce.
  Object.defineProperty(main, 'scrollTop', { value: 240, writable: true, configurable: true })
  Object.defineProperty(main, 'scrollLeft', { value: 0, writable: true, configurable: true })
  return { main, target }
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })

describe('scroll helpers', () => {
  it('puts a scrolled overflow-hidden ancestor back to 0 — the user cannot', () => {
    const { main, target } = clippedTree()
    resetClippedAncestors(target)
    expect(main.scrollTop).toBe(0)
  })

  it('scrolls the window only, offset for the fixed header, and never the clipped ancestor', () => {
    const { main, target } = clippedTree()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 500, bottom: 540, height: 40, left: 0, right: 0, width: 0, x: 0, y: 500, toJSON: () => ({}) })
    Object.defineProperty(window, 'scrollY', { value: 1000, configurable: true })
    scrollToElement(target, 'start')
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000 + 500 - SCROLL_TOP_OFFSET, behavior: 'smooth' })
    expect(main.scrollTop).toBe(0)
  })

  it('leaves the window alone for "nearest" when the element is already in view', () => {
    const { target } = clippedTree()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 300, bottom: 340, height: 40, left: 0, right: 0, width: 0, x: 0, y: 300, toJSON: () => ({}) })
    scrollToElement(target, 'nearest')
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('focuses with preventScroll so the browser cannot scroll ancestors on its own', () => {
    const { target } = clippedTree()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const focus = vi.spyOn(target, 'focus')
    focusWithoutClipping(target)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })
})
