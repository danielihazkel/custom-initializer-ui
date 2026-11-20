import { describe, it, expect } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import type { FullstackEntityDef, FullstackNav, FullstackPageDef } from '../../types'
import { LayoutPreview } from './LayoutPreview'
import { buildLayoutPreview } from './layoutPreviewModel'
import { buildUiPreview } from './uiPreview'

// What the canvas used to leave out or stand in for (Round 14, phase 10): the header's tools, the
// gauge, funnel and time-in-state widgets, rows edited in their parent's form, file and picture
// fields, the change history and the "Changed by me" toggle.

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Claim',
    opts: { audit: true, history: true },
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true, generated: true },
      { name: 'title', type: 'STRING', required: true },
      { name: 'status', type: 'ENUM', enumValues: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
      { name: 'receipt', type: 'FILE' },
      { name: 'photos', type: 'IMAGE', maxFiles: 3 },
      { name: 'assignee', type: 'STRING' },
    ],
    relations: [{ type: 'ONE_TO_MANY', fieldName: 'lines', targetEntity: 'ClaimLine', mappedBy: 'claim', composition: true }],
    workflow: {
      statusField: 'status', assigneeField: 'assignee', trackMoves: true,
      transitions: [{ name: 'submit', from: ['DRAFT'], to: 'SUBMITTED' }, { name: 'approve', from: ['SUBMITTED'], to: 'APPROVED' }],
    },
  },
  {
    name: 'ClaimLine',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true, generated: true },
      { name: 'description', type: 'STRING', required: true },
      { name: 'quantity', type: 'INTEGER' },
    ],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'claim', targetEntity: 'Claim', required: true }],
  },
]

const pages: FullstackPageDef[] = [
  {
    id: 'desk', type: 'dashboard', widgets: [
      { kind: 'gauge', entity: 'Claim', target: '50' },
      { kind: 'funnel', entity: 'Claim' },
      { kind: 'timeInState', entity: 'Claim' },
    ],
  },
  { id: 'claims', type: 'entity-list', entity: 'Claim', columns: ['title', 'receipt', 'photos'] },
  { id: 'claim', type: 'record', entity: 'Claim', hidden: true },
  { id: 'new-claim', type: 'form', entity: 'Claim', hidden: true },
  { id: 'claim-steps', type: 'wizard', entity: 'Claim', hidden: true, steps: [{ title: 'Basics', fields: ['title'] }, { fields: ['receipt', 'photos'] }] },
  { id: 'customers', type: 'entity-list', entity: 'Customer' },
  { id: 'new-customer', type: 'form', entity: 'Customer', hidden: true },
]

const allTools: FullstackNav = { commandPalette: true, notifications: true, userMenu: true }
const build = (nav?: FullstackNav, locale: 'en' | 'he' = 'en') => buildLayoutPreview(pages, entities, { locale, projectOpts: [], nav })
const screenOf = <T extends string>(index: number, type: T) => {
  const screen = build().screens[index]
  if (screen.type !== type) throw new Error(`${screen.type}, not ${type}`)
  return screen as Extract<typeof screen, { type: T }>
}

describe('the preview model — what the canvas now draws', () => {
  it('lists the header tools the nav switches on, in the app’s language', () => {
    expect(build().tools).toBeUndefined()
    expect(build(allTools).tools).toEqual({
      palette: 'Go to anything', bell: { label: 'Notifications', count: 3 }, user: { label: 'Signed in as', name: 'dev-user' },
    })
    expect(build(allTools, 'he').tools?.palette).toBe('מעבר מהיר')
    // A bell with nothing to count is not generated, so it is not drawn.
    const noWorkflow = buildLayoutPreview(pages, [entities[0]], { locale: 'en', projectOpts: [], nav: allTools })
    expect(noWorkflow.tools).toEqual({ palette: 'Go to anything', user: { label: 'Signed in as', name: 'dev-user' } })
  })

  it('gives a gauge, a funnel and time in state their own shapes', () => {
    const [gauge, funnel, time] = screenOf(0, 'dashboard').widgets
    expect(gauge.kind).toBe('gauge')
    if (funnel.kind !== 'funnel') throw new Error(funnel.kind)
    // The stages in the field's order, each counting everything that got that far.
    expect(funnel.stages.map(s => s.label)).toEqual(['Draft', 'Submitted', 'Approved'])
    expect(funnel.stages[0].value).toBeGreaterThanOrEqual(funnel.stages[1].value)
    expect(funnel.stages[1].value).toBeGreaterThanOrEqual(funnel.stages[2].value)
    if (time.kind !== 'timeInState') throw new Error(time.kind)
    expect(time.title).toBe('Time in each state — Claims')
    // Only the states something leaves.
    expect(time.rows.map(r => r.label)).toEqual(['Draft', 'Submitted'])
    expect(Math.max(...time.rows.map(r => r.share))).toBe(1)
    const he = build(undefined, 'he').screens[0]
    expect(he.type === 'dashboard' && he.widgets[2].title).toBe('זמן בכל מצב — Claims')
  })

  it('marks file and picture columns, and an audited list’s toggle', () => {
    const { table } = screenOf(1, 'entity-list')
    expect(table.kinds).toEqual(['text', 'file', 'images'])
    expect(table.changedByMe).toBe('Changed by me')
    expect('changedByMe' in screenOf(5, 'entity-list').table).toBe(false)
  })

  it('adds the change history to a record that keeps one', () => {
    const record = screenOf(2, 'record')
    expect(record.history?.label).toBe('Change history')
    expect(record.history?.rows.map(r => r.what)).toEqual(['Changed', 'Created'])
    // The related tabs are still the layout's own.
    expect(record.tabs).toHaveLength(2)
    expect(record.details.find(d => d.label === 'Receipt')?.input).toBe('file')
    expect(record.details.find(d => d.label === 'Title')?.input).toBeUndefined()
  })

  it('draws a form’s drop zones and the rows it edits; a plain form keeps its shape', () => {
    const form = screenOf(3, 'form')
    // `inputs` is index-aligned with `fields`.
    const inputOf = (label: string) => form.groups[0].inputs?.[form.groups[0].fields.indexOf(label)]
    expect(form.groups[0].inputs).toHaveLength(form.groups[0].fields.length)
    expect(inputOf('Title')).toBe('text')
    expect(inputOf('Receipt')).toBe('file')
    expect(inputOf('Photos')).toBe('images')
    // A workflow's status and assignee are set by its moves, never asked for in the form.
    expect(form.groups[0].fields).toEqual(['Title', 'Receipt', 'Photos'])
    expect(form.rows).toEqual([{ title: 'Lines', columns: ['Description', 'Quantity'], rows: expect.any(Array), add: 'Add row' }])
    expect(form.rows?.[0].rows).toHaveLength(2)
    const plain = screenOf(6, 'form')
    // (Customer's key is typed in, so the form asks for it.)
    expect(plain.groups).toEqual([{ fields: ['Id', 'Name'] }])
    expect('rows' in plain).toBe(false)
  })

  it('gives a wizard a step for the rows, after its own', () => {
    const wizard = screenOf(4, 'wizard')
    expect(wizard.steps).toEqual(['Basics', 'Step 2', 'Review'])
    expect(wizard.stepInputs).toEqual([['text'], ['file', 'images']])
    expect(wizard.rowsSteps?.map(r => r.title)).toEqual(['Lines'])
  })

  it('the entity card’s mock draws a file field as a drop zone', () => {
    const form = buildUiPreview(entities[1], { projectOpts: [], entities }).form
    expect(form.find(c => c.name === 'receipt')).toMatchObject({ control: 'file' })
    expect(form.find(c => c.name === 'receipt')?.many).toBeUndefined()
    expect(form.find(c => c.name === 'photos')).toMatchObject({ control: 'image', many: 3, hint: '≤ 3 files' })
  })
})

function draw(selected: number, options: { nav?: FullstackNav; skin?: 'tailwind' | 'menora'; navStyle?: 'sidebar' | 'topbar' } = {}) {
  return render(
    <LayoutPreview preview={build(options.nav)} selected={selected} onSelect={() => {}} onEdit={() => {}}
                   skin={options.skin ?? 'tailwind'} navStyle={options.navStyle} />,
  ).container
}

describe('the canvas — what it now draws', () => {
  it('draws the header tools in each shell, and none without them', () => {
    expect(draw(0).querySelector('[data-preview-tools]')).toBeNull()
    for (const shell of [{}, { navStyle: 'topbar' as const }, { skin: 'menora' as const }]) {
      const canvas = draw(0, { nav: allTools, ...shell })
      const tools = Array.from(canvas.querySelectorAll('[data-preview-tool]')).map(el => el.getAttribute('data-preview-tool'))
      expect(tools).toEqual(['palette', 'bell', 'user'])
      expect(canvas.querySelector('[data-preview-tool="bell"]')?.textContent).toContain('3')
    }
    // The sidebar shell gets a header for them; the other two already have a bar.
    expect(draw(0, { nav: allTools }).querySelector('[data-preview-header] [data-preview-tools]')).not.toBeNull()
    expect(draw(0, { nav: allTools, navStyle: 'topbar' }).querySelector('[data-preview-header]')).toBeNull()
  })

  it('draws the three widget shapes', () => {
    const canvas = draw(0)
    expect(canvas.querySelector('[data-preview-gauge] svg')).not.toBeNull()
    expect(canvas.querySelectorAll('[data-preview-funnel] li')).toHaveLength(3)
    expect(canvas.querySelectorAll('[data-preview-time-in-state] li')).toHaveLength(2)
  })

  it('draws a list’s attachments and its "Changed by me" toggle', () => {
    const canvas = draw(1)
    expect(canvas.querySelector('[data-preview-changed-by-me]')?.textContent).toBe('Changed by me')
    expect(canvas.querySelectorAll('[data-preview-attachment="file"]')).toHaveLength(3)
    // Several pictures: the first, and how many more.
    expect(canvas.querySelector('[data-preview-attachment="images"]')?.textContent).toContain('+2')
    expect(draw(5).querySelector('[data-preview-changed-by-me]')).toBeNull()
  })

  it('opens the change history from the record’s last tab', () => {
    const canvas = draw(2)
    expect(canvas.querySelector('[data-preview-history]')).toBeNull()
    fireEvent.click(canvas.querySelector('[data-preview-history-tab]')!)
    expect(canvas.querySelectorAll('[data-preview-history] li')).toHaveLength(2)
  })

  it('draws drop zones and the rows editor in a form', () => {
    const canvas = draw(3)
    expect(canvas.querySelector('[data-preview-drop-zone="file"]')?.textContent).toContain('Choose a file')
    expect(canvas.querySelectorAll('[data-preview-drop-zone="images"] [data-preview-thumbnail]')).toHaveLength(2)
    expect(canvas.querySelector('[data-preview-rows]')?.textContent).toContain('Add row')
    expect(draw(6).querySelector('[data-preview-drop-zone], [data-preview-rows]')).toBeNull()
  })

  it('walks a wizard through its rows step to the review', () => {
    const canvas = draw(4)
    const steps = Array.from(canvas.querySelectorAll('[data-preview-steps] button')).map(b => b.textContent?.replace(/^\d+\s*/, ''))
    expect(steps).toEqual(['Basics', 'Step 2', 'Lines', 'Review'])
    const stepButtons = canvas.querySelectorAll<HTMLButtonElement>('[data-preview-steps] button')
    fireEvent.click(stepButtons[1])
    expect(canvas.querySelectorAll('[data-preview-step="1"] [data-preview-drop-zone]')).toHaveLength(2)
    fireEvent.click(stepButtons[2])
    expect(canvas.querySelector('[data-preview-step="2"] [data-preview-rows]')).not.toBeNull()
    fireEvent.click(stepButtons[3])
    expect(canvas.querySelector('[data-preview-step="review"]')).not.toBeNull()
  })
})
