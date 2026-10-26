import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppToast } from './AppToast'
import { StatusToast } from './admin/shared/StatusToast'
import type { Toast } from '../types'

const toast: Toast = { message: 'Link copied to clipboard', type: 'success' }

describe('toast timers', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('AppToast clears after 3 s even when the parent re-renders with a new onClear', () => {
    const cleared = vi.fn()
    const { rerender } = render(<AppToast toast={toast} onClear={() => cleared()} />)
    act(() => { vi.advanceTimersByTime(2000) })
    rerender(<AppToast toast={toast} onClear={() => cleared()} />)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(cleared).toHaveBeenCalledTimes(1)
  })

  it('StatusToast clears after 3 s even when the parent re-renders with a new onClear', () => {
    const cleared = vi.fn()
    const { rerender } = render(<StatusToast toast={toast} onClear={() => cleared()} />)
    act(() => { vi.advanceTimersByTime(2000) })
    rerender(<StatusToast toast={toast} onClear={() => cleared()} />)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(cleared).toHaveBeenCalledTimes(1)
  })
})
