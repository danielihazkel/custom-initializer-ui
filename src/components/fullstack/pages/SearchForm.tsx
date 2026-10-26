import { inputClass } from '../controls'
import { entityOption } from '../fieldOptions'
import { DEFAULT_PER_ENTITY, MAX_PER_ENTITY, MIN_PER_ENTITY, defaultSearchEntities, searchableEntity } from '../newPageTypes'
import type { FormProps } from './formTypes'
import { Field } from './fields'

export function SearchForm({ page, index, entities, errors, update }: Omit<FormProps, 'lossy'>) {
  const searchable = entities.filter(searchableEntity)
  const chosen = page.entities ?? defaultSearchEntities(entities)
  const toggle = (name: string) => {
    const next = chosen.includes(name) ? chosen.filter(n => n !== name) : [...chosen, name]
    if (next.length === 0) return
    const ordered = searchable.map(e => e.name).filter(n => next.includes(n))
    const isDefault = ordered.join('|') === defaultSearchEntities(entities).join('|')
    update(index, { entities: isDefault ? undefined : ordered })
  }
  return (
    <div className="space-y-3">
      <Field label="Searches" error={errors.entities} control="entities" hint="Entities with a searchable text field; their matches are listed in this order">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {searchable.map(e => (
            <label key={e.name} className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={chosen.includes(e.name)} onChange={() => toggle(e.name)} disabled={chosen.includes(e.name) && chosen.length === 1} />
              {entityOption(e)}
            </label>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
        <Field label="Matches per entity" error={errors.perEntity} control="perEntity" hint="“See all” opens the entity’s list with the same words">
          <select
            aria-label="Matches per entity"
            value={page.perEntity ?? DEFAULT_PER_ENTITY}
            onChange={e => update(index, { perEntity: Number(e.target.value) === DEFAULT_PER_ENTITY ? undefined : Number(e.target.value) })}
            className={`${inputClass(errors.perEntity)} w-full py-1 text-xs`}
          >
            {Array.from({ length: MAX_PER_ENTITY - MIN_PER_ENTITY + 1 }, (_, i) => MIN_PER_ENTITY + i).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Header" error={errors.shellSearch} control="shellSearch">
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={page.shellSearch ?? false} onChange={e => update(index, { shellSearch: e.target.checked || undefined })} />
            A search box in the app’s header opens this page
          </label>
        </Field>
      </div>
    </div>
  )
}
