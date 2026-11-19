import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { DatabaseDrawer } from './DatabaseDrawer'
import { ddlFileName, projectDialect } from './databaseApi'
import type { FullstackStarterRequest } from '../../types'

vi.mock('../admin/shared/AdminFormDrawer', () => ({
  AdminFormDrawer: ({ children, onSave, isOpen, saveLabel }: { children: ReactNode; onSave: () => Promise<void>; isOpen: boolean; saveLabel?: string }) =>
    isOpen ? <div>{children}<button data-primary onClick={() => { onSave().catch(() => {}) }}>{saveLabel ?? 'Save'}</button></div> : null,
}))

const OPTIONS = {
  sources: [
    { name: 'HR reporting', dialect: 'POSTGRESQL', defaultSchema: 'hr', createTables: false },
    { name: 'Sandbox', dialect: 'ORACLE', defaultSchema: 'APP', createTables: true },
  ],
  typedConnections: true, drivers: {}, defaultPorts: {}, maxTables: 300,
}

type Call = { url: string; body: Record<string, unknown> }
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status })

function stub(handlers: Record<string, (body: Record<string, unknown>, url: string) => Response>, options: unknown = OPTIONS) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/metadata/live-schema/options') return json(options)
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}
    calls.push({ url, body })
    const key = Object.keys(handlers).find(k => url.startsWith(k))
    return key ? handlers[key](body, url) : json({}, 404)
  }))
  return calls
}

const REQUEST = { artifactId: 'orders', entities: [{ name: 'Order', fields: [] }] } as unknown as FullstackStarterRequest

function ddl(dialect: string) {
  return json({ dialect, label: dialect === 'MSSQL' ? 'SQL Server' : dialect, sql: `-- for ${dialect}\ncreate table orders (\n);\n`,
    tables: ['orders'], projectDialect: 'POSTGRESQL', flyway: true })
}

afterEach(() => vi.unstubAllGlobals())

describe('databaseApi', () => {
  it('picks the project’s database the way the server does', () => {
    expect(projectDialect(['web', 'h2', 'postgresql'])).toBe('POSTGRESQL')
    expect(projectDialect(['mssql', 'oracle'])).toBe('ORACLE')
    expect(projectDialect(['web', 'h2'])).toBe('H2')
    expect(ddlFileName('orders', 'MSSQL')).toBe('orders-schema-mssql.sql')
    expect(ddlFileName(' ', 'H2')).toBe('model-schema-h2.sql')
  })
})

describe('DatabaseDrawer — export', () => {
  it('starts on the project’s database and asks again for another', async () => {
    const calls = stub({ '/starter-fullstack.ddl': (_b, url) => ddl(new URL(url, 'http://x').searchParams.get('dialect')!) })
    render(<DatabaseDrawer isOpen onClose={() => {}} buildRequest={() => REQUEST} selectedDeps={['web', 'postgresql']} artifactId="orders" />)
    await waitFor(() => expect(document.querySelector('[data-ddl-sql]')?.textContent).toContain('-- for POSTGRESQL'))
    expect(calls[0].url).toBe('/starter-fullstack.ddl?dialect=POSTGRESQL')
    expect(calls[0].body.artifactId).toBe('orders')
    expect((screen.getByLabelText('Database') as HTMLSelectElement).value).toBe('POSTGRESQL')

    fireEvent.change(screen.getByLabelText('Database'), { target: { value: 'MSSQL' } })
    await waitFor(() => expect(document.querySelector('[data-ddl-sql]')?.textContent).toContain('-- for MSSQL'))
    expect(screen.getByRole('button', { name: 'Download .sql' })).toBeTruthy()
  })

  it('shows a model the server refuses with where it is', async () => {
    stub({ '/starter-fullstack.ddl': () => json({ error: 'Invalid request', detail: 'Field name twice', path: 'entities[0].fields[2]' }, 400) })
    render(<DatabaseDrawer isOpen onClose={() => {}} buildRequest={() => REQUEST} selectedDeps={[]} artifactId="orders" />)
    const box = await waitFor(() => {
      const el = document.querySelector('[data-database-error]')
      expect(el).toBeTruthy()
      return el!
    })
    expect(box.textContent).toContain('Field name twice')
    expect(box.textContent).toContain('entities[0].fields[2]')
  })
})

describe('DatabaseDrawer — create', () => {
  const PLAN = {
    dialect: 'ORACLE', label: 'Oracle', schema: 'APP', sql: 'create table "APP".orders (\n);\n', tables: ['"APP".orders'],
    statements: 3, created: [], checked: true, transactional: false, projectDialect: 'POSTGRESQL', flyway: true,
  }

  it('offers only the sources that allow it, checks, then creates after a confirm', async () => {
    const onClose = vi.fn()
    const calls = stub({
      '/metadata/live-schema/schemas': () => json({ schemas: ['APP', 'HR'], defaultSchema: 'APP' }),
      '/starter-fullstack.create-tables': body => json(body.check ? PLAN : { ...PLAN, checked: false, created: ['"APP".orders'] }),
    })
    render(<DatabaseDrawer isOpen initialMode="create" onClose={onClose} buildRequest={() => REQUEST} selectedDeps={['postgresql', 'flyway']} artifactId="orders" />)

    await waitFor(() => expect((screen.getByLabelText('Schema') as HTMLSelectElement).value).toBe('APP'))
    const sources = [...(screen.getByLabelText('Source') as HTMLSelectElement).options].map(o => o.value)
    expect(sources).toEqual(['Sandbox'])
    expect(document.querySelector('[data-dialect-mismatch]')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    await waitFor(() => expect(document.querySelector('[data-create-plan]')).toBeTruthy())
    expect(calls.find(c => c.url === '/starter-fullstack.create-tables')?.body)
      .toMatchObject({ source: 'Sandbox', schema: 'APP', check: true, request: { artifactId: 'orders' } })
    expect(document.querySelector('[data-flyway-note]')).toBeTruthy()
    expect(document.querySelector('[data-not-transactional]')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Create 1 table' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Create tables' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const run = calls.filter(c => c.url === '/starter-fullstack.create-tables')
    expect(run).toHaveLength(2)
    expect(run[1].body.check).toBe(false)
  })

  it('lists the tables in the way and creates nothing', async () => {
    const calls = stub({
      '/metadata/live-schema/schemas': () => json({ schemas: ['APP'], defaultSchema: 'APP' }),
      '/starter-fullstack.create-tables': () => json({ error: 'Tables exist', detail: '1 table of this model already exists in APP: APP.orders. Nothing was created.', existing: ['APP.orders'] }, 409),
    })
    render(<DatabaseDrawer isOpen initialMode="create" onClose={() => {}} buildRequest={() => REQUEST} selectedDeps={[]} artifactId="orders" />)
    await waitFor(() => expect((screen.getByLabelText('Schema') as HTMLSelectElement).value).toBe('APP'))
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    const list = await waitFor(() => {
      const el = document.querySelector('[data-existing-tables]')
      expect(el).toBeTruthy()
      return el!
    })
    expect(list.textContent).toContain('APP.orders')
    // Still a check: no Create button, nothing run.
    expect(screen.getByRole('button', { name: 'Check' })).toBeTruthy()
    expect(calls.filter(c => c.body.check === false)).toHaveLength(0)
  })

  it('says so when no source allows creating tables', async () => {
    stub({}, { ...OPTIONS, sources: [OPTIONS.sources[0]] })
    render(<DatabaseDrawer isOpen initialMode="create" onClose={() => {}} buildRequest={() => REQUEST} selectedDeps={[]} artifactId="orders" />)
    await waitFor(() => expect(document.querySelector('[data-no-writable-source]')).toBeTruthy())
  })
})
