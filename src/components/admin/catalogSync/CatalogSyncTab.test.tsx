import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { CatalogSyncTab } from './CatalogSyncTab'
import type { CatalogSyncReport, CatalogSyncRow } from '../../../types'

const row = (key: string, status: CatalogSyncRow['status'], label: string, kind: CatalogSyncRow['kind'] = 'BACKEND'): CatalogSyncRow => ({
  key, table: 'FILE_CONTRIBUTION', kind, dependencyId: 'kafka', label, status, rowId: 1,
})

const report: CatalogSyncReport = {
  enabled: true,
  summary: { DIFFERS: 2, MISSING: 1, IN_STEP: 1, KEPT: 1 },
  rows: [
    row('a', 'DIFFERS', 'src/main/resources/application-kafka.yml'),
    row('b', 'MISSING', 'Dockerfile'),
    row('c', 'IN_STEP', 'pom.xml'),
    row('d', 'KEPT', 'README.md'),
    row('e', 'DIFFERS', 'nginx.conf', 'FRONTEND'),
  ],
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

describe('CatalogSyncTab', () => {
  it('lists the rows that differ or are missing, of the kind shown, and filters by status', async () => {
    stub(() => new Response(JSON.stringify(report)))
    render(<CatalogSyncTab />)
    const table = await waitFor(() => {
      const el = document.querySelector('[data-sync-rows]') as HTMLElement
      expect(within(el).getByText('Dockerfile')).toBeTruthy()
      return el
    })
    expect(within(table).getByText('src/main/resources/application-kafka.yml')).toBeTruthy()
    // In step and kept rows are not shown at first; the frontend row is the other kind.
    expect(within(table).queryByText('pom.xml')).toBeNull()
    expect(within(table).queryByText('README.md')).toBeNull()
    expect(within(table).queryByText('nginx.conf')).toBeNull()
    // Every shipped row counts both catalogs.
    expect(screen.getByRole('button', { name: /Take every shipped row \(3\)/ })).toBeTruthy()

    fireEvent.click(document.querySelector('[data-sync-status="KEPT"]')!)
    expect(within(table).getByText('README.md')).toBeTruthy()
  })

  it('takes the shipped version of the picked rows, or keeps them', async () => {
    const calls = stub((url) => {
      if (url === '/admin/catalog-sync/apply') return new Response(JSON.stringify({ written: 1, summary: {} }))
      if (url === '/admin/catalog-sync/keep') return new Response(JSON.stringify({ marked: 1, summary: {} }))
      return new Response(JSON.stringify(report))
    })
    render(<CatalogSyncTab />)
    await waitFor(() => expect(screen.getByLabelText('Pick Dockerfile')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Pick Dockerfile'))
    fireEvent.click(within(document.querySelector('[data-sync-bulk]') as HTMLElement).getByRole('button', { name: 'Take shipped' }))
    await waitFor(() => expect(screen.getByText('Took the shipped version of 1 row.')).toBeTruthy())
    expect(JSON.parse(calls.find(c => c.url === '/admin/catalog-sync/apply')!.body!)).toEqual({ keys: ['b'] })

    fireEvent.click(await screen.findByLabelText('Pick src/main/resources/application-kafka.yml'))
    fireEvent.click(within(document.querySelector('[data-sync-bulk]') as HTMLElement).getByRole('button', { name: 'Keep mine' }))
    await waitFor(() => expect(screen.getByText('Kept 1 row as your own.')).toBeTruthy())
    expect(JSON.parse(calls.find(c => c.url === '/admin/catalog-sync/keep')!.body!)).toEqual({ keys: ['a'], kept: true })
  })

  it('compares a row field by field and its content as a diff', async () => {
    stub(url => {
      if (url === '/admin/catalog-sync/a') {
        return new Response(JSON.stringify({
          row: report.rows[0],
          current: { id: 4, targetPath: 'src/main/resources/application-kafka.yml', sortOrder: 1, content: 'spring:\n  kafka: {}\n' },
          shipped: { id: null, targetPath: 'src/main/resources/application-kafka.yml', sortOrder: 2, content: 'spring:\n  kafka:\n    bootstrap-servers: x\n' },
        }))
      }
      return new Response(JSON.stringify(report))
    })
    render(<CatalogSyncTab />)
    const compare = await waitFor(() => {
      const r = document.querySelector('[data-sync-row="a"]') as HTMLElement
      expect(r).toBeTruthy()
      return within(r).getByRole('button', { name: 'Compare' })
    })
    fireEvent.click(compare)
    const fields = await waitFor(() => {
      const el = document.querySelector('[data-sync-fields]') as HTMLElement
      expect(el).toBeTruthy()
      return el
    })
    expect(within(fields).getByText('sortOrder').closest('tr')!.getAttribute('data-changed')).toBe('true')
    expect(within(fields).getByText('targetPath').closest('tr')!.getAttribute('data-changed')).toBeNull()
    // The id says nothing; the content is a diff below the table.
    expect(within(fields).queryByText('id')).toBeNull()
    expect(within(fields).queryByText('content')).toBeNull()
    expect(document.querySelector('[data-sync-content]')!.textContent).toContain('bootstrap-servers')
  })

  it('says when the sync is switched off', async () => {
    stub(() => new Response(JSON.stringify({ ...report, enabled: false })))
    render(<CatalogSyncTab />)
    await waitFor(() => expect(document.querySelector('[data-sync-off]')).toBeTruthy())
  })
})
