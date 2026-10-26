import { describe, it, expect } from 'vitest'
import type { FullstackPageDef, PreviewFile } from '../../types'
import { pageCodeFiles, screenPath } from './pageCode'

const f = (path: string): PreviewFile => ({ path, content: `// ${path}` })

const files: PreviewFile[] = [
  f('backend/src/main/java/com/acme/order/OrderController.java'),
  f('frontend/src/app/App.tsx'),
  f('frontend/src/app/route.ts'),
  f('frontend/src/app/screens/NewOrderScreen.tsx'),
  f('frontend/src/app/screens/OrdersScreen.tsx'),
  f('frontend/src/app/screens/QueueScreen.tsx'),
  f('frontend/src/app/screens/CustomerOrdersScreen.tsx'),
  f('frontend/src/pages/order/ui/OrderPage.tsx'),
  f('frontend/src/pages/order-line/ui/OrderLinePage.tsx'),
  f('frontend/src/pages/customer/ui/CustomerPage.tsx'),
]

const pages: FullstackPageDef[] = [
  { id: 'orders', type: 'entity-list', entity: 'Order' },
  { id: 'new-order', type: 'wizard', entity: 'Order' },
  { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'orders' }, { page: 'new-order' }] },
  { id: 'customer-orders', type: 'master-detail', parent: 'Customer', child: 'Order' },
]

const listed = (page: FullstackPageDef) => pageCodeFiles(page, pages, files).map(c => [c.name, c.role])

describe('pageCodeFiles', () => {
  it('names a screen the way the generator does', () => {
    expect(screenPath({ id: 'new-order' })).toBe('frontend/src/app/screens/NewOrderScreen.tsx')
    expect(screenPath({ id: 'orders_2' })).toBe('frontend/src/app/screens/Orders2Screen.tsx')
  })

  it('lists the screen first, then the entity page it draws, then the shell', () => {
    expect(listed(pages[0])).toEqual([
      ['OrdersScreen.tsx', 'screen'],
      ['OrderPage.tsx', 'entity'],
      ['App.tsx', 'shell'],
      ['route.ts', 'shell'],
    ])
  })

  it('adds the screens a tabs page embeds, and both entities of a master-detail page', () => {
    expect(listed(pages[2]).slice(0, 3)).toEqual([['QueueScreen.tsx', 'screen'], ['OrdersScreen.tsx', 'tab'], ['NewOrderScreen.tsx', 'tab']])
    expect(listed(pages[3]).slice(0, 3)).toEqual([['CustomerOrdersScreen.tsx', 'screen'], ['CustomerPage.tsx', 'entity'], ['OrderPage.tsx', 'entity']])
  })

  it('gives nothing when the preview has no screen for the page', () => {
    expect(pageCodeFiles({ id: 'reports', type: 'report', entity: 'Order' }, pages, files)).toEqual([])
    expect(pageCodeFiles({ id: ' ', type: 'entity-list', entity: 'Order' }, pages, files)).toEqual([])
    expect(pageCodeFiles(pages[0], pages, undefined)).toEqual([])
  })
})
