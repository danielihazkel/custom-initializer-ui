import type { AdminModuleTemplate } from '../../../types'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'

interface Props {
  data: Partial<AdminModuleTemplate>
  errors: Record<string, string>
  onChange: (updates: Partial<AdminModuleTemplate>) => void
  packagings: string[]
}

export function ModuleTemplateForm({ data, errors, onChange, packagings }: Props) {
  return (
    <>
      <FieldRow label="Module ID" required error={errors.moduleId} hint="Unique slug (e.g. api, core, persistence)">
        <input
          className={inputClass}
          value={data.moduleId ?? ''}
          onChange={e => onChange({ moduleId: e.target.value })}
          placeholder="api"
        />
      </FieldRow>
      <FieldRow label="Label" required error={errors.label}>
        <input
          className={inputClass}
          value={data.label ?? ''}
          onChange={e => onChange({ label: e.target.value })}
          placeholder="API Module"
        />
      </FieldRow>
      <FieldRow label="Description" error={errors.description}>
        <input
          className={inputClass}
          value={data.description ?? ''}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="REST controllers and application entry point"
        />
      </FieldRow>
      <FieldRow label="Suffix" required error={errors.suffix} hint="Appended to artifactId (e.g. -api → myapp-api)">
        <input
          className={inputClass}
          value={data.suffix ?? ''}
          onChange={e => onChange({ suffix: e.target.value })}
          placeholder="-api"
        />
      </FieldRow>
      <FieldRow label="Packaging" hint="jar or war">
        <select
          className={selectClass}
          value={data.packaging ?? 'jar'}
          onChange={e => onChange({ packaging: e.target.value })}
        >
          {packagings.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Has Main Class" hint="Only one module should get the @SpringBootApplication class">
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={data.hasMainClass ?? false}
            onChange={e => onChange({ hasMainClass: e.target.checked })}
            className="accent-primary"
          />
          This module contains the application entry point
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
