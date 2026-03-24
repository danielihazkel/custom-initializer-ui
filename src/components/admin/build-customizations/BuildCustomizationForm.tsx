import type { AdminBuildCustomization, BuildCustomizationType } from '../../../types'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'

const CUST_TYPES: BuildCustomizationType[] = ['ADD_DEPENDENCY', 'EXCLUDE_DEPENDENCY', 'ADD_REPOSITORY']

interface Props {
  data: Partial<AdminBuildCustomization>
  isEditing: boolean
  errors: Record<string, string>
  onChange: (updates: Partial<AdminBuildCustomization>) => void
}

export function BuildCustomizationForm({ data, isEditing, errors, onChange }: Props) {
  const type = data.customizationType

  return (
    <>
      <FieldRow label="Dependency ID" required error={errors.dependencyId} hint='Use __common__ for rules that apply to every generated project'>
        <input
          className={inputClass}
          value={data.dependencyId ?? ''}
          onChange={e => onChange({ dependencyId: e.target.value })}
          placeholder="kafka or __common__"
        />
      </FieldRow>
      <FieldRow label="Customization Type" required error={errors.customizationType}>
        <select
          className={selectClass}
          value={data.customizationType ?? ''}
          onChange={e => onChange({ customizationType: e.target.value as BuildCustomizationType })}
          disabled={isEditing}
        >
          <option value="">— Select type —</option>
          {CUST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {isEditing && (
          <p className="text-[10px] text-secondary mt-1">Delete and recreate to change the type.</p>
        )}
      </FieldRow>

      {(type === 'ADD_DEPENDENCY' || type === 'EXCLUDE_DEPENDENCY') && (
        <div className="space-y-4 border-t border-outline-variant pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Maven Coordinates</p>
          <FieldRow label="Maven Group ID" required error={errors.mavenGroupId}>
            <input className={inputClass} value={data.mavenGroupId ?? ''} onChange={e => onChange({ mavenGroupId: e.target.value })} placeholder="org.springframework.boot" />
          </FieldRow>
          <FieldRow label="Maven Artifact ID" required error={errors.mavenArtifactId}>
            <input className={inputClass} value={data.mavenArtifactId ?? ''} onChange={e => onChange({ mavenArtifactId: e.target.value })} placeholder="spring-boot-starter-log4j2" />
          </FieldRow>
          <FieldRow label="Version" hint="Leave blank to inherit from BOM">
            <input className={inputClass} value={data.version ?? ''} onChange={e => onChange({ version: e.target.value })} placeholder="3.2.1" />
          </FieldRow>
        </div>
      )}

      {type === 'EXCLUDE_DEPENDENCY' && (
        <div className="space-y-4 border-t border-outline-variant pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Exclude From</p>
          <FieldRow label="Exclude From Group ID" required error={errors.excludeFromGroupId}>
            <input className={inputClass} value={data.excludeFromGroupId ?? ''} onChange={e => onChange({ excludeFromGroupId: e.target.value })} placeholder="org.springframework.boot" />
          </FieldRow>
          <FieldRow label="Exclude From Artifact ID" required error={errors.excludeFromArtifactId}>
            <input className={inputClass} value={data.excludeFromArtifactId ?? ''} onChange={e => onChange({ excludeFromArtifactId: e.target.value })} placeholder="spring-boot-starter" />
          </FieldRow>
        </div>
      )}

      {type === 'ADD_REPOSITORY' && (
        <div className="space-y-4 border-t border-outline-variant pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Repository</p>
          <FieldRow label="Repository ID" required error={errors.repoId}>
            <input className={inputClass} value={data.repoId ?? ''} onChange={e => onChange({ repoId: e.target.value })} placeholder="menora-release" />
          </FieldRow>
          <FieldRow label="Repository Name">
            <input className={inputClass} value={data.repoName ?? ''} onChange={e => onChange({ repoName: e.target.value })} placeholder="Menora Artifactory Releases" />
          </FieldRow>
          <FieldRow label="Repository URL" required error={errors.repoUrl}>
            <input className={inputClass} value={data.repoUrl ?? ''} onChange={e => onChange({ repoUrl: e.target.value })} placeholder="https://repo.menora.co.il/artifactory/libs-release" />
          </FieldRow>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.snapshotsEnabled ?? false}
              onChange={e => onChange({ snapshotsEnabled: e.target.checked })}
              className="w-4 h-4 rounded border-outline-variant accent-primary"
            />
            <span className="text-sm text-on-surface">Snapshots enabled</span>
          </label>
        </div>
      )}

      <FieldRow label="Sort Order">
        <input type="number" className={inputClass} value={data.sortOrder ?? 0} onChange={e => onChange({ sortOrder: parseInt(e.target.value) || 0 })} />
      </FieldRow>
    </>
  )
}
