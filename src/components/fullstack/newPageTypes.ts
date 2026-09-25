import type { FullstackCalendarMode, FullstackEntityDef, FullstackFieldDef, FullstackPageDef, FullstackPageType } from '../../types'
import { contentLinks, isExternalLink } from './contentMarkdown'

/**
 * The calendar, board, content, import and search page types: their choices, defaults and the
 * rules FullstackPageValidator applies to them, kept apart from pageLayout.ts (which calls in).
 */

export const CALENDAR_MODES: { value: FullstackCalendarMode; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'timeline', label: 'Timeline' },
]
export const LANE_SIZES = [10, 20, 50]
export const DEFAULT_LANE_SIZE = 20
export const MAX_CARD_FIELDS = 4
export const MAX_WIP_LIMIT = 999
export const MAX_BODY = 8000
export const MAX_SEARCH_ENTITIES = 8
export const MIN_PER_ENTITY = 3
export const MAX_PER_ENTITY = 10
export const DEFAULT_PER_ENTITY = 5

const eq = (a: string | undefined, b: string | undefined) => a != null && b != null && a.trim().toLowerCase() === b.trim().toLowerCase()
const isDate = (f: FullstackFieldDef) => f.type === 'LOCAL_DATE' || f.type === 'LOCAL_DATE_TIME'

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
  const heading = e.fields.find(f => !f.primaryKey && (f.type === 'STRING' || f.type === 'TEXT'))
    ?? e.fields.find(f => f.primaryKey) ?? e.fields[0]
  const out = [heading.name]
  for (const f of e.fields) {
    if (out.length >= 3) break
    if (f.primaryKey || f.name === lane || out.includes(f.name) || f.type === 'TEXT') continue
    out.push(f.name)
  }
  const relation = (e.relations ?? []).find(r => r.type === 'MANY_TO_ONE')
  if (relation) out.push(relation.fieldName)
  return out.slice(0, MAX_CARD_FIELDS)
}

/** Whether a search can find an entity's rows: some searchable text field. */
export const searchableEntity = (e: FullstackEntityDef) =>
  e.fields.some(f => f.searchable !== false && (f.type === 'STRING' || f.type === 'TEXT'))

/** The entities a search page asks when it names none. */
export const defaultSearchEntities = (entities: FullstackEntityDef[]) =>
  entities.filter(e => e.name.trim() && searchableEntity(e)).slice(0, MAX_SEARCH_ENTITIES).map(e => e.name)

/** Whether an entity may import CSV at all (and so have an import page). */
export const importable = (e: FullstackEntityDef) => !e.readOnly && !e.viewQuery?.trim()

/** Why a new page of one of these types cannot be about `e`, or undefined when it can. */
export function newTypeReason(type: FullstackPageType, e: FullstackEntityDef, pages: FullstackPageDef[]): string | undefined {
  switch (type) {
    case 'calendar':
      return calendarDateFields(e).length === 0 ? 'No filterable date field to place rows by' : undefined
    case 'board':
      return laneFields(e).length === 0 ? 'No filterable enum or boolean field for lanes' : undefined
    case 'import':
      return !importable(e) ? 'Read-only — nothing to import'
        : e.opts?.csvImport === false ? 'Its CSV import option is off'
          : pages.some(p => p.type === 'import' && eq(p.entity, e.name)) ? 'Already has an import page' : undefined
    default:
      return undefined
  }
}

/** Why a new search page cannot be added, or undefined when it can. */
export function newSearchReason(entities: FullstackEntityDef[], pages: FullstackPageDef[]): string | undefined {
  if (pages.some(p => p.type === 'search')) return 'The layout already has a search page'
  if (!entities.some(searchableEntity)) return 'No entity has a text field to search'
  return undefined
}

/** A new page of one of these types, filled in so it is valid on sight. */
export function blankNewTypePage(type: 'calendar' | 'board' | 'content' | 'import' | 'search', entity: FullstackEntityDef | undefined,
  entities: FullstackEntityDef[], id: (base: string) => string): FullstackPageDef {
  const name = entity?.name ?? ''
  switch (type) {
    case 'calendar':
      return { id: id(`${name || 'calendar'}-calendar`), type, entity: name, title: `${name} calendar`, dateField: defaultCalendarDate(entity), modes: ['month'] }
    case 'board':
      return { id: id(`${name || 'board'}-board`), type, entity: name, title: `${name} board`, laneField: defaultLaneField(entity) }
    case 'import':
      return { id: id(`import-${name || 'rows'}`), type, entity: name, title: `Import ${name}`, group: undefined }
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
  if (!date) add('dateField', `${e.name} has no filterable date field to place rows by`)
  else if (!dates.some(f => eq(f.name, date))) add('dateField', `“${date}” is not a filterable date field of ${e.name}`, `${where} places rows by “${date}”, which is not a filterable date of ${e.name}`)
  if (page.endField) {
    if (!dates.some(f => eq(f.name, page.endField))) add('endField', `“${page.endField}” is not a filterable date field of ${e.name}`)
    else if (eq(page.endField, date)) add('endField', 'must differ from the start date')
  }
  const modes = page.modes ?? ['month']
  if (modes.length === 0) add('modes', 'needs at least one view')
  if (new Set(modes).size !== modes.length) add('modes', 'lists a view twice')
  if (modes.some(m => !CALENDAR_MODES.some(c => c.value === m))) add('modes', 'has an unknown view')
  if (modes.includes('timeline') && !page.endField) add('modes', 'the timeline needs an end date', `${where} has a timeline but no end date for its bars`)
  for (const key of Object.keys(page.presetFilter ?? {})) {
    if (eq(key, date) || eq(key, page.endField)) add(`presetFilter.${key}`, 'the calendar’s own range sets it')
  }
}

/** A board page's rules (FullstackPageValidator.board). */
export function checkBoard(page: FullstackPageDef, e: FullstackEntityDef, add: Add, where: string): void {
  const lane = page.laneField ?? defaultLaneField(e)
  if (!lane) {
    add('laneField', `${e.name} has no filterable enum or boolean field to split into lanes`)
    return
  }
  if (!laneFields(e).some(f => eq(f.name, lane))) {
    add('laneField', `“${lane}” is not a filterable enum or boolean field of ${e.name}`, `${where} splits by “${lane}”, which ${e.name} cannot filter by`)
    return
  }
  const values = laneValues(e, lane)
  if (page.lanes) {
    if (page.lanes.length === 0) add('lanes', 'needs at least one lane')
    const unknown = page.lanes.filter(v => !values.some(x => eq(x, v)))
    if (unknown.length) add('lanes', `${unknown.map(v => `“${v}”`).join(', ')} ${unknown.length === 1 ? 'is' : 'are'} not a value of ${lane}`)
    if (new Set(page.lanes).size !== page.lanes.length) add('lanes', 'lists a lane twice')
  }
  const lanes = page.lanes ?? values
  for (const [key, limit] of Object.entries(page.wipLimits ?? {})) {
    if (!lanes.some(v => eq(v, key))) add('wipLimits', `“${key}” is not one of its lanes`)
    else if (!Number.isInteger(limit) || limit < 1 || limit > MAX_WIP_LIMIT) add('wipLimits', `a lane holds 1 to ${MAX_WIP_LIMIT} cards`)
  }
  if (page.cardFields) {
    const options = cardFieldOptions(e)
    if (page.cardFields.length === 0 || page.cardFields.length > MAX_CARD_FIELDS) add('cardFields', `shows 1 to ${MAX_CARD_FIELDS} fields`)
    const unknown = page.cardFields.filter(n => !options.some(o => eq(o, n)))
    if (unknown.length) add('cardFields', `${e.name} has no field or relation ${unknown.map(n => `“${n}”`).join(', ')}`)
    if (new Set(page.cardFields).size !== page.cardFields.length) add('cardFields', 'lists a field twice')
  }
  if (page.laneSize != null && !LANE_SIZES.includes(page.laneSize)) add('laneSize', `loads ${LANE_SIZES.join(', ')} cards at a time`)
  if (Object.keys(page.presetFilter ?? {}).some(k => eq(k, lane))) add(`presetFilter.${lane}`, 'the lanes already split by it')
}

/** A content page's rules (FullstackPageValidator.body): a title, a body, and links that can open. */
export function checkContent(page: FullstackPageDef, pages: FullstackPageDef[], add: Add, where: string): void {
  if (!page.title?.trim()) add('title', 'needs a title', `${where} needs a title — a content page has no entity to name it`)
  const body = page.body?.trim() ?? ''
  if (!body) add('body', 'needs some text')
  else if (body.length > MAX_BODY) add('body', `is longer than ${MAX_BODY} characters`)
  for (const link of contentLinks(body)) {
    if (link.kind === 'link' && !isExternalLink(link.target ?? '')) {
      add('body', `link “${link.target}” must be an http(s) or mailto address, or a page (#/page-id)`)
      continue
    }
    if (link.kind !== 'page-link') continue
    const target = pages.find(p => p.id === link.target)
    if (!target) add('body', `links to no page “${link.target}”`, `${where} links to the missing page “${link.target}”`)
    else if (target.type === 'record') add('body', `cannot link to the record page “${link.target}” — it opens from a row`)
    else if (target.hidden && target.type !== 'wizard' && target.type !== 'search') add('body', `“${link.target}” is hidden, so a link cannot open it`)
  }
}

/** An import page's rules (the entity must be writable, one import page per entity). */
export function checkImport(page: FullstackPageDef, e: FullstackEntityDef, pages: FullstackPageDef[], add: Add, where: string): void {
  if (!importable(e)) add('entity', `${e.name} is read-only, so there is nothing to import`)
  if (e.opts?.csvImport === false) add('entity', `${e.name}’s CSV import option is off`, `${where} imports ${e.name}, whose CSV import option is off`)
  const first = pages.find(p => p.type === 'import' && eq(p.entity, e.name))
  if (first && first !== page) add('entity', `${e.name} already has the import page “${first.id}”`, `${where} is a second import page for ${e.name}`)
}

/** A search page's rules (FullstackPageValidator.search). */
export function checkSearch(page: FullstackPageDef, entities: FullstackEntityDef[], pages: FullstackPageDef[], add: Add, where: string): void {
  const first = pages.find(p => p.type === 'search')
  if (first && first !== page) add('type', `the layout already has the search page “${first.id}”`, `${where} is a second search page`)
  if (page.entities) {
    if (page.entities.length === 0 || page.entities.length > MAX_SEARCH_ENTITIES) add('entities', `searches 1 to ${MAX_SEARCH_ENTITIES} entities`)
    for (const name of page.entities) {
      const e = entities.find(x => eq(x.name, name))
      if (!e) add('entities', `“${name}” is no longer an entity`)
      else if (!searchableEntity(e)) add('entities', `${e.name} has no searchable text field`)
    }
  } else if (defaultSearchEntities(entities).length === 0) {
    add('entities', 'no entity has a searchable text field')
  }
  if (page.perEntity != null && (!Number.isInteger(page.perEntity) || page.perEntity < MIN_PER_ENTITY || page.perEntity > MAX_PER_ENTITY)) {
    add('perEntity', `shows ${MIN_PER_ENTITY} to ${MAX_PER_ENTITY} matches per entity`)
  }
  if (page.hidden && !page.shellSearch) add('shellSearch', 'a hidden search page needs the header’s search box — nothing else opens it')
}

/** One line describing one of these pages. */
export function describeNewTypePage(page: FullstackPageDef, entities: FullstackEntityDef[]): string {
  const e = entities.find(x => eq(x.name, page.entity))
  switch (page.type) {
    case 'calendar': {
      const modes = (page.modes ?? ['month']).join(', ')
      return `${page.entity ?? '?'} by ${page.dateField ?? defaultCalendarDate(e) ?? '?'}${page.endField ? `–${page.endField}` : ''} · ${modes}`
    }
    case 'board': {
      const lane = page.laneField ?? defaultLaneField(e) ?? '?'
      const limits = Object.keys(page.wipLimits ?? {}).length
      return `${page.entity ?? '?'} in lanes of ${lane}${limits ? ` · ${limits} lane limit${limits === 1 ? '' : 's'}` : ''}`
    }
    case 'content': {
      const words = (page.body ?? '').trim().split(/\s+/).filter(Boolean).length
      return `Text · ${words} word${words === 1 ? '' : 's'}`
    }
    case 'import':
      return `CSV import of ${page.entity ?? '?'}`
    case 'search': {
      const names = page.entities ?? defaultSearchEntities(entities)
      return `Searches ${names.join(', ') || 'nothing'}${page.shellSearch ? ' · header box' : ''}`
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
    if (page.cardFields?.includes(from)) out.cardFields = page.cardFields.map(n => (n === from ? to : n))
  }
  return out
}

/** Follows a relation rename into a board's cards. */
export function renameRelationInNewPages(page: FullstackPageDef, child: string, from: string, to: string): FullstackPageDef {
  if (page.type !== 'board' || !eq(page.entity, child) || !page.cardFields?.includes(from)) return page
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
