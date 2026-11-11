import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RelationsEditor } from './RelationsEditor'
import type { FullstackRelationDef } from '../../types'
import { parseLinkIndex } from './childLists'

const foreignKey: FullstackRelationDef = {
  uid: 'r1', type: 'MANY_TO_ONE', fieldName: 'tags', targetEntity: 'Tag', required: true, joinColumn: 'TAG_FK',
}
const link: FullstackRelationDef = {
  uid: 'r1', type: 'MANY_TO_MANY', fieldName: 'tags', targetEntity: 'Tag', required: false, joinTable: 'T_POST_TAGS', inverseJoinColumn: 'TAG_FK',
}

const links = parseLinkIndex(['comment>post>post', 'revision>post>original', 'revision>post>replacement'].join('\n'))

function renderEditor(relations: FullstackRelationDef[], errors?: Parameters<typeof RelationsEditor>[0]['errors']) {
  const onChange = vi.fn()
  render(<RelationsEditor relations={relations} entityNames={['Post', 'Tag', 'Comment', 'Revision']} linkIndex={links}
                          ownerName="Post" showInverse onChange={onChange} errors={errors} />)
  return onChange
}

describe('RelationsEditor — relation kind', () => {
  it('turns a foreign key into a many-to-many: never required, no foreign-key column', () => {
    const onChange = renderEditor([foreignKey])
    fireEvent.change(screen.getByLabelText('Relation kind'), { target: { value: 'MANY_TO_MANY' } })
    expect(onChange).toHaveBeenCalledWith([{ ...foreignKey, type: 'MANY_TO_MANY', required: false, joinColumn: undefined }])
  })

  it('turns a many-to-many back into a foreign key, dropping the join table', () => {
    const onChange = renderEditor([link])
    fireEvent.change(screen.getByLabelText('Relation kind'), { target: { value: 'MANY_TO_ONE' } })
    expect(onChange).toHaveBeenCalledWith([{ ...link, type: 'MANY_TO_ONE', joinTable: undefined, inverseJoinColumn: undefined }])
  })

  it('asks a many-to-many for its join table, named after the owner and the field by default', () => {
    const onChange = renderEditor([{ ...link, joinTable: undefined }])
    const joinTable = screen.getByLabelText('Join table') as HTMLInputElement
    expect(joinTable.placeholder).toBe('post_tags')
    expect(screen.queryByLabelText('Join column')).toBeNull()
    // A set of rows may always be empty, and its target gains no inverse collection.
    expect((screen.getByLabelText('Required (not null)') as HTMLInputElement).disabled).toBe(true)
    expect(document.querySelector('[data-inverse-hint]')).toBeNull()
    fireEvent.change(joinTable, { target: { value: 'T_POST_TAGS' } })
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ joinTable: 'T_POST_TAGS' })])
  })

  it('keeps the join column and the inverse hint for a foreign key', () => {
    renderEditor([foreignKey])
    expect(screen.getByLabelText('Join column')).toBeTruthy()
    expect(screen.queryByLabelText('Join table')).toBeNull()
    expect((screen.getByLabelText('Required (not null)') as HTMLInputElement).disabled).toBe(false)
    expect(document.querySelector('[data-inverse-hint]')).not.toBeNull()
  })

  it('turns a row into a one-to-many: nothing of a foreign key or a join table is kept', () => {
    const onChange = renderEditor([{ ...link, joinColumn: 'POST_FK' }])
    fireEvent.change(screen.getByLabelText('Relation kind'), { target: { value: 'ONE_TO_MANY' } })
    const [[[next]]] = onChange.mock.calls
    expect(next).toMatchObject({ type: 'ONE_TO_MANY', fieldName: 'tags', targetEntity: 'Tag', required: false })
    expect(next.joinColumn ?? next.joinTable ?? next.inverseJoinColumn).toBeUndefined()
  })

  it('names the only link a one-to-many can read, and asks when there are several', () => {
    const comments: FullstackRelationDef = { uid: 'r1', type: 'ONE_TO_MANY', fieldName: 'comments', targetEntity: 'Comment' }
    const revisions: FullstackRelationDef = { uid: 'r2', type: 'ONE_TO_MANY', fieldName: 'revisions', targetEntity: 'Revision' }
    const onChange = renderEditor([comments, revisions])
    const [only, several] = screen.getAllByLabelText('Linked by') as HTMLSelectElement[]
    expect(only.options[0].textContent).toBe('by post (the only link)')
    expect([...several.options].map(o => o.textContent)).toEqual(['— pick the link —', 'by original', 'by replacement'])
    // No column of its own and nothing to require.
    expect(screen.queryByLabelText('Join column')).toBeNull()
    expect(screen.queryByLabelText('Join table')).toBeNull()
    expect((screen.getAllByLabelText('Required (not null)') as HTMLInputElement[]).every(box => box.disabled)).toBe(true)
    expect(document.querySelector('[data-inverse-hint]')).toBeNull()
    fireEvent.change(several, { target: { value: 'replacement' } })
    expect(onChange).toHaveBeenCalledWith([comments, { ...revisions, mappedBy: 'replacement' }])
  })

  it('says when the target has no link back, and keeps a link that is gone on show', () => {
    renderEditor([
      { uid: 'r1', type: 'ONE_TO_MANY', fieldName: 'tags', targetEntity: 'Tag' },
      { uid: 'r2', type: 'ONE_TO_MANY', fieldName: 'comments', targetEntity: 'Comment', mappedBy: 'article' },
    ], { 1: { mappedBy: "Comment has no many-to-one 'article' to Post" } })
    const [none, stale] = screen.getAllByLabelText('Linked by') as HTMLSelectElement[]
    expect(none.options[0].textContent).toBe('no link back yet')
    expect(stale.value).toBe('article')
    expect(screen.getByText("Comment has no many-to-one 'article' to Post")).toBeTruthy()
  })

  it('leaves a one-to-many behind when the kind changes again', () => {
    const onChange = renderEditor([{ uid: 'r1', type: 'ONE_TO_MANY', fieldName: 'revisions', targetEntity: 'Revision', mappedBy: 'original' }])
    fireEvent.change(screen.getByLabelText('Relation kind'), { target: { value: 'MANY_TO_ONE' } })
    const [[[next]]] = onChange.mock.calls
    expect(next.type).toBe('MANY_TO_ONE')
    expect(next.mappedBy).toBeUndefined()
  })

  it('shows what is wrong with the join table under it', () => {
    renderEditor([link], { 0: { joinTable: 'A composite-key entity cannot own a many-to-many' } })
    expect(screen.getByText('A composite-key entity cannot own a many-to-many')).toBeTruthy()
  })
})
