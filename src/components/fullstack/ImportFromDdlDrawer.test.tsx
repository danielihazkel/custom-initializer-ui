import { describe, it, expect } from 'vitest'
import { dialectOptions } from './ImportFromDdlDrawer'

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
