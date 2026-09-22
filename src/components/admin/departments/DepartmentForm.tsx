import type { AdminDepartment } from '../../../types'
import { FieldRow, inputClass } from '../shared/FieldRow'

interface Props {
  data: Partial<AdminDepartment>
  errors: Record<string, string>
  onChange: (updates: Partial<AdminDepartment>) => void
}

export function DepartmentForm({ data, errors, onChange }: Props) {
  return (
    <>
      <FieldRow label="Department ID" required error={errors.departmentId}
                hint="Lower-case slug rendered into templates as {{department}}: k8s namespace, image repo, cert secret (e.g. lts)">
        <input
          className={inputClass}
          value={data.departmentId ?? ''}
          onChange={e => onChange({ departmentId: e.target.value })}
          placeholder="lts"
        />
      </FieldRow>
      <FieldRow label="Name" required error={errors.name} hint="Label shown in the Backend / Frontend / Fullstack pickers ({{departmentName}})">
        <input
          className={inputClass}
          value={data.name ?? ''}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="LTS"
        />
      </FieldRow>
      <FieldRow label="Default" hint="Used when a request names no department. Exactly one should be the default">
        <label className="inline-flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={data.isDefault ?? false}
            onChange={e => onChange({ isDefault: e.target.checked })}
          />
          <span>Mark as the default department</span>
        </label>
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
