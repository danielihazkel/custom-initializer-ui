import type { ProjectFormProps, ProjectFormValues } from '../types'

export function ProjectForm({ values, onChange, isDark }: ProjectFormProps) {
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

  const inputClass = isDark
    ? 'w-full bg-surface-container border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all'
    : 'w-full bg-white border border-outline-variant rounded-lg px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all'

  const labelClass = isDark
    ? 'block text-[11px] text-secondary-fixed'
    : 'block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-0.5'

  return (
    <div className="space-y-4 pt-4">
      <span className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-secondary' : "font-['Geist_Mono'] text-[10px] text-on-surface-variant"}`}>Project Metadata</span>
      <div className="grid grid-cols-2 gap-4 mt-3">
        <div className="space-y-1.5">
          <label className={labelClass}>Group</label>
          <input className={inputClass} type="text" value={values.groupId} onChange={handle('groupId')} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Artifact</label>
          <input className={inputClass} type="text" value={values.artifactId} onChange={handle('artifactId')} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className={labelClass}>Name</label>
          <input className={inputClass} type="text" value={values.name} onChange={handle('name')} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className={labelClass}>Description</label>
          <input className={inputClass} type="text" value={values.description} onChange={handle('description')} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className={labelClass}>Package name</label>
          <input className={inputClass} type="text" value={values.packageName} onChange={handle('packageName')} />
        </div>
      </div>
    </div>
  )
}
