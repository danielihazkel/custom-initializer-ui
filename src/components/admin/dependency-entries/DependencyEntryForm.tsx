import type { AdminDependencyEntry, AdminDependencyGroup } from '../../../types'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'

interface Props {
  data: Partial<AdminDependencyEntry>
  groups: AdminDependencyGroup[]
  errors: Record<string, string>
  onChange: (updates: Partial<AdminDependencyEntry>) => void
}

export function DependencyEntryForm({ data, groups, errors, onChange }: Props) {
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
          <FieldRow label="Scope" hint="e.g. runtime, test — leave blank for default (compile)">
            <input className={inputClass} value={data.scope ?? ''} onChange={e => onChange({ scope: e.target.value })} placeholder="runtime" />
          </FieldRow>
          <FieldRow label="Repository" hint='e.g. menora-release — leave blank for Maven Central'>
            <input className={inputClass} value={data.repository ?? ''} onChange={e => onChange({ repository: e.target.value })} placeholder="menora-release" />
          </FieldRow>
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
