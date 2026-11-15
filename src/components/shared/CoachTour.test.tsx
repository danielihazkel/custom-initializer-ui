import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CoachTour, tourSeen, type TourStep } from './CoachTour'
import { Tour, storageKeyOf } from '../tours'
import { CopyButton } from './CopyButton'
import { withViewTransition } from '../../utils/viewTransition'

const STEPS: TourStep[] = [
  { anchor: '[data-part="search"]', title: 'Search', body: 'Press / to search.' },
  { anchor: '[data-part="folded"]', title: 'Folded away', body: 'Not on screen.' },
  { anchor: '[data-part="generate"]', title: 'Generate', body: 'Download the ZIP.' },
]

function Page({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button data-part="search">Search</button>
      <button data-part="generate">Generate</button>
      {open && <CoachTour root={document} steps={STEPS} storageKey="tour:test" label="Test tour" onClose={() => { setOpen(false); onClose() }} />}
    </>
  )
}

const dialog = () => screen.queryByRole('dialog')

describe('CoachTour', () => {
  beforeEach(() => { localStorage.clear() })

  it('walks the parts that are on screen, skipping one that is not', () => {
    render(<Page />)
    expect(dialog()?.getAttribute('aria-label')).toBe('Test tour — Search')
    expect(dialog()?.textContent).toContain('Tour · 1 of 2')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(dialog()?.getAttribute('aria-label')).toBe('Test tour — Generate')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(dialog()?.getAttribute('aria-label')).toBe('Test tour — Search')
    // The arrows step too.
    fireEvent.keyDown(dialog()!, { key: 'ArrowRight' })
    expect(dialog()?.getAttribute('aria-label')).toBe('Test tour — Generate')
  })

  it('is seen once finished or skipped, and tells its owner', () => {
    const onClose = vi.fn()
    render(<Page onClose={onClose} />)
    expect(tourSeen('tour:test')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(dialog()).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(tourSeen('tour:test')).toBe(true)
  })

  it('skips on Escape and keeps its keys to itself', () => {
    const pageKey = vi.fn()
    document.addEventListener('keydown', pageKey)
    render(<Page />)
    fireEvent.keyDown(dialog()!, { key: 'Escape' })
    expect(dialog()).toBeNull()
    expect(tourSeen('tour:test')).toBe(true)
    expect(pageKey).not.toHaveBeenCalled()
    document.removeEventListener('keydown', pageKey)
  })

  it('counts as seen, and closes, when none of its parts is on screen', () => {
    const onClose = vi.fn()
    render(<CoachTour root={document} steps={[STEPS[1]]} storageKey="tour:none" label="Empty tour" onClose={onClose} />)
    expect(dialog()).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(tourSeen('tour:none')).toBe(true)
  })
})

describe('the tab tours', () => {
  beforeEach(() => { localStorage.clear() })

  it('point at the parts a tab marks with data-tour, under the key the shell checks', () => {
    render(
      <>
        <div data-tour="quick-start" />
        <div data-tour="dep-search" />
        <div data-tour="actions" />
        <Tour tour="backend" onClose={() => {}} />
      </>,
    )
    // Three of the six Backend stops are on this page.
    expect(dialog()?.textContent).toContain('Tour · 1 of 3')
    expect(dialog()?.getAttribute('aria-label')).toBe('Backend tour — Start from a template')
    // App reads this key directly, so it never has to load the tours to know one was seen.
    expect(storageKeyOf('backend')).toBe('tour:backend')
    expect(storageKeyOf('frontend')).toBe('tour:frontend')
    expect(storageKeyOf('fullstack')).toBe('tour:fullstack')
  })
})

describe('CopyButton', () => {
  it('copies, shows a tick for a moment and reports the outcome', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const copied = vi.fn()
    render(<CopyButton text={() => 'mvn spring-boot:run'} label="Copy Run command" onCopied={copied} />)
    const button = screen.getByRole('button', { name: 'Copy Run command' })
    expect(button.textContent).toBe('content_copy')

    await act(async () => { fireEvent.click(button) })
    expect(writeText).toHaveBeenCalledWith('mvn spring-boot:run')
    expect(copied).toHaveBeenCalledWith(true)
    expect(button.textContent).toBe('check')

    act(() => { vi.advanceTimersByTime(1500) })
    expect(button.textContent).toBe('content_copy')
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})

describe('withViewTransition', () => {
  it('just runs the update where the browser has no view transitions', () => {
    const update = vi.fn()
    withViewTransition(update, { name: 'view' })
    expect(update).toHaveBeenCalledTimes(1)
    expect(document.documentElement.dataset.transition).toBeUndefined()
  })

  it('runs it inside a transition where it has, and clears its mark afterwards', async () => {
    let finish: () => void = () => {}
    const start = vi.fn((cb: () => void) => { cb(); return { finished: new Promise<void>(res => { finish = res }) } })
    Object.assign(document, { startViewTransition: start })
    const update = vi.fn()
    withViewTransition(update, { name: 'theme', origin: { x: 10, y: 20 } })
    expect(start).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
    expect(document.documentElement.dataset.transition).toBe('theme')
    expect(document.documentElement.style.getPropertyValue('--vt-x')).toBe('10px')
    finish()
    await Promise.resolve()
    await Promise.resolve()
    expect(document.documentElement.dataset.transition).toBeUndefined()

    // With motion off the browser is not asked at all.
    document.documentElement.classList.add('motion-off')
    withViewTransition(update)
    expect(start).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(2)
    document.documentElement.classList.remove('motion-off')
    delete (document as unknown as Record<string, unknown>).startViewTransition
  })
})
