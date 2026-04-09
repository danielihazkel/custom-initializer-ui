import type { AdminDependencyCompatibility, AdminDependencyEntry, RelationType } from '../../../types'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'

interface Props {
  data: Partial<AdminDependencyCompatibility>
  errors: Record<string, string>
  onChange: (updates: Partial<AdminDependencyCompatibility>) => void
  dependencyEntries: AdminDependencyEntry[]
}

export function CompatibilityForm({ data, errors, onChange, dependencyEntries }: Props) {
  return (
    <>
      <FieldRow label="Source Dependency ID" required error={errors.sourceDepId} hint="The dep that triggers this rule">
        <select
          className={selectClass}
          value={data.sourceDepId ?? ''}
          onChange={e => onChange({ sourceDepId: e.target.value })}
        >
          <option value="">— Select —</option>
          {dependencyEntries.map(d => <option key={d.depId} value={d.depId}>{d.name} ({d.depId})</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Target Dependency ID" required error={errors.targetDepId} hint="The dep this rule points to">
        <select
          className={selectClass}
          value={data.targetDepId ?? ''}
          onChange={e => onChange({ targetDepId: e.target.value })}
        >
          <option value="">— Select —</option>
          {dependencyEntries.map(d => <option key={d.depId} value={d.depId}>{d.name} ({d.depId})</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Relation Type" required error={errors.relationType}>
        <select
          className={selectClass}
          value={data.relationType ?? ''}
          onChange={e => onChange({ relationType: e.target.value as RelationType })}
        >
          <option value="">— select —</option>
          <option value="CONFLICTS">CONFLICTS — selecting both is an error</option>
          <option value="REQUIRES">REQUIRES — source needs target to work</option>
          <option value="RECOMMENDS">RECOMMENDS — target is suggested alongside source</option>
        </select>
      </FieldRow>
      <FieldRow label="Description" error={errors.description} hint="Shown to users in the warning banner">
        <input
          className={inputClass}
          value={data.description ?? ''}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Spring MVC and WebFlux use incompatible server models"
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
