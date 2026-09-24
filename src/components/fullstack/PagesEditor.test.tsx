import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
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
      { name: 'total', type: 'BIG_DECIMAL' },
      { name: 'placedOn', type: 'LOCAL_DATE' },
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
function Harness({ initial, onClear = () => {}, entities: model = entities }: { initial: FullstackPageDef[]; onClear?: () => void; entities?: FullstackEntityDef[] }) {
  const [pages, setPages] = useState(initial)
  latest = pages
  return (
    <PagesEditor
      pages={pages}
      entities={model}
      validation={validatePages(pages, model)}
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
    expect(latest[0]).toMatchObject({ id: 'queue', title: 'Order queue', idLocked: true })
  })

  it('keeps a hand-edited id that came stored with the page, and can follow the title again', () => {
    // The lock lives on the page (it is what a reload or an example load restores), not in the editor.
    render(<Harness initial={[{ id: 'queue', idLocked: true, type: 'entity-list', entity: 'Order', title: 'Order queue' }]} />)
    openRow('queue')
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Open orders' } })
    expect(latest[0]).toMatchObject({ id: 'queue', title: 'Open orders' })

    fireEvent.click(screen.getByRole('button', { name: 'Follow the title again' }))
    expect(latest[0]).toMatchObject({ id: 'open-orders', title: 'Open orders' })
    expect(latest[0].idLocked).toBeUndefined()
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Orders' } })
    expect(latest[0].id).toBe('orders')
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
    fireEvent.click(screen.getByRole('button', { name: 'Add number tile' }))
    expect(latest[0].widgets).toHaveLength(2)

    const kinds = screen.getAllByRole('radiogroup', { name: 'Widget kind' })
    fireEvent.click(within(kinds[1]).getByRole('radio', { name: 'Breakdown chart' }))
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

  it('turns a widget into a trend, and offers the date field and bucket it needs', () => {
    render(<Harness initial={[{ id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }] }]} />)
    openRow('home')

    expect(screen.queryByLabelText('Date field')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Trend over time' }))
    expect(latest[0].widgets?.[0]).toEqual({ kind: 'line', entity: 'Order' })

    fireEvent.change(screen.getByLabelText('Date field'), { target: { value: 'placedOn' } })
    fireEvent.change(screen.getByLabelText('Bucket'), { target: { value: 'year' } })
    expect(latest[0].widgets?.[0]).toMatchObject({ groupBy: 'placedOn', bucket: 'year' })
    expect(document.querySelector('[data-page-id="home"]')?.textContent).toContain('1 trend')
  })

  it('asks for a numeric field once a tile stops counting, and drops it when it counts again', () => {
    render(<Harness initial={[{ id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }] }]} />)
    openRow('home')

    // A count needs no field, so no field picker is offered.
    expect(screen.queryByLabelText('Value field')).toBeNull()
    fireEvent.change(screen.getByLabelText('Aggregate'), { target: { value: 'sum' } })
    // Order has one numeric field, so it is picked straight away.
    expect(latest[0].widgets?.[0]).toEqual({ kind: 'kpi', entity: 'Order', agg: 'sum', field: 'total' })
    fireEvent.change(screen.getByLabelText('Value field'), { target: { value: '' } })
    expect(latest[0].widgets?.[0]).toMatchObject({ agg: 'sum', field: undefined })
    expect(document.querySelector('[data-page-layout-problems]')?.textContent)
      .toContain('reduces Order with sum but names no numeric field')

    fireEvent.change(screen.getByLabelText('Value field'), { target: { value: 'total' } })
    expect(latest[0].widgets?.[0]).toMatchObject({ agg: 'sum', field: 'total' })
    expect(document.querySelector('[data-page-layout-problems]')).toBeNull()

    fireEvent.change(screen.getByLabelText('Aggregate'), { target: { value: 'count' } })
    expect(latest[0].widgets?.[0]).toEqual({ kind: 'kpi', entity: 'Order', agg: undefined, field: undefined })
  })

  it('adds a report page and configures its chart', () => {
    render(<Harness initial={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /Add page/ }))
    fireEvent.click(screen.getByRole('button', { name: /Report/ }))

    // Pre-filled with an entity that has something to chart, so it is valid on sight.
    expect(latest).toEqual([{ id: 'order-report', type: 'report', entity: 'Order', chart: {} }])
    expect(document.querySelector('[data-page-layout-problems]')).toBeNull()

    // A date grouping reveals the bucket; an enum one does not.
    expect(screen.queryByLabelText('Bucket')).toBeNull()
    fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'placedOn' } })
    fireEvent.change(screen.getByLabelText('Bucket'), { target: { value: 'month' } })
    fireEvent.change(screen.getByLabelText('Aggregate'), { target: { value: 'sum' } })
    fireEvent.change(screen.getByLabelText('Value field'), { target: { value: 'total' } })
    expect(latest[0].chart).toEqual({ groupBy: 'placedOn', bucket: 'month', agg: 'sum', field: 'total' })
    expect(document.querySelector('[data-page-id="order-report"]')?.textContent)
      .toContain('sum of total by placedOn per month')
  })

  it('seeds a layout from the entities, and offers the classic shell back', () => {
    const onClear = vi.fn()
    render(<Harness initial={[]} onClear={onClear} />)
    expect(screen.queryByRole('button', { name: /Use classic layout/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Start from my entities/ }))
    expect(latest.map(p => p.id)).toEqual(['dashboard', 'customer', 'order'])

    fireEvent.click(screen.getByRole('button', { name: /Use classic layout/ }))
    expect(onClear).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Use classic layout' }))
    expect(onClear).toHaveBeenCalled()
  })

  it('keeps the tabs pointing at a page when the page is renamed', () => {
    render(<Harness initial={[
      { id: 'open', type: 'entity-list', entity: 'Order', hidden: true },
      { id: 'all', type: 'entity-list', entity: 'Order', hidden: true },
      { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'open' }, { page: 'all' }] },
    ]} />)
    openRow('open')
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Open orders' } })
    expect(latest[0].id).toBe('open-orders')
    expect(latest[2].tabs).toEqual([{ page: 'open-orders' }, { page: 'all' }])

    fireEvent.change(screen.getByLabelText('Page id'), { target: { value: 'inbox' } })
    expect(latest[2].tabs?.[0].page).toBe('inbox')
    expect(document.querySelector('[data-page-layout-problems]')).toBeNull()
  })

  it('warns before removing a page that is a tab, and removes the tab with it', () => {
    render(<Harness initial={[
      { id: 'open', type: 'entity-list', entity: 'Order', hidden: true },
      { id: 'all', type: 'entity-list', entity: 'Order' },
      { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'open' }, { page: 'all' }] },
    ]} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove Order' })[0])
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('It is a tab of “Queue”')
    expect(latest).toHaveLength(3)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove page and tab' }))
    expect(latest.map(p => p.id)).toEqual(['all', 'queue'])
    expect(latest[1].tabs).toEqual([{ page: 'all' }])
  })

  it('keeps the open page open when it is moved, and moves pages from the keyboard', () => {
    render(<Harness initial={[
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }] },
      { id: 'orders', type: 'entity-list', entity: 'Order' },
    ]} />)
    openRow('orders')
    fireEvent.click(screen.getByRole('button', { name: 'Move Order up' }))
    expect(latest.map(p => p.id)).toEqual(['orders', 'home'])
    // The open form followed the page, not the position.
    expect(screen.getByLabelText('List entity')).toBeTruthy()
    expect(document.querySelector('[data-page-id="orders"] [aria-expanded="true"]')).toBeTruthy()
    expect(document.querySelector('[data-page-id="orders"] [data-start-page]')).toBeTruthy()
  })

  it('duplicates a page and a widget', () => {
    render(<Harness initial={[{ id: 'home', type: 'dashboard', widgets: [{ kind: 'bar', entity: 'Order', groupBy: 'status' }] }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Dashboard' }))
    expect(latest.map(p => p.id)).toEqual(['home', 'home-copy'])
    expect(latest[1]).toMatchObject({ title: 'Dashboard (copy)', widgets: [{ kind: 'bar', entity: 'Order', groupBy: 'status' }] })

    // The copy opens, so its widget is the one on screen.
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate widget 1' }))
    expect(latest[1].widgets).toHaveLength(2)
  })

  it('says which field a default resolves to', () => {
    render(<Harness initial={[{ id: 'home', type: 'dashboard', widgets: [{ kind: 'bar', entity: 'Order' }] }]} />)
    openRow('home')
    const groupBy = screen.getByLabelText('Group by') as HTMLSelectElement
    expect(groupBy.options[0].textContent).toBe('Default (status)')
  })

  it('starts a tabs page from two existing pages, so it is valid on sight', () => {
    render(<Harness initial={[
      { id: 'orders', type: 'entity-list', entity: 'Order' },
      { id: 'customers', type: 'entity-list', entity: 'Customer' },
    ]} />)
    fireEvent.click(screen.getByRole('button', { name: /Add page/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Tabs/ }))
    expect(latest[2]).toMatchObject({ type: 'tabs', tabs: [{ page: 'orders' }, { page: 'customers' }] })
    expect(document.querySelector('[data-page-layout-problems]')).toBeNull()
    // Every candidate is already a tab.
    expect((screen.getByRole('button', { name: /Add tab/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('offers pages the model is shaped for', () => {
    render(<Harness initial={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /Add page/ }))
    const suggestion = document.querySelector('[data-suggestion="record:Customer"]') as HTMLButtonElement
    fireEvent.click(suggestion)
    expect(latest).toEqual([{ id: 'customer', type: 'record', entity: 'Customer', hidden: true }])
  })

  it('opens the page at the problem when the problem is clicked', () => {
    render(<Harness initial={[
      { id: 'orders', type: 'entity-list', entity: 'Order' },
      { id: 'desk', type: 'master-detail', parent: 'Customer', child: 'Order' },
    ]} />)
    expect(screen.queryByLabelText('Relation to link through')).toBeNull()
    // The problem itself opens the page; the "Fix" beside it is a separate button.
    fireEvent.click(within(document.querySelector('[data-page-layout-problems]') as HTMLElement).getByRole('button', { name: /must say which/ }))
    expect(screen.getByLabelText('Relation to link through')).toBeTruthy()
  })

  it('previews the layout and jumps from the preview to the editor', () => {
    render(<Harness initial={[
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }, { kind: 'bar', entity: 'Order' }] },
      { id: 'orders', type: 'entity-list', entity: 'Order', presetFilter: { status: 'PAID' } },
    ]} />)
    const preview = document.querySelector('[data-layout-preview]') as HTMLElement
    expect(preview.querySelectorAll('[data-preview-widget]')).toHaveLength(2)

    fireEvent.click(within(preview).getByRole('button', { name: /Orders/ }))
    expect(preview.querySelector('[data-preview-screen="entity-list"]')).toBeTruthy()
    expect(preview.querySelector('[data-preview-chip]')?.textContent).toBe('Status: Paid')

    fireEvent.click(within(preview).getByRole('button', { name: 'Edit the listed entity' }))
    expect(screen.getByLabelText('List entity')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Hide preview/ }))
    expect(document.querySelector('[data-layout-preview]')).toBeNull()
  })

  it('places a nav page in a group with an icon, and drops both when the page is hidden', () => {
    render(<Harness initial={[{ id: 'orders', type: 'entity-list', entity: 'Order' }, { id: 'customers', type: 'entity-list', entity: 'Customer' }]} />)
    const row = openRow('orders')

    fireEvent.change(within(row as HTMLElement).getByLabelText('Nav group'), { target: { value: 'Sales' } })
    fireEvent.click(within(row as HTMLElement).getByRole('radio', { name: 'Cart' }))
    expect(latest[0]).toMatchObject({ group: 'Sales', icon: 'ShoppingCart' })
    // Picking the type's own icon again stores nothing.
    fireEvent.click(within(row as HTMLElement).getByRole('radio', { name: 'Table (default)' }))
    expect(latest[0].icon).toBeUndefined()

    fireEvent.click(within(row as HTMLElement).getByRole('radio', { name: 'Cart' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide Order from the navigation' }))
    expect(latest[0]).toMatchObject({ hidden: true })
    expect(latest[0].group).toBeUndefined()
    expect(latest[0].icon).toBeUndefined()
    expect(within(row as HTMLElement).queryByLabelText('Nav group')).toBeNull()
  })

  it('sets a dashboard period picker and a widget’s width, filter and sort', () => {
    render(<Harness initial={[{ id: 'desk', type: 'dashboard', widgets: [{ kind: 'recent', entity: 'Order' }] }]} />)
    const row = openRow('desk') as HTMLElement

    fireEvent.change(within(row).getByLabelText('Period picker'), { target: { value: '90d' } })
    expect(latest[0].dateRange).toBe('90d')

    const options = row.querySelector('[data-widget-options]') as HTMLElement
    fireEvent.click(within(options).getByRole('radio', { name: '4 columns' }))
    fireEvent.change(within(options).getByLabelText('Sort by'), { target: { value: 'placedOn' } })
    fireEvent.change(within(options).getByLabelText('Period date field'), { target: { value: 'placedOn' } })
    fireEvent.click(within(options).getByRole('button', { name: /Add filter/ }))
    expect(latest[0].widgets?.[0]).toEqual({
      kind: 'recent', entity: 'Order', span: 4, sortBy: 'placedOn', dateField: 'placedOn', presetFilter: { status: 'OPEN' },
    })
    // Back to the default width stores nothing.
    fireEvent.click(within(options).getByRole('radio', { name: '2 columns (default)' }))
    expect(latest[0].widgets?.[0].span).toBeUndefined()

    // Turning the picker off drops the widgets' period dates with it.
    fireEvent.change(within(row).getByLabelText('Period picker'), { target: { value: '' } })
    expect(latest[0].dateRange).toBeUndefined()
    expect(latest[0].widgets?.[0].dateField).toBeUndefined()
    expect(validatePages(latest, entities).count).toBe(0)
  })

  it('edits a top list, a progress target and a report with two charts', () => {
    render(<Harness initial={[
      { id: 'desk', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }] },
      { id: 'r', type: 'report', entity: 'Order', chart: { groupBy: 'status' } },
    ]} />)
    const desk = openRow('desk') as HTMLElement
    fireEvent.click(within(desk).getByRole('radio', { name: 'Top list' }))
    fireEvent.change(within(desk).getByLabelText('Rank by'), { target: { value: 'customer' } })
    expect(latest[0].widgets?.[0]).toMatchObject({ kind: 'top', groupBy: 'customer' })
    fireEvent.click(within(desk).getByRole('radio', { name: 'Progress to target' }))
    fireEvent.change(within(desk).getByLabelText('Target'), { target: { value: '750' } })
    expect(latest[0].widgets?.[0]).toMatchObject({ kind: 'progress', target: '750' })
    expect(latest[0].widgets?.[0].groupBy).toBeUndefined()
    // Comparing needs the period picker first.
    fireEvent.click(within(desk).getByRole('radio', { name: 'Number tile' }))
    expect((within(desk).getByRole('checkbox', { name: 'vs previous period' }) as HTMLInputElement).disabled).toBe(true)

    const report = openRow('r') as HTMLElement
    fireEvent.click(within(report).getByRole('button', { name: /Add chart/ }))
    expect(latest[1].chart).toBeUndefined()
    expect(latest[1].charts).toEqual([{ groupBy: 'status' }, {}])
    fireEvent.click(within(report).getByRole('button', { name: 'Remove chart 1' }))
    // Back to one chart: the one-chart spelling again.
    expect(latest[1]).toMatchObject({ chart: {} })
    expect(latest[1].charts).toBeUndefined()
  })

  it('adds a wizard with its steps spelled out, and moves a field between steps', () => {
    render(<Harness initial={[{ id: 'orders', type: 'entity-list', entity: 'Order' }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Add page/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Wizard/ }))
    const wizard = latest[1]
    expect(wizard).toMatchObject({ type: 'wizard', entity: 'Customer', steps: [{ fields: ['id', 'name'] }] })

    const row = document.querySelector(`[data-page-id="${wizard.id}"]`) as HTMLElement
    fireEvent.change(within(row).getByLabelText('Wizard entity'), { target: { value: 'Order' } })
    expect(latest[1].steps).toEqual([{ fields: ['id', 'status', 'total', 'placedOn'] }, { fields: ['customer', 'billTo'] }])
    // Taking a required field out is flagged; putting it in another step moves it.
    fireEvent.click(within(row).getByRole('button', { name: 'Take id out of step 1' }))
    expect(document.querySelector('[data-page-layout-problems]')?.textContent).toContain('never asks for “id”')
    fireEvent.change(within(row).getByLabelText('Add a field to step 2'), { target: { value: 'id' } })
    expect(latest[1].steps?.[1].fields).toEqual(['customer', 'billTo', 'id'])
    expect(validatePages(latest, entities).byPage[1]).toBeUndefined()
  })

  it('switches a record page’s header numbers between the default, none and a chosen list', () => {
    render(<Harness initial={[
      { id: 'orders', type: 'entity-list', entity: 'Order' },
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true },
    ]} />)
    const row = openRow('customer') as HTMLElement
    fireEvent.click(within(row).getByRole('radio', { name: 'None' }))
    expect(latest[1].headerStats).toEqual([])
    fireEvent.click(within(row).getByRole('radio', { name: 'Choose' }))
    expect(latest[1].headerStats).toEqual([{ child: 'Order' }])
    fireEvent.click(within(row).getByRole('radio', { name: 'A count per tab' }))
    expect(latest[1].headerStats).toBeUndefined()
  })

  it('keeps a widget’s settings across a kind switch and says what it dropped', () => {
    pushUndo.mockClear()
    render(<Harness initial={[{ id: 'desk', type: 'dashboard', widgets: [{ kind: 'progress', entity: 'Order', agg: 'sum', field: 'total', target: '900' }] }]} />)
    const row = openRow('desk') as HTMLElement
    fireEvent.click(within(row).getByRole('radio', { name: 'Number tile' }))
    expect(latest[0].widgets?.[0]).toEqual({ kind: 'kpi', entity: 'Order', agg: 'sum', field: 'total' })
    expect(pushUndo).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-pages-notice]')?.textContent).toContain('dropped the target setting')
    // A switch that keeps everything is silent.
    fireEvent.click(within(row).getByRole('radio', { name: 'Breakdown chart' }))
    expect(latest[0].widgets?.[0]).toMatchObject({ kind: 'bar', agg: 'sum', field: 'total' })
    expect(pushUndo).toHaveBeenCalledTimes(1)
  })

  it('configures how a list page opens: columns, sort, view and rows per page', () => {
    const board: FullstackEntityDef[] = [entities[0], { ...entities[1], listViews: ['table', 'kanban'] }]
    render(<Harness initial={[{ id: 'orders', type: 'entity-list', entity: 'Order' }]} entities={board} />)
    const row = openRow('orders') as HTMLElement

    // Every column is shown by default; hiding one writes the rest, in order; showing it again appends it.
    fireEvent.click(within(row).getByRole('button', { name: 'Hide the Id column' }))
    expect(latest[0].columns).toEqual(['status', 'total', 'placedOn', 'customer', 'billTo'])
    fireEvent.click(within(row).getByRole('button', { name: 'Show the Id column' }))
    expect(latest[0].columns).toEqual(['status', 'total', 'placedOn', 'customer', 'billTo', 'id'])
    fireEvent.click(within(row).getByRole('button', { name: 'All columns (default)' }))
    expect(latest[0].columns).toBeUndefined()

    // Sort: a sortable column (relations are not offered) and a direction.
    const sort = within(row).getByLabelText('Sort rows by') as HTMLSelectElement
    expect(Array.from(sort.options).map(o => o.value)).toEqual(['', 'id', 'status', 'total', 'placedOn'])
    fireEvent.change(sort, { target: { value: 'placedOn' } })
    expect(latest[0].sort).toEqual({ field: 'placedOn' })
    fireEvent.click(within(row).getByRole('radio', { name: 'Descending' }))
    expect(latest[0].sort).toEqual({ field: 'placedOn', dir: 'desc' })

    // Views: only the ones the entity offers can be picked; the others say why not.
    const views = within(row.querySelector('[data-control="view"]') as HTMLElement)
    const calendar = views.getByRole('radio', { name: 'Calendar' }) as HTMLButtonElement
    expect(calendar.disabled).toBe(true)
    expect(calendar.title).toBe('Not ticked in the list views of Order')
    fireEvent.click(views.getByRole('radio', { name: 'Board' }))
    expect(latest[0].view).toBe('kanban')
    expect(row.textContent).toContain('Order list · board · by placedOn ↓')
    fireEvent.click(views.getByRole('radio', { name: 'Table' }))
    expect(latest[0].view).toBeUndefined()

    fireEvent.change(within(row).getByLabelText('Rows per page'), { target: { value: '50' } })
    expect(latest[0].pageSize).toBe(50)
    expect(validatePages(latest, board).count).toBe(0)
  })

  it('keeps a list page’s presentation across an entity switch and names what it dropped', () => {
    pushUndo.mockClear()
    render(<Harness initial={[{ id: 'orders', type: 'entity-list', entity: 'Order', columns: ['status', 'id'], sort: { field: 'total' } }]} />)
    const row = openRow('orders') as HTMLElement
    fireEvent.change(within(row).getByLabelText('List entity'), { target: { value: 'Customer' } })
    expect(latest[0]).toMatchObject({ entity: 'Customer', columns: ['id'] })
    expect(latest[0].sort).toBeUndefined()
    expect(document.querySelector('[data-pages-notice]')?.textContent).toContain('dropped the columns, sort settings')
    expect(pushUndo).toHaveBeenCalledTimes(1)
  })

  it('says what a record entity switch and a period-picker switch-off drop', () => {
    pushUndo.mockClear()
    render(<Harness initial={[
      { id: 'desk', type: 'dashboard', dateRange: '30d', widgets: [{ kind: 'kpi', entity: 'Order', dateField: 'placedOn', compare: true }] },
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true, headerStats: [{ child: 'Order', title: 'Orders' }] },
    ]} />)
    const record = openRow('customer') as HTMLElement
    fireEvent.change(within(record).getByLabelText('Record entity'), { target: { value: 'Order' } })
    expect(latest[1].entity).toBe('Order')
    expect(latest[1].headerStats).toBeUndefined()
    expect(document.querySelector('[data-pages-notice]')?.textContent).toContain('dropped the header numbers setting')

    const desk = openRow('desk') as HTMLElement
    fireEvent.change(within(desk).getByLabelText('Period picker'), { target: { value: '' } })
    expect(latest[0].dateRange).toBeUndefined()
    expect(latest[0].widgets?.[0]).toEqual({ kind: 'kpi', entity: 'Order', dateField: undefined, compare: undefined })
    expect(document.querySelector('[data-pages-notice]')?.textContent).toContain('dropped the period date, period comparison settings')
    expect(pushUndo).toHaveBeenCalledTimes(2)
  })

  it('adds a widget of a chosen kind for a chosen entity from the gallery, and says why a kind does not fit', () => {
    render(<Harness initial={[{ id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }] }]} />)
    openRow('home')
    fireEvent.click(screen.getByRole('button', { name: /Add widget/ }))
    const gallery = document.querySelector('[data-widget-gallery]') as HTMLElement
    expect(gallery).toBeTruthy()
    // Starts from the last widget's entity (Order), where every kind fits.
    expect((within(gallery).getByLabelText('New widget entity') as HTMLSelectElement).value).toBe('Order')
    expect((within(gallery).getByRole('button', { name: 'Add trend over time' }) as HTMLButtonElement).disabled).toBe(false)

    // Customer has no enum, boolean or date: the chart kinds say so and cannot be picked.
    fireEvent.change(within(gallery).getByLabelText('New widget entity'), { target: { value: 'Customer' } })
    const trend = within(gallery).getByRole('button', { name: 'Add trend over time' }) as HTMLButtonElement
    expect(trend.disabled).toBe(true)
    expect(trend.title).toBe('Customer has no date field to plot over')
    expect((within(gallery).getByRole('button', { name: 'Add breakdown chart' }) as HTMLButtonElement).title).toBe('Customer has no enum or boolean field to break down by')
    expect((within(gallery).getByRole('button', { name: 'Add number tile' }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.change(within(gallery).getByLabelText('New widget entity'), { target: { value: 'Order' } })
    fireEvent.click(within(gallery).getByRole('button', { name: 'Add progress to target' }))
    expect(latest[0].widgets).toEqual([{ kind: 'kpi', entity: 'Order' }, { kind: 'progress', entity: 'Order', target: '100' }])
    expect(document.querySelector('[data-widget-gallery]')).toBeNull()
    expect(document.querySelector('[data-page-layout-problems]')).toBeNull()

    // The kind switcher on a card says the same thing for a Customer widget.
    fireEvent.click(screen.getByRole('button', { name: /Add widget/ }))
    fireEvent.change(screen.getByLabelText('New widget entity'), { target: { value: 'Customer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add number tile' }))
    const kinds = screen.getAllByRole('radiogroup', { name: 'Widget kind' })
    const radio = within(kinds[2]).getByRole('radio', { name: 'Trend over time' }) as HTMLButtonElement
    expect(radio.disabled).toBe(true)
    expect(radio.title).toBe('Customer has no date field to plot over')
  })

  it('splits a list page by an enum into hidden preset lists under a tabs page, as one undo step', () => {
    pushUndo.mockClear()
    render(<Harness initial={[{ id: 'orders', type: 'entity-list', entity: 'Order', columns: ['status', 'total'] }]} />)
    openRow('orders')
    fireEvent.click(screen.getByRole('button', { name: /Split into tabs/ }))

    expect(pushUndo).toHaveBeenCalledTimes(1)
    expect(pushUndo).toHaveBeenCalledWith('Split “Order” by status')
    expect(latest.map(p => p.id)).toEqual(['orders', 'orders-by-status', 'order-open', 'order-paid'])
    expect(latest[1]).toEqual({ id: 'orders-by-status', type: 'tabs', title: 'Orders by status', tabs: [{ page: 'order-open', title: 'Open' }, { page: 'order-paid', title: 'Paid' }] })
    expect(latest[2]).toEqual({ id: 'order-open', type: 'entity-list', entity: 'Order', hidden: true, presetFilter: { status: 'OPEN' }, columns: ['status', 'total'] })
    expect(document.querySelector('[data-page-layout-problems]')).toBeNull()

    // The split lists are already filtered on status, so they cannot be split by it again.
    openRow('order-open')
    const row = document.querySelector('[data-page-id="order-open"]') as HTMLElement
    const again = within(row).getByRole('button', { name: /Split into tabs/ }) as HTMLButtonElement
    expect(again.disabled).toBe(true)
    expect(again.title).toBe('This list is already filtered on status')
  })

  it('opens the gallery and the preview on request (the command palette)', () => {
    const initial: FullstackPageDef[] = [{ id: 'orders', type: 'entity-list', entity: 'Order' }]
    const props = { entities, validation: validatePages(initial, entities), onChange: () => {}, pushUndo, onClear: () => {} }
    const { rerender } = render(<PagesEditor pages={initial} {...props} />)
    expect(document.querySelector('[data-page-gallery]')).toBeNull()

    rerender(<PagesEditor pages={initial} {...props} addRequest={1} />)
    expect(document.querySelector('[data-page-gallery]')).toBeTruthy()

    // No matchMedia here (jsdom), so the preview opens as the slide-over.
    rerender(<PagesEditor pages={initial} {...props} addRequest={1} previewRequest={1} />)
    expect(document.querySelector('[data-preview-drawer]')).toBeTruthy()
  })

  it('says when a wizard entity switch starts the steps over, with an undo', () => {
    pushUndo.mockClear()
    render(<Harness initial={[{ id: 'new-order', type: 'wizard', entity: 'Order', steps: [{ title: 'Basics', fields: ['status', 'total', 'placedOn', 'customer'] }] }]} />)
    const row = openRow('new-order') as HTMLElement
    fireEvent.change(within(row).getByLabelText('Wizard entity'), { target: { value: 'Customer' } })
    expect(latest[0].entity).toBe('Customer')
    expect(latest[0].steps).toEqual([{ fields: ['id', 'name'] }])
    expect(document.querySelector('[data-pages-notice]')?.textContent).toContain('dropped the step layout setting')
    expect(pushUndo).toHaveBeenCalledTimes(1)
  })

  it('always offers page roles — disabled, with a shortcut, when no LDAP auth dependency is selected', () => {
    const onAddDep = vi.fn()
    const pages: FullstackPageDef[] = [{ id: 'orders', type: 'entity-list', entity: 'Order' }, { id: 'customers', type: 'entity-list', entity: 'Customer' }]
    render(
      <PagesEditor
        pages={pages}
        entities={entities}
        validation={validatePages(pages, entities)}
        onChange={() => {}}
        pushUndo={pushUndo}
        onClear={() => {}}
        ldapAuth={false}
        onAddDep={onAddDep}
      />,
    )
    const row = openRow('customers') as HTMLElement
    expect((within(row).getByLabelText('Only ADMIN') as HTMLInputElement).disabled).toBe(true)
    expect(row.textContent).toContain('Restricting pages needs ldap-auth-rest')
    fireEvent.click(within(row).getByRole('button', { name: /Add ldap-auth-rest/ }))
    expect(onAddDep).toHaveBeenCalledWith('ldap-auth-rest')
  })

  it('leaves the role boxes enabled when the dependency list is unknown', () => {
    render(<Harness initial={[{ id: 'orders', type: 'entity-list', entity: 'Order' }, { id: 'customers', type: 'entity-list', entity: 'Customer' }]} />)
    const row = openRow('customers') as HTMLElement
    fireEvent.click(within(row).getByLabelText('Only USER'))
    expect(latest[1].roles).toEqual(['USER'])
    expect(row.querySelector('[data-add-ldap-auth]')).toBeNull()
  })

  it('offers the bucket when a report groups over a date by default', () => {
    const events: FullstackEntityDef[] = [{ name: 'Event', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'on', type: 'LOCAL_DATE' }] }]
    render(<Harness initial={[{ id: 'r', type: 'report', entity: 'Event', chart: {} }]} entities={events} />)
    const row = openRow('r') as HTMLElement
    fireEvent.change(within(row).getByLabelText('Bucket'), { target: { value: 'year' } })
    expect(latest[0].chart).toEqual({ bucket: 'year' })
    expect(validatePages(latest, events).count).toBe(0)
  })

  it('resets wizard steps and record tabs to the generator defaults', () => {
    render(<Harness initial={[
      { id: 'new-order', type: 'wizard', entity: 'Order', steps: [{ fields: ['id', 'status', 'total', 'placedOn', 'customer', 'billTo'] }] },
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true, childTabs: [] },
    ]} />)
    let row = openRow('new-order') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Reset to default steps' }))
    expect(latest[0].steps).toBeUndefined()
    expect(within(row).queryByRole('button', { name: 'Reset to default steps' })).toBeNull()
    row = openRow('customer') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'All related lists (default)' }))
    expect(latest[1].childTabs).toBeUndefined()
    expect(within(row).queryByRole('button', { name: 'All related lists (default)' })).toBeNull()
  })

  it('collapses the widgets of a busy dashboard to one line each, and opens the one a problem points at', () => {
    const widgets: NonNullable<FullstackPageDef['widgets']> = [
      { kind: 'kpi', entity: 'Order' },
      { kind: 'bar', entity: 'Order', groupBy: 'status', agg: 'sum', field: 'total' },
      { kind: 'recent', entity: 'Customer' },
      { kind: 'kpi', entity: 'Product', title: 'Products' },
    ]
    render(<Harness initial={[{ id: 'desk', type: 'dashboard', widgets }]} />)
    const row = openRow('desk') as HTMLElement
    expect(row.querySelectorAll('[data-widget-options]')).toHaveLength(0)
    const summaries = Array.from(row.querySelectorAll('[data-widget-summary]')).map(el => el.textContent)
    expect(summaries).toEqual([
      'Number · Order · width 1',
      'Breakdown · Order by status · sum of total · width 2',
      'Recent · Customer · width 2',
      'Number · Product · “Products” · width 1',
    ])
    fireEvent.click(within(row).getByRole('button', { name: 'Expand widget 2' }))
    expect(row.querySelectorAll('[data-widget-options]')).toHaveLength(1)
    expect(within(row).getByLabelText('Group by')).toBeTruthy()
    fireEvent.click(within(row).getByRole('button', { name: 'Collapse widget 2' }))
    fireEvent.click(within(row).getByRole('button', { name: 'Expand all' }))
    expect(row.querySelectorAll('[data-widget-options]')).toHaveLength(4)
    fireEvent.click(within(row).getByRole('button', { name: 'Collapse all' }))
    expect(row.querySelectorAll('[data-widget-options]')).toHaveLength(0)
    // A problem click opens the card it is about (widget 4 names a missing entity).
    const problems = within(document.querySelector('[data-page-layout-problems]') as HTMLElement)
    fireEvent.click(problems.getByRole('button', { name: /widget for “Product”/ }))
    expect(row.querySelector('[data-widget="3"] [data-widget-options]')).toBeTruthy()
    expect(row.querySelectorAll('[data-widget-options]')).toHaveLength(1)
    // A new widget opens expanded; a short dashboard opens every card.
    fireEvent.click(within(row).getByRole('button', { name: /Add widget/ }))
    fireEvent.click(within(row).getByRole('button', { name: 'Add number tile' }))
    expect(row.querySelector('[data-widget="4"] [data-widget-options]')).toBeTruthy()
  })

  it('applies a one-click fix from the problems list, undoably', () => {
    pushUndo.mockClear()
    render(<Harness initial={[
      { id: 'desk', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }, { kind: 'kpi', entity: 'Product' }] },
      { id: 'c', type: 'master-detail', parent: 'Customer', child: 'Order' },
    ]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Fix: Remove widget 2' }))
    expect(latest[0].widgets).toEqual([{ kind: 'kpi', entity: 'Order' }])
    expect(pushUndo).toHaveBeenCalledWith('Remove widget 2')
    fireEvent.click(screen.getByRole('button', { name: 'Fix: Link through “customer”' }))
    expect(latest[1].via).toBe('customer')
    expect(document.querySelector('[data-page-layout-problems]')).toBeNull()
  })

  it('lists a server rejection on the page it names', () => {
    const pages: FullstackPageDef[] = [{ id: 'orders', type: 'entity-list', entity: 'Order' }]
    render(
      <PagesEditor
        pages={pages}
        entities={entities}
        validation={validatePages(pages, entities)}
        onChange={() => {}}
        pushUndo={pushUndo}
        onClear={() => {}}
        serverIssue={{ page: 0, message: "Page 'orders': something the editor does not check" }}
      />,
    )
    expect(document.querySelector('[data-page-layout-problems]')?.textContent).toContain('The server rejected “Order”')
  })

  it('flags required fields a wizard never asks for', () => {
    render(<Harness initial={[{ id: 'new-order', type: 'wizard', entity: 'Order', steps: [{ fields: ['status', 'total'] }] }]} />)
    openRow('new-order')
    expect(document.querySelector('[data-wizard-unasked-required]')?.textContent).toContain('id')
    expect(document.querySelector('[data-wizard-unasked]')?.textContent).toContain('placedOn')
  })

  it('offers undo and redo in the header', () => {
    const onUndo = vi.fn()
    const pages: FullstackPageDef[] = [{ id: 'orders', type: 'entity-list', entity: 'Order' }]
    render(
      <PagesEditor
        pages={pages}
        entities={entities}
        validation={validatePages(pages, entities)}
        onChange={() => {}}
        pushUndo={pushUndo}
        onClear={() => {}}
        history={{ undoLabel: 'Undo: Added a page', redoLabel: null, onUndo, onRedo: () => {} }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Undo: Added a page' }))
    expect(onUndo).toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Redo (nothing to redo)' }) as HTMLButtonElement).disabled).toBe(true)
  })

  describe('collapsible section', () => {
    /** Like the Harness, plus the caller's "jump to the first error" bump. */
    function RevealHarness({ initial }: { initial: FullstackPageDef[] }) {
      const [pages, setPages] = useState(initial)
      const [reveal, setReveal] = useState(0)
      return (
        <>
          <button type="button" onClick={() => setReveal(n => n + 1)}>Jump to error</button>
          <PagesEditor
            pages={pages}
            entities={entities}
            validation={validatePages(pages, entities)}
            onChange={setPages}
            pushUndo={pushUndo}
            onClear={() => {}}
            revealRequest={reveal}
          />
        </>
      )
    }

    it('folds to its header and a summary, remembers the choice, and shows the problem count while folded', () => {
      const { unmount } = render(
        <RevealHarness
          initial={[
            { id: 'orders', type: 'entity-list', entity: 'Order' },
            { id: 'order', type: 'record', entity: 'Order', hidden: true },
            { id: 'customer', type: 'master-detail', parent: 'Customer', child: 'Order' }, // ambiguous relation → a problem
          ]}
        />,
      )
      expect(document.getElementById('fs-pages-body')).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Collapse frontend pages' }))
      expect(document.getElementById('fs-pages-body')).toBeNull()
      expect(screen.queryByRole('button', { name: /Add page/ })).toBeNull()
      expect(document.querySelector('[data-pages-summary]')?.textContent).toContain('1 off the navigation')
      expect(screen.getByRole('status').textContent).toContain('1 problem here')
      expect(localStorage.getItem('fullstack:pagesSection')).toBe('closed')

      // The choice survives a remount.
      unmount()
      render(<RevealHarness initial={[{ id: 'orders', type: 'entity-list', entity: 'Order' }]} />)
      expect(document.getElementById('fs-pages-body')).toBeNull()
      expect(document.querySelector('[data-pages-summary]')?.textContent).not.toContain('off the navigation')

      fireEvent.click(screen.getByRole('button', { name: 'Expand frontend pages' }))
      expect(document.getElementById('fs-pages-body')).toBeTruthy()
      expect(localStorage.getItem('fullstack:pagesSection')).toBe('open')
    })

    it('summarizes the classic layout when there are no pages', () => {
      render(<Harness initial={[]} />)
      fireEvent.click(screen.getByRole('button', { name: 'Collapse frontend pages' }))
      expect(document.querySelector('[data-pages-summary]')?.textContent).toContain('Classic layout')
      expect(screen.queryByRole('button', { name: /Start from my entities/ })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Expand frontend pages' }))
      expect(screen.getByRole('button', { name: /Start from my entities/ })).toBeTruthy()
    })

    it('opens itself again when the caller jumps to a page problem', () => {
      render(
        <RevealHarness initial={[{ id: 'customer', type: 'master-detail', parent: 'Customer', child: 'Order' }]} />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Collapse frontend pages' }))
      expect(document.getElementById('fs-pages-body')).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'Jump to error' }))
      expect(document.getElementById('fs-pages-body')).toBeTruthy()
      // The page with the problem is open, not just the section.
      expect(screen.getByLabelText('Relation to link through')).toBeTruthy()
    })
  })
  it('rings the previewed part while its editor control is hovered or focused', () => {
    localStorage.setItem('fullstack:layoutPreview', 'open') // an earlier test hid it
    render(<Harness initial={[
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }, { kind: 'bar', entity: 'Order' }] },
      { id: 'customer', type: 'record', entity: 'Customer', headerStats: [{ child: 'Order' }] },
    ]} />)
    const preview = document.querySelector('[data-layout-preview]') as HTMLElement
    const lit = () => [...preview.querySelectorAll('[data-preview-highlight]')]
    expect(lit()).toHaveLength(0)

    const home = openRow('home') as HTMLElement
    const list = home.parentElement!
    fireEvent.mouseOver(home.querySelector('[data-widget="1"]')!)
    expect(lit()).toHaveLength(1)
    expect(lit()[0].querySelector('[data-preview-widget="1"]')).toBeTruthy()
    // Any control on the page maps onto a drawn part — the title field onto the heading.
    const title = within(home).getByLabelText('Page title')
    fireEvent.mouseOver(title)
    expect(lit().map(el => el.getAttribute('aria-label'))).toEqual(['Edit the page title'])
    // The row itself, outside any control, is the page: its nav entry.
    fireEvent.mouseOver(home.querySelector('button[aria-expanded]')!)
    expect(lit().map(el => el.getAttribute('data-preview-nav'))).toEqual(['0'])
    fireEvent.mouseLeave(list)
    expect(lit()).toHaveLength(0)

    // Keyboard focus lights a part too, and the mouse passing over does not lose it.
    title.focus()
    fireEvent.focus(title)
    expect(lit().map(el => el.getAttribute('aria-label'))).toEqual(['Edit the page title'])
    fireEvent.mouseOver(home.querySelector('[data-widget="0"]')!)
    expect(lit()[0].querySelector('[data-preview-widget="0"]')).toBeTruthy()
    fireEvent.mouseLeave(list)
    expect(lit().map(el => el.getAttribute('aria-label'))).toEqual(['Edit the page title'])
    title.blur()
    fireEvent.blur(title)
    expect(lit()).toHaveLength(0)

    // A record's tile row: the editor keys one tile, the preview draws the tiles as one part.
    const record = openRow('customer')
    fireEvent.mouseOver(record.querySelector('[data-header-stat="0"]')!)
    expect(lit()).toHaveLength(1)
    expect(lit()[0].querySelector('[data-preview-stats]')).toBeTruthy()
  })

  it('lists warnings apart from problems, marks the page and the preview, and applies their fix', () => {
    render(<Harness initial={[{ id: 'home', type: 'dashboard', title: 'Home', widgets: [{ kind: 'bar', entity: 'Order' }] }]} />)
    expect(document.querySelector('[data-page-layout-problems]')).toBeNull()
    const warnings = document.querySelector('[data-page-layout-warnings]')!
    expect(warnings.textContent).toContain('clicking a bar of the Order chart goes nowhere')
    expect(document.querySelector('[data-page-warnings]')?.textContent).toBe('1 warning')
    expect(document.querySelector('[data-preview-nav="0"] [data-preview-warning]')).toBeTruthy()

    fireEvent.click(within(warnings as HTMLElement).getByRole('button', { name: /Fix: Add a Orders list page/ }))
    expect(pushUndo).toHaveBeenCalledWith('Add a Orders list page')
    expect(latest.map(p => p.id)).toEqual(['home', 'orders'])
    expect(document.querySelector('[data-page-layout-warnings]')).toBeNull()
    expect(document.querySelector('[data-preview-warning]')).toBeNull()
  })

  it('makes a page the start page by moving it first, and keeps the start page open to everyone', () => {
    render(<Harness initial={[
      { id: 'orders', type: 'entity-list', entity: 'Order', title: 'Orders' },
      { id: 'customers', type: 'entity-list', entity: 'Customer', title: 'Customers' },
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true },
    ]} />)
    // The start page has no such button; a record page never does.
    expect(screen.queryByRole('button', { name: 'Make Orders the start page' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /the start page$/ })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Make Customers the start page' }))
    expect(pushUndo).toHaveBeenCalledWith('Made “Customers” the start page')
    expect(latest.map(p => p.id)).toEqual(['customers', 'orders', 'customer'])
    expect(screen.getByRole('button', { name: 'Make Orders the start page' })).toBeTruthy()

    openRow('customers')
    expect((screen.getByLabelText('Only ADMIN') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('The start page is open to everyone — make another page the start page to restrict this one')).toBeTruthy()
    openRow('orders')
    expect((screen.getByLabelText('Only ADMIN') as HTMLInputElement).disabled).toBe(false)
  })
})
