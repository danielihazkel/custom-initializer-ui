import type { FullstackPageDef } from '../../types'
import { pageOfServerError } from './pageLayout'

/**
 * A 400 from `/starter-fullstack.zip` or `.preview`: the server's sentence, and — since the
 * validators report it — where in the request it is (`entities[1].fields[3].defaultValue`,
 * `pages[2].widgets[0]`, `bootVersion`). The path is in the request's own JSON names.
 */
export interface ServerIssue {
  message: string
  path?: string
}

/** What a server issue is about, in the editor's terms. */
export type ServerTarget =
  /** An entity card, and within it a field row, a relation row or one of its panels. */
  | { kind: 'entity'; entity: number; field?: number; relation?: number; panel?: 'workflow' | 'formSections'; property?: string }
  /** A page of the layout, and within it one widget / tab / step / chart / related list / header number. */
  | { kind: 'page'; page: number; part?: { list: PagePartList; index: number } }
  /** A project setting: `bootVersion`, `locale`, `frontendTemplateSet`, `domainPackage`, `nav`, `opts.scaffold`. */
  | { kind: 'setting'; setting: string }

export type PagePartList = 'widgets' | 'tabs' | 'steps' | 'charts' | 'childTabs' | 'headerStats'

const PAGE_PART_LISTS: readonly PagePartList[] = ['widgets', 'tabs', 'steps', 'charts', 'childTabs', 'headerStats']

interface Segment { name: string; index?: number }

/** `entities[1].fields[3].type` → [{entities,1},{fields,3},{type}]; null when it is not a path. */
function segments(path: string): Segment[] | null {
  const out: Segment[] = []
  for (const part of path.split('.')) {
    const m = /^([A-Za-z_$][A-Za-z0-9_$]*)((?:\[\d+\])*)$/.exec(part)
    if (!m) return null
    const indexes = [...m[2].matchAll(/\[(\d+)\]/g)].map(i => Number(i[1]))
    out.push({ name: m[1], index: indexes[0] })
    // A second index on one name (never sent today) would be a nested list; keep it as its own step.
    for (const extra of indexes.slice(1)) out.push({ name: '', index: extra })
  }
  return out
}

/**
 * Reads a server path. Unknown shapes return null rather than a guess, so a path this editor
 * does not understand yet (a newer backend) degrades to the plain message.
 */
export function parseServerPath(path: string | undefined | null): ServerTarget | null {
  if (!path?.trim()) return null
  const segs = segments(path.trim())
  if (!segs || segs.length === 0) return null
  const [head, ...rest] = segs

  if (head.name === 'entities' && head.index != null) {
    const target: Extract<ServerTarget, { kind: 'entity' }> = { kind: 'entity', entity: head.index }
    const [second, third] = rest
    if (!second) return target
    if (second.name === 'fields' && second.index != null) {
      target.field = second.index
      if (third) target.property = third.name
    } else if (second.name === 'relations' && second.index != null) {
      target.relation = second.index
      if (third) target.property = third.name
    } else if (second.name === 'workflow' || second.name === 'formSections') {
      target.panel = second.name
    } else {
      target.property = second.name
    }
    return target
  }

  if (head.name === 'pages' && head.index != null) {
    const target: Extract<ServerTarget, { kind: 'page' }> = { kind: 'page', page: head.index }
    const second = rest[0]
    if (second && second.index != null && (PAGE_PART_LISTS as readonly string[]).includes(second.name)) {
      target.part = { list: second.name as PagePartList, index: second.index }
    }
    return target
  }

  // opts.scaffold[1] → the scaffold options; anything else top-level is the setting of that name.
  if (head.name === 'opts' && rest[0]?.name === 'scaffold') return { kind: 'setting', setting: 'opts.scaffold' }
  if (head.index == null) return { kind: 'setting', setting: head.name }
  return null
}

/**
 * Where a server issue points: its path when it has one this editor can read; otherwise the page
 * its message names (`Page 'orders' …`, `pages[2]` — all an older backend says). Null: nowhere in
 * particular, so it is shown as it always was, as a toast.
 */
export function locateServerIssue(issue: ServerIssue | null, pages: FullstackPageDef[]): ServerTarget | null {
  if (!issue) return null
  const byPath = parseServerPath(issue.path)
  if (byPath) return byPath
  const page = pageOfServerError(issue.message, pages)
  return page == null ? null : { kind: 'page', page }
}

/** A short "where" for the toast: the thing the message is now shown on. */
export function describeServerTarget(target: ServerTarget): string {
  switch (target.kind) {
    case 'entity':
      if (target.field != null) return 'a field; it is marked in the entity list'
      if (target.relation != null) return 'a relation; it is marked in the entity list'
      if (target.panel === 'workflow') return 'a workflow; its entity is marked'
      return 'an entity; it is marked in the entity list'
    case 'page':
      return 'a page; it is highlighted in the page layout'
    case 'setting':
      return 'a project setting'
  }
}
