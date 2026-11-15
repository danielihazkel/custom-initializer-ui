import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccessBlocked } from './AccessBlocked'
import { ACCESS_BLOCKED_CODE, invalidateMetadata, useMetadata } from '../hooks/useMetadata'

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('AccessBlocked', () => {
  it('says why, and asks again only on the button', () => {
    vi.useFakeTimers()
    try {
      const retry = vi.fn()
      const { rerender } = render(<AccessBlocked detail="Missing 'userinfo' header" retrying={false} onRetry={retry} />)
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('No access')
      expect(alert.textContent).toContain("Missing 'userinfo' header")

      // Waiting changes nothing here, so nothing knocks by itself.
      act(() => { vi.advanceTimersByTime(120_000) })
      expect(retry).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(retry).toHaveBeenCalledTimes(1)

      rerender(<AccessBlocked detail="Missing 'userinfo' header" retrying onRetry={retry} />)
      expect(screen.getByRole('button', { name: /Checking/ })).toHaveProperty('disabled', true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useMetadata and the access gate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    invalidateMetadata()
  })

  it('reports blocked for the gate’s refusal, with the backend’s words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      answer(403, { error: 'Forbidden', code: ACCESS_BLOCKED_CODE, detail: "Missing 'userinfo' header" })))
    const { result } = renderHook(() => useMetadata())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.blocked).toBe(true)
    expect(result.current.error).toBe("Missing 'userinfo' header")
    expect(result.current.metadata).toBeNull()
  })

  it('keeps any other failure an ordinary one', async () => {
    const fetchMock = vi.fn(async () => answer(403, { error: 'Forbidden' }))
    vi.stubGlobal('fetch', fetchMock)
    const first = renderHook(() => useMetadata())
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    expect(first.result.current.blocked).toBe(false)
    expect(first.result.current.error).toBe('HTTP 403')
    first.unmount()

    fetchMock.mockImplementation(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
    const second = renderHook(() => useMetadata())
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(second.result.current.blocked).toBe(false)
    expect(second.result.current.error).toBe('HTTP 502')
  })

  it('comes up once the gate lets the browser through', async () => {
    const fetchMock = vi.fn(async () => answer(403, { code: ACCESS_BLOCKED_CODE, detail: 'Missing header' }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useMetadata())
    await waitFor(() => expect(result.current.blocked).toBe(true))

    fetchMock.mockImplementation(async () => answer(200, { dependencies: { values: [] } }))
    act(() => { result.current.reload() })
    await waitFor(() => expect(result.current.metadata).not.toBeNull())
    expect(result.current.blocked).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
