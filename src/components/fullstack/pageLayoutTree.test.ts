import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { blankPage, describePage, newPageChoices, selfLinks, treeReason, validatePages } from './pageLayout'

const category = (...links: string[]): FullstackEntityDef => ({
  name: 'Category',
  fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }],
  relations: links.map(fieldName => ({ fieldName, targetEntity: 'Category', type: 'MANY_TO_ONE' as const })),
})
const product: FullstackEntityDef = {
  name: 'Product',
  fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }],
  relations: [{ fieldName: 'category', targetEntity: 'Category', type: 'MANY_TO_ONE' }],
}
const tree = (extra: Partial<FullstackPageDef> = {}): FullstackPageDef[] => [
  { id: 'categories', type: 'entity-list', entity: 'Category' },
  { id: 'outline', type: 'tree', entity: 'Category', ...extra },
]

describe('the tree page', () => {
  it('is about an entity that points at itself', () => {
    expect(selfLinks(category('parent')).map(r => r.fieldName)).toEqual(['parent'])
    expect(selfLinks(product)).toEqual([])
    expect(treeReason(category('parent'))).toBeUndefined()
    expect(treeReason(product)).toBe('No relation to itself (a parent)')
    expect(newPageChoices('tree', [category('parent'), product], [])).toEqual([
      { value: 'Category', label: 'Category' },
      { value: 'Product', label: 'Product', reason: 'No relation to itself (a parent)' },
    ])
    // A new one starts on the first entity that fits, valid on sight.
    const fresh = blankPage('tree', [product, category('parent')], [])
    expect(fresh).toEqual({ id: 'category-tree', type: 'tree', entity: 'Category', title: 'Category tree' })
    expect(validatePages([{ id: 'categories', type: 'entity-list', entity: 'Category' }, fresh], [product, category('parent')]).problems).toEqual([])
  })

  it('mirrors the validator: one link, or the one the page names', () => {
    expect(validatePages(tree(), [category('parent')]).problems).toEqual([])
    expect(validatePages(tree(), [category()]).problems)
      .toEqual(['Page “outline” draws a tree of Category, which has no relation to itself (a parent)'])
    const two = [category('parent', 'replacedBy')]
    const ambiguous = validatePages(tree(), two)
    expect(ambiguous.problems).toEqual(['Page “outline” draws a tree of Category, which points at itself through parent and replacedBy'])
    // The fix names the first; so does choosing one by hand.
    expect(ambiguous.issues[0].fix?.apply(tree())[1].via).toBe('parent')
    expect(validatePages(tree({ via: 'replacedBy' }), two).problems).toEqual([])
    expect(validatePages(tree({ via: 'name' }), two).problems)
      .toEqual(['Page “outline” draws its tree by “name”, which is not a relation of Category to itself'])
  })

  it('says what it shows in one line', () => {
    expect(describePage(tree()[1], tree())).toBe('Category as a tree')
    expect(describePage(tree({ via: 'parent' })[1], tree())).toBe('Category as a tree by parent')
  })
})
