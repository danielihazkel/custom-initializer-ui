import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { PagesEditor } from './PagesEditor'
import { validatePages } from './pageLayout'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Order',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] },
    ],
    relations: [
      { type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' },
      { type: 'MANY_TO_ONE', fieldName: 'billTo', targetEntity: 'Customer' },
    ],
  },
]

const pushUndo = vi.fn()
let latest: FullstackPageDef[] = []

/** The editor is controlled; the harness holds the layout the way FullstackView does. */
function Harness({ initial, onClear = () => {} }: { initial: FullstackPageDef[]; onClear?: () => void }) {
  const [pages, setPages] = useState(initial)
  latest = pages
  return (
    <PagesEditor
      pages={pages}
      entities={entities}
      validation={validatePages(pages, entities)}
      onChange={setPages}
      pushUndo={pushUndo}
      onClear={onClear}
    />
  )
}

const openRow = (id: string) => {
  const row = document.querySelector(`[data-page-id="${id}"]`)!
  fireEvent.click(row.querySelector('button[aria-expanded]')!)
  return row
}

describe('PagesEditor', () => {
  it('adds a page of the chosen type, pre-filled so it is valid on sight', () => {
    render(<Harness initial={[]} />)
    expect(screen.getByText('Classic layout')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Add page/ }))
    fireEvent.click(screen.getByRole('button', { name: /Master–detail/ }))

    expect(latest).toEqual([{ id: 'customer', type: 'master-detail', parent: 'Customer', child: 'Order' }])
    // Two relations point at Customer, so the page must say which one it links through.
    expect(screen.getByLabelText('Relation to link through')).toBeTruthy()
    expect(document.querySelector('[data-page-layout-problems]')?.textContent)
      .toContain('must say which of the relations of Order to Customer it links through')

    fireEvent.change(screen.getByLabelText('Relation to link through'), { target: { value: 'billTo' } })
    expect(latest[0].via).toBe('billTo')
    expect(document.querySelector('[data-page-layout-problems]')).toBeNull()
  })

  it('derives the id from the title until the id is edited by hand', () => {
    render(<Harness initial={[{ id: 'orders', type: 'entity-list', entity: 'Order' }]} />)
    openRow('orders')

    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Open orders' } })
    expect(latest[0]).toMatchObject({ id: 'open-orders', title: 'Open orders' })

    fireEvent.change(screen.getByLabelText('Page id'), { target: { value: 'queue' } })
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Order queue' } })
    expect(latest[0]).toMatchObject({ id: 'queue', title: 'Order queue' })
  })

  it('edits a list page: entity and preset filter, with the filter values of that field', () => {
    render(<Harness initial={[{ id: 'orders', type: 'entity-list', entity: 'Order' }]} />)
    openRow('orders')

    fireEvent.click(screen.getByRole('button', { name: /Add filter/ }))
    expect(latest[0].presetFilter).toEqual({ status: 'OPEN' })
    fireEvent.change(screen.getByLabelText('Filter value for status'), { target: { value: 'PAID' } })
    expect(latest[0].presetFilter).toEqual({ status: 'PAID' })
    expect(document.querySelector('[data-page-id="orders"]')?.textContent).toContain('filtered on status = PAID')

    fireEvent.click(screen.getByRole('button', { name: 'Remove the status filter' }))
    expect(latest[0].presetFilter).toBeUndefined()
    // Customer has no enum/boolean field, so it offers no preset filter at all.
    fireEvent.change(screen.getByLabelText('List entity'), { target: { value: 'Customer' } })
    expect(screen.queryByRole('button', { name: /Add filter/ })).toBeNull()
  })

  it('edits dashboard widgets, including the field a breakdown groups by', () => {
    render(<Harness initial={[{ id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }] }]} />)
    openRow('home')

    fireEvent.click(screen.getByRole('button', { name: /Add widget/ }))
    expect(latest[0].widgets).toHaveLength(2)

    const kinds = screen.getAllByLabelText('Widget kind')
    fireEvent.change(kinds[1], { target: { value: 'bar' } })
    fireEvent.change(screen.getAllByLabelText('Widget entity')[1], { target: { value: 'Order' } })
    fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'status' } })
    expect(latest[0].widgets?.[1]).toEqual({ kind: 'bar', entity: 'Order', groupBy: 'status' })

    fireEvent.click(screen.getByRole('button', { name: 'Remove widget 2' }))
    expect(latest[0].widgets).toHaveLength(1)
  })

  it('offers the record page its related lists, all on until one is switched off', () => {
    render(<Harness initial={[
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true },
      { id: 'customers', type: 'entity-list', entity: 'Customer' },
    ]} />)
    const row = openRow('customer')
    // A record page opens from a row, so it has no "hide from the navigation" toggle.
    expect(row.textContent).toContain('One Customer · its related lists')
    expect(row.querySelector('[aria-pressed]')).toBeNull()

    const order = screen.getByRole('checkbox', { name: 'Order' }) as HTMLInputElement
    expect(order.checked).toBe(true)
    fireEvent.click(order)
    expect(latest[0].childTabs).toEqual([])
    expect(row.textContent).toContain('no related lists')
  })

  it('hides a page from the navigation and removes one undoably', () => {
    render(<Harness initial={[
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }] },
      { id: 'orders', type: 'entity-list', entity: 'Order' },
    ]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Hide Order from the navigation' }))
    expect(latest[1].hidden).toBe(true)
    expect(document.querySelector('[data-page-id="orders"]')?.textContent).toContain('Tab only')

    pushUndo.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Order' }))
    expect(pushUndo).toHaveBeenCalledWith('Removed the “Order” page')
    expect(latest.map(p => p.id)).toEqual(['home'])
  })

  it('seeds a layout from the entities, and offers the classic shell back', () => {
    const onClear = vi.fn()
    render(<Harness initial={[]} onClear={onClear} />)
    expect(screen.queryByRole('button', { name: /Use classic layout/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Start from my entities/ }))
    expect(latest.map(p => p.id)).toEqual(['dashboard', 'customer', 'order'])

    fireEvent.click(screen.getByRole('button', { name: /Use classic layout/ }))
    expect(onClear).toHaveBeenCalled()
  })
})
