import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { OptionCoverage } from './OptionCoverage'
import { withUids } from './uid'

const pk = { name: 'id', type: 'LONG' as const, primaryKey: true, generated: true }

describe('OptionCoverage', () => {
  it('says the option applies everywhere when nothing is excluded', () => {
    const entities = withUids([{ name: 'Order', fields: [pk] }, { name: 'Item', fields: [pk] }])
    render(<OptionCoverage optKey="csvExport" entities={entities} onReveal={() => {}} />)
    expect(screen.getByText('Applies to all 2 entities')).toBeTruthy()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('lists the excluded entities as chips that open the card', () => {
    const onReveal = vi.fn()
    const entities = withUids([
      { name: 'Order', fields: [pk] },
      { name: 'Report', viewQuery: 'select 1 as id', fields: [pk] },
    ])
    render(<OptionCoverage optKey="audit" entities={entities} onReveal={onReveal} />)
    expect(screen.getByText('Applies to 1 of 2 entities')).toBeTruthy()
    const chip = screen.getByRole('button', { name: /Report/ })
    expect(chip.getAttribute('title')).toContain('SELECT-backed view')
    fireEvent.click(chip)
    expect(onReveal).toHaveBeenCalledWith(entities[1].uid)
  })

  it('renders nothing without entities', () => {
    const { container } = render(<OptionCoverage optKey="audit" entities={[]} onReveal={() => {}} />)
    expect(container.innerHTML).toBe('')
  })
})
