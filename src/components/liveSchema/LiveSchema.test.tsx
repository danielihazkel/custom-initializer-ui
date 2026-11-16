import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { LiveSchemaPanel } from './LiveSchemaPanel'
import { SqlWizardDrawer } from '../SqlWizardDrawer'
import { ImportFromDdlDrawer } from '../fullstack/ImportFromDdlDrawer'
import { validateSchemaSource, PASSWORD_REF } from '../admin/schema-sources/SchemaSourcesTab'

vi.mock('../admin/shared/AdminFormDrawer', () => ({
  AdminFormDrawer: ({ children, onSave, isOpen, saveLabel }: { children: ReactNode; onSave: () => Promise<void>; isOpen: boolean; saveLabel?: string }) =>
    isOpen ? <div>{children}<button onClick={() => { onSave().catch(() => {}) }}>{saveLabel ?? 'Save'}</button></div> : null,
}))
vi.mock('../admin/file-contributions/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
    <textarea aria-label="sql" value={value} onChange={e => onChange(e.target.value)} />,
}))

const OPTIONS = {
  sources: [{ name: 'HR reporting', dialect: 'POSTGRESQL', description: 'The HR warehouse', defaultSchema: 'hr' }],
  typedConnections: true,
  drivers: { POSTGRESQL: true, MSSQL: true, ORACLE: true, DB2: false },
  defaultPorts: { POSTGRESQL: 5432, MSSQL: 1433, ORACLE: 1521 },
  maxTables: 300,
}

type Call = { url: string; body: Record<string, unknown> }

function stub(handlers: Record<string, (body: Record<string, unknown>) => Response>, options: unknown = OPTIONS) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/metadata/live-schema/options') return new Response(JSON.stringify(options))
    if (url === '/metadata/sql-dialects') return new Response(JSON.stringify({ postgresql: 'POSTGRESQL' }))
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}
    calls.push({ url, body })
    const h = handlers[url]
    return h ? h(body) : new Response('{}', { status: 404 })
  }))
  return calls
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status })

const SCHEMAS = () => json({ schemas: ['hr', 'public'], defaultSchema: 'hr' })
const TABLES = () => json({ tables: [{ name: 'departments', kind: 'TABLE' }, { name: 'employees', kind: 'TABLE' }, { name: 'active_staff', kind: 'VIEW' }], truncated: false })

afterEach(() => vi.unstubAllGlobals())

describe('LiveSchemaPanel', () => {
  it('reads the picked tables of a typed-in database, sending its parts', async () => {
    const calls = stub({ '/metadata/live-schema/schemas': SCHEMAS, '/metadata/live-schema/tables': TABLES })
    const onRead = vi.fn(async () => {})
    render(<LiveSchemaPanel dialect="MSSQL" readLabel={n => `Read ${n}`} onRead={onRead} />)
    // No SQL Server source: the typed form is the choice.
    await screen.findByLabelText('Host')
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'sql01' } })
    fireEvent.change(screen.getByLabelText('Database'), { target: { value: 'Hr' } })
    fireEvent.change(screen.getByLabelText('User'), { target: { value: 'reader' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 's3cret' } })
    fireEvent.click(screen.getByLabelText(/Trust the server/))
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
    const list = await waitFor(() => {
      const el = document.querySelector('[data-live-tables]') as HTMLElement
      expect(el).toBeTruthy()
      return el
    })
    expect(within(list).getByText('view')).toBeTruthy()
    fireEvent.click(within(list).getByLabelText('Read departments'))
    fireEvent.click(within(list).getByLabelText('Read active_staff'))
    fireEvent.click(screen.getByRole('button', { name: 'Read 2' }))
    await waitFor(() => expect(onRead).toHaveBeenCalled())
    expect(onRead).toHaveBeenCalledWith({
      connection: { dialect: 'MSSQL', host: 'sql01', database: 'Hr', user: 'reader', password: 's3cret', trustServerCertificate: true, port: undefined, library: undefined },
      schema: 'hr',
      tables: ['departments', 'active_staff'],
      qualify: true,
    })
    expect(calls[0].body.connection).toMatchObject({ host: 'sql01', password: 's3cret' })
  })

  it('reads through an admin source by its name only', async () => {
    const calls = stub({ '/metadata/live-schema/schemas': SCHEMAS, '/metadata/live-schema/tables': TABLES })
    const onRead = vi.fn(async () => {})
    render(<LiveSchemaPanel dialect="POSTGRESQL" readLabel={() => 'Read'} onRead={onRead} />)
    expect(await screen.findByText('The HR warehouse')).toBeTruthy()
    expect(screen.queryByLabelText('Host')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
    await screen.findByLabelText('Read employees')
    expect(calls.map(c => c.body.connection)).toEqual([{ source: 'HR reporting' }, { source: 'HR reporting' }])
    expect((screen.getByLabelText('Schema') as HTMLSelectElement).value).toBe('hr')
  })

  it('says why it cannot connect, and when a driver is missing', async () => {
    stub({ '/metadata/live-schema/schemas': () => json({ error: 'Could not connect', detail: 'Could not connect to HR reporting: refused' }, 400) })
    const { unmount } = render(<LiveSchemaPanel dialect="POSTGRESQL" readLabel={() => 'Read'} onRead={vi.fn()} />)
    await screen.findByText('The HR warehouse')
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect((await screen.findByRole('alert')).textContent).toContain('refused')
    unmount()

    render(<LiveSchemaPanel dialect="DB2" readLabel={() => 'Read'} onRead={vi.fn()} />)
    expect((await screen.findByRole('status')).textContent).toContain('driver is not installed')
  })
})

describe('SQL wizard: read from a database', () => {
  it('puts the script read into the SQL box, with an undo', async () => {
    stub({
      '/metadata/live-schema/schemas': SCHEMAS,
      '/metadata/live-schema/tables': TABLES,
      '/metadata/live-schema/ddl': () => json({ dialect: 'POSTGRESQL', sql: 'CREATE TABLE hr.departments (id BIGINT);\n', tables: 1, views: 0, warnings: ['CHECK constraints could not be read'] }),
    })
    render(<SqlWizardDrawer isOpen onClose={() => {}} depId="postgresql" depName="PostgreSQL" dialectName="POSTGRESQL"
                            initial={{ sql: 'CREATE TABLE old (id INT);', subPackage: 'entity', tables: [], apiMode: 'NONE' }}
                            selected={['postgresql']} onSave={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Read from a database/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }))
    fireEvent.click(await screen.findByLabelText('Read departments'))
    fireEvent.click(screen.getByRole('button', { name: 'Read 1 into the script (replaces it)' }))
    const status = await waitFor(() => {
      const el = document.querySelector('[data-live-read]') as HTMLElement
      expect(el).toBeTruthy()
      return el
    })
    expect(status.textContent).toContain('Read 1 table from hr — the script was replaced.')
    expect(status.textContent).toContain('CHECK constraints could not be read')
    expect((screen.getByLabelText('sql') as HTMLTextAreaElement).value).toContain('CREATE TABLE hr.departments')
    expect(screen.getByText('departments')).toBeTruthy() // detected entities follow the script
    fireEvent.click(within(status).getByRole('button', { name: 'Undo' }))
    expect((screen.getByLabelText('sql') as HTMLTextAreaElement).value).toBe('CREATE TABLE old (id INT);')
  })
})

describe('Fullstack import: from a database', () => {
  it('reads entities into the preview and imports them', async () => {
    const calls = stub({
      '/metadata/live-schema/schemas': SCHEMAS,
      '/metadata/live-schema/tables': TABLES,
      '/metadata/fullstack/import-live': () => json({
        entities: [{ name: 'ActiveStaff', tableName: null, fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: false, required: true, unique: false, length: null, enumValues: [] }], readOnly: true, viewQuery: 'SELECT id FROM hr.active_staff', relations: [] }],
        note: 'A view has no key: its first column was made the key — check it in the editor.',
      }),
    })
    const onImport = vi.fn()
    render(<ImportFromDdlDrawer isOpen onClose={() => {}} hasExisting={false} onImport={onImport} />)
    fireEvent.click(screen.getByRole('radio', { name: /From a database/ }))
    expect(screen.queryByLabelText('DDL')).toBeNull()
    // The panel offers the database type itself; the source is PostgreSQL's.
    expect((await screen.findByLabelText('Database type') as HTMLSelectElement).value).toBe('POSTGRESQL')
    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }))
    fireEvent.click(await screen.findByLabelText('Read active_staff'))
    fireEvent.click(screen.getByRole('button', { name: 'Read 1 into the preview' }))
    expect(await screen.findByText(/first column was made the key/)).toBeTruthy()
    expect(calls.find(c => c.url === '/metadata/fullstack/import-live')?.body).toMatchObject({ schema: 'hr', tables: ['active_staff'] })
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 entity' }))
    await waitFor(() => expect(onImport).toHaveBeenCalled())
    expect(onImport.mock.calls[0][0][0]).toMatchObject({ name: 'ActiveStaff', readOnly: true, viewQuery: 'SELECT id FROM hr.active_staff' })
  })
})

describe('Schema sources (admin)', () => {
  it('checks what the server would refuse', () => {
    expect(validateSchemaSource({ name: '', dialect: 'POSTGRESQL', host: '', username: '' }))
      .toMatchObject({ name: 'Required', host: 'Required', username: 'Required', databaseName: 'Required' })
    expect(validateSchemaSource({ name: 'x', dialect: 'DB2', host: 'as400', username: 'u' })).toEqual({})
    expect(validateSchemaSource({ name: 'x', dialect: 'DB2', host: 'as400', username: 'u', passwordRef: 'admin.password' }).passwordRef)
      .toContain('SCHEMA_SOURCE_')
    expect(PASSWORD_REF.test('SCHEMA_SOURCE_HR')).toBe(true)
    expect(PASSWORD_REF.test('menora.live-schema.secrets.hr')).toBe(true)
  })
})
