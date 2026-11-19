import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { FullstackEntityDef, FullstackRelationDef } from '../../types'
import { linkIndexKey, parseLinkIndex, renameLinkInChildLists, secondSideProblem, setKey, setsBetween } from './childLists'
import { checkExpr, exprProblem, listsOfExpr } from './expr'
import { renameLinkInRules, renameLinkedFieldInRules, ruleProblems } from './rules'
import { validateEntities } from './validation'
import { defaultWizardSteps, stepFields, validatePages } from './pageLayout'
import { RelationsEditor } from './RelationsEditor'

/**
 * Round 14, phase 4 in the editor: a many-to-many declared from both sides, a wizard step that
 * asks for a set, the rows a record's rules read (sum, count, min, max, avg) and the version
 * check a parent of rows carries — each a mirror of the server's rule.
 */

const id = { name: 'id', type: 'LONG' as const, primaryKey: true, generated: true }

const tag = (relations: FullstackRelationDef[] = []): FullstackEntityDef =>
  ({ name: 'Tag', fields: [id, { name: 'name', type: 'STRING' }], relations })
const post = (over: Partial<FullstackEntityDef> = {}): FullstackEntityDef => ({
  name: 'Post', fields: [id, { name: 'title', type: 'STRING', required: true }],
  relations: [{ type: 'MANY_TO_MANY', fieldName: 'tags', targetEntity: 'Tag' }],
  ...over,
})
const posts = (over: Partial<FullstackRelationDef> = {}): FullstackRelationDef =>
  ({ type: 'MANY_TO_MANY', fieldName: 'posts', targetEntity: 'Post', mappedBy: 'tags', ...over })

describe('the second side of a many-to-many', () => {
  it('is a set the target holds to this entity — not one that is itself a second side', () => {
    expect(setsBetween(post(), 'tag')).toEqual(['tags'])
    expect(setsBetween(tag([posts()]), 'Post')).toEqual([])
    const index = parseLinkIndex(linkIndexKey([post(), tag([posts()])]))
    expect(index.get(setKey('Post', 'Tag'))).toEqual(['tags'])
    expect(index.get(setKey('Tag', 'Post'))).toBeUndefined()
  })

  it('is refused as the server refuses it', () => {
    const check = (rel: FullstackRelationDef, others: FullstackEntityDef[] = [post()]) => {
      const entity = tag([rel])
      return secondSideProblem(entity, rel, [...others, entity])
    }
    expect(check(posts())).toBeUndefined()
    expect(check(posts({ mappedBy: 'labels' }))).toEqual({ on: 'mappedBy',
      message: "Post has no many-to-many 'labels' to Tag that holds its join table (it has: tags)" })
    expect(check(posts({ joinTable: 'tag_posts' }))).toEqual({ on: 'joinTable',
      message: 'The join table is the one Post.tags names — leave it to that side' })
    // The owner's rows belong to users: their links change hands with them.
    expect(check(posts(), [post({ access: { owners: ['createdBy'] } })])?.message)
      .toBe("Post's rows belong to users, so their links are changed from Post only")
    // One second side per set.
    const first = posts()
    const again = posts({ fieldName: 'others' })
    const twice = tag([first, again])
    expect(secondSideProblem(twice, first, [post(), twice])).toBeUndefined()
    expect(secondSideProblem(twice, again, [post(), twice])?.message).toBe('Another relation of this entity is already the other side of Post.tags')

    const result = validateEntities([post(), tag([posts({ mappedBy: 'labels' })])])
    expect(result.entities[1].relations?.[0].mappedBy).toContain("no many-to-many 'labels'")
    expect(validateEntities([post(), tag([posts()])]).count).toBe(0)
  })

  it('follows the set when it is renamed', () => {
    const next = renameLinkInChildLists([post(), tag([posts()])], 'Post', 'tags', 'labels')
    expect(next[1].relations?.[0].mappedBy).toBe('labels')
  })

  it('is picked in the relation row, which then names no join table', () => {
    const onChange = vi.fn()
    const index = parseLinkIndex(linkIndexKey([post(), tag()]))
    const own: FullstackRelationDef = { uid: 'r1', type: 'MANY_TO_MANY', fieldName: 'posts', targetEntity: 'Post', joinTable: 'tag_posts' }
    const { rerender } = render(<RelationsEditor relations={[own]} entityNames={['Post', 'Tag']} linkIndex={index}
                                                 ownerName="Tag" onChange={onChange} />)
    expect(screen.getByLabelText('Join table')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Other side of'), { target: { value: 'tags' } })
    const saved = onChange.mock.calls[0][0][0] as FullstackRelationDef
    expect(saved.mappedBy).toBe('tags')
    expect(saved.joinTable).toBeUndefined()
    rerender(<RelationsEditor relations={[saved]} entityNames={['Post', 'Tag']} linkIndex={index} ownerName="Tag" onChange={onChange} />)
    expect(screen.queryByLabelText('Join table')).toBeNull()
  })

  it('a wizard step may ask for a set, and the default steps end with them', () => {
    expect(stepFields(post()).map(f => f.name)).toEqual(['title', 'tags'])
    expect(defaultWizardSteps(post())).toEqual([{ fields: ['title', 'tags'] }])
    const pages = [
      { id: 'posts', type: 'entity-list' as const, entity: 'Post' },
      { id: 'new-post', type: 'wizard' as const, entity: 'Post', steps: [{ fields: ['title'] }, { title: 'Tags', fields: ['tags'] }] },
    ]
    expect(validatePages(pages, [post(), tag()]).problems).toEqual([])
  })
})

const line: FullstackEntityDef = {
  name: 'OrderLine',
  fields: [id, { name: 'quantity', type: 'INTEGER' }, { name: 'lineTotal', type: 'BIG_DECIMAL', formula: 'quantity * 2' }, { name: 'note', type: 'STRING' }],
  relations: [{ type: 'MANY_TO_ONE', fieldName: 'order', targetEntity: 'Order', required: true }],
}
const order = (over: Partial<FullstackEntityDef> = {}): FullstackEntityDef => ({
  name: 'Order',
  fields: [id, { name: 'reference', type: 'STRING' }, { name: 'total', type: 'BIG_DECIMAL', formula: 'sum(lines.lineTotal)' }],
  relations: [
    { type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' },
    { type: 'ONE_TO_MANY', fieldName: 'lines', targetEntity: 'OrderLine', composition: true },
  ],
  rules: [{ check: 'count(lines) > 0', message: 'An order needs at least one line' }],
  ...over,
})
const customer: FullstackEntityDef = { name: 'Customer', fields: [id, { name: 'name', type: 'STRING' }] }
const model = (o = order()) => [customer, o, line]

describe('the rows a record’s rules read', () => {
  it('are read through sum, count, min, max and avg', () => {
    const o = order()
    expect(checkExpr('sum(lines.lineTotal) + avg(lines.quantity) >= min(lines.quantity) * count(lines)', o, 'BOOL', model())).toEqual([])
    expect(listsOfExpr('max(lines.quantity) < 10 and count(lines) > 0', o, model())).toEqual(['lines'])
    expect(exprProblem('sum(lines.lineTotal)', o, 'NUMBER', model())).toBeUndefined()
    expect(validateEntities(model()).count).toBe(0)
  })

  it('and only through them, as the server says it', () => {
    const o = order()
    const problem = (text: string) => exprProblem(text, o, 'BOOL', model())
    expect(problem('lines.lineTotal > 0')).toContain("'lines.lineTotal' is one value in each of the rows: read them with sum, min, max or avg (sum(lines.lineTotal))")
    expect(problem('lines == 0')).toContain("'lines' is the rows saved with this entity: count(lines), or sum, min, max or avg over one of their fields")
    expect(problem('count(customer) > 0')).toContain('count takes the rows saved with this entity — here: lines')
    expect(problem('sum(total) > 0')).toContain('sum takes a field of the rows saved with this entity, like sum(lines.total) — here: lines')
    expect(problem('avg(lines.linetotal) > 0')).toContain("'linetotal' is not a field of OrderLine (did you mean 'lineTotal'?)")
    expect(problem('sum(lines.note) > 0')).toContain("sum takes a number field of the rows; 'lines.note' is a text")
    // An entity with no rows of its own.
    expect(exprProblem('count(lines) > 0', customer, 'BOOL', model())).toContain('this entity has none (a one-to-many edited in its form)')
  })

  it('a rule over the rows alone shows its message on them; another list is not a field', () => {
    expect(ruleProblems(order(), model())).toEqual([])
    expect(ruleProblems(order({ rules: [{ check: 'count(lines) > 0', message: 'No', field: 'lines' }] }), model())).toEqual([])
    expect(ruleProblems(order({ rules: [{ check: 'count(lines) > 0', message: 'No', field: 'customer' }] }), model())[0].part).toBe('field')
  })

  it('follow a renamed list and a renamed field of the rows', () => {
    const renamed = renameLinkInRules(model(order({ rules: [{ check: 'count(lines) > 0', message: 'No', field: 'lines' }] })), 'Order', 'lines', 'items')[1]
    expect(renamed.rules?.[0]).toEqual({ check: 'count(items) > 0', message: 'No', field: 'items' })
    expect(renamed.fields[2].formula).toBe('sum(items.lineTotal)')
    expect(renameLinkedFieldInRules(model(), 'OrderLine', 'lineTotal', 'amount')[1].fields[2].formula).toBe('sum(lines.amount)')
  })

  it('a parent of rows carries the version check unless it says not', () => {
    const versioned = (opts?: FullstackEntityDef['opts']) => order({
      fields: [...order().fields, { name: 'version', type: 'STRING' }], ...(opts ? { opts } : {}),
    })
    expect(validateEntities(model(versioned())).entities[1].fields[3].name).toContain("'version' is taken by optimistic locking")
    expect(validateEntities(model(versioned({ optimisticLocking: false }))).count).toBe(0)
    // Without rows saved with it, only the option brings the column.
    const plain = { ...versioned(), relations: [], rules: [], fields: versioned().fields.filter(f => f.name !== 'total') }
    expect(validateEntities([customer, plain, line]).entities[1]?.fields?.[2]?.name).toBeUndefined()
  })
})
