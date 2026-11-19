import { importable } from '../newPageTypes'
import type { FormProps } from './formTypes'
import { EntitySelect, Field } from './fields'
import { t } from '../../../i18n'

export function ImportForm({ page, index, entities, errors, update }: Omit<FormProps, 'lossy'>) {
  const entity = entities.find(e => e.name === page.entity)
  return (
    <div className="space-y-2">
      <Field label={t('Entity')} error={errors.entity} control="entity" hint={t('Rows are checked in the browser first, then created all at once — or not at all')}>
        <EntitySelect
          label={t('Import entity')}
          value={page.entity ?? ''}
          options={entities.filter(importable).map(e => e.name)}
          error={errors.entity}
          onChange={name => update(index, { entity: name })}
        />
      </Field>
      {entity && (
        <p className="text-[11px] text-secondary">
          {t('This switches on CSV import for {entity}: its backend gets', { entity: entity.name })} <code>POST /import</code>{' '}
          {t('and its list page an Import button that opens this page.')}{' '}
          {t('A file exported from the app imports as it is — columns match by field name or label.')}
        </p>
      )}
    </div>
  )
}
