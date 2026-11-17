import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { FullstackEntityDef } from '../../types'
import { checkExpr, exprProblem, renameInExpr } from './expr'
import { ruleProblems, syncRules } from './rules'
import { validateEntities } from './validation'
import { EntitySettingsPanel } from './EntitySettingsPanel'

const claim = (over: Partial<FullstackEntityDef> = {}): FullstackEntityDef => ({
  uid: 'c',
  name: 'Claim',
  fields: [
    { uid: 'f-id', name: 'id', type: 'LONG', primaryKey: true, generated: true },
    { uid: 'f-starts', name: 'startsOn', type: 'LOCAL_DATE' },
    { uid: 'f-ends', name: 'endsOn', type: 'LOCAL_DATE' },
    { uid: 'f-qty', name: 'quantity', type: 'INTEGER' },
    { uid: 'f-price', name: 'unitPrice', type: 'MONEY' },
    { uid: 'f-status', name: 'status', type: 'ENUM', enumValues: ['OPEN', 'REJECTED'] },
    { uid: 'f-reason', name: 'reason', type: 'TEXT' },
    { uid: 'f-receipt', name: 'receipt', type: 'FILE' },
  ],
  ...over,
})

describe('the expression language (mirror of fullstack/expr)', () => {
  it('reads what the server reads, and says which fields', () => {
    expect(checkExpr('endsOn >= startsOn', claim())).toEqual(['endsOn', 'startsOn'])
    expect(checkExpr("status = 'rejected' && not isEmpty(reason) or quantity * unitPrice > 100", claim()))
      .toEqual(['status', 'reason', 'quantity', 'unitPrice'])
    expect(exprProblem('endsOn <= startsOn + 30 and daysBetween(startsOn, endsOn) < 7 and endsOn > date(\'2025-01-31\')', claim())).toBeUndefined()
    expect(exprProblem('!isEmpty(receipt) and round(unitPrice / 3, 2) > abs(-1)', claim())).toBeUndefined()
  })

  it('refuses what the server refuses, saying where', () => {
    expect(exprProblem('ends >= startsOn', claim())).toBe("'ends' is not a field of this entity (at character 1)")
    expect(exprProblem('Endson >= startsOn', claim())).toContain("did you mean 'endsOn'?")
    expect(exprProblem('endsOn >= quantity', claim())).toBe('Cannot compare a date with a number (at character 8)')
    expect(exprProblem("status == 'CLOSED'", claim())).toContain("'CLOSED' is not one of status's values (OPEN, REJECTED)")
    expect(exprProblem("status < 'OPEN'", claim())).toContain('not ordered')
    expect(exprProblem("receipt == 'x'", claim())).toContain('can only be tested with isEmpty()')
    expect(exprProblem('quantity + 1', claim())).toContain('This must be a yes/no condition, but it is a number')
    expect(exprProblem('1 < quantity < 5', claim())).toContain('do not chain')
    expect(exprProblem('frobnicate(reason)', claim())).toContain("'frobnicate' is not a function")
    expect(exprProblem('round(unitPrice, quantity) > 1', claim())).toContain('whole number of decimal places')
    expect(exprProblem("endsOn > date('2025-02-30')", claim())).toContain('is not a date')
    expect(exprProblem("reason == 'open", claim())).toContain('not closed')
    expect(exprProblem('reason == ', claim())).toContain('ends too early')
    expect(exprProblem('quantity > 1 $', claim())).toContain("'$' is not part of the language")
  })

  it('renames a field where it is read, not inside a text or a function name', () => {
    expect(renameInExpr("endsOn >= startsOn and reason != 'endsOn'", 'endsOn', 'finishesOn'))
      .toBe("finishesOn >= startsOn and reason != 'endsOn'")
    expect(renameInExpr('isEmpty(length) or length(reason) > 1', 'length', 'size')).toBe('isEmpty(size) or length(reason) > 1')
  })
})

describe('rules', () => {
  it('say what is wrong with each, by part', () => {
    const e = claim({ rules: [
      { check: 'endsOn >= startsOn', message: 'Ends after it starts' },
      { check: 'endsOn >= 1', message: 'x' },
      { when: 'status', check: 'endsOn >= startsOn', message: 'x' },
      { check: 'endsOn >= startsOn', message: '' },
      { check: "today() > date('2020-01-01')", message: 'x' },
      { check: 'endsOn >= startsOn', message: 'x', field: 'nope' },
    ] })
    expect(ruleProblems(e).map(p => [p.index, p.part])).toEqual([[1, 'check'], [2, 'when'], [3, 'message'], [4, 'field'], [5, 'field']])
    expect(ruleProblems(claim({ readOnly: true, rules: [{ check: 'endsOn >= startsOn', message: 'x' }] }))[0].message)
      .toMatch(/read-only/)
  })

  it('follow a renamed field', () => {
    const before = claim({ rules: [{ when: "status == 'REJECTED'", check: 'not isEmpty(reason)', message: 'Why?', field: 'reason' }] })
    const after = syncRules(before, {
      ...before,
      fields: before.fields.map(f => (f.uid === 'f-reason' ? { ...f, name: 'rejectionReason' } : f)),
    })
    expect(after.rules).toEqual([{ when: "status == 'REJECTED'", check: 'not isEmpty(rejectionReason)', message: 'Why?', field: 'rejectionReason' }])
  })

  it('count in the editor’s validation; a composed child may have none', () => {
    const parent: FullstackEntityDef = {
      uid: 'p', name: 'Batch',
      fields: [{ uid: 'p-id', name: 'id', type: 'LONG', primaryKey: true, generated: true }],
      relations: [{ uid: 'p-c', type: 'ONE_TO_MANY', fieldName: 'claims', targetEntity: 'Claim', composition: true }],
    }
    const ruled = claim({ rules: [{ check: 'endsOn >= startsOn', message: 'x' }] })
    expect(validateEntities([ruled]).entities[0]).toBeUndefined()
    expect(validateEntities([parent, ruled]).entities[1]?.rules).toMatch(/inside their parent’s form/)
    expect(validateEntities([claim({ rules: [{ check: 'endsOn >= 3', message: 'x' }] })]).entities[0]?.rules)
      .toBe('Rule 1: Cannot compare a date with a number (at character 8)')
  })

  it('are written in the entity settings, the problem under the rule', () => {
    const onUpdate = vi.fn()
    const { container } = render(<EntitySettingsPanel entity={claim({ rules: [{ check: 'endsOn >= quantity', message: 'x' }] })}
      onUpdate={onUpdate} onTickView={() => {}} />)
    expect(container.querySelector('[data-rule="0"] [data-error]')?.textContent).toBe('Cannot compare a date with a number (at character 8)')
    fireEvent.change(screen.getByLabelText('Check of rule 1'), { target: { value: 'endsOn >= startsOn' } })
    expect(onUpdate).toHaveBeenLastCalledWith({ rules: [{ check: 'endsOn >= startsOn', message: 'x' }] })
    fireEvent.change(screen.getByLabelText('Field rule 1 is shown on'), { target: { value: 'endsOn' } })
    expect(onUpdate).toHaveBeenLastCalledWith({ rules: [{ check: 'endsOn >= quantity', message: 'x', field: 'endsOn' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }))
    expect(onUpdate).toHaveBeenLastCalledWith({ rules: [{ check: 'endsOn >= quantity', message: 'x' }, { check: '', message: '' }] })
  })
})
