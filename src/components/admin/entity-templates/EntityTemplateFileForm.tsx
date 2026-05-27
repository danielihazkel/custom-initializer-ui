import type { AdminEntityTemplateFile, EntityTemplateFileType, SubstitutionType } from '../../../types'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'
import { CodeEditor } from '../file-contributions/CodeEditor'

interface Props {
  data: Partial<AdminEntityTemplateFile>
  errors: Record<string, string>
  onChange: (updates: Partial<AdminEntityTemplateFile>) => void
}

const FILE_TYPES: EntityTemplateFileType[] = ['TEMPLATE', 'STATIC_COPY']
const SUB_TYPES: SubstitutionType[] = ['MUSTACHE', 'NONE']

export function EntityTemplateFileForm({ data, errors, onChange }: Props) {
  return (
    <>
      <FieldRow label="Path Template" required error={errors.pathTemplate}
                hint="Mustache; per-entity files can use {{EntityName}}, {{entityNameKebab}} etc.">
        <input
          type="text"
          className={inputClass}
          value={data.pathTemplate ?? ''}
          onChange={e => onChange({ pathTemplate: e.target.value })}
          placeholder="src/main/java/{{packagePath}}/{{EntityName}}.java"
        />
      </FieldRow>
      <FieldRow label="Per Entity">
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={data.perEntity ?? false}
            onChange={e => onChange({ perEntity: e.target.checked })}
          />
          Render once for each user-supplied entity
        </label>
      </FieldRow>
      <FieldRow label="File Type" required>
        <select
          className={selectClass}
          value={data.fileType ?? 'TEMPLATE'}
          onChange={e => onChange({ fileType: e.target.value as EntityTemplateFileType })}
        >
          {FILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Substitution" required>
        <select
          className={selectClass}
          value={data.substitutionType ?? 'MUSTACHE'}
          onChange={e => onChange({ substitutionType: e.target.value as SubstitutionType })}
        >
          {SUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Sort Order">
        <input
          type="number"
          className={inputClass}
          value={data.sortOrder ?? 0}
          onChange={e => onChange({ sortOrder: Number(e.target.value) })}
        />
      </FieldRow>
      <FieldRow label="Content" error={errors.content}>
        <CodeEditor
          value={data.content ?? ''}
          onChange={v => onChange({ content: v })}
          targetPath={data.pathTemplate ?? ''}
        />
      </FieldRow>
    </>
  )
}
