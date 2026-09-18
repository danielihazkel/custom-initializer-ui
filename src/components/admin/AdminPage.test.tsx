import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { AdminPage } from './AdminPage'
import { invalidateAdminCache } from '../../hooks/useAdminResource'

// The admin tabs are heavy (framer-motion, every CRUD tab); the page under test only needs to
// decide between the login form and the authenticated shell, so the shell is stubbed to a
// component that fires one admin GET the way OverviewTab does.
vi.mock('framer-motion', () => ({
  motion: { div: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('./overview/OverviewTab', async () => {
  const { useAdminResource } = await import('../../hooks/useAdminResource')
  return {
    OverviewTab: () => {
      const { items } = useAdminResource<{ id: number }>('/admin/dependency-groups')
      return <div data-testid="overview">{items.length} groups</div>
    },
  }
})

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>
let reload: ReturnType<typeof vi.fn>
const originalLocation = window.location

beforeEach(() => {
  sessionStorage.clear()
  invalidateAdminCache()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  reload = vi.fn()
  Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
})

describe('AdminPage', () => {
  it('shows the login form when no token is stored', () => {
    render(<AdminPage />)
    expect(screen.getByPlaceholderText('Enter admin password')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders the admin shell with a stored token', async () => {
    sessionStorage.setItem('adminToken', 'tok-123')
    fetchMock.mockResolvedValue(response(200, [{ id: 1 }, { id: 2 }]))
    render(<AdminPage />)
    await waitFor(() => expect(screen.getByTestId('overview').textContent).toBe('2 groups'))
    expect(screen.queryByPlaceholderText('Enter admin password')).toBeNull()
  })

  it('falls back to the login form in place when a stored token is rejected, without reloading', async () => {
    sessionStorage.setItem('adminToken', 'stale-after-restart')
    fetchMock.mockResolvedValue(response(401, { error: 'Unauthorized' }))
    render(<AdminPage />)

    await waitFor(() => expect(screen.getByPlaceholderText('Enter admin password')).toBeTruthy())
    expect(screen.getByRole('status').textContent).toMatch(/session has expired/i)
    expect(sessionStorage.getItem('adminToken')).toBeNull()
    expect(reload).not.toHaveBeenCalled()
  })
})
