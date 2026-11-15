import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef } from '../../types'
import { cleanNav, hasNavSettings, navToolDisabledReason, requestNav } from './navTools'

const plain: FullstackEntityDef = { name: 'Order', fields: [{ name: 'id', type: 'LONG', primaryKey: true }] }
const tasks: FullstackEntityDef = {
  name: 'Claim',
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true },
    { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'DONE'] },
    { name: 'owner', type: 'STRING' },
  ],
  workflow: { statusField: 'status', assigneeField: 'owner', transitions: [{ name: 'finish', from: ['OPEN'], to: 'DONE' }] },
}
const unassigned: FullstackEntityDef = { ...tasks, name: 'Review', workflow: { ...tasks.workflow!, assigneeField: undefined } }

describe('the header’s tools', () => {
  it('leaves defaults and switched-off flags out, and nothing at all when nothing is left', () => {
    expect(cleanNav(undefined)).toBeUndefined()
    expect(cleanNav({ style: 'sidebar', collapsibleGroups: false, userMenu: false })).toBeUndefined()
    expect(cleanNav({ style: 'topbar', commandPalette: true, notifications: false })).toEqual({ style: 'topbar', commandPalette: true })
    expect(cleanNav({ collapsibleGroups: true, userMenu: true, notifications: true }))
      .toEqual({ collapsibleGroups: true, userMenu: true, notifications: true })
  })

  it('counts any setting as a nav to carry', () => {
    expect(hasNavSettings(undefined)).toBe(false)
    expect(hasNavSettings({})).toBe(false)
    expect(hasNavSettings({ commandPalette: true })).toBe(true)
    expect(hasNavSettings({ style: 'topbar' })).toBe(true)
  })

  it('offers the bell only where a workflow assigns its tasks', () => {
    expect(navToolDisabledReason('notifications', [plain])).toMatch(/workflow has an assignee/)
    expect(navToolDisabledReason('notifications', [plain, unassigned])).toMatch(/workflow has an assignee/)
    expect(navToolDisabledReason('notifications', [plain, tasks])).toBeUndefined()
    expect(navToolDisabledReason('userMenu', [plain])).toBeUndefined()
    expect(navToolDisabledReason('commandPalette', [plain])).toBeUndefined()
  })

  it('sends a bell only while there is something for it to count', () => {
    const nav = { style: 'topbar' as const, notifications: true, userMenu: true }
    expect(requestNav(nav, [tasks])).toBe(nav)
    // The workflow went since: the rest of the nav is still sent, the bell is not.
    expect(requestNav(nav, [plain])).toEqual({ style: 'topbar', userMenu: true })
    expect(requestNav({ notifications: true }, [plain])).toBeUndefined()
    expect(requestNav(undefined, [tasks])).toBeUndefined()
    expect(requestNav({}, [tasks])).toBeUndefined()
  })
})
