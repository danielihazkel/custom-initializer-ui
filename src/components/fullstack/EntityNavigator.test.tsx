import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EntityNavigator, entityMatches } from './EntityNavigator'
import { withUids } from './uid'
import type { FullstackEntityDef } from '../../types'

const entities: FullstackEntityDef[] = withUids([
  { name: 'Customer', label: 'Client', tableName: 'crm_customers', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'email', type: 'STRING' }] },
  { name: 'Order', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'total', type: 'BIG_DECIMAL' }] },
  { name: 'MonthlySales', viewQuery: 'SELECT 1', fields: [{ name: 'month', type: 'STRING', primaryKey: true }] },
])

describe('entityMatches', () => {
  it('matches name, labels, table and field names, case-insensitively', () => {
    expect(entityMatches(entities[0], 'cust')).toBe(true)
    expect(entityMatches(entities[0], 'CLIENT')).toBe(true)
    expect(entityMatches(entities[0], 'crm_')).toBe(true)
    expect(entityMatches(entities[0], 'email')).toBe(true)
    expect(entityMatches(entities[0], 'total')).toBe(false)
    expect(entityMatches(entities[1], '  ')).toBe(true)
  })
})

describe('EntityNavigator', () => {
  function renderNav(filter = '') {
    const onSelect = vi.fn()
    const onFilterChange = vi.fn()
    render(
      <EntityNavigator
        entities={entities}
        errorCounts={{ 1: 2 }}
        lintCounts={new Map([[entities[0].uid!, 1]])}
        filter={filter}
        onFilterChange={onFilterChange}
        onSelect={onSelect}
        activeUid={entities[2].uid!}
      />,
    )
    return { onSelect, onFilterChange }
  }

  it('lists every entity with its badges and highlights the active one', () => {
    renderNav()
    expect(screen.getByText('Customer')).toBeTruthy()
    expect(screen.getByTitle('2 issues')).toBeTruthy()
    expect(screen.getByTitle('1 suggestion')).toBeTruthy()
    const active = screen.getByText('MonthlySales').closest('button')!
    expect(active.getAttribute('aria-current')).toBe('true')
  })

  it('narrows the rows to the filter and reveals a row on click / Enter', () => {
    const { onSelect, onFilterChange } = renderNav('ord')
    expect(screen.queryByText('Customer')).toBeNull()
    fireEvent.click(screen.getByText('Order'))
    expect(onSelect).toHaveBeenCalledWith(entities[1].uid)
    const input = screen.getByLabelText('Find entity')
    fireEvent.change(input, { target: { value: 'x' } })
    expect(onFilterChange).toHaveBeenCalledWith('x')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onFilterChange).toHaveBeenCalledWith('')
  })

  it('says when nothing matches', () => {
    renderNav('zzz')
    expect(screen.getByText(/No entity matches/)).toBeTruthy()
  })
})
