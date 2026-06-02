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
