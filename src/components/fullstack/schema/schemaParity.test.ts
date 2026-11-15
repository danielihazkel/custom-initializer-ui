import { describe, expect, it } from 'vitest'
import { FULLSTACK_ENTITY_OPT_KEYS } from '../../../types'
import { CHART_KINDS, DATE_RANGES, LIST_ACTIONS, LIST_VIEWS, NAV_ICONS, PAGE_ROLES, REFRESH_CHOICES } from '../pageLayout'
import { CALENDAR_MODES, INBOX_QUEUES } from '../newPageTypes'
import { parseQuickAdd } from '../quickAdd'
import { RTL_OPTION, SCAFFOLD_OPTIONS } from '../scaffoldOptions'
import { validateEntities } from '../validation'
import { WORKFLOW_ROLES } from '../workflow'
import {
  BACKEND_TYPE_ALIASES, CHOICES, NAME_RULES, PER_ENTITY_OPTION_KEYS, SCAFFOLD_OPTION_KEYS, SCHEMA,
  isReservedEntityName, ownerOfGeneratedClass,
} from './index'

/**
 * The editor's closed lists are TypeScript unions with labels and icons attached, so they cannot
 * be read from the schema document — but they must say what it says. An option, page type or
 * icon the backend adds and the editor forgets fails here, as does the reverse.
 */
const sorted = (values: readonly (string | number)[]) => [...values].map(String).sort()

describe('the editor\'s lists match the backend schema', () => {
  it('scaffold options: every backend option is offered, and nothing else', () => {
    const offered = SCAFFOLD_OPTIONS.map(o => o.value)
    expect(offered).toContain(RTL_OPTION.value)
    expect(sorted(offered)).toEqual(sorted(SCAFFOLD_OPTION_KEYS))
  })

  it('per-entity option keys', () => {
    expect(sorted(FULLSTACK_ENTITY_OPT_KEYS)).toEqual(sorted(PER_ENTITY_OPTION_KEYS))
    expect(sorted(SCAFFOLD_OPTIONS.filter(o => o.perEntity).map(o => o.value))).toEqual(sorted(PER_ENTITY_OPTION_KEYS))
  })

  it('roles', () => {
    expect([...WORKFLOW_ROLES]).toEqual(SCHEMA.roles)
    expect(PAGE_ROLES).toEqual(SCHEMA.roles)
  })

  it('list views, actions, calendar modes, inbox queues', () => {
    expect(LIST_VIEWS.map(v => v.value)).toEqual(SCHEMA.listViews)
    expect(LIST_ACTIONS.map(a => a.value)).toEqual(SCHEMA.listActions)
    expect(sorted(CALENDAR_MODES.map(m => m.value))).toEqual(sorted(SCHEMA.calendarModes))
    expect(sorted(INBOX_QUEUES.map(q => q.value))).toEqual(sorted(SCHEMA.inboxQueues))
  })

  it('nav icons', () => {
    expect(sorted(Object.keys(NAV_ICONS))).toEqual(sorted(SCHEMA.navIcons))
  })

  it('dashboard periods and refresh intervals', () => {
    expect(sorted(DATE_RANGES.map(r => r.value))).toEqual(sorted(SCHEMA.dateRanges))
    expect(REFRESH_CHOICES.map(c => c.value)).toEqual(CHOICES.refreshSeconds)
  })

  it('chart kinds and what each can draw', () => {
    expect(CHART_KINDS.map(k => k.value)).toEqual(SCHEMA.chartKinds.map(k => k.kind))
    for (const kind of CHART_KINDS) {
      const backend = SCHEMA.chartKinds.find(k => k.kind === kind.value)!
      // overTime: true = dates only, false = groups only, null = either.
      expect({ kind: kind.value, overGroups: kind.overTime !== true, overTime: kind.overTime !== false })
        .toEqual(backend)
    }
  })

  it('quick-add takes every type name and alias the backend parses', () => {
    // Only an enum takes values; naming them on another type would make it one.
    const typeOf = (word: string) =>
      parseQuickAdd(word.toUpperCase() === 'ENUM' ? `f ${word} values=A|B` : `f ${word}`).fields[0]?.type
    for (const type of SCHEMA.fieldTypes) expect(typeOf(type.type), type.type).toBe(type.type)
    for (const [alias, type] of Object.entries(BACKEND_TYPE_ALIASES)) expect(typeOf(alias), alias).toBe(type)
  })
})

describe('name rules read from the schema', () => {
  it('compiles the backend patterns as whole-string matches', () => {
    expect(NAME_RULES.identifier.test('unit_price$')).toBe(true)
    expect(NAME_RULES.identifier.test('לקוח')).toBe(false)
    expect(NAME_RULES.identifier.test('2fast')).toBe(false)
    expect(NAME_RULES.sqlName.test('ORDER_DT')).toBe(true)
    expect(NAME_RULES.sqlName.test('"Order Date"')).toBe(true)
    expect(NAME_RULES.sqlName.test('x; drop table')).toBe(false)
    expect(NAME_RULES.sqlName.test('pre ORDER_DT')).toBe(false)
    expect(NAME_RULES.pageId.test('open-tickets')).toBe(true)
    expect(NAME_RULES.pageId.test('Open')).toBe(false)
    expect(NAME_RULES.transitionName.test('sendBack')).toBe(true)
    expect(NAME_RULES.transitionName.test('SendBack')).toBe(false)
  })

  it('knows the names the generated code already uses', () => {
    for (const name of ['Page', 'page', 'Table', 'Dashboard', 'State', 'String', ' Me ']) {
      expect(isReservedEntityName(name), name).toBe(true)
    }
    for (const name of ['Order', 'Customer', 'Tag', 'User', 'Test']) {
      expect(isReservedEntityName(name), name).toBe(false)
    }
  })

  it('knows a name another entity\'s generated class takes', () => {
    expect(ownerOfGeneratedClass('OrderDto', ['Order', 'Customer'])).toBe('Order')
    expect(ownerOfGeneratedClass('orderservice', ['Order'])).toBe('Order')
    expect(ownerOfGeneratedClass('OrderLine', ['Order'])).toBeUndefined()
    expect(ownerOfGeneratedClass('Dto', ['Order'])).toBeUndefined()
  })

  it('validateEntities flags both on the entity name', () => {
    const pk = { name: 'id', type: 'LONG' as const, primaryKey: true, generated: true }
    const errors = validateEntities([
      { name: 'Page', fields: [pk] },
      { name: 'Order', fields: [pk] },
      { name: 'OrderDto', fields: [pk] },
    ])
    expect(errors.entities[0].name).toMatch(/already uses/)
    expect(errors.entities[1]).toBeUndefined()
    expect(errors.entities[2].name).toMatch(/'Order' already generates a class called OrderDto/)
  })
})

describe('field types', () => {
  it('the picker lists exactly the backend\'s types', async () => {
    const { FIELD_TYPES } = await import('../fieldTypes')
    expect(sorted(FIELD_TYPES)).toEqual(sorted(SCHEMA.fieldTypes.map(t => t.type)))
  })
})
