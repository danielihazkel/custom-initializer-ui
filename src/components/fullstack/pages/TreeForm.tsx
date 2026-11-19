import { inputClass } from '../controls'
import { selfLinks, treeReason } from '../pageLayout'
import type { FormProps } from './formTypes'
import { EntitySelect, Field } from './fields'
import { t } from '../../../i18n'

/** A tree page: the entity, and — when it points at itself in more than one way — which link the tree is drawn by. */
export function TreeForm({ page, index, entities, errors, update }: Omit<FormProps, 'lossy'>) {
  const entity = entities.find(e => e.name === page.entity)
  const links = selfLinks(entity).map(r => r.fieldName)
  return (
    <div className="space-y-2">
      <Field label={t('Entity')} error={errors.entity} control="entity" hint={t('Its rows are drawn as an outline: each under the row it belongs to')}>
        <EntitySelect
          label={t('Tree entity')}
          value={page.entity ?? ''}
          options={entities.filter(e => !treeReason(e)).map(e => e.name)}
          error={errors.entity}
          // The link named for one entity means nothing on another.
          onChange={name => update(index, { entity: name, via: undefined })}
        />
      </Field>
      {(links.length > 1 || page.via) && (
        <Field label={t('Parent link')} error={errors.via} control="via" hint={t('The relation of the entity to itself that says which row a row sits under')}>
          <select
            aria-label={t('Parent link')}
            aria-invalid={Boolean(errors.via)}
            value={page.via ?? ''}
            onChange={e => update(index, { via: e.target.value || undefined })}
            className={`${inputClass(errors.via)} max-w-[14rem] py-1 text-xs`}
          >
            {links.length === 1 && <option value="">{t('{link} (the only one)', { link: links[0] })}</option>}
            {links.length !== 1 && <option value="">{t('Choose…')}</option>}
            {links.map(name => <option key={name} value={name}>{name}</option>)}
            {page.via && !links.includes(page.via) && <option value={page.via}>{page.via}</option>}
          </select>
        </Field>
      )}
      {entity && (
        <p className="text-[11px] text-secondary">
          {t('The page reads up to 500 rows in one call and builds the outline in the browser; a row opens {entity}’s record page when the layout has one, else a quick look.', { entity: entity.name })}
        </p>
      )}
    </div>
  )
}
