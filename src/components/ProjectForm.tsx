import type { ProjectFormProps, ProjectFormValues } from '../types'

function FloatingInput({
  id,
  label,
  value,
  onChange,
}: {
  id: keyof ProjectFormValues,
  label: string,
  value: string,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
}) {
  return (
    <div className="relative group">
      <input
        id={id}
        className="peer w-full bg-surface-container-high border border-outline-variant rounded-xl px-4 pt-6 pb-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all placeholder-transparent shadow-sm"
        type="text"
        placeholder={label}
        value={value}
        onChange={onChange}
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-2 text-[10px] uppercase font-bold text-primary transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-on-surface-variant peer-placeholder-shown:normal-case peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-[10px] peer-focus:uppercase peer-focus:font-bold peer-focus:text-primary cursor-text pointer-events-none"
      >
        {label}
      </label>
    </div>
  )
}

export function ProjectForm({ values, onChange }: ProjectFormProps) {
  function handle(field: keyof ProjectFormValues) {
    return (e: React.ChangeEvent<HTMLInputElement>): void => {
      const val = e.target.value
      const updates: Partial<ProjectFormValues> = { [field]: val }

      if (field === 'artifactId') {
        updates.name = val
        updates.packageName = `${values.groupId}.${val}`.replace(/-/g, '_')
      }
      if (field === 'groupId') {
        updates.packageName = `${val}.${values.artifactId}`.replace(/-/g, '_')
      }

      onChange(updates)
    }
  }

  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>tune</span>
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface">Project Metadata</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="col-span-1">
          <FloatingInput id="groupId" label="Group" value={values.groupId} onChange={handle('groupId')} />
        </div>
        <div className="col-span-1">
          <FloatingInput id="artifactId" label="Artifact" value={values.artifactId} onChange={handle('artifactId')} />
        </div>
        <div className="col-span-2">
          <FloatingInput id="name" label="Name" value={values.name} onChange={handle('name')} />
        </div>
        <div className="col-span-2">
          <FloatingInput id="description" label="Description" value={values.description} onChange={handle('description')} />
        </div>
        <div className="col-span-2">
          <FloatingInput id="packageName" label="Package name" value={values.packageName} onChange={handle('packageName')} />
        </div>
      </div>
    </div>
  )
}
