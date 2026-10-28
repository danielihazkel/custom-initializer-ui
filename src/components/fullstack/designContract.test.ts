import { describe, it, expect } from 'vitest'
import contract from './__fixtures__/design-contract.json'
import { NAV_ICONS, PAGE_TYPE_META } from './pageLayout'
import { WIDGET_KINDS } from './pages/constants'

/**
 * The editor's hand lists against the generator's design contract (GET /metadata/design/contract).
 * The fixture is written by the backend's DesignContractSnapshotTest
 * (-Ddesign.contract.update=true), so a nav icon, widget kind or page type added on one side
 * without the other fails here.
 */
describe('design contract', () => {
  it('offers exactly the nav icons the generator accepts', () => {
    expect(Object.keys(NAV_ICONS).sort()).toEqual([...contract.navIcons].sort())
  })

  it('offers exactly the widget kinds the generator renders', () => {
    expect(WIDGET_KINDS.map(w => w.kind).sort()).toEqual([...contract.widgetKinds].sort())
  })

  it('knows every page type the generator renders', () => {
    expect(Object.keys(PAGE_TYPE_META).sort()).toEqual([...contract.pageTypes].sort())
  })
})
