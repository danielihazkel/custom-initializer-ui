import { useState } from 'react'
import { inputClass } from '../controls'
import { keyOption } from '../fieldOptions'
import { moveItem } from '../reorder'
import { dropIndicatorClass, useDragReorder } from '../useDragReorder'
import { MAX_STEPS, askableFields, MAX_TITLE, defaultWizardSteps, pageLabel, retargetWizardSteps } from '../pageLayout'
import type { FormProps } from './formTypes'
import { ICON_BUTTON, SMALL_BUTTON } from './constants'
import { DragGrip, EntitySelect, Field, MoveButtons } from './fields'

/** A wizard: its entity, and the form's fields dealt into steps (each field in exactly one). */
export function WizardForm({ page, index, entities, errors, update, lossy, removed, dnd }: FormProps & { dnd: ReturnType<typeof useDragReorder> }) {
  const entity = entities.find(e => e.name === page.entity)
  const askable = askableFields(entity)
  const steps = page.steps ?? defaultWizardSteps(entity)
  const setSteps = (next: { title?: string; fields: string[] }[]) => update(index, { steps: next })
  const stepOf = (name: string) => steps.findIndex(s => s.fields.includes(name))
  const unasked = askable.filter(a => stepOf(a.name) < 0)

  // The field chip being dragged to another step (native drag, across steps).
  const [draggedField, setDraggedField] = useState<string | null>(null)
  const [dropStep, setDropStep] = useState<number | null>(null)
  const unaskedRequired = unasked.filter(a => a.required)

  // Moves a field into step `si`, out of whichever step had it.
  const place = (name: string, si: number) => setSteps(steps.map((s, i) => ({
    ...s,
    fields: i === si ? (s.fields.includes(name) ? s.fields : [...s.fields, name]) : s.fields.filter(f => f !== name),
  })))

  return (
    <div className="space-y-2">
      <Field
        label="Entity"
        error={errors.entity}
        control="entity"
        hint="Creates rows — and edits them too (#/page/<id>); a record page's Edit opens the wizard"
      >
        <EntitySelect
          label="Wizard entity"
          value={page.entity ?? ''}
          options={entities.filter(e => !e.readOnly).map(e => e.name)}
          error={errors.entity}
          // Steps keep the fields the new entity also has; the rest are dealt in after them.
          onChange={name => {
            const { steps: next, dropped } = retargetWizardSteps(page.steps, entities.find(e => e.name === name))
            lossy(`Asked for ${name} in “${pageLabel(page)}”`, dropped)
            update(index, { entity: name, steps: next })
          }}
        />
      </Field>
      <div className="space-y-1" data-control="steps">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          Steps <span className="font-normal normal-case tracking-normal">· then a review before saving</span>
        </p>
        {steps.map((step, si) => {
          const error = errors[`step.${si}`]
          return (
            <div
              key={si}
              {...dnd.rowProps(`steps:${index}`, si)}
              onDragOver={e => {
                if (draggedField) {
                  e.preventDefault()
                  if (dropStep !== si) setDropStep(si)
                } else dnd.rowProps(`steps:${index}`, si).onDragOver(e)
              }}
              onDrop={e => {
                if (draggedField) {
                  e.preventDefault()
                  place(draggedField, si)
                  setDraggedField(null)
                  setDropStep(null)
                } else dnd.rowProps(`steps:${index}`, si).onDrop(e)
              }}
              className={`space-y-1 rounded border px-2 py-1.5 ${error ? 'border-error/50' : draggedField && dropStep === si ? 'border-primary bg-primary/5' : 'border-outline-variant'} ${
                dnd.isDragging(`steps:${index}`, si) ? 'opacity-40' : ''} ${dropIndicatorClass(dnd.indicatorFor(`steps:${index}`, si))}`}
              data-control={`step.${si}`}
              data-wizard-step={si}
            >
              <div className="flex items-center gap-1.5">
                <DragGrip dnd={dnd} list={`steps:${index}`} index={si} />
                <MoveButtons
                  label={`step ${si + 1}`}
                  canUp={si > 0}
                  canDown={si < steps.length - 1}
                  onMove={delta => setSteps(moveItem(steps, si, si + delta))}
                />
                <span className="text-xs font-semibold text-secondary">{si + 1}.</span>
                <input
                  type="text"
                  aria-label={`Step ${si + 1} title`}
                  value={step.title ?? ''}
                  maxLength={MAX_TITLE}
                  placeholder={`Step ${si + 1}`}
                  onChange={e => setSteps(steps.map((s, i) => (i === si ? { ...s, title: e.target.value || undefined } : s)))}
                  className={`${inputClass()} min-w-[8rem] flex-1 py-1 text-xs`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const fields = steps[si].fields
                    removed?.(`Removed step ${si + 1} from “${pageLabel(page)}”`,
                      fields.length ? `${fields.join(', ')} ${fields.length === 1 ? 'is' : 'are'} no longer asked — add ${fields.length === 1 ? 'it' : 'them'} to another step` : undefined)
                    setSteps(steps.filter((_, i) => i !== si))
                  }}
                  disabled={steps.length === 1}
                  className={ICON_BUTTON}
                  aria-label={`Remove step ${si + 1}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {step.fields.map(name => {
                  const a = askable.find(x => x.name === name)
                  return (
                    <span
                      key={name}
                      draggable
                      onDragStart={e => {
                        e.stopPropagation()
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', name)
                        setDraggedField(name)
                      }}
                      onDragEnd={() => { setDraggedField(null); setDropStep(null) }}
                      title="Drag to another step"
                      className={`inline-flex cursor-grab items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${a ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'} ${draggedField === name ? 'opacity-40' : ''}`}
                      data-step-field={name}
                    >
                      {a?.relation && <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">link</span>}
                      {keyOption(entity, name)}{a?.required && <span aria-label="required">*</span>}
                      <button
                        type="button"
                        onClick={() => setSteps(steps.map((s, i) => (i === si ? { ...s, fields: s.fields.filter(f => f !== name) } : s)))}
                        className="leading-none hover:text-error"
                        aria-label={`Take ${name} out of step ${si + 1}`}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
                {askable.some(a => stepOf(a.name) !== si) && (
                  <select
                    aria-label={`Add a field to step ${si + 1}`}
                    value=""
                    onChange={e => e.target.value && place(e.target.value, si)}
                    className={`${inputClass()} max-w-[10rem] py-0.5 text-[11px]`}
                  >
                    <option value="">+ field</option>
                    {askable.filter(a => stepOf(a.name) !== si).map(a => (
                      <option key={a.name} value={a.name}>
                        {keyOption(entity, a.name)}{a.required ? ' *' : ''}{stepOf(a.name) >= 0 ? ` (from step ${stepOf(a.name) + 1})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {error && <p className="text-[11px] text-error">{error}</p>}
            </div>
          )
        })}
        {unaskedRequired.length > 0 && (
          <p className="text-[11px] text-error" data-wizard-unasked-required>
            Required but not asked: {unaskedRequired.map(a => a.name).join(', ')} — add each to a step, or the wizard cannot save.
          </p>
        )}
        {unasked.length > unaskedRequired.length && (
          <p className="text-[11px] text-secondary" data-wizard-unasked>
            Not asked (optional): {unasked.filter(a => !a.required).map(a => a.name).join(', ')}
          </p>
        )}
        <p className="text-[10px] text-secondary/80">Drag a field chip onto another step to move it.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSteps([...steps, { fields: [] }])}
            disabled={steps.length >= MAX_STEPS}
            className={SMALL_BUTTON}
            title={steps.length >= MAX_STEPS ? `A wizard can have at most ${MAX_STEPS} steps` : undefined}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
            Add step
          </button>
          {page.steps != null && (
            <button
              type="button"
              onClick={() => update(index, { steps: undefined })}
              className={SMALL_BUTTON}
              title={`The generator's steps: ${askable.length} field${askable.length === 1 ? '' : 's'}, four to a step, relations last`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">restart_alt</span>
              Reset to default steps
            </button>
          )}
        </div>
        {errors.steps && <p className="text-[11px] text-error">{errors.steps}</p>}
      </div>
    </div>
  )
}
