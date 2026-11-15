import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissToast, showToast } from './toast'
import { Toaster } from './components/Toaster'
import { AppToast } from './components/AppToast'
import { StatusToast } from './components/admin/shared/StatusToast'

describe('the toast stack', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('draws toasts from any caller in one stack, and lets each go after its time', () => {
    render(<Toaster />)
    const first = vi.fn()
    act(() => { showToast({ message: 'Link copied', type: 'success' }, first) })
    act(() => { vi.advanceTimersByTime(1000) })
    act(() => { showToast({ message: 'Could not save', type: 'error' }) })
    expect(screen.getAllByRole('status').map(el => el.textContent)).toEqual([
      expect.stringContaining('Link copied'),
      expect.stringContaining('Could not save'),
    ])

    act(() => { vi.advanceTimersByTime(2000) })
    expect(first).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('keeps at most three, telling the owner of the one pushed out', () => {
    render(<Toaster />)
    const oldest = vi.fn()
    act(() => {
      showToast({ message: 'one', type: 'success' }, oldest)
      showToast({ message: 'two', type: 'success' })
      showToast({ message: 'three', type: 'success' })
      showToast({ message: 'four', type: 'success' })
    })
    expect(oldest).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('status').map(el => el.textContent)).toEqual([
      expect.stringContaining('two'), expect.stringContaining('three'), expect.stringContaining('four'),
    ])
  })

  it('gives a toast with an action longer, runs the action once and then lets it go', () => {
    render(<Toaster />)
    const undo = vi.fn()
    const gone = vi.fn()
    act(() => { showToast({ message: 'Preset deleted', type: 'success', action: { label: 'Undo', onClick: undo } }, gone) })
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByRole('status')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(undo).toHaveBeenCalledTimes(1)
    expect(gone).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('holds every toast while the pointer is over the stack', () => {
    render(<Toaster />)
    act(() => { showToast({ message: 'Reading this', type: 'success' }) })
    fireEvent.mouseEnter(document.querySelector('[data-toaster]')!)
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(screen.getByRole('status')).toBeTruthy()
    fireEvent.mouseLeave(document.querySelector('[data-toaster]')!)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('closes on its button, and a silent dismissal does not call the owner', () => {
    render(<Toaster />)
    const closed = vi.fn()
    const silent = vi.fn()
    let silentId = 0
    act(() => {
      showToast({ message: 'Closable', type: 'success' }, closed)
      silentId = showToast({ message: 'Replaced', type: 'success' }, silent)
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0])
    expect(closed).toHaveBeenCalledTimes(1)
    act(() => { dismissToast(silentId, true) })
    expect(silent).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows two views’ toasts together, drawn once', () => {
    // App mounts AppToast; the Fullstack and admin views mount StatusToast under it.
    function Both() {
      return (
        <>
          <AppToast toast={{ message: 'Link copied', type: 'success' }} onClear={() => {}} />
          <StatusToast toast={{ message: 'Model saved', type: 'success' }} onClear={() => {}} />
        </>
      )
    }
    render(<Both />)
    expect(document.querySelectorAll('[data-toaster]')).toHaveLength(1)
    expect(screen.getAllByRole('status')).toHaveLength(2)
  })

  it('replaces a view’s toast when its state changes, without clearing the new one', () => {
    const cleared = vi.fn()
    const { rerender } = render(<AppToast toast={{ message: 'First', type: 'success' }} onClear={cleared} />)
    rerender(<AppToast toast={{ message: 'Second', type: 'error' }} onClear={cleared} />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toContain('Second')
    expect(cleared).not.toHaveBeenCalled()
    rerender(<AppToast toast={null} onClear={cleared} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
