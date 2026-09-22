import { defaultDepartmentId, useDepartments } from '../../hooks/useDepartments'

interface Props {
  id: string
  /** The chosen department id; '' = the server's default department. */
  value: string
  onChange: (departmentId: string) => void
  className: string
}

/**
 * The department picker shared by the Backend, Frontend and Fullstack screens. The options come
 * from the admin-managed list (`/metadata/departments`); a blank value shows the default
 * department as selected, since that is what the server resolves blank to. A value that has since
 * left the list is kept visible as "(unknown)" rather than silently snapping to another entry.
 */
export function DepartmentSelect({ id, value, onChange, className }: Props) {
  const { departments, loading, error } = useDepartments()
  const effective = value || defaultDepartmentId(departments)
  const known = departments.some(d => d.id === effective)

  return (
    <select
      id={id}
      className={className}
      value={effective}
      disabled={loading && departments.length === 0}
      title={error ? `Could not load departments (${error}) — the default department is used` : undefined}
      onChange={e => onChange(e.target.value)}
      data-department-select
    >
      {departments.length === 0 && (
        <option value={effective}>{loading ? 'Loading…' : effective || 'Default department'}</option>
      )}
      {departments.length > 0 && !known && <option value={effective}>{effective} (unknown)</option>}
      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  )
}

/** The picker dressed as the floating-label inputs of the Backend and Frontend metadata forms. */
export function FloatingDepartmentSelect({ id, value, onChange }: Omit<Props, 'className'>) {
  return (
    <div className="relative">
      <DepartmentSelect
        id={id}
        value={value}
        onChange={onChange}
        className="w-full appearance-none bg-surface-container-high border border-outline-variant rounded-xl px-4 pt-6 pb-2 pr-10 text-sm text-on-surface outline-none transition-all shadow-sm focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
      />
      <label htmlFor={id} className="absolute left-4 top-2 text-[10px] uppercase font-bold text-primary pointer-events-none">
        Department
      </label>
      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" style={{ fontSize: '18px' }}>
        expand_more
      </span>
    </div>
  )
}
