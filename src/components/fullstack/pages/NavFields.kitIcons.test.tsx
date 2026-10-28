import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { FullstackEntityDef, FullstackPageDef } from '../../../types'
import { validatePages } from '../pageLayout'
import { NavFields } from './NavFields'
import { KitNavIcons } from './kitNavIcons'

afterEach(cleanup)

const note: FullstackEntityDef = {
  name: 'Note', tableName: '', fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }],
} as FullstackEntityDef
const page = (icon?: string): FullstackPageDef => ({ id: 'notes', type: 'entity-list', entity: 'Note', icon })

describe('Nav icons a design kit adds', () => {
  it('offers them after the lucide icons, and picks one', () => {
    const update = vi.fn()
    render(
      <KitNavIcons.Provider value={['ShieldIcon']}>
        <NavFields page={page()} index={0} pages={[page()]} errors={{}} update={update} />
      </KitNavIcons.Provider>,
    )
    const shield = screen.getByRole('radio', { name: 'Shield (from the design kit)' })
    expect(shield.getAttribute('data-kit-icon')).not.toBeNull()
    fireEvent.click(shield)
    expect(update).toHaveBeenCalledWith(0, { icon: 'ShieldIcon' })
  })

  it('accepts a kit icon only while the kit adds it', () => {
    const pages = [page('shieldicon')]
    expect(validatePages(pages, [note], { kitIcons: ['ShieldIcon'] }).byPage[0]?.icon).toBeUndefined()
    expect(validatePages(pages, [note], { kitIcons: ['CoinIcon'] }).byPage[0]?.icon).toContain('nor one the design kit adds')
    expect(validatePages(pages, [note]).byPage[0]?.icon).toBe('“shieldicon” is not a nav icon')
  })
})
