import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef, FullstackWidgetDef } from '../../types'
import { describePage, validatePages } from './pageLayout'

const entities: FullstackEntityDef[] = [{
  name: 'Ticket',
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true },
    { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'DONE'] },
    { name: 'urgent', type: 'BOOLEAN' },
  ],
}]
const dash = (widgets: FullstackWidgetDef[]): FullstackPageDef[] => [{ id: 'desk', type: 'dashboard', widgets }]

describe('validating the donut, stacked and text widgets', () => {
  it('accepts well-formed ones', () => {
    const v = validatePages(dash([
      { kind: 'donut', entity: 'Ticket' },
      { kind: 'stacked', entity: 'Ticket', groupBy: 'status', series: 'urgent' },
      { kind: 'stacked', entity: 'Ticket' },
      { kind: 'text', entity: '', text: 'Hello' },
    ]), entities)
    expect(v.count).toBe(0)
  })

  it('flags what the generator would reject', () => {
    const v = validatePages(dash([
      { kind: 'stacked', entity: 'Ticket', groupBy: 'status', series: 'status' },
      { kind: 'bar', entity: 'Ticket', series: 'urgent' },
      { kind: 'text', entity: '', text: '  ' },
    ]), entities)
    expect(v.byPage[0]).toMatchObject({
      'widget.0': 'needs a second enum or boolean field to split by',
      'widget.1': 'only a stacked chart takes a series',
      'widget.2': 'needs some text',
    })
  })

  it('counts them in the page summary', () => {
    expect(describePage(dash([{ kind: 'donut', entity: 'Ticket' }, { kind: 'text', entity: '', text: 'x' }])[0], []))
      .toBe('1 donut · 1 note')
  })
})
