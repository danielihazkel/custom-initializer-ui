import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { buildLayoutPreview } from './layoutPreviewModel'
import { renameFieldInNewPages } from './newPageTypes'
import { DEFAULT_NAV_ICON, blankPage, describePage, newPageChoices, validatePages } from './pageLayout'
import { buildPlayLinks } from './playLinks'

const entities: FullstackEntityDef[] = [
  {
    name: 'Claim',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true, generated: true },
      { name: 'title', type: 'STRING', required: true },
      { name: 'amount', type: 'BIG_DECIMAL' },
      { name: 'status', type: 'ENUM', enumValues: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
      { name: 'assignee', type: 'STRING' },
      { name: 'dueOn', type: 'LOCAL_DATE' },
    ],
    workflow: {
      statusField: 'status', assigneeField: 'assignee', dueField: 'dueOn',
      transitions: [
        { name: 'submit', from: ['DRAFT'], to: 'SUBMITTED' },
        { name: 'approve', label: 'Approve', from: ['SUBMITTED'], to: 'APPROVED' },
      ],
    },
  },
  { name: 'Note', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'text', type: 'STRING' }] },
]

const base: FullstackPageDef[] = [
  { id: 'claims', type: 'entity-list', entity: 'Claim' },
  { id: 'claim', type: 'record', entity: 'Claim', hidden: true },
  { id: 'notes', type: 'entity-list', entity: 'Note' },
]
const inbox: FullstackPageDef = { id: 'tasks', type: 'inbox', entity: 'Claim' }
const problems = (pages: FullstackPageDef[]) => {
  const v = validatePages(pages, entities)
  return [...Object.values(v.byPage).flatMap(controls => Object.values(controls)), ...v.problems]
}

describe('inbox page', () => {
  it('lists an entity whose workflow assigns its rows', () => {
    expect(problems([...base, inbox])).toEqual([])
    expect(problems([...base, { ...inbox, entity: 'Note' }]).join()).toContain('Note has no workflow with an assignee')
    expect(problems([...base, { ...inbox, queues: ['mine', 'mine'] }]).join()).toContain('lists a queue twice')
    expect(problems([...base, { ...inbox, queues: [] }]).join()).toContain('needs at least one queue')
    expect(problems([...base, { ...inbox, cardFields: ['nope'] }]).join()).toContain('Claim has no field or relation “nope”')
  })

  it('is offered for such an entity only, and starts as “My tasks”', () => {
    const choices = newPageChoices('inbox', entities, base)!
    expect(choices.find(c => c.value === 'Claim')?.reason).toBeUndefined()
    expect(choices.find(c => c.value === 'Note')?.reason).toBe('No workflow with an assignee')
    expect(blankPage('inbox', entities, base, 'Claim')).toMatchObject({ id: 'claim-tasks', type: 'inbox', entity: 'Claim', title: 'My tasks' })
    expect(DEFAULT_NAV_ICON.inbox).toBe('Inbox')
    expect(describePage({ ...inbox, queues: ['open', 'mine'] }, [...base, inbox])).toBe('Claim tasks · All open, My tasks')
    expect(renameFieldInNewPages({ ...inbox, cardFields: ['title', 'amount'] }, 'Claim', 'amount', 'total').cardFields).toEqual(['title', 'total'])
  })

  it('previews its queues, a late row and the moves, and opens rows on the record page in Play', () => {
    const pages = [...base, inbox]
    const screen = buildLayoutPreview(pages, entities, { locale: 'en', projectOpts: [] }).screens[3]
    expect(screen.type).toBe('inbox')
    if (screen.type !== 'inbox') return
    expect(screen.queues).toEqual(['My tasks', 'Unassigned'])
    // The row cells skip what has its own column.
    expect(screen.columns).toEqual(['Title', 'Amount', 'Status', 'Assignee', 'Due on'])
    expect(screen.rows[0].late).toBe(true)
    expect(screen.rows[1].assignee).toBe('Nobody')
    expect(screen.actions).toEqual(['Submit'])
    expect(buildPlayLinks(pages, entities)[3].row).toBe(1)
  })
})
