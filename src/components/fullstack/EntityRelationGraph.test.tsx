import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { EntityRelationGraph } from './EntityRelationGraph'
import type { FullstackEntityDef } from '../../types'

const pk = { name: 'id', type: 'LONG' as const, primaryKey: true, generated: true }

const customer: FullstackEntityDef = {
  uid: 'u-customer', name: 'Customer',
  fields: [pk, { name: 'title', type: 'STRING' }],
}
const order: FullstackEntityDef = {
  uid: 'u-order', name: 'Order',
  fields: [pk, { name: 'ref', type: 'STRING' }],
}
const lineItem: FullstackEntityDef = {
  uid: 'u-line', name: 'LineItem',
  fields: [
    { name: 'orderId', type: 'LONG', primaryKey: true },
    { name: 'lineNo', type: 'INTEGER', primaryKey: true },
  ],
}
const report: FullstackEntityDef = {
  uid: 'u-report', name: 'Report', viewQuery: 'select 1 as code',
  fields: [{ name: 'code', type: 'STRING', primaryKey: true }],
}

/** jsdom has no layout, so give the svg a box and stub the pointer-capture API. */
beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect)
})

function renderGraph(entities: FullstackEntityDef[]) {
  const onCreateRelation = vi.fn()
  const onRefuseRelation = vi.fn()
  const view = render(
    <EntityRelationGraph
      entities={entities}
      showInverse={false}
      onCreateRelation={onCreateRelation}
      onRefuseRelation={onRefuseRelation}
    />,
  )
  return { ...view, onCreateRelation, onRefuseRelation }
}

/** Drags `from`'s connect handle onto the centre of `to`'s box. */
function dragBetween(container: HTMLElement, fromLabel: string, toLabel: string) {
  const handle = [...container.querySelectorAll('circle')]
    .find(c => c.querySelector('title')?.textContent?.includes(fromLabel))
  expect(handle).toBeTruthy()

  // Find the target's box by its rendered name and read the layout's own coordinates back off
  // the transform, rather than recomputing the force simulation in the test.
  const box = [...container.querySelectorAll<SVGGElement>('g[transform]')]
    .find(g => g.querySelector('text')?.textContent === toLabel)
  expect(box).toBeTruthy()
  const [, tx, ty] = /translate\(([-\d.]+), ?([-\d.]+)\)/.exec(box!.getAttribute('transform')!)!

  // The component maps client → viewBox with `min(rect.w/width, rect.h/height)`; the mocked rect
  // is square, so the limiting axis is whichever viewBox dimension is larger.
  const svg = container.querySelector('svg')!
  const [, , vbW, vbH] = svg.getAttribute('viewBox')!.split(' ').map(Number)
  const scale = Math.min(1000 / vbW, 1000 / vbH)

  fireEvent.pointerDown(handle!, { pointerId: 1, clientX: 0, clientY: 0 })
  // NODE_W / 2 = 86, NODE_H / 2 = 31 — the centre of the box.
  fireEvent.pointerMove(svg, { pointerId: 1, clientX: (Number(tx) + 86) * scale, clientY: (Number(ty) + 31) * scale })
  fireEvent.pointerUp(svg, { pointerId: 1 })
}

describe('EntityRelationGraph — drag to relate', () => {
  it('creates a relation when dragged onto a valid target', () => {
    const { container, onCreateRelation, onRefuseRelation } = renderGraph([order, customer])
    dragBetween(container, 'Order', 'Customer')
    expect(onRefuseRelation).not.toHaveBeenCalled()
    expect(onCreateRelation).toHaveBeenCalledWith('u-order', 'u-customer')
  })

  it('refuses a target with a composite primary key, in the backend’s words', () => {
    const { container, onCreateRelation, onRefuseRelation } = renderGraph([order, lineItem])
    dragBetween(container, 'Order', 'LineItem')
    expect(onCreateRelation).not.toHaveBeenCalled()
    expect(onRefuseRelation).toHaveBeenCalledWith(expect.stringContaining('composite primary key'))
  })

  it('refuses a SELECT-backed view as a target', () => {
    const { container, onCreateRelation, onRefuseRelation } = renderGraph([order, report])
    dragBetween(container, 'Order', 'Report')
    expect(onCreateRelation).not.toHaveBeenCalled()
    expect(onRefuseRelation).toHaveBeenCalledWith(expect.stringContaining('SELECT-backed view'))
  })

  it('gives a view no connect handle at all, since it cannot own relations', () => {
    const { container } = renderGraph([order, report])
    const titles = [...container.querySelectorAll('circle title')].map(t => t.textContent)
    expect(titles.some(t => t?.includes('Order'))).toBe(true)
    expect(titles.some(t => t?.includes('Report'))).toBe(false)
  })

  it('shows the key and the label field on each box', () => {
    const { container } = renderGraph([customer, lineItem])
    const text = container.textContent ?? ''
    expect(text).toContain('id')
    expect(text).toContain('title')
    // A composite key is spelled out, so it is obvious why it cannot be targeted.
    expect(text).toContain('orderId + lineNo')
  })

  it('stays a read-only picture when no create handler is given', () => {
    const { container } = render(<EntityRelationGraph entities={[order, customer]} showInverse={false} />)
    expect(container.querySelectorAll('circle')).toHaveLength(0)
    expect(container.textContent).not.toContain('Drag the dot')
  })

  it('renders nothing for an empty model', () => {
    const { container } = renderGraph([])
    expect(container.querySelector('[data-entity-graph]')).toBeNull()
  })
})
