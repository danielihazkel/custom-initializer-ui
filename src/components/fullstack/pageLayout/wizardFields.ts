import type { FullstackEntityDef } from '../../../types'
import { DEFAULT_STEP_SIZE } from './limits'

/**
 * What a create page may ask for: the fields and links of an entity that a wizard's steps and a
 * form's sections are dealt from, and the steps a wizard gets when it names none.
 */

/** What a wizard step can ask for: every field but a generated key, then the MANY_TO_ONE
 *  relations (by field name) — what the entity's form shows. */
/** What a wizard can ask for: the form's fields, without a workflow's status (it starts in its
 *  initial state, and only transitions move it) or its assignee (set by claiming and reassigning). */
export function wizardFields(entity: FullstackEntityDef | undefined): { name: string; required: boolean; relation: boolean }[] {
  const status = entity?.workflow?.statusField
  const assignee = entity?.workflow?.assigneeField
  return stepFields(entity).filter(a => a.relation || (a.name !== status && a.name !== assignee))
}

/** What a wizard's steps are dealt from: the form's fields and links, then its sets of linked rows
 *  (the many-to-manys — a step may ask for one, and it may always be empty). */
export function stepFields(entity: FullstackEntityDef | undefined): { name: string; required: boolean; relation: boolean }[] {
  return [
    ...askableFields(entity),
    ...(entity?.relations ?? []).filter(r => r.type === 'MANY_TO_MANY' && r.fieldName.trim())
      .map(r => ({ name: r.fieldName, required: false, relation: true })),
  ]
}

export function askableFields(entity: FullstackEntityDef | undefined): { name: string; required: boolean; relation: boolean }[] {
  if (!entity) return []
  return [
    ...entity.fields.filter(f => f.name.trim() && !(f.primaryKey && f.generated))
      .map(f => ({ name: f.name, required: Boolean(f.required || f.primaryKey), relation: false })),
    ...(entity.relations ?? []).filter(r => r.type === 'MANY_TO_ONE' && r.fieldName.trim())
      .map(r => ({ name: r.fieldName, required: Boolean(r.required), relation: true })),
  ]
}

/** The steps a wizard gets when it names none (FullstackPageValidator): four fields to a step. */
export function defaultWizardSteps(entity: FullstackEntityDef | undefined): { title?: string; fields: string[] }[] {
  const names = wizardFields(entity).map(f => f.name)
  const status = entity?.workflow?.statusField
  const assignee = entity?.workflow?.assigneeField
  // The entity's form sections, one step each, then whatever they leave out (FullstackPageValidator.steps).
  if (entity?.formSections?.length) {
    const placed = new Set(entity.formSections.flatMap(s => s.fields.map(f => f.toLowerCase())))
    const rest = names.filter(n => !placed.has(n.toLowerCase()))
    const sections = entity.formSections
      .map(s => ({ title: s.title, fields: s.fields.filter(f => f !== status && f !== assignee) }))
      .filter(s => s.fields.length > 0)
    return [...sections, ...(rest.length ? [{ fields: rest }] : [])]
  }
  const steps: { fields: string[] }[] = []
  for (let i = 0; i < names.length; i += DEFAULT_STEP_SIZE) steps.push({ fields: names.slice(i, i + DEFAULT_STEP_SIZE) })
  return steps
}
