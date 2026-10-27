import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { buildLayoutPreview } from './layoutPreviewModel'
import { DEFAULT_NAV_ICON, blankPage, canDuplicate, describePage, linkablePages, newPageChoices, retargetPage, validatePages } from './pageLayout'
import { buildPlayLinks } from './playLinks'

const entities: FullstackEntityDef[] = [
  {
    name: 'Order',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true, generated: true },
      { name: 'reference', type: 'STRING', required: true },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] },
      { name: 'note', type: 'TEXT' },
    ],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
    formSections: [{ title: 'Basics', fields: ['reference', 'customer'] }],
  },
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  { name: 'Rate', readOnly: true, fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'value', type: 'BIG_DECIMAL' }] },
]

const base: FullstackPageDef[] = [
  { id: 'orders', type: 'entity-list', entity: 'Order' },
  { id: 'order', type: 'record', entity: 'Order', hidden: true },
  { id: 'customers', type: 'entity-list', entity: 'Customer' },
]
const form: FullstackPageDef = { id: 'new-order', type: 'form', entity: 'Order', title: 'New order' }
const problems = (pages: FullstackPageDef[]) => {
  const v = validatePages(pages, entities)
  return [...Object.values(v.byPage).flatMap(controls => Object.values(controls)), ...v.problems]
}

describe('form page', () => {
  it('is valid for a writable entity, once, and never beside a wizard', () => {
    expect(problems([...base, form])).toEqual([])
    // Hidden, it is still a route: no "nothing opens it" advice, and a links widget may open it.
    const hidden = [...base, { ...form, hidden: true }]
    expect(validatePages(hidden, entities).warnings.map(w => w.key)).not.toContain('unreachable:new-order')
    expect(linkablePages(hidden).map(p => p.id)).toContain('new-order')
    expect(problems([...base, form, { ...form, id: 'again' }]).join()).toContain('Order already has the form “new-order”')
    expect(problems([...base, form, { id: 'steps', type: 'wizard', entity: 'Order' }]).join())
      .toContain('which already has a form — an entity has one or the other')
    expect(problems([...base, { id: 'rates', type: 'entity-list', entity: 'Rate' }, { id: 'new-rate', type: 'form', entity: 'Rate' }]).join())
      .toContain('Rate is read-only')
  })

  it('is offered for an entity without a create page, and is one of a kind', () => {
    const choices = newPageChoices('form', entities, [...base, { id: 'w', type: 'wizard', entity: 'Customer' }])!
    expect(choices.find(c => c.value === 'Order')?.reason).toBeUndefined()
    expect(choices.find(c => c.value === 'Customer')?.reason).toBe('Already has a wizard')
    expect(choices.find(c => c.value === 'Rate')?.reason).toBe('Read-only — nothing to create')
    expect(newPageChoices('wizard', entities, [...base, form])!.find(c => c.value === 'Order')?.reason).toBe('Already has a form page')
    expect(canDuplicate(form)).toBe(false)
    expect(DEFAULT_NAV_ICON.form).toBe('FilePlus')
    expect(blankPage('form', entities, base, 'Customer')).toMatchObject({ type: 'form', entity: 'Customer', title: 'New Customer' })
    expect(describePage(form, [...base, form])).toBe('Order · its whole form — New and Edit open it')
  })

  it('keeps its entity when a page becomes a form', () => {
    const { page } = retargetPage(base[0], 'form', entities, base)
    expect(page).toMatchObject({ type: 'form', entity: 'Order', title: 'New Order' })
  })

  it('takes over New in Play mode and lands on the record page', () => {
    const pages = [...base, form]
    const links = buildPlayLinks(pages, entities)
    expect(links[0].create).toBe(3)
    expect(links[3].afterSave).toBe(1)
  })

  it('previews the form in its sections', () => {
    const preview = buildLayoutPreview([...base, form], entities, { locale: 'en', projectOpts: [] })
    const screen = preview.screens[3]
    expect(screen.type).toBe('form')
    if (screen.type !== 'form') return
    expect(screen.groups).toEqual([
      { title: 'Basics', fields: ['Reference', 'Customer'] },
      { fields: ['Status', 'Note'] },
    ])
    expect(screen.title).toBe('New order')
    expect([screen.save, screen.cancel]).toEqual(['Save', 'Cancel'])
  })
})
