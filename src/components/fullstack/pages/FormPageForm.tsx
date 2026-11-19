import type { FullstackPageDef } from '../../../types'
import { createsRows } from '../pageLayout'
import type { FormProps } from './formTypes'
import { EntitySelect, Field } from './fields'
import { t } from '../../../i18n'

/** A form page's settings: only its entity — the fields and their sections are the entity's own. */
export function FormPageForm({ page, index, entities, pages, errors, update }: Omit<FormProps, 'lossy'> & { pages: FullstackPageDef[] }) {
  const entity = entities.find(e => e.name === page.entity)
  // An entity has one page that creates its rows, a wizard or a form.
  const taken = (name: string) => pages.some(p => p.id !== page.id && createsRows(p) && p.entity === name)
  return (
    <div className="space-y-2">
      <Field label={t('Entity')} error={errors.entity} control="entity" hint={t('Its whole form, in the sections set on the entity')}>
        <EntitySelect
          label={t('Form entity')}
          value={page.entity ?? ''}
          options={entities.filter(e => !e.readOnly && (!taken(e.name) || e.name === page.entity)).map(e => e.name)}
          error={errors.entity}
          onChange={name => update(index, { entity: name })}
        />
      </Field>
      {entity && (
        <p className="text-[11px] text-secondary">
          {t('New on {entity}’s lists, a calendar’s day and the record page’s Edit open this page instead of the drawer', { entity: entity.name })}{' '}
          ({entity.fields.filter(f => f.primaryKey).length === 1
            ? t('{create} creates, {edit} edits', { create: `#/${page.id}`, edit: `#/${page.id}/<id>` })
            : t('{create} creates', { create: `#/${page.id}` })}).{' '}
          {t('Saved, a row opens on its record page when there is one, else its list.')}
        </p>
      )}
    </div>
  )
}
