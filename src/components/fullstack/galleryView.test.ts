import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { lintModel } from './lint'
import { enabledListViews, validatePages, viewDisabledReason } from './pageLayout'
import { summarizeEntity } from './summary'

const item = (views: FullstackEntityDef['listViews'], withPhoto = true): FullstackEntityDef => ({
  name: 'Item',
  listViews: views,
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true },
    { name: 'name', type: 'STRING' },
    ...(withPhoto ? [{ name: 'photo', type: 'IMAGE' as const }] : []),
  ],
})

describe('the gallery list view', () => {
  it('is offered where the entity has an image field, and shows its first one', () => {
    expect(summarizeEntity(item(['table', 'gallery'])).views).toEqual([{ name: 'table' }, { name: 'gallery', by: 'photo' }])
    expect(enabledListViews(item(['table', 'gallery']))).toEqual(['table', 'gallery'])
    // Without a picture the generator drops it, like a calendar without a date.
    expect(enabledListViews(item(['table', 'gallery'], false))).toEqual(['table'])
    expect(viewDisabledReason(item(['table', 'gallery'], false), 'gallery')).toBe('Gallery needs an image field')
    expect(viewDisabledReason(item(['table']), 'gallery')).toBe('Not ticked in the list views of Item')
  })

  it('lets a list page open on it, and says when the entity has none', () => {
    const page: FullstackPageDef[] = [{ id: 'items', type: 'entity-list', entity: 'Item', view: 'gallery' }]
    expect(validatePages(page, [item(['table', 'gallery'])]).problems).toEqual([])
    expect(validatePages(page, [item(['table', 'gallery'], false)]).problems).toHaveLength(1)
  })

  it('warns about a ticked gallery the generator will drop', () => {
    const issues = lintModel([{ ...item(['table', 'gallery'], false), uid: 'u1' }], [], [])
    expect(issues.find(i => i.rule === 'view-dropped')?.message).toMatch(/gallery view will not be generated — it needs an image field/)
  })
})
