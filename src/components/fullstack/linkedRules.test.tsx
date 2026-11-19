import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { FullstackEntityDef } from '../../types'
import { checkExpr, exprProblem, renameNamesInExpr } from './expr'
import { renameLinkedFieldInRules, renameLinkInRules, ruleProblems } from './rules'
import { validateEntities } from './validation'
import { EntitySettingsPanel } from './EntitySettingsPanel'
import { ModelEntities } from './modelEntities'

const center: FullstackEntityDef = {
  uid: 'cc', name: 'CostCenter',
  fields: [
    { uid: 'cc-id', name: 'id', type: 'LONG', primaryKey: true, generated: true },
    { uid: 'cc-budget', name: 'budget', type: 'MONEY' },
    { uid: 'cc-kind', name: 'kind', type: 'ENUM', enumValues: ['OPEX', 'CAPEX'] },
    { uid: 'cc-notes', name: 'notes', type: 'TEXT' },
  ],
}

const claim = (over: Partial<FullstackEntityDef> = {}): FullstackEntityDef => ({
  uid: 'c', name: 'Claim',
  fields: [
    { uid: 'c-id', name: 'id', type: 'LONG', primaryKey: true, generated: true },
    { uid: 'c-amount', name: 'amount', type: 'MONEY' },
  ],
  relations: [{ uid: 'c-cc', type: 'MANY_TO_ONE', fieldName: 'costCenter', targetEntity: 'CostCenter', required: true }],
  ...over,
})

describe('a rule that reads a linked row (mirror of ExprCheck)', () => {
  it('reads one step through a MANY_TO_ONE, with the target from the model', () => {
    const model = [center, claim()]
    // The row's own fields are what it reports; the linked ones are checked, not listed.
    expect(checkExpr("amount <= costCenter.budget and costCenter.kind == 'capex'", claim(), 'BOOL', model)).toEqual(['amount'])
    expect(exprProblem('costcenter.budget > 1', claim(), 'BOOL', model)).toContain("did you mean 'costCenter'?")
    expect(exprProblem('amount.budget > 1', claim(), 'BOOL', model)).toContain('its links are costCenter')
    expect(exprProblem('costCenter.Budget > 1', claim(), 'BOOL', model)).toContain("'Budget' is not a field of CostCenter (did you mean 'budget'?)")
    expect(exprProblem("costCenter.notes == 'x'", claim(), 'BOOL', model)).toContain('cannot be read through a link')
    expect(exprProblem("costCenter.kind == 'other'", claim(), 'BOOL', model)).toContain("is not one of kind's values")
    expect(exprProblem('costCenter.owner.name > 1', claim(), 'BOOL', model)).toContain('one step only')
    expect(exprProblem('costCenter.budget(1) > 1', claim(), 'BOOL', model)).toContain('is not a function')
  })

  it('counts in the validation with the whole model, and in the settings panel through the context', () => {
    const ruled = claim({ rules: [{ check: 'amount <= costCenter.budget', message: 'Over budget' }] })
    expect(validateEntities([center, ruled]).entities[1]?.rules).toBeUndefined()
    // Alone (no model), the link leads nowhere.
    expect(ruleProblems(ruled)[0]?.message).toContain("'costCenter' is not a link")
    const { container } = render(
      <ModelEntities.Provider value={[center, ruled]}>
        <EntitySettingsPanel entity={ruled} onUpdate={() => {}} onTickView={() => {}} />
      </ModelEntities.Provider>,
    )
    expect(container.textContent).not.toContain('is not a link')
  })

  it('follows a renamed link and a renamed field of the linked entity', () => {
    const ruled = claim({
      rules: [{ check: 'amount <= costCenter.budget', message: 'x' }],
      fields: [...claim().fields, { uid: 'c-flag', name: 'flag', type: 'BOOLEAN', showWhen: "costCenter.kind == 'CAPEX'" }],
    })
    const renamedLink = renameLinkInRules([center, ruled], 'Claim', 'costCenter', 'center')
    expect(renamedLink[1].rules?.[0].check).toBe('amount <= center.budget')
    expect(renamedLink[1].fields[2].showWhen).toBe("center.kind == 'CAPEX'")
    const renamedField = renameLinkedFieldInRules([center, ruled], 'CostCenter', 'budget', 'limit')
    expect(renamedField[1].rules?.[0].check).toBe('amount <= costCenter.limit')
    // Nothing reads it: the same list back.
    const model = [center, ruled]
    expect(renameLinkedFieldInRules(model, 'CostCenter', 'notes', 'memo')).toBe(model)
    // A field of the row itself with the same name as the linked one is not touched.
    expect(renameNamesInExpr('budget > costCenter.budget', n => (n === 'costCenter.budget' ? 'costCenter.limit' : n)))
      .toBe('budget > costCenter.limit')
  })
})
