import type { AdminDependencyGroup } from '../../../types'
import { FieldRow, inputClass } from '../shared/FieldRow'

interface Props {
  data: Partial<AdminDependencyGroup>
  errors: Record<string, string>
  onChange: (updates: Partial<AdminDependencyGroup>) => void
}

export function DependencyGroupForm({ data, errors, onChange }: Props) {
  return (
    <>
      <FieldRow label="Name" required error={errors.name}>
        <input
          className={inputClass}
          value={data.name ?? ''}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="e.g. Messaging"
        />
      </FieldRow>
      <FieldRow label="Sort Order" error={errors.sortOrder}>
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
