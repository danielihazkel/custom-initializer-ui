import type { AdminStarterTemplate } from '../../../types'
import { FieldRow, inputClass } from '../shared/FieldRow'

interface Props {
  data: Partial<AdminStarterTemplate>
  errors: Record<string, string>
  onChange: (updates: Partial<AdminStarterTemplate>) => void
}

export function StarterTemplateForm({ data, errors, onChange }: Props) {
  return (
    <>
      <FieldRow label="Template ID" required error={errors.templateId} hint="URL-friendly slug (e.g. rest-api)">
        <input
          className={inputClass}
          value={data.templateId ?? ''}
          onChange={e => onChange({ templateId: e.target.value })}
          placeholder="rest-api"
        />
      </FieldRow>
      <FieldRow label="Name" required error={errors.name}>
        <input
          className={inputClass}
          value={data.name ?? ''}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="REST API Service"
        />
      </FieldRow>
      <FieldRow label="Description" error={errors.description}>
        <input
          className={inputClass}
          value={data.description ?? ''}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Spring Web + JPA + Actuator"
        />
      </FieldRow>
      <FieldRow label="Icon" hint="Material Symbols icon name (e.g. api, bolt, cloud)">
        <input
          className={inputClass}
          value={data.icon ?? ''}
          onChange={e => onChange({ icon: e.target.value })}
          placeholder="api"
        />
      </FieldRow>
      <FieldRow label="Color" hint="CSS color for card accent (e.g. #4CAF50)">
        <input
          className={inputClass}
          value={data.color ?? ''}
          onChange={e => onChange({ color: e.target.value })}
          placeholder="#4CAF50"
        />
      </FieldRow>
      <FieldRow label="Boot Version" hint="Optional override (leave blank for no override)">
        <input
          className={inputClass}
          value={data.bootVersion ?? ''}
          onChange={e => onChange({ bootVersion: e.target.value })}
          placeholder=""
        />
      </FieldRow>
      <FieldRow label="Java Version" hint="Optional override">
        <input
          className={inputClass}
          value={data.javaVersion ?? ''}
          onChange={e => onChange({ javaVersion: e.target.value })}
          placeholder=""
        />
      </FieldRow>
      <FieldRow label="Packaging" hint="Optional override (jar or war)">
        <input
          className={inputClass}
          value={data.packaging ?? ''}
          onChange={e => onChange({ packaging: e.target.value })}
          placeholder=""
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
