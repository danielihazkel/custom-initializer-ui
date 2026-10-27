import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { LayoutPreview } from './LayoutPreview'
import { buildLayoutPreview, type PreviewDataState } from './layoutPreviewModel'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Order',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] },
      { name: 'total', type: 'BIG_DECIMAL' },
      { name: 'placedOn', type: 'LOCAL_DATE', filterable: true },
    ],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
  },
]

// One page of every type that reads rows.
const pages: FullstackPageDef[] = [
  { id: 'desk', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }, { kind: 'progress', entity: 'Order', target: '50' }, { kind: 'bar', entity: 'Order' }, { kind: 'list', entity: 'Order' }] },
  { id: 'orders', type: 'entity-list', entity: 'Order' },
  { id: 'customers', type: 'master-detail', parent: 'Customer', child: 'Order', showParent: true },
  { id: 'customer', type: 'record', entity: 'Customer', hidden: true },
  { id: 'revenue', type: 'report', entity: 'Order', chart: { groupBy: 'status' } },
  { id: 'schedule', type: 'calendar', entity: 'Order', dateField: 'placedOn' },
  { id: 'board', type: 'board', entity: 'Order' },
  { id: 'find', type: 'search', entities: ['Customer'] },
]

function draw(selected: number, dataState: PreviewDataState, locale: 'en' | 'he' = 'en') {
  const preview = buildLayoutPreview(pages, entities, { locale, projectOpts: [] })
  const { container, unmount } = render(
    <LayoutPreview preview={preview} selected={selected} onSelect={() => {}} onEdit={() => {}} skin="tailwind" dataState={dataState} />,
  )
  const text = container.textContent ?? ''
  const states = Array.from(container.querySelectorAll('[data-preview-state]')).map(el => el.getAttribute('data-preview-state'))
  unmount()
  return { text, states }
}

describe('LayoutPreview data states', () => {
  it('draws every page type that reads rows in every state, without its sample rows', () => {
    const sample = pages.map((_, i) => draw(i, 'data'))
    for (const [i, page] of pages.entries()) {
      expect(sample[i].states, page.id).toEqual([])
      for (const state of ['empty', 'loading', 'error'] as const) {
        const drawn = draw(i, state)
        expect(drawn.states.length, `${page.id} ${state}`).toBeGreaterThan(0)
        expect(drawn.states.every(s => s === state), `${page.id} ${state}`).toBe(true)
      }
    }
  })

  it('says what the generated app says, in its language', () => {
    expect(draw(4, 'empty').text).toContain('No records yet.')
    expect(draw(5, 'empty').text).toContain('Nothing in this period.')
    expect(draw(6, 'empty').text).toContain('Empty')
    expect(draw(7, 'empty').text).toMatch(/Nothing matches “\S+”\./)
    expect(draw(3, 'error').text).toContain('Couldn’t load data. Try again')
    expect(draw(1, 'empty', 'he').text).toContain('אין רשומות עדיין')
    expect(draw(2, 'error', 'he').text).toContain('משהו השתבש בשרת. נסו שוב בעוד רגע.')
  })
})
