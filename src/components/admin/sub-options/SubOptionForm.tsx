import type { AdminSubOption } from '../../../types'
import { FieldRow, inputClass } from '../shared/FieldRow'

interface Props {
  data: Partial<AdminSubOption>
  errors: Record<string, string>
  onChange: (updates: Partial<AdminSubOption>) => void
}

export function SubOptionForm({ data, errors, onChange }: Props) {
  return (
    <>
      <FieldRow label="Dependency ID" required error={errors.dependencyId} hint="Must match the depId of an existing dependency entry (e.g. kafka)">
        <input
          className={inputClass}
          value={data.dependencyId ?? ''}
          onChange={e => onChange({ dependencyId: e.target.value })}
          placeholder="kafka"
        />
      </FieldRow>
      <FieldRow label="Option ID" required error={errors.optionId} hint="Unique identifier for this sub-option (e.g. consumer-example)">
        <input
          className={inputClass}
          value={data.optionId ?? ''}
          onChange={e => onChange({ optionId: e.target.value })}
          placeholder="consumer-example"
        />
      </FieldRow>
      <FieldRow label="Label" required error={errors.label}>
        <input
          className={inputClass}
          value={data.label ?? ''}
          onChange={e => onChange({ label: e.target.value })}
          placeholder="Consumer Example"
        />
      </FieldRow>
      <FieldRow label="Description" error={errors.description}>
        <input
          className={inputClass}
          value={data.description ?? ''}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Add a KafkaConsumerExample.java class"
        />
      </FieldRow>
      <FieldRow label="Sort Order">
        <input
          type="number"
          className={inputClass}
          value={data.sortOrder ?? 0}
          onChange={e => onChange({ sortOrder: parseInt(e.target.value) || 0 })}
        />
      </FieldRow>
    </>
  )
}
