import { describe, it, expect, beforeEach } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import seeded from './__fixtures__/fullstack-examples.json'
import { validatePages } from './pageLayout'
import { LAYOUT_TEMPLATES, buildLayoutTemplate, pageFromTemplate, readPageTemplates, savePageTemplate, deletePageTemplate } from './layoutTemplates'

const examples = seeded as unknown as { name: string; entities: FullstackEntityDef[] }[]

describe('layout templates', () => {
  it('builds a layout with no problems from every seeded example it fits', () => {
    let built = 0
    for (const example of examples) {
      for (const template of LAYOUT_TEMPLATES) {
        const result = buildLayoutTemplate(template, example.entities)
        if ('reason' in result) continue
        built++
        const v = validatePages(result.pages, example.entities, { ldapAuth: true })
        expect(v.problems, `${template.key} on ${example.name}`).toEqual([])
        expect(v.warnings.map(w => w.summary), `${template.key} on ${example.name}`).toEqual([])
      }
    }
    // Every template fits at least one example, so each is exercised.
    for (const template of LAYOUT_TEMPLATES) {
      expect(examples.some(ex => !('reason' in buildLayoutTemplate(template, ex.entities))), template.key).toBe(true)
    }
    expect(built).toBeGreaterThan(LAYOUT_TEMPLATES.length)
  })

  it('says why a model cannot fill a template', () => {
    const flat: FullstackEntityDef[] = [{ name: 'Note', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'text', type: 'STRING' }] }]
    const reasons = Object.fromEntries(LAYOUT_TEMPLATES.map(t => [t.key, buildLayoutTemplate(t, flat)]))
    expect(reasons['work-queue']).toEqual({ reason: 'Needs an entity with an enum or boolean field of 2 to 6 values to split by' })
    expect(reasons.reporting).toEqual({ reason: 'Needs an entity with an enum, boolean or date field to chart' })
    expect(reasons.browser).toEqual({ reason: 'Needs a many-to-one relation between two entities' })
    expect('pages' in reasons.admin).toBe(true)
  })
})

describe('page templates', () => {
  beforeEach(() => localStorage.clear())

  it('saves a page by name, and places it with a free id and without references it cannot keep', () => {
    const tabs: FullstackPageDef = { id: 'queue', type: 'tabs', title: 'Queue', idLocked: true, tabs: [{ page: 'open' }, { page: 'closed' }] }
    expect(savePageTemplate('My queue', tabs)).toBe(true)
    expect(savePageTemplate('My queue', { ...tabs, title: 'Queue 2' })).toBe(true)
    const saved = readPageTemplates()
    expect(saved.map(t => t.name)).toEqual(['My queue'])
    expect(saved[0].page.idLocked).toBeUndefined()

    const placed = pageFromTemplate(saved[0], [{ id: 'queue-2', type: 'entity-list', entity: 'X' }, { id: 'open', type: 'entity-list', entity: 'X', hidden: true }])
    expect(placed.id).toBe('queue-2-2')
    expect(placed.tabs).toEqual([{ page: 'open' }])

    deletePageTemplate('My queue')
    expect(readPageTemplates()).toEqual([])
  })
})
