import { describe, it, expect } from 'vitest'
import type { ExampleModel, FullstackEntityDef, FullstackPageDef } from '../../types'
import seeded from './__fixtures__/fullstack-examples.json'
import { isExternalLink, pageIdOfLink, parseContent, parseInline } from './contentMarkdown'
import { buildLayoutPreview } from './layoutPreviewModel'
import {
  blankPage, canDuplicate, linkablePages, newPageChoices, newPageTypeReason, renameEntityInPages, renameEnumValueInPages,
  renameFieldInPages, renamePageIdInPages, renameRelationInPages, retargetPage, validatePages,
} from './pageLayout'
import { defaultCardFields, defaultLaneField } from './newPageTypes'

const planning = (seeded as ExampleModel[]).find(m => m.id === 'projects')!
const entities = planning.entities as FullstackEntityDef[]
const pages = () => JSON.parse(JSON.stringify(planning.pages)) as FullstackPageDef[]
const pageOf = (all: FullstackPageDef[], id: string) => all.find(p => p.id === id)!
const errorsOf = (all: FullstackPageDef[], id: string) => validatePages(all, entities, { scaffoldOpts: ['csvExport'] }).byPage[all.findIndex(p => p.id === id)] ?? {}

describe('content Markdown (a port of the backend ContentMarkdown)', () => {
  it('reads blocks', () => {
    const blocks = parseContent('# Title\n## Sub\nA paragraph\nover two lines.\n\n- one\n* two\n1. first\n2) second\n> a quote\n> goes on\n---\nLast.')
    expect(blocks.map(b => b.kind)).toEqual(['heading', 'heading', 'paragraph', 'bullets', 'numbers', 'callout', 'rule', 'paragraph'])
    expect(blocks[2].items[0]).toEqual([{ kind: 'text', text: 'A paragraph over two lines.' }])
    expect(blocks[5].items[0]).toEqual([{ kind: 'text', text: 'a quote goes on' }])
  })

  it('reads inline runs and leaves unclosed markers as text', () => {
    expect(parseInline('Plain **bold** *em* `code` [page](#/orders) [site](https://example.com)')).toEqual([
      { kind: 'text', text: 'Plain ' }, { kind: 'bold', text: 'bold' }, { kind: 'text', text: ' ' }, { kind: 'em', text: 'em' },
      { kind: 'text', text: ' ' }, { kind: 'code', text: 'code' }, { kind: 'text', text: ' ' },
      { kind: 'page-link', text: 'page', target: 'orders' }, { kind: 'text', text: ' ' },
      { kind: 'link', text: 'site', target: 'https://example.com' },
    ])
    expect(parseInline('2 * 3 = 6, a [ bracket and `tick')).toEqual([{ kind: 'text', text: '2 * 3 = 6, a [ bracket and `tick' }])
  })

  it('tells pages from addresses', () => {
    expect(pageIdOfLink('page:help-desk')).toBe('help-desk')
    expect(pageIdOfLink('#/Not A Page')).toBeUndefined()
    expect(isExternalLink('mailto:a@b.c')).toBe(true)
    expect(isExternalLink('javascript:alert(1)')).toBe(false)
    expect(isExternalLink('https://')).toBe(false)
  })
})

describe('the calendar, board, content, import and search pages', () => {
  it('accept the Project planning example as it is', () => {
    const v = validatePages(pages(), entities, { scaffoldOpts: ['csvExport'] })
    expect(v.issues).toEqual([])
  })

  it('flag what the generator would reject', () => {
    const cases: [string, (all: FullstackPageDef[]) => void, string, string][] = [
      ['schedule', all => { pageOf(all, 'schedule').dateField = 'title' }, 'dateField', '“title” is not a filterable date field of Task'],
      ['schedule', all => { delete pageOf(all, 'schedule').endField }, 'modes', 'the timeline needs an end date'],
      ['board', all => { pageOf(all, 'board').laneField = 'title' }, 'laneField', '“title” is not a filterable enum or boolean field of Task'],
      ['board', all => { pageOf(all, 'board').wipLimits = { LATER: 3 } }, 'wipLimits', '“LATER” is not one of its lanes'],
      ['board', all => { pageOf(all, 'board').cardFields = ['title', 'nope'] }, 'cardFields', 'Task has no field or relation “nope”'],
      ['help', all => { pageOf(all, 'help').body = 'Go [here](javascript:alert(1)).' }, 'body', 'must be an http(s) or mailto address'],
      ['help', all => { pageOf(all, 'help').body = 'See [the task](#/task).' }, 'body', 'cannot link to the record page “task”'],
      ['help', all => { delete pageOf(all, 'help').title }, 'title', 'needs a title'],
      ['find', all => { Object.assign(pageOf(all, 'find'), { hidden: true, shellSearch: false }) }, 'shellSearch', 'needs the header’s search box'],
      ['find', all => { pageOf(all, 'find').perEntity = 50 }, 'perEntity', 'shows 3 to 10 matches per entity'],
    ]
    for (const [id, mutate, field, message] of cases) {
      const all = pages()
      mutate(all)
      expect(errorsOf(all, id)[field], `${id}.${field}`).toContain(message)
    }
    const twice = pages()
    twice.push({ id: 'import-again', type: 'import', entity: 'Task' })
    expect(errorsOf(twice, 'import-again').entity).toContain('already has the import page “import-tasks”')
    twice.push({ id: 'find-again', type: 'search' })
    expect(errorsOf(twice, 'find-again').type).toContain('already has the search page “find”')
  })

  it('default like the generator does', () => {
    const task = entities.find(e => e.name === 'Task')!
    expect(defaultLaneField(task)).toBe('status')
    expect(defaultCardFields(task, 'status')).toEqual(['title', 'priority', 'startsOn', 'project'])
  })

  it('start valid from the gallery, and say why one cannot be added', () => {
    const person = { name: 'Person', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] } as FullstackEntityDef
    expect(newPageChoices('calendar', [person], [])?.[0].reason).toBe('No filterable date field to place rows by')
    expect(newPageChoices('board', [person], [])?.[0].reason).toBe('No filterable enum or boolean field for lanes')
    expect(newPageTypeReason('search', entities, pages())).toBe('The layout already has a search page')
    for (const type of ['calendar', 'board', 'import', 'content'] as const) {
      const page = blankPage(type, entities, [])
      expect(validatePages([{ id: 'home', type: 'entity-list', entity: 'Task' }, page], entities).issues, type).toEqual([])
    }
    expect(validatePages([blankPage('search', entities, [])], entities).issues).toEqual([])
  })

  it('are not duplicated when a layout holds one, and a hidden search page can be linked to', () => {
    expect(canDuplicate({ id: 'i', type: 'import', entity: 'Task' })).toBe(false)
    expect(canDuplicate({ id: 's', type: 'search' })).toBe(false)
    expect(canDuplicate({ id: 'b', type: 'board', entity: 'Task' })).toBe(true)
    expect(linkablePages([{ id: 's', type: 'search', hidden: true, shellSearch: true }]).map(p => p.id)).toEqual(['s'])
  })

  it('follow renames of fields, relations, enum values, entities and page ids', () => {
    let all = renameFieldInPages(pages(), 'Task', 'dueOn', 'deadline')
    expect(pageOf(all, 'schedule').endField).toBe('deadline')
    expect(pageOf(all, 'board').cardFields).toContain('deadline')
    all = renameFieldInPages(all, 'Task', 'status', 'stage')
    expect(pageOf(all, 'board').laneField).toBe('stage')
    all = renameEnumValueInPages(all, 'Task', 'stage', 'DOING', 'IN_PROGRESS')
    expect(pageOf(all, 'board').wipLimits).toEqual({ IN_PROGRESS: 5 })
    all = renameRelationInPages(all, 'Task', 'assignee', 'owner')
    expect(pageOf(all, 'board').cardFields).toContain('owner')
    all = renameEntityInPages(all, 'Project', 'Initiative')
    expect(pageOf(all, 'find').entities).toEqual(['Task', 'Initiative', 'Person'])
    all = renamePageIdInPages(all, 'board', 'task-board')
    expect(pageOf(all, 'help').body).toContain('[task board](#/task-board)')
  })

  it('switch types keeping the entity where the new type can take it', () => {
    const list: FullstackPageDef = { id: 'tasks', type: 'entity-list', entity: 'Task', presetFilter: { priority: 'HIGH' } }
    const { page, dropped } = retargetPage(list, 'board', entities, [list])
    expect(page).toMatchObject({ type: 'board', entity: 'Task', laneField: 'status', presetFilter: { priority: 'HIGH' } })
    expect(dropped).toEqual([])
    const back = retargetPage(pageOf(pages(), 'schedule'), 'entity-list', entities, pages())
    expect(back.dropped).toContain('end date')
  })

  it('preview with sample rows', () => {
    const preview = buildLayoutPreview(pages(), entities, { locale: 'en', projectOpts: ['csvExport'] })
    const screen = (id: string) => preview.screens[pages().findIndex(p => p.id === id)]
    const board = screen('board')
    expect(board.type === 'board' && board.lanes.map(l => [l.label, l.limit])).toEqual([['To do', null], ['Doing', 5], ['Review', null], ['Done', null]])
    const calendar = screen('schedule')
    expect(calendar.type === 'calendar' && calendar.modes).toEqual(['Month', 'Week', 'Agenda', 'Timeline'])
    const content = screen('help')
    expect(content.type === 'content' && content.blocks[0]).toMatchObject({ kind: 'heading', level: 2 })
    const search = screen('find')
    expect(search.type === 'search' && search.groups.map(g => g.title)).toEqual(['Tasks', 'Projects', 'People'])
    const imp = screen('import-tasks')
    expect(imp.type === 'import' && imp.fields.some(f => f.label === 'Project' && f.required)).toBe(true)
  })
})
