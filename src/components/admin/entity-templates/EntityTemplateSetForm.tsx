import type { AdminEntityTemplateSet, EntityTemplateSetKind } from '../../../types'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'

interface Props {
  data: Partial<AdminEntityTemplateSet>
  errors: Record<string, string>
  onChange: (updates: Partial<AdminEntityTemplateSet>) => void
}

const KINDS: { value: EntityTemplateSetKind; label: string }[] = [
  { value: 'BACKEND_JAVA', label: 'Backend (Java)' },
  { value: 'FRONTEND_REACT', label: 'Frontend (React)' },
]

export function EntityTemplateSetForm({ data, errors, onChange }: Props) {
  return (
    <>
      <FieldRow label="Set Key" required error={errors.setKey} hint="Unique identifier, e.g. 'spring-jpa-crud'">
        <input
          type="text"
          className={inputClass}
          value={data.setKey ?? ''}
          onChange={e => onChange({ setKey: e.target.value })}
          placeholder="spring-jpa-crud"
        />
      </FieldRow>
      <FieldRow label="Name" required error={errors.name}>
        <input
          type="text"
          className={inputClass}
          value={data.name ?? ''}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Spring Boot + JPA CRUD"
        />
      </FieldRow>
      <FieldRow label="Description">
        <textarea
          className={inputClass}
          rows={2}
          value={data.description ?? ''}
          onChange={e => onChange({ description: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="Kind" required error={errors.kind}>
        <select
          className={selectClass}
          value={data.kind ?? ''}
          onChange={e => onChange({ kind: e.target.value as EntityTemplateSetKind })}
        >
          <option value="">— Select kind —</option>
          {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Enabled">
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={data.enabled ?? true}
            onChange={e => onChange({ enabled: e.target.checked })}
          />
          Surface this set in the wizard
        </label>
      </FieldRow>
      <FieldRow label="Sort Order">
        <input
          type="number"
          className={inputClass}
          value={data.sortOrder ?? 0}
          onChange={e => onChange({ sortOrder: Number(e.target.value) })}
        />
      </FieldRow>
    </>
  )
}
