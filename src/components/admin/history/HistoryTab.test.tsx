import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { HistoryTab } from './HistoryTab'
import { AdminLogin } from '../AdminLogin'
import type { CatalogChange } from '../../../types'

const change: CatalogChange = {
  id: 7, changedAt: '2026-11-16T10:00:00Z', actor: 'dana', source: 'admin', requestId: 'r-1',
  entityType: 'DependencyGroupEntity', tableName: 'initializer_dependency_group', rowId: '3', action: 'UPDATE',
  label: 'Web (renamed)', before: { id: 3, name: 'Web', sortOrder: 1 }, after: { id: 3, name: 'Web (renamed)', sortOrder: 1 },
  changedFields: ['name'],
}

function stub(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; body?: string }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body as string | undefined })
    return handler(url, init)
  }))
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('HistoryTab', () => {
  it('lists changes and shows a change field by field', async () => {
    stub(url => url.startsWith('/admin/history?')
      ? new Response(JSON.stringify({ content: [change], totalElements: 1, page: 0, size: 50 }))
      : new Response('{}'))
    render(<HistoryTab />)
    const table = await waitFor(() => {
      const el = document.querySelector('[data-history-changes]') as HTMLElement
      expect(within(el).getByText('Web (renamed)')).toBeTruthy()
      return el
    })
    expect(within(table).getByText('dana')).toBeTruthy()
    expect(within(table).getByText('Dependency group')).toBeTruthy()
    fireEvent.click(within(table).getByText('Web (renamed)'))
    const fields = document.querySelector('[data-change-fields]') as HTMLElement
    const name = within(fields).getByText('name').closest('tr')!
    expect(name.getAttribute('data-changed')).toBe('true')
    expect(within(name).getByText('Web')).toBeTruthy()
    expect(within(fields).getByText('sortOrder').closest('tr')!.getAttribute('data-changed')).toBeNull()
  })

  it('asks before undoing over somebody else\'s later change, then forces it', async () => {
    let undos = 0
    const calls = stub((url, init) => {
      if (url.startsWith('/admin/history?')) return new Response(JSON.stringify({ content: [change], totalElements: 1, page: 0, size: 50 }))
      if (url === '/admin/history/7/undo') {
        undos++
        const force = JSON.parse(String(init?.body ?? '{}')).force
        return force
          ? new Response(JSON.stringify({ undone: 1 }))
          : new Response(JSON.stringify({ detail: 'changed', rows: ["DependencyGroupEntity 'Web 2' (name changed since)"] }), { status: 409 })
      }
      return new Response('{}')
    })
    render(<HistoryTab />)
    fireEvent.click(await screen.findByText('Web (renamed)'))
    fireEvent.click(screen.getByRole('button', { name: 'Undo this change' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/Web 2/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Undo anyway' }))
    await screen.findByText('Change undone.')
    expect(undos).toBe(2)
    expect(calls.filter(c => c.url === '/admin/history/7/undo').map(c => JSON.parse(c.body!).force)).toEqual([false, true])
  })

  it('undoes a whole request from the requests view', async () => {
    const calls = stub(url => {
      if (url.startsWith('/admin/history/requests?')) {
        return new Response(JSON.stringify({ content: [{ requestId: 'r-9', at: '2026-11-16T09:00:00Z', actor: 'eli', source: 'import', changes: 612 }], totalElements: 1, page: 0, size: 50 }))
      }
      if (url === '/admin/history/requests/r-9/undo') return new Response(JSON.stringify({ undone: 612 }))
      return new Response(JSON.stringify({ content: [], totalElements: 0, page: 0, size: 50 }))
    })
    render(<HistoryTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Requests' }))
    const table = await waitFor(() => {
      const el = document.querySelector('[data-history-requests]') as HTMLElement
      expect(within(el).getByText('Import')).toBeTruthy()
      return el
    })
    fireEvent.click(within(table).getByRole('button', { name: 'Undo' }))
    await screen.findByText('Undid the 612 changes of that request.')
    expect(calls.some(c => c.url === '/admin/history/requests/r-9/undo')).toBe(true)
  })
})

describe('AdminLogin', () => {
  it('signs an admin in as themselves', async () => {
    stub(url => {
      if (url === '/admin/login/options') return new Response(JSON.stringify({ password: true, sso: true, user: 'dana' }))
      if (url === '/admin/login/sso') return new Response(JSON.stringify({ token: 't', user: 'dana' }))
      return new Response('{}', { status: 404 })
    })
    const onSuccess = vi.fn()
    render(<AdminLogin onSuccess={onSuccess} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in as dana' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('t', 'dana'))
  })

  it('says why somebody is not let in, and keeps the password for when there is no sign-on', async () => {
    stub(url => {
      if (url === '/admin/login/options') return new Response(JSON.stringify({ password: true, sso: true, user: 'mallory' }))
      if (url === '/admin/login/sso') return new Response(JSON.stringify({ error: 'mallory is not an admin of this service.' }), { status: 403 })
      return new Response('{}', { status: 404 })
    })
    render(<AdminLogin onSuccess={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in as mallory' }))
    expect((await screen.findByRole('alert')).textContent).toContain('not an admin')
    expect(screen.getByLabelText('Password')).toBeTruthy()
  })

  it('offers only the password where single sign-on is not set up', async () => {
    stub(url => url === '/admin/login/options'
      ? new Response(JSON.stringify({ password: true, sso: false, user: null }))
      : new Response(JSON.stringify({ token: 't', user: 'password' })))
    const onSuccess = vi.fn()
    render(<AdminLogin onSuccess={onSuccess} />)
    await waitFor(() => expect(screen.queryByRole('button', { name: /Sign in/ })).toBeNull())
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('t', 'password'))
  })
})
