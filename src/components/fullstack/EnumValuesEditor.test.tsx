import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EnumValuesEditor } from './EnumValuesEditor'

describe('EnumValuesEditor', () => {
  it('adds a value on Enter', () => {
    const onChange = vi.fn()
    render(<EnumValuesEditor values={[]} onChange={onChange} />)
    const input = screen.getByLabelText('Add enum value')
    fireEvent.change(input, { target: { value: 'ACTIVE' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['ACTIVE'])
  })

  it('splits a comma-pasted draft into multiple values', () => {
    const onChange = vi.fn()
    render(<EnumValuesEditor values={[]} onChange={onChange} />)
    const input = screen.getByLabelText('Add enum value')
    fireEvent.change(input, { target: { value: 'A, B ,C' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(['A', 'B', 'C'])
  })

  it('does not add a duplicate value', () => {
    const onChange = vi.fn()
    render(<EnumValuesEditor values={['ACTIVE']} onChange={onChange} />)
    const input = screen.getByLabelText('Add enum value')
    fireEvent.change(input, { target: { value: 'ACTIVE' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Already present → unchanged list re-emitted, no new entry.
    expect(onChange).toHaveBeenCalledWith(['ACTIVE'])
  })

  it('removes a value via its × button', () => {
    const onChange = vi.fn()
    render(<EnumValuesEditor values={['ACTIVE', 'DISABLED']} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Remove ACTIVE'))
    expect(onChange).toHaveBeenCalledWith(['DISABLED'])
  })

  it('removes the last value on Backspace when the draft is empty', () => {
    const onChange = vi.fn()
    render(<EnumValuesEditor values={['ACTIVE', 'DISABLED']} onChange={onChange} />)
    const input = screen.getByLabelText('Add enum value')
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(onChange).toHaveBeenCalledWith(['ACTIVE'])
  })
})

describe('EnumValuesEditor — display labels', () => {
  it('emits the label map from a chip input and defaults the placeholder to the humanized constant', () => {
    const onChange = vi.fn()
    const onLabelsChange = vi.fn()
    const { rerender } = render(<EnumValuesEditor values={['IN_PROGRESS']} labels={{}} onChange={onChange} onLabelsChange={onLabelsChange} />)
    const input = screen.getByLabelText('Label for IN_PROGRESS') as HTMLInputElement
    expect(input.placeholder).toBe('In progress')
    fireEvent.change(input, { target: { value: 'בטיפול' } })
    expect(onLabelsChange).toHaveBeenCalledWith({ IN_PROGRESS: 'בטיפול' })
    // Controlled: the parent hands the map back, then clearing the input empties the map.
    rerender(<EnumValuesEditor values={['IN_PROGRESS']} labels={{ IN_PROGRESS: 'בטיפול' }} onChange={onChange} onLabelsChange={onLabelsChange} />)
    fireEvent.change(screen.getByLabelText('Label for IN_PROGRESS'), { target: { value: '' } })
    expect(onLabelsChange).toHaveBeenLastCalledWith(undefined)
  })

  it('accepts VALUE:Label in the draft and drops the label with its value', () => {
    const onChange = vi.fn()
    const onLabelsChange = vi.fn()
    render(<EnumValuesEditor values={['OPEN']} labels={{ OPEN: 'Open' }} onChange={onChange} onLabelsChange={onLabelsChange} />)
    const draft = screen.getByLabelText('Add enum value')
    fireEvent.change(draft, { target: { value: 'CLOSED:Closed, DONE' } })
    fireEvent.keyDown(draft, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['OPEN', 'CLOSED', 'DONE'])
    expect(onLabelsChange).toHaveBeenCalledWith({ OPEN: 'Open', CLOSED: 'Closed' })
    fireEvent.click(screen.getByLabelText('Remove OPEN'))
    expect(onChange).toHaveBeenLastCalledWith([])
    expect(onLabelsChange).toHaveBeenLastCalledWith(undefined)
  })

  it('renames a value in place, carrying its label, and ignores a clash', () => {
    const onChange = vi.fn()
    const onLabelsChange = vi.fn()
    render(<EnumValuesEditor values={['OPEN', 'DONE']} onChange={onChange} labels={{ OPEN: 'Open' }} onLabelsChange={onLabelsChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Rename OPEN' }))
    const input = screen.getByLabelText('New name for OPEN')
    fireEvent.change(input, { target: { value: 'NEW' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['NEW', 'DONE'])
    expect(onLabelsChange).toHaveBeenCalledWith({ NEW: 'Open' })

    onChange.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Rename DONE' }))
    const again = screen.getByLabelText('New name for DONE')
    fireEvent.change(again, { target: { value: 'OPEN' } })
    fireEvent.keyDown(again, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
