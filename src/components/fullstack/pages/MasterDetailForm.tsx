import { inputClass } from '../controls'
import { relationOption } from '../fieldOptions'
import { pageLabel, relationsTo, retargetMasterDetail, retargetMasterDetailChild } from '../pageLayout'
import type { FormProps } from './formTypes'
import { EntitySelect, Field, ListOptions } from './fields'
import { t } from '../../../i18n'

export function MasterDetailForm({ page, index, entities, errors, update, lossy, projectOpts }: FormProps & { projectOpts: string[] }) {
  const parent = entities.find(e => e.name === page.parent)
  const child = entities.find(e => e.name === page.child)
  const children = entities.filter(e => relationsTo(e, page.parent).length > 0)
  const vias = relationsTo(child, page.parent)

  return (
    <div className="grid grid-cols-1 @sm:grid-cols-3 gap-2">
      <Field label={t('Parent (left list)')} error={errors.parent} control="parent">
        <EntitySelect
          label={t('Parent entity')}
          value={page.parent ?? ''}
          options={entities.map(e => e.name)}
          error={errors.parent}
          onChange={name => {
            // The child and its link stay when they still fit the new parent (a lone candidate
            // child is picked, so the page is complete in one step); anything dropped is named.
            const { patch, dropped } = retargetMasterDetail(page, name, entities)
            lossy(t('Listed {entity} on the left of “{page}”', { entity: name, page: pageLabel(page) }), dropped)
            update(index, patch)
          }}
        />
      </Field>
      <Field
        label={t('Child (right list)')}
        error={errors.child}
        control="child"
        hint={parent ? t('Entities with a relation to {entity}', { entity: parent.name }) : undefined}
      >
        <EntitySelect
          label={t('Child entity')}
          value={page.child ?? ''}
          options={children.map(e => e.name)}
          error={errors.child}
          empty={children.length === 0 ? t('No entity points at this parent') : undefined}
          onChange={name => {
            const { patch, dropped } = retargetMasterDetailChild(page, name, entities)
            lossy(t('Showed {entity} on the right of “{page}”', { entity: name, page: pageLabel(page) }), dropped)
            update(index, patch)
          }}
        />
        {parent && children.length === 0 && (
          <p className="text-[10px] text-secondary" data-md-no-child>
            {t('Add a many-to-one relation to {entity} on another entity (its Relations table), then pick it here.', { entity: parent.name })}
          </p>
        )}
      </Field>
      <Field label={t('Parent card')} control="showParent" hint={page.showParent ? t('{entity}’s details above its rows, with Edit when it is writable', { entity: parent?.name ?? t('The parent') }) : t('The right side shows the child rows only')}>
        <label className="inline-flex items-center gap-1.5 text-xs text-on-surface">
          <input
            type="checkbox"
            className="accent-primary"
            checked={Boolean(page.showParent)}
            aria-label={t("Show the selected parent's details")}
            onChange={e => update(index, { showParent: e.target.checked ? true : undefined })}
          />
          {t('Show the selected {entity}', { entity: parent?.name ?? t('parent') })}
        </label>
      </Field>
      <Field label={t('Child list opens with')} error={errors.columns ?? errors.sort} control="columns" hint={t("Its columns and sort — each absent: the list's own default")}>
        <ListOptions
          label={t('{entity} list', { entity: child?.name ?? t('child') })}
          entity={child}
          projectOpts={projectOpts}
          columns={page.columns}
          sort={page.sort}
          onChange={patch => update(index, patch)}
        />
      </Field>
      {vias.length > 1 && (
        <Field label={t('Linked through')} error={errors.via} control="via">
          <select
            aria-label={t('Relation to link through')}
            aria-invalid={Boolean(errors.via)}
            value={page.via ?? ''}
            onChange={e => update(index, { via: e.target.value || undefined })}
            className={`${inputClass(errors.via)} py-1 text-xs`}
          >
            <option value="">{t('— pick a relation —')}</option>
            {vias.map(v => <option key={v} value={v}>{relationOption(v)}</option>)}
          </select>
        </Field>
      )}
    </div>
  )
}
