import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackendUnreachable } from './BackendUnreachable'
import { PopoverMenu } from './shared/PopoverMenu'

describe('BackendUnreachable', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('asks again by itself, waiting longer each time, and at once on the button', () => {
    const retry = vi.fn()
    const { rerender } = render(<BackendUnreachable error="HTTP 502" retrying={false} onRetry={retry} />)
    expect(screen.getByRole('alert').textContent).toContain('HTTP 502')
    expect(screen.getByText('Trying again in 2 s')).toBeTruthy()

    act(() => { vi.advanceTimersByTime(2000) })
    expect(retry).toHaveBeenCalledTimes(1)

    // The attempt is in flight, then comes back failed: the next wait is longer.
    rerender(<BackendUnreachable error="HTTP 502" retrying onRetry={retry} />)
    expect(screen.getByRole('button', { name: /Trying/ })).toHaveProperty('disabled', true)
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(retry).toHaveBeenCalledTimes(1)
    rerender(<BackendUnreachable error="HTTP 502" retrying={false} onRetry={retry} />)
    expect(screen.getByText('Trying again in 4 s')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(retry).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Retry now' }))
    expect(retry).toHaveBeenCalledTimes(2)
  })

  it('waits while the tab is hidden', () => {
    const retry = vi.fn()
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    render(<BackendUnreachable error="Failed to fetch" retrying={false} onRetry={retry} />)
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(retry).not.toHaveBeenCalled()
    visibility.mockReturnValue('visible')
    act(() => { vi.advanceTimersByTime(2000) })
    expect(retry).toHaveBeenCalledTimes(1)
    visibility.mockRestore()
  })
})

describe('PopoverMenu', () => {
  it('opens on its button, marks the current item, runs a pick and closes', () => {
    const goFrontend = vi.fn()
    render(
      <PopoverMenu
        label="Open navigation"
        icon="menu"
        items={[
          { id: 'backend', label: 'Backend', current: true, onSelect: () => {} },
          { id: 'frontend', label: 'Frontend', onSelect: goFrontend },
        ]}
      />,
    )
    const button = screen.getByRole('button', { name: 'Open navigation' })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')

    const items = screen.getAllByRole('menuitem')
    expect(items[0].getAttribute('aria-current')).toBe('page')
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0])

    fireEvent.click(items[1])
    expect(goFrontend).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes on Escape, giving focus back to the button, and on a click outside', () => {
    render(<PopoverMenu label="More actions" icon="more_vert" items={[{ id: 'share', label: 'Copy share link', onSelect: () => {} }]} />)
    const button = screen.getByRole('button', { name: 'More actions' })
    fireEvent.click(button)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(button)

    fireEvent.click(button)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
