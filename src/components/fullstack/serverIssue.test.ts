import { describe, expect, it } from 'vitest'
import type { FullstackPageDef } from '../../types'
import { locateServerIssue, parseServerPath } from './serverIssue'

describe('parseServerPath', () => {
  it('reads an entity, its field or relation, and the property', () => {
    expect(parseServerPath('entities[2]')).toEqual({ kind: 'entity', entity: 2 })
    expect(parseServerPath('entities[2].name')).toEqual({ kind: 'entity', entity: 2, property: 'name' })
    expect(parseServerPath('entities[1].fields[3]')).toEqual({ kind: 'entity', entity: 1, field: 3 })
    expect(parseServerPath('entities[1].fields[3].defaultValue'))
      .toEqual({ kind: 'entity', entity: 1, field: 3, property: 'defaultValue' })
    expect(parseServerPath('entities[0].relations[1].fieldName'))
      .toEqual({ kind: 'entity', entity: 0, relation: 1, property: 'fieldName' })
  })

  it('reads an entity panel', () => {
    expect(parseServerPath('entities[1].workflow.transitions[1]')).toEqual({ kind: 'entity', entity: 1, panel: 'workflow' })
    expect(parseServerPath('entities[1].workflow')).toEqual({ kind: 'entity', entity: 1, panel: 'workflow' })
    expect(parseServerPath('entities[0].formSections[2]')).toEqual({ kind: 'entity', entity: 0, panel: 'formSections' })
  })

  it('reads a page and the part of it', () => {
    expect(parseServerPath('pages[4]')).toEqual({ kind: 'page', page: 4 })
    expect(parseServerPath('pages[1].widgets[2]')).toEqual({ kind: 'page', page: 1, part: { list: 'widgets', index: 2 } })
    expect(parseServerPath('pages[0].childTabs[1]')).toEqual({ kind: 'page', page: 0, part: { list: 'childTabs', index: 1 } })
    // A property this editor has no part for still lands on the page.
    expect(parseServerPath('pages[3].roles')).toEqual({ kind: 'page', page: 3 })
  })

  it('reads project settings', () => {
    expect(parseServerPath('bootVersion')).toEqual({ kind: 'setting', setting: 'bootVersion' })
    expect(parseServerPath('opts.scaffold[1]')).toEqual({ kind: 'setting', setting: 'opts.scaffold' })
    expect(parseServerPath('nav')).toEqual({ kind: 'setting', setting: 'nav' })
  })

  it('returns null for nothing, and for what it cannot read', () => {
    expect(parseServerPath(undefined)).toBeNull()
    expect(parseServerPath('  ')).toBeNull()
    expect(parseServerPath('entities[x]')).toBeNull()
    expect(parseServerPath('not a path')).toBeNull()
  })
})

describe('locateServerIssue', () => {
  const pages = [
    { id: 'home', type: 'dashboard' }, { id: 'orders', type: 'entity-list', entity: 'Order' },
  ] as FullstackPageDef[]

  it('prefers the path', () => {
    expect(locateServerIssue({ message: "Page 'home' is wrong", path: 'entities[0].fields[1]' }, pages))
      .toEqual({ kind: 'entity', entity: 0, field: 1 })
  })

  it('falls back to the page a message names, as an older backend only says', () => {
    expect(locateServerIssue({ message: "Page 'orders': unknown entity" }, pages)).toEqual({ kind: 'page', page: 1 })
    expect(locateServerIssue({ message: 'pages[0] has no id' }, pages)).toEqual({ kind: 'page', page: 0 })
  })

  it('is null when the issue is about nothing in particular', () => {
    expect(locateServerIssue({ message: 'At least one entity is required' }, pages)).toBeNull()
    expect(locateServerIssue(null, pages)).toBeNull()
  })
})
