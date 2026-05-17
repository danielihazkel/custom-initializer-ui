import type { AdminBuildCustomization, AdminDependencyEntry, AdminSubOption, BuildCustomizationType } from '../../../types'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'
import { COMMON_DEP_ID } from '../shared/adminConstants'
import { useAdminKind } from '../AdminKindContext'

const BACKEND_TYPES: BuildCustomizationType[] = ['ADD_DEPENDENCY', 'EXCLUDE_DEPENDENCY', 'ADD_REPOSITORY']
const FRONTEND_TYPES: BuildCustomizationType[] = ['ADD_NPM_DEPENDENCY', 'ADD_NPM_SCRIPT', 'ADD_VITE_PLUGIN']

interface Props {
  data: Partial<AdminBuildCustomization>
  isEditing: boolean
  errors: Record<string, string>
  onChange: (updates: Partial<AdminBuildCustomization>) => void
  dependencyEntries: AdminDependencyEntry[]
  subOptions: AdminSubOption[]
}

export function BuildCustomizationForm({ data, isEditing, errors, onChange, dependencyEntries, subOptions }: Props) {
  const { kind } = useAdminKind()
  const type = data.customizationType
  const types = kind === 'FRONTEND' ? FRONTEND_TYPES : BACKEND_TYPES
  const matchingSubOptions = subOptions.filter(s => s.dependencyId === data.dependencyId)

  return (
    <>
      <FieldRow label="Dependency ID" required error={errors.dependencyId} hint='Use __common__ for rules that apply to every generated project'>
        <select
          className={selectClass}
          value={data.dependencyId ?? ''}
          onChange={e => onChange({ dependencyId: e.target.value })}
        >
          <option value="">— Select —</option>
          <option value={COMMON_DEP_ID}>{COMMON_DEP_ID} (all projects)</option>
          {dependencyEntries.map(d => <option key={d.depId} value={d.depId}>{d.name} ({d.depId})</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Customization Type" required error={errors.customizationType}>
        <select
          className={selectClass}
          value={data.customizationType ?? ''}
          onChange={e => onChange({ customizationType: e.target.value as BuildCustomizationType })}
          disabled={isEditing}
        >
          <option value="">— Select type —</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
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

      {type === 'ADD_NPM_DEPENDENCY' && (
        <div className="space-y-4 border-t border-outline-variant pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">npm Package</p>
          <FieldRow label="Package Name" required error={errors.mavenArtifactId}>
            <input className={inputClass} value={data.mavenArtifactId ?? ''} onChange={e => onChange({ mavenArtifactId: e.target.value })} placeholder="react-router-dom" />
          </FieldRow>
          <FieldRow label="Version" required error={errors.version} hint="semver range written into package.json verbatim">
            <input className={inputClass} value={data.version ?? ''} onChange={e => onChange({ version: e.target.value })} placeholder="^6.26.0" />
          </FieldRow>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.scope === 'dev'}
              onChange={e => onChange({ scope: e.target.checked ? 'dev' : '' })}
              className="w-4 h-4 rounded border-outline-variant accent-primary"
            />
            <span className="text-sm text-on-surface">devDependency (goes under <code>devDependencies</code>)</span>
          </label>
        </div>
      )}

      {type === 'ADD_NPM_SCRIPT' && (
        <div className="space-y-4 border-t border-outline-variant pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">package.json script</p>
          <FieldRow label="Script Name" required error={errors.mavenArtifactId} hint="Later rows with the same name override earlier ones, so admins can replace baseline scripts">
            <input className={inputClass} value={data.mavenArtifactId ?? ''} onChange={e => onChange({ mavenArtifactId: e.target.value })} placeholder="lint:fix" />
          </FieldRow>
          <FieldRow label="Command" required error={errors.version}>
            <input className={inputClass} value={data.version ?? ''} onChange={e => onChange({ version: e.target.value })} placeholder="eslint . --fix" />
          </FieldRow>
        </div>
      )}

      {type === 'ADD_VITE_PLUGIN' && (
        <div className="space-y-4 border-t border-outline-variant pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Vite plugin</p>
          <FieldRow label="Import Path" required error={errors.mavenGroupId} hint="The module Vite imports the plugin from">
            <input className={inputClass} value={data.mavenGroupId ?? ''} onChange={e => onChange({ mavenGroupId: e.target.value })} placeholder="@vitejs/plugin-react" />
          </FieldRow>
          <FieldRow label="Import Binding" required error={errors.mavenArtifactId} hint="Local name used in vite.config.ts (e.g. react, vue, tsconfigPaths)">
            <input className={inputClass} value={data.mavenArtifactId ?? ''} onChange={e => onChange({ mavenArtifactId: e.target.value })} placeholder="react" />
          </FieldRow>
          <FieldRow label="Plugin Call" required error={errors.version} hint="Expression placed inside plugins[]">
            <input className={inputClass} value={data.version ?? ''} onChange={e => onChange({ version: e.target.value })} placeholder="react()" />
          </FieldRow>
        </div>
      )}

      {kind === 'FRONTEND' && matchingSubOptions.length > 0 && (
        <FieldRow
          label="Sub-Option (optional)"
          hint="If set, this customization only applies when the user picks this sub-option under the parent dependency."
        >
          <select
            className={selectClass}
            value={data.subOptionId ?? ''}
            onChange={e => onChange({ subOptionId: e.target.value })}
          >
            <option value="">— Always apply —</option>
            {matchingSubOptions.map(s => (
              <option key={s.optionId} value={s.optionId}>{s.label} ({s.optionId})</option>
            ))}
          </select>
        </FieldRow>
      )}

      <FieldRow label="Sort Order">
        <input type="number" className={inputClass} value={data.sortOrder ?? 0} onChange={e => onChange({ sortOrder: parseInt(e.target.value) || 0 })} />
      </FieldRow>
    </>
  )
}
