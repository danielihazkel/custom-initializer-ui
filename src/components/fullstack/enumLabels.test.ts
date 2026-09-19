import { describe, it, expect } from 'vitest'
import { enumLabel, humanizeConstant, lookupLabel, pruneLabels } from './enumLabels'

describe('enum labels', () => {
  it('humanizes a constant the way the generator does', () => {
    expect(humanizeConstant('IN_PROGRESS')).toBe('In progress')
    expect(humanizeConstant('open')).toBe('Open')
    expect(humanizeConstant('  ')).toBe('')
  })

  it('prefers the explicit label, matched case-insensitively, and falls back to the humanized constant', () => {
    const field = { enumLabels: { OPEN: 'פתוח', closed: ' Closed ' } }
    expect(enumLabel(field, 'OPEN')).toBe('פתוח')
    expect(enumLabel(field, 'CLOSED')).toBe('Closed')
    expect(enumLabel(field, 'IN_PROGRESS')).toBe('In progress')
    expect(enumLabel({}, 'DONE')).toBe('Done')
    expect(lookupLabel(undefined, 'OPEN')).toBeUndefined()
  })

  it('prunes labels for removed or blank values and collapses an empty map to undefined', () => {
    expect(pruneLabels({ OPEN: 'Open', GONE: 'Gone', BLANK: '  ' }, ['OPEN', 'BLANK'])).toEqual({ OPEN: 'Open' })
    expect(pruneLabels({ GONE: 'Gone' }, ['OPEN'])).toBeUndefined()
    expect(pruneLabels(undefined, ['OPEN'])).toBeUndefined()
  })
})
