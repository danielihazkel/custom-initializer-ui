import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ImportFromDdlDrawer, dialectOptions } from './ImportFromDdlDrawer'

describe('dialectOptions', () => {
  it('derives distinct dialects from the depId → dialect catalog, H2 first, with display names', () => {
    const options = dialectOptions({ postgresql: 'POSTGRESQL', 'postgresql-r2dbc': 'POSTGRESQL', mysql: 'MYSQL', h2: 'H2', exotic: 'EXOTICDB' })
    expect(options.map(o => o.value)).toEqual(['H2', 'POSTGRESQL', 'MYSQL', 'EXOTICDB'])
    expect(options.map(o => o.label)).toEqual(['H2', 'PostgreSQL', 'MySQL', 'EXOTICDB'])
  })
  it('falls back to the built-in list while the catalog is empty or failed', () => {
    expect(dialectOptions({}).map(o => o.value)).toEqual(['H2', 'POSTGRESQL', 'MYSQL', 'MSSQL', 'ORACLE', 'DB2'])
  })
})

describe('ImportFromDdlDrawer — parse, edit, re-parse', () => {
  const wireField = { type: 'LONG', primaryKey: true, generated: true, required: true, unique: false, length: null, enumValues: [] as string[] }
  const parsedBody = {
    entities: [
      { name: 'Product', tableName: 'products', fields: [{ name: 'id', ...wireField }] },
      { name: 'Category', tableName: 'categories', fields: [{ name: 'id', ...wireField }] },
    ],
  }
  afterEach(() => { vi.unstubAllGlobals() })

  it('keeps the preview and ticks after the SQL changes, marks it stale, and re-parses on Save', async () => {
    const importCalls: string[] = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/metadata/sql-dialects') return { ok: true, json: async () => ({ h2: 'H2' }) }
      importCalls.push(JSON.parse(String(init?.body)).sql as string)
      return { ok: true, json: async () => parsedBody }
    })
    vi.stubGlobal('fetch', fetchMock)
    const onImport = vi.fn()
    render(<ImportFromDdlDrawer isOpen onClose={vi.fn()} hasExisting={false} onImport={onImport} />)

    const sql = screen.getByLabelText('DDL')
    fireEvent.change(sql, { target: { value: 'CREATE TABLE products (id BIGINT PRIMARY KEY);' } })
    fireEvent.click(screen.getByRole('button', { name: 'Parse' }))
    await waitFor(() => expect(screen.getByText('Product')).toBeTruthy())
    // Untick one of the two parsed entities.
    fireEvent.click(screen.getByLabelText('Import Category'))
    expect(screen.getByRole('button', { name: 'Import 1 of 2' })).toBeTruthy()

    // A further keystroke no longer wipes the preview…
    fireEvent.change(sql, { target: { value: 'CREATE TABLE products (id BIGINT PRIMARY KEY, sku VARCHAR(10));' } })
    expect(screen.getByText('Product')).toBeTruthy()
    expect(document.querySelector('[data-import-preview][data-stale]')).toBeTruthy()
    expect(screen.getByText(/Parse again to refresh/)).toBeTruthy()

    // …and Save re-parses (with the new SQL) instead of importing the stale preview, keeping
    // the untick by entity name.
    fireEvent.click(screen.getByRole('button', { name: 'Parse again' }))
    await waitFor(() => expect(importCalls).toHaveLength(2))
    expect(importCalls[1]).toContain('sku')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Import 1 of 2' })).toBeTruthy())
    expect(onImport).not.toHaveBeenCalled()
    expect(document.querySelector('[data-stale]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Import 1 of 2' }))
    await waitFor(() => expect(onImport).toHaveBeenCalled())
    const [entities, mode] = onImport.mock.calls[0]
    expect(entities.map((e: { name: string }) => e.name)).toEqual(['Product'])
    expect(mode).toBe('replace')
  })

  it('keeps the DDL column names on the imported fields and relations', async () => {
    const body = {
      entities: [
        { name: 'Customer', tableName: 'CUSTOMERS', fields: [{ name: 'custNo', ...wireField, column: 'CUST_NO' }] },
        {
          name: 'Order', tableName: 'ORDERS',
          fields: [
            { name: 'ordNo', ...wireField, column: 'ORD_NO' },
            { ...wireField, name: 'frfQodMishloahFutureUse8', type: 'STRING', primaryKey: false, column: 'FRF_QOD_MISHLOAH_FUTURE_USE_8' },
          ],
          relations: [{ type: 'MANY_TO_ONE', fieldName: 'custRef', targetEntity: 'Customer', required: true, joinColumn: 'CUST_REF' }],
        },
      ],
    }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/metadata/sql-dialects') return { ok: true, json: async () => ({ h2: 'H2' }) }
      return { ok: true, json: async () => body }
    }))
    const onImport = vi.fn()
    render(<ImportFromDdlDrawer isOpen onClose={vi.fn()} hasExisting={false} onImport={onImport} />)
    fireEvent.change(screen.getByLabelText('DDL'), { target: { value: 'CREATE TABLE ORDERS (ORD_NO INT PRIMARY KEY);' } })
    fireEvent.click(screen.getByRole('button', { name: 'Parse' }))
    await waitFor(() => expect(screen.getByText('Order')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 entities' }))
    await waitFor(() => expect(onImport).toHaveBeenCalled())
    const order = onImport.mock.calls[0][0][1]
    expect(order.fields.map((f: { column?: string }) => f.column)).toEqual(['ORD_NO', 'FRF_QOD_MISHLOAH_FUTURE_USE_8'])
    expect(order.relations[0].joinColumn).toBe('CUST_REF')
  })
})
