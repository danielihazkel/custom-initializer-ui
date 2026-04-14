import type { AdminDependencyEntry, AdminDependencyGroup } from '../../../types'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'
import { MAVEN_SCOPES, REPOSITORIES } from '../shared/adminConstants'

interface Props {
  data: Partial<AdminDependencyEntry>
  groups: AdminDependencyGroup[]
  errors: Record<string, string>
  depIdsWithPomEntry: Set<string>
  onChange: (updates: Partial<AdminDependencyEntry>) => void
}

export function DependencyEntryForm({ data, groups, errors, depIdsWithPomEntry, onChange }: Props) {
  const depIdAddsPomViaCustomization = !!data.depId && depIdsWithPomEntry.has(data.depId)
  const fileOnly = data.starter === false

  const toggleFileOnly = (next: boolean) => {
    if (next) {
      onChange({ starter: false, mavenGroupId: '', mavenArtifactId: '', version: '', scope: '', repository: '' })
    } else {
      onChange({ starter: true })
    }
  }

  return (
    <>
      <FieldRow label="Group" required error={errors.group}>
        <select
          className={selectClass}
          value={data.group?.id ?? ''}
          onChange={e => onChange({ group: { id: parseInt(e.target.value) } })}
        >
          <option value="">— Select a group —</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Dependency ID" required error={errors.depId} hint="Unique slug used in URLs and file-contribution rules (e.g. kafka)">
        <input
          className={inputClass}
          value={data.depId ?? ''}
          onChange={e => onChange({ depId: e.target.value })}
          placeholder="kafka"
        />
      </FieldRow>
      <FieldRow label="Display Name" required error={errors.name}>
        <input
          className={inputClass}
          value={data.name ?? ''}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Spring for Apache Kafka"
        />
      </FieldRow>
      <FieldRow label="Description" error={errors.description}>
        <input
          className={inputClass}
          value={data.description ?? ''}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Short description shown in the UI"
        />
      </FieldRow>
      <div className="border-t border-outline-variant pt-4">
        <label className="flex items-start gap-2 mb-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-1"
            checked={fileOnly}
            onChange={e => toggleFileOnly(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium">File-only option</span>
            <span className="block text-xs text-on-surface-variant">No pom dependency is added — this entry only contributes files/sub-options when selected.</span>
          </span>
        </label>
        {fileOnly && depIdAddsPomViaCustomization && (
          <p className="mb-4 text-xs text-error">
            Heads up: a build customization (ADD_DEPENDENCY) already references <code>{data.depId}</code>, so a pom entry will still be added when this option is selected. Remove that customization in the Build Customizations tab to make this truly file-only.
          </p>
        )}
        {!fileOnly && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-3">Maven Coordinates (optional — leave blank for Spring-managed deps)</p>
            <div className="space-y-4">
              <FieldRow label="Maven Group ID">
                <input className={inputClass} value={data.mavenGroupId ?? ''} onChange={e => onChange({ mavenGroupId: e.target.value })} placeholder="org.apache.kafka" />
              </FieldRow>
              <FieldRow label="Maven Artifact ID">
                <input className={inputClass} value={data.mavenArtifactId ?? ''} onChange={e => onChange({ mavenArtifactId: e.target.value })} placeholder="kafka-clients" />
              </FieldRow>
              <FieldRow label="Version">
                <input className={inputClass} value={data.version ?? ''} onChange={e => onChange({ version: e.target.value })} placeholder="3.6.0" />
              </FieldRow>
              <FieldRow label="Scope" hint="Leave blank to omit the <scope> element (maven then applies compile by default)">
                <select className={selectClass} value={data.scope ?? ''} onChange={e => onChange({ scope: e.target.value })}>
                  <option value="">— none —</option>
                  {MAVEN_SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Repository" hint='Leave blank to omit the <repository> element'>
                <select className={selectClass} value={data.repository ?? ''} onChange={e => onChange({ repository: e.target.value })}>
                  <option value="">— none —</option>
                  {REPOSITORIES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </FieldRow>
            </div>
          </>
        )}
        <div className={fileOnly ? '' : 'space-y-4 mt-4'}>
          <FieldRow label="Compatibility Range" hint='Spring Boot version range, e.g. [3.2.0,4.0.0) or 3.2.0 — blank = all versions'>
            <input className={inputClass} value={data.compatibilityRange ?? ''} onChange={e => onChange({ compatibilityRange: e.target.value })} placeholder="[3.2.0,4.0.0)" />
          </FieldRow>
        </div>
      </div>
      <FieldRow label="Sort Order">
        <input type="number" className={inputClass} value={data.sortOrder ?? 0} onChange={e => onChange({ sortOrder: parseInt(e.target.value) || 0 })} />
      </FieldRow>
    </>
  )
}
