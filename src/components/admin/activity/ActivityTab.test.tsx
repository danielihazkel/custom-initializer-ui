import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { ActivityTab } from './ActivityTab'
import { activityQuery, EMPTY_ACTIVITY_FILTER } from '../../../hooks/useActivity'
import type { ActivityEventsPage, ActivitySummary } from '../../../types'

const summary: ActivitySummary = {
  days: 30, totalCount: 7, successCount: 6, failureCount: 1, successRate: 6 / 7, previewCount: 3,
  p50Ms: 120, p95Ms: 900, p99Ms: 1200,
  topDependencies: [{ depId: 'web', count: 5 }],
  topBootVersions: [{ bootVersion: '3.5.16', count: 7 }],
  byKind: [
    { kind: 'backend', generations: 4, previews: 2 },
    { kind: 'wizard', generations: 0, previews: 0 },
    { kind: 'multimodule', generations: 0, previews: 0 },
    { kind: 'fullstack', generations: 3, previews: 1 },
    { kind: 'frontend', generations: 0, previews: 0 },
  ],
  byEndpoint: [{ endpoint: 'starter.zip', count: 4 }],
  byDepartment: [{ department: 'lts', count: 5 }, { department: '(none)', count: 2 }],
  topUsers: [{ username: 'dana', count: 4 }],
  perDay: [
    { date: '2026-11-15', byKind: { backend: 2 }, generations: 2, previews: 0 },
    { date: '2026-11-16', byKind: { backend: 2, fullstack: 3 }, generations: 5, previews: 3 },
  ],
  failures: [{ message: 'HTTP 400 — Unknown SQL wizard apiMode', count: 1, lastAt: '2026-11-16T10:00:00Z',
    lastEndpoint: 'starter-wizard.zip', lastArtifactId: 'claims', lastUsername: 'dana', lastEventId: 9 }],
  retentionDays: 365,
}

const page: ActivityEventsPage = {
  content: [{
    id: 9, eventTimestamp: '2026-11-16T10:00:00Z', endpoint: 'starter-wizard.zip', artifactId: 'claims', groupId: 'com.menora',
    bootVersion: '3.5.16', javaVersion: '21', packaging: 'jar', language: 'java', dependencyIds: 'web,h2', durationMs: 40,
    status: 'FAILURE', errorMessage: 'HTTP 400 — Unknown SQL wizard apiMode', remoteAddr: null, username: 'dana',
    kind: 'wizard', action: 'download', department: 'lts', wizards: 'sql', entityCount: null,
  }],
  totalElements: 1, page: 0, size: 50,
}

function stubApi() {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url)
    if (url.startsWith('/admin/activity/summary')) return new Response(JSON.stringify(summary))
    if (url.startsWith('/admin/activity/events.csv')) return new Response('timestamp\n')
    if (url.startsWith('/admin/activity/events')) return new Response(JSON.stringify(page))
    return new Response('{}', { status: 404 })
  }))
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('ActivityTab', () => {
  it('shows generations apart from previews, per day, and the breakdowns', async () => {
    stubApi()
    render(<ActivityTab />)
    await screen.findByText('Generations per day')
    await waitFor(() => expect(screen.getAllByText('Generations').find(el => el.tagName === 'P')!.parentElement!.textContent).toContain('7'))
    expect(screen.getAllByText('Previews').find(el => el.tagName === 'P')!.parentElement!.textContent).toContain('3')
    expect(screen.getByText(/Events are kept 365 days/)).toBeTruthy()
    const chart = document.querySelector('[data-activity-chart]')!
    expect(chart.querySelectorAll('[data-day]')).toHaveLength(2)
    expect(chart.querySelector('[data-day="2026-11-16"]')!.getAttribute('title')).toContain('Fullstack: 3')
    // Kinds with nothing in the period are left out.
    expect(screen.getByRole('button', { name: 'Fullstack' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Frontend' })).toBeNull()
    expect(screen.getByText('+1 previews')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'lts' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'dana' })).toBeTruthy()
  })

  it('lists failures by reason and narrows the events to them', async () => {
    const calls = stubApi()
    render(<ActivityTab />)
    const failures = await waitFor(() => {
      const el = document.querySelector('[data-activity-failures]') as HTMLElement
      expect(within(el).getByText('HTTP 400 — Unknown SQL wizard apiMode')).toBeTruthy()
      return el
    })
    fireEvent.click(within(failures).getByRole('button', { name: 'Show events' }))
    await waitFor(() => expect(calls.some(c => c.includes('/admin/activity/events?') && c.includes('status=FAILURE')
      && c.includes('q=HTTP+400'))).toBe(true))
  })

  it('filters, shows a row with its kind and reason, and exports what it shows', async () => {
    const calls = stubApi()
    const createObjectURL = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    render(<ActivityTab />)
    const events = await waitFor(() => {
      const el = document.querySelector('[data-activity-events]') as HTMLElement
      expect(within(el).getByText('claims')).toBeTruthy()
      return el
    })
    const row = events.querySelector('tbody tr') as HTMLElement
    expect(within(row).getByText('Wizard')).toBeTruthy()
    expect(within(events).getByText('sql · lts')).toBeTruthy()
    expect(within(events).getAllByText('HTTP 400 — Unknown SQL wizard apiMode').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'fullstack' } })
    await waitFor(() => expect(calls.some(c => c.includes('kind=fullstack') && c.includes('page=0'))).toBe(true))
    // A breakdown row narrows too.
    fireEvent.click(screen.getByRole('button', { name: 'dana' }))
    await waitFor(() => expect(calls.some(c => c.includes('username=dana'))).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: /Export CSV/ }))
    await waitFor(() => expect(calls.some(c => c.startsWith('/admin/activity/events.csv?') && c.includes('kind=fullstack')
      && c.includes('username=dana') && !c.includes('page='))).toBe(true))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
  })

  it('builds a query from the filled fields only', () => {
    expect(activityQuery(EMPTY_ACTIVITY_FILTER)).toBe('')
    expect(activityQuery({ ...EMPTY_ACTIVITY_FILTER, kind: 'wizard', q: ' a b ' }, { page: 2 })).toBe('?kind=wizard&q=a+b&page=2')
  })
})
