import { importable } from '../newPageTypes'
import type { FormProps } from './formTypes'
import { EntitySelect, Field } from './fields'

export function ImportForm({ page, index, entities, errors, update }: Omit<FormProps, 'lossy'>) {
  const entity = entities.find(e => e.name === page.entity)
  return (
    <div className="space-y-2">
      <Field label="Entity" error={errors.entity} control="entity" hint="Rows are checked in the browser first, then created all at once — or not at all">
        <EntitySelect
          label="Import entity"
          value={page.entity ?? ''}
          options={entities.filter(importable).map(e => e.name)}
          error={errors.entity}
          onChange={name => update(index, { entity: name })}
        />
      </Field>
      {entity && (
        <p className="text-[11px] text-secondary">
          This switches on CSV import for {entity.name}: its backend gets <code>POST /import</code> and its list page an Import button that opens this page.
          A file exported from the app imports as it is — columns match by field name or label.
        </p>
      )}
    </div>
  )
}
