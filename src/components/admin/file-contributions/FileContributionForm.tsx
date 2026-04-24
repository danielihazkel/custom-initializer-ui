import type { AdminFileContribution, AdminDependencyEntry, AdminSubOption, FileType, SubstitutionType } from '../../../types'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'
import { COMMON_DEP_ID } from '../shared/adminConstants'
import { CodeEditor } from './CodeEditor'

const FILE_TYPES: FileType[] = ['STATIC_COPY', 'YAML_MERGE', 'TEMPLATE', 'DELETE']
const SUB_TYPES: SubstitutionType[] = ['NONE', 'MUSTACHE']
const SUB_TYPE_HINTS: Record<SubstitutionType, string> = {
  NONE: 'No substitution — content is written verbatim.',
  MUSTACHE: 'Variables: {{artifactId}}, {{groupId}}, {{version}}, {{packageName}}, {{packagePath}}, {{javaVersion}}, {{packaging}}. Sections: {{#hasKafka}}…{{/hasKafka}}, {{#optKafkaConsumerExample}}…{{/optKafkaConsumerExample}}. Use {{packagePath}} in Target Path too.',
}

interface Props {
  data: Partial<AdminFileContribution>
  errors: Record<string, string>
  onChange: (updates: Partial<AdminFileContribution>) => void
  dependencyEntries: AdminDependencyEntry[]
  subOptions: AdminSubOption[]
  javaVersions: string[]
}

export function FileContributionForm({ data, errors, onChange, dependencyEntries, subOptions, javaVersions }: Props) {
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
      <FieldRow label="File Type" required error={errors.fileType}>
        <select
          className={selectClass}
          value={data.fileType ?? ''}
          onChange={e => onChange({ fileType: e.target.value as FileType })}
        >
          <option value="">— Select type —</option>
          {FILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Target Path" required error={errors.targetPath} hint='May use {{packagePath}} — e.g. src/main/java/{{packagePath}}/config/MyConfig.java'>
        <input
          className={inputClass}
          value={data.targetPath ?? ''}
          onChange={e => onChange({ targetPath: e.target.value })}
          placeholder="src/main/resources/application.yaml"
        />
      </FieldRow>
      {data.fileType === 'TEMPLATE' && (
        <FieldRow label="Substitution Type" hint={SUB_TYPE_HINTS[data.substitutionType ?? 'NONE']}>
          <select
            className={selectClass}
            value={data.substitutionType ?? 'NONE'}
            onChange={e => onChange({ substitutionType: e.target.value as SubstitutionType })}
          >
            {SUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FieldRow>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Java Version" hint="Leave blank for all versions">
          <select
            className={selectClass}
            value={data.javaVersion ?? ''}
            onChange={e => onChange({ javaVersion: e.target.value })}
          >
            <option value="">All versions</option>
            {javaVersions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Sub-Option ID" hint="Only apply when this sub-option is selected">
          <select
            className={selectClass}
            value={data.subOptionId ?? ''}
            onChange={e => onChange({ subOptionId: e.target.value })}
          >
            <option value="">None</option>
            {subOptions.map(so => <option key={`${so.dependencyId}-${so.optionId}`} value={so.optionId}>{so.label} ({so.dependencyId}/{so.optionId})</option>)}
          </select>
        </FieldRow>
      </div>
      <FieldRow label="Sort Order">
        <input
          type="number"
          className={inputClass}
          value={data.sortOrder ?? 0}
          onChange={e => onChange({ sortOrder: parseInt(e.target.value) || 0 })}
        />
      </FieldRow>
      <FieldRow label="Content" error={errors.content} hint={`${(data.content ?? '').length} characters`}>
        {data.fileType === 'DELETE' ? (
          <p className="text-xs italic px-3 py-2 border border-outline-variant rounded opacity-50">
            No content needed for DELETE contributions.
          </p>
        ) : (
          <CodeEditor
            value={data.content ?? ''}
            onChange={content => onChange({ content })}
            targetPath={data.targetPath ?? ''}
          />
        )}
      </FieldRow>
    </>
  )
}
