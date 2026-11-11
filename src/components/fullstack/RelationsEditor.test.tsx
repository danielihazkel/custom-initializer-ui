import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RelationsEditor } from './RelationsEditor'
import type { FullstackRelationDef } from '../../types'

const foreignKey: FullstackRelationDef = {
  uid: 'r1', type: 'MANY_TO_ONE', fieldName: 'tags', targetEntity: 'Tag', required: true, joinColumn: 'TAG_FK',
}
const link: FullstackRelationDef = {
  uid: 'r1', type: 'MANY_TO_MANY', fieldName: 'tags', targetEntity: 'Tag', required: false, joinTable: 'T_POST_TAGS', inverseJoinColumn: 'TAG_FK',
}

function renderEditor(relations: FullstackRelationDef[], errors?: Parameters<typeof RelationsEditor>[0]['errors']) {
  const onChange = vi.fn()
  render(<RelationsEditor relations={relations} entityNames={['Post', 'Tag']} ownerName="Post" showInverse onChange={onChange} errors={errors} />)
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

  it('shows what is wrong with the join table under it', () => {
    renderEditor([link], { 0: { joinTable: 'A composite-key entity cannot own a many-to-many' } })
    expect(screen.getByText('A composite-key entity cannot own a many-to-many')).toBeTruthy()
  })
})
