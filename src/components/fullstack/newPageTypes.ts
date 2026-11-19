import type { FullstackCalendarMode, FullstackEntityDef, FullstackFieldDef, FullstackInboxQueue, FullstackPageDef, FullstackPageType } from '../../types'
import { contentLinks, isExternalLink } from './contentMarkdown'
import { CHOICES, LIMITS } from './schema'
import { isDateType, isLongTextType, isTextualType } from './fieldTypes'
import { t, tn } from '../../i18n'

/**
 * The calendar, board, content, import and search page types: their choices, defaults and the
 * rules FullstackPageValidator applies to them, kept apart from pageLayout.ts (which calls in).
 */

export const CALENDAR_MODES: { value: FullstackCalendarMode; readonly label: string }[] = [
  { value: 'month', get label() { return t('Month') } },
  { value: 'week', get label() { return t('Week') } },
  { value: 'agenda', get label() { return t('Agenda') } },
  { value: 'timeline', get label() { return t('Timeline') } },
]
export const LANE_SIZES = CHOICES.laneSizes
export const DEFAULT_LANE_SIZE = LIMITS.defaultLaneSize
export const MAX_CARD_FIELDS = LIMITS.maxCardFields
export const MAX_WIP_LIMIT = LIMITS.maxWipLimit
export const MAX_BODY = LIMITS.maxBody
export const MAX_SEARCH_ENTITIES = LIMITS.maxSearchEntities
export const MIN_PER_ENTITY = LIMITS.minPerEntity
export const MAX_PER_ENTITY = LIMITS.maxPerEntity
export const DEFAULT_PER_ENTITY = LIMITS.defaultPerEntity
export const INBOX_QUEUES: { value: FullstackInboxQueue; readonly label: string }[] = [
  { value: 'mine', get label() { return t('My tasks') } },
  { value: 'unassigned', get label() { return t('Unassigned') } },
  { value: 'open', get label() { return t('All open') } },
]
export const DEFAULT_INBOX_QUEUES: FullstackInboxQueue[] = ['mine', 'unassigned']

/** Whether an entity can have an inbox: a workflow that assigns its rows to users. */
export const hasInbox = (e: FullstackEntityDef | undefined) => Boolean(e?.workflow?.assigneeField)

/** An inbox's columns when the page names none: the card defaults without the status, assignee and due date (they have their own). */
export function defaultInboxFields(e: FullstackEntityDef | undefined): string[] {
  const wf = e?.workflow
  const own = [wf?.statusField, wf?.assigneeField, wf?.dueField]
  return defaultCardFields(e, wf?.statusField).filter(n => !own.includes(n))
}

const eq = (a: string | undefined, b: string | undefined) => a != null && b != null && a.trim().toLowerCase() === b.trim().toLowerCase()
const isDate = (f: FullstackFieldDef) => isDateType(f.type)

/** What a calendar can place rows by: a filterable, non-key date (the period travels as its filter). */
export const calendarDateFields = (e: FullstackEntityDef | undefined): FullstackFieldDef[] =>
  (e?.fields ?? []).filter(f => !f.primaryKey && f.filterable !== false && isDate(f))

/** What a board can split into lanes: a filterable, non-key enum or boolean (each lane is a filter). */
export const laneFields = (e: FullstackEntityDef | undefined): FullstackFieldDef[] =>
  (e?.fields ?? []).filter(f => !f.primaryKey && f.filterable !== false && (f.type === 'ENUM' || f.type === 'BOOLEAN'))

export const defaultCalendarDate = (e: FullstackEntityDef | undefined) => calendarDateFields(e)[0]?.name

export function defaultLaneField(e: FullstackEntityDef | undefined): string | undefined {
  const fields = laneFields(e)
  return (fields.find(f => f.type === 'ENUM') ?? fields[0])?.name
}

/** A lane field's values, as its lanes: an enum's constants, a boolean's true/false. */
export function laneValues(e: FullstackEntityDef | undefined, lane: string | undefined): string[] {
  const f = e?.fields.find(x => eq(x.name, lane))
  if (!f) return []
  return f.type === 'BOOLEAN' ? ['true', 'false'] : (f.enumValues ?? [])
}

/** What a card may show: every field and every MANY_TO_ONE relation, by name. */
export function cardFieldOptions(e: FullstackEntityDef | undefined): string[] {
  return [...(e?.fields ?? []).map(f => f.name), ...(e?.relations ?? []).filter(r => r.type === 'MANY_TO_ONE').map(r => r.fieldName)]
}

/** A card's fields when the page names none (FullstackPageValidator.defaultCardFields): a heading —
 *  the first text field, else the key — the next two fields but the lane, then the first relation. */
export function defaultCardFields(e: FullstackEntityDef | undefined, lane: string | undefined): string[] {
  if (!e || e.fields.length === 0) return []
  const heading = e.fields.find(f => !f.primaryKey && (isTextualType(f.type)))
    ?? e.fields.find(f => f.primaryKey) ?? e.fields[0]
  const out = [heading.name]
  for (const f of e.fields) {
    if (out.length >= 3) break
    if (f.primaryKey || f.name === lane || out.includes(f.name) || isLongTextType(f.type)) continue
    out.push(f.name)
  }
  const relation = (e.relations ?? []).find(r => r.type === 'MANY_TO_ONE')
  if (relation) out.push(relation.fieldName)
  return out.slice(0, MAX_CARD_FIELDS)
}

/** Whether a search can find an entity's rows: some searchable text field. */
export const searchableEntity = (e: FullstackEntityDef) =>
  e.fields.some(f => f.searchable !== false && (isTextualType(f.type)))

/** The entities a search page asks when it names none. */
export const defaultSearchEntities = (entities: FullstackEntityDef[]) =>
  entities.filter(e => e.name.trim() && searchableEntity(e)).slice(0, MAX_SEARCH_ENTITIES).map(e => e.name)

/** Whether an entity may import CSV at all (and so have an import page). */
export const importable = (e: FullstackEntityDef) => !e.readOnly && !e.viewQuery?.trim()

/** Why a new page of one of these types cannot be about `e`, or undefined when it can. */
export function newTypeReason(type: FullstackPageType, e: FullstackEntityDef, pages: FullstackPageDef[]): string | undefined {
  switch (type) {
    case 'calendar':
      return calendarDateFields(e).length === 0 ? t('No filterable date field to place rows by') : undefined
    case 'board':
      return laneFields(e).length === 0 ? t('No filterable enum or boolean field for lanes') : undefined
    case 'inbox':
      return !hasInbox(e) ? t('No workflow with an assignee') : undefined
    case 'import':
      return !importable(e) ? t('Read-only — nothing to import')
        : e.opts?.csvImport === false ? t('Its CSV import option is off')
          : pages.some(p => p.type === 'import' && eq(p.entity, e.name)) ? t('Already has an import page') : undefined
    default:
      return undefined
  }
}

/** Why a new search page cannot be added, or undefined when it can. */
export function newSearchReason(entities: FullstackEntityDef[], pages: FullstackPageDef[]): string | undefined {
  if (pages.some(p => p.type === 'search')) return t('The layout already has a search page')
  if (!entities.some(searchableEntity)) return t('No entity has a text field to search')
  return undefined
}

/** A new page of one of these types, filled in so it is valid on sight. */
export function blankNewTypePage(type: 'calendar' | 'board' | 'content' | 'import' | 'search' | 'inbox', entity: FullstackEntityDef | undefined,
  entities: FullstackEntityDef[], id: (base: string) => string): FullstackPageDef {
  const name = entity?.name ?? ''
  switch (type) {
    case 'calendar':
      return { id: id(`${name || 'calendar'}-calendar`), type, entity: name, title: `${name} calendar`, dateField: defaultCalendarDate(entity), modes: ['month'] }
    case 'board':
      return { id: id(`${name || 'board'}-board`), type, entity: name, title: `${name} board`, laneField: defaultLaneField(entity) }
    case 'import':
      return { id: id(`import-${name || 'rows'}`), type, entity: name, title: `Import ${name}`, group: undefined }
    case 'inbox':
      return { id: id(`${name || 'my'}-tasks`), type, entity: name, title: 'My tasks' }
    case 'search':
      return { id: id('search'), type, title: 'Search', entities: defaultSearchEntities(entities), shellSearch: true }
    case 'content':
      return { id: id('help'), type, title: 'Help', body: '## About this app\n\nWrite what people should know here — **bold**, *emphasis*, lists and [links](https://example.com).' }
  }
}

type Add = (field: string, message: string, summary?: string) => void

/** A calendar page's rules (FullstackPageValidator.calendar). */
export function checkCalendar(page: FullstackPageDef, e: FullstackEntityDef, add: Add, where: string): void {
  const dates = calendarDateFields(e)
  const date = page.dateField ?? defaultCalendarDate(e)
  if (!date) add('dateField', t('{entity} has no filterable date field to place rows by', { entity: e.name }))
  else if (!dates.some(f => eq(f.name, date))) add('dateField', t('“{field}” is not a filterable date field of {entity}', { field: date, entity: e.name }), t('{where} places rows by “{field}”, which is not a filterable date of {entity}', { where, field: date, entity: e.name }))
  if (page.endField) {
    if (!dates.some(f => eq(f.name, page.endField))) add('endField', t('“{field}” is not a filterable date field of {entity}', { field: page.endField, entity: e.name }))
    else if (eq(page.endField, date)) add('endField', t('must differ from the start date'))
  }
  const modes = page.modes ?? ['month']
  if (modes.length === 0) add('modes', t('needs at least one view'))
  if (new Set(modes).size !== modes.length) add('modes', t('lists a view twice'))
  if (modes.some(m => !CALENDAR_MODES.some(c => c.value === m))) add('modes', t('has an unknown view'))
  if (modes.includes('timeline') && !page.endField) add('modes', t('the timeline needs an end date'), t('{where} has a timeline but no end date for its bars', { where }))
  for (const key of Object.keys(page.presetFilter ?? {})) {
    if (eq(key, date) || eq(key, page.endField)) add(`presetFilter.${key}`, t('the calendar’s own range sets it'))
  }
}

/** A board page's rules (FullstackPageValidator.board). */
export function checkBoard(page: FullstackPageDef, e: FullstackEntityDef, add: Add, where: string): void {
  const lane = page.laneField ?? defaultLaneField(e)
  if (!lane) {
    add('laneField', t('{entity} has no filterable enum or boolean field to split into lanes', { entity: e.name }))
    return
  }
  if (!laneFields(e).some(f => eq(f.name, lane))) {
    add('laneField', t('“{lane}” is not a filterable enum or boolean field of {entity}', { lane, entity: e.name }), t('{where} splits by “{lane}”, which {entity} cannot filter by', { where, lane, entity: e.name }))
    return
  }
  const values = laneValues(e, lane)
  if (page.lanes) {
    if (page.lanes.length === 0) add('lanes', t('needs at least one lane'))
    const unknown = page.lanes.filter(v => !values.some(x => eq(x, v)))
    if (unknown.length) add('lanes', tn(unknown.length, '{values} is not a value of {lane}', '{values} are not a value of {lane}', { values: unknown.map(v => `“${v}”`).join(', '), lane }))
    if (new Set(page.lanes).size !== page.lanes.length) add('lanes', t('lists a lane twice'))
  }
  const lanes = page.lanes ?? values
  for (const [key, limit] of Object.entries(page.wipLimits ?? {})) {
    if (!lanes.some(v => eq(v, key))) add('wipLimits', t('“{lane}” is not one of its lanes', { lane: key }))
    else if (!Number.isInteger(limit) || limit < 1 || limit > MAX_WIP_LIMIT) add('wipLimits', t('a lane holds 1 to {max} cards', { max: MAX_WIP_LIMIT }))
  }
  checkCardFields(page, e, add)
  if (page.laneSize != null && !LANE_SIZES.includes(page.laneSize)) add('laneSize', t('loads {sizes} cards at a time', { sizes: LANE_SIZES.join(', ') }))
  if (Object.keys(page.presetFilter ?? {}).some(k => eq(k, lane))) add(`presetFilter.${lane}`, t('the lanes already split by it'))
}

function checkCardFields(page: FullstackPageDef, e: FullstackEntityDef, add: Add): void {
  if (!page.cardFields) return
  const options = cardFieldOptions(e)
  if (page.cardFields.length === 0 || page.cardFields.length > MAX_CARD_FIELDS) add('cardFields', t('shows 1 to {max} fields', { max: MAX_CARD_FIELDS }))
  const unknown = page.cardFields.filter(n => !options.some(o => eq(o, n)))
  if (unknown.length) add('cardFields', t('{entity} has no field or relation {names}', { entity: e.name, names: unknown.map(n => `“${n}”`).join(', ') }))
  if (new Set(page.cardFields).size !== page.cardFields.length) add('cardFields', t('lists a field twice'))
}

/** An inbox page's rules: an entity whose workflow assigns rows, its queues and its columns. */
export function checkInbox(page: FullstackPageDef, e: FullstackEntityDef, add: Add, where: string): void {
  if (!hasInbox(e)) {
    add('entity', t('{entity} has no workflow with an assignee', { entity: e.name }), t('{where} lists {entity}, whose rows are not assigned to anyone', { where, entity: e.name }))
    return
  }
  if (page.queues) {
    if (page.queues.length === 0) add('queues', t('needs at least one queue'))
    if (page.queues.some(q => !INBOX_QUEUES.some(x => x.value === q))) add('queues', t('has an unknown queue'))
    if (new Set(page.queues).size !== page.queues.length) add('queues', t('lists a queue twice'))
  }
  checkCardFields(page, e, add)
}

/** A content page's rules (FullstackPageValidator.body): a title, a body, and links that can open. */
export function checkContent(page: FullstackPageDef, pages: FullstackPageDef[], add: Add, where: string): void {
  if (!page.title?.trim()) add('title', t('needs a title'), t('{where} needs a title — a content page has no entity to name it', { where }))
  const body = page.body?.trim() ?? ''
  if (!body) add('body', t('needs some text'))
  else if (body.length > MAX_BODY) add('body', t('is longer than {max} characters', { max: MAX_BODY }))
  for (const link of contentLinks(body)) {
    if (link.kind === 'link' && !isExternalLink(link.target ?? '')) {
      add('body', t('link “{target}” must be an http(s) or mailto address, or a page (#/page-id)', { target: link.target ?? '' }))
      continue
    }
    if (link.kind !== 'page-link') continue
    const target = pages.find(p => p.id === link.target)
    if (!target) add('body', t('links to no page “{target}”', { target: link.target ?? '' }), t('{where} links to the missing page “{id}”', { where, id: link.target ?? '' }))
    else if (target.type === 'record') add('body', t('cannot link to the record page “{target}” — it opens from a row', { target: link.target ?? '' }))
    else if (target.hidden && target.type !== 'wizard' && target.type !== 'form' && target.type !== 'search') add('body', t('“{target}” is hidden, so a link cannot open it', { target: link.target ?? '' }))
  }
}

/** An import page's rules (the entity must be writable, one import page per entity). */
export function checkImport(page: FullstackPageDef, e: FullstackEntityDef, pages: FullstackPageDef[], add: Add, where: string): void {
  if (!importable(e)) add('entity', t('{entity} is read-only, so there is nothing to import', { entity: e.name }))
  if (e.opts?.csvImport === false) add('entity', t('{entity}’s CSV import option is off', { entity: e.name }), t('{where} imports {entity}, whose CSV import option is off', { where, entity: e.name }))
  const first = pages.find(p => p.type === 'import' && eq(p.entity, e.name))
  if (first && first !== page) add('entity', t('{entity} already has the import page “{id}”', { entity: e.name, id: first.id }), t('{where} is a second import page for {entity}', { where, entity: e.name }))
}

/** A search page's rules (FullstackPageValidator.search). */
export function checkSearch(page: FullstackPageDef, entities: FullstackEntityDef[], pages: FullstackPageDef[], add: Add, where: string): void {
  const first = pages.find(p => p.type === 'search')
  if (first && first !== page) add('type', t('the layout already has the search page “{id}”', { id: first.id }), t('{where} is a second search page', { where }))
  if (page.entities) {
    if (page.entities.length === 0 || page.entities.length > MAX_SEARCH_ENTITIES) add('entities', t('searches 1 to {max} entities', { max: MAX_SEARCH_ENTITIES }))
    for (const name of page.entities) {
      const e = entities.find(x => eq(x.name, name))
      if (!e) add('entities', t('“{name}” is no longer an entity', { name }))
      else if (!searchableEntity(e)) add('entities', t('{entity} has no searchable text field', { entity: e.name }))
    }
  } else if (defaultSearchEntities(entities).length === 0) {
    add('entities', t('no entity has a searchable text field'))
  }
  if (page.perEntity != null && (!Number.isInteger(page.perEntity) || page.perEntity < MIN_PER_ENTITY || page.perEntity > MAX_PER_ENTITY)) {
    add('perEntity', t('shows {min} to {max} matches per entity', { min: MIN_PER_ENTITY, max: MAX_PER_ENTITY }))
  }
  if (page.hidden && !page.shellSearch) add('shellSearch', t('a hidden search page needs the header’s search box — nothing else opens it'))
}

/** One line describing one of these pages. */
export function describeNewTypePage(page: FullstackPageDef, entities: FullstackEntityDef[]): string {
  const e = entities.find(x => eq(x.name, page.entity))
  switch (page.type) {
    case 'calendar': {
      const modes = (page.modes ?? ['month']).join(', ')
      const date = `${page.dateField ?? defaultCalendarDate(e) ?? '?'}${page.endField ? `–${page.endField}` : ''}`
      return `${t('{entity} by {date}', { entity: page.entity ?? '?', date })} · ${modes}`
    }
    case 'board': {
      const lane = page.laneField ?? defaultLaneField(e) ?? '?'
      const limits = Object.keys(page.wipLimits ?? {}).length
      return `${t('{entity} in lanes of {lane}', { entity: page.entity ?? '?', lane })}${limits ? ` · ${tn(limits, '{n} lane limit', '{n} lane limits')}` : ''}`
    }
    case 'content': {
      const words = (page.body ?? '').trim().split(/\s+/).filter(Boolean).length
      return `${t('Text')} · ${tn(words, '{n} word', '{n} words')}`
    }
    case 'tree':
      return page.via ? t('{entity} as a tree by {link}', { entity: page.entity ?? '?', link: page.via }) : t('{entity} as a tree', { entity: page.entity ?? '?' })
    case 'import':
      return t('CSV import of {entity}', { entity: page.entity ?? '?' })
    case 'inbox': {
      const queues = (page.queues ?? DEFAULT_INBOX_QUEUES).map(q => INBOX_QUEUES.find(x => x.value === q)?.label ?? q)
      return `${t('{entity} tasks', { entity: page.entity ?? '?' })} · ${queues.join(', ')}`
    }
    case 'search': {
      const names = page.entities ?? defaultSearchEntities(entities)
      return `${t('Searches {names}', { names: names.join(', ') || t('nothing') })}${page.shellSearch ? ` · ${t('header box')}` : ''}`
    }
    default:
      return ''
  }
}

/** Follows a field rename on `entity` into a calendar's dates and a board's lane and cards. */
export function renameFieldInNewPages(page: FullstackPageDef, entity: string, from: string, to: string): FullstackPageDef {
  if (!eq(page.entity, entity)) return page
  const out = { ...page }
  if (page.type === 'calendar') {
    if (page.dateField === from) out.dateField = to
    if (page.endField === from) out.endField = to
  }
  if (page.type === 'board') {
    if (page.laneField === from) out.laneField = to
  }
  if ((page.type === 'board' || page.type === 'inbox') && page.cardFields?.includes(from)) {
    out.cardFields = page.cardFields.map(n => (n === from ? to : n))
  }
  return out
}

/** Follows a relation rename into a board's cards. */
export function renameRelationInNewPages(page: FullstackPageDef, child: string, from: string, to: string): FullstackPageDef {
  if ((page.type !== 'board' && page.type !== 'inbox') || !eq(page.entity, child) || !page.cardFields?.includes(from)) return page
  return { ...page, cardFields: page.cardFields.map(n => (n === from ? to : n)) }
}

/** Follows a renamed enum constant into a board's lanes and limits. */
export function renameEnumValueInNewPages(page: FullstackPageDef, entity: string, field: string, from: string, to: string): FullstackPageDef {
  if (page.type !== 'board' || !eq(page.entity, entity) || !eq(page.laneField, field)) return page
  const out = { ...page }
  if (page.lanes?.includes(from)) out.lanes = page.lanes.map(v => (v === from ? to : v))
  if (page.wipLimits && from in page.wipLimits) {
    out.wipLimits = Object.fromEntries(Object.entries(page.wipLimits).map(([k, v]) => [k === from ? to : k, v]))
  }
  return out
}

/** Follows an entity rename into a search page's list. */
export function renameEntityInNewPages(page: FullstackPageDef, from: string, to: string): FullstackPageDef {
  if (page.type !== 'search' || !page.entities?.some(n => eq(n, from))) return page
  return { ...page, entities: page.entities.map(n => (eq(n, from) ? to : n)) }
}

/** Follows a page id rename into content pages' links. */
export function renamePageIdInBody(body: string, from: string, to: string): string {
  return body.replace(/\]\((#\/|page:)([a-z0-9-]+)\)/gi, (match, prefix: string, id: string) => (id === from ? `](${prefix}${to})` : match))
}
