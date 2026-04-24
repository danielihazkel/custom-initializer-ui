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
  const isRequired = ['groupId', 'artifactId', 'name', 'packageName'].includes(id);
  const showError = isRequired && value.trim() === '';

  return (
    <div className="relative group">
      <input
        id={id}
        className={`peer w-full bg-surface-container-high border rounded-xl px-4 pt-6 pb-2 text-sm text-on-surface outline-none transition-all placeholder-transparent shadow-sm ${showError ? 'border-error/50 focus:ring-2 focus:ring-error/30 focus:border-error' : 'border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary'}`}
        type="text"
        placeholder={label}
        value={value}
        onChange={onChange}
      />
      <label
        htmlFor={id}
        className={`absolute left-4 top-2 text-[10px] uppercase font-bold transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:normal-case peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-[10px] peer-focus:uppercase peer-focus:font-bold cursor-text pointer-events-none ${showError ? 'text-error peer-placeholder-shown:text-error/70 peer-focus:text-error' : 'text-primary peer-placeholder-shown:text-on-surface-variant peer-focus:text-primary'}`}
      >
        {label}
        {showError && <span className="ml-1 text-error">*</span>}
      </label>
      {showError && (
        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-error" style={{ fontSize: '18px' }}>
          error
        </span>
      )}
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
