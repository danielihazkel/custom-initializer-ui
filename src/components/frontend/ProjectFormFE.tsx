import type { FeForm } from '../../hooks/useFrontendState'

interface Props {
  values: FeForm
  onChange: (patch: Partial<FeForm>) => void
}

function FloatingInput({
  id,
  label,
  value,
  required,
  onChange,
}: {
  id: keyof FeForm
  label: string
  value: string
  required?: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const showError = required && value.trim() === ''
  return (
    <div className="relative group">
      <input
        id={id}
        className={`peer w-full bg-surface-container-high border rounded-xl px-4 pt-6 pb-2 text-sm text-on-surface outline-none transition-all placeholder-transparent shadow-sm ${
          showError
            ? 'border-error/50 focus:ring-2 focus:ring-error/30 focus:border-error'
            : 'border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary'
        }`}
        type="text"
        placeholder={label}
        value={value}
        onChange={onChange}
      />
      <label
        htmlFor={id}
        className={`absolute left-4 top-2 text-[10px] uppercase font-bold transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:normal-case peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-[10px] peer-focus:uppercase peer-focus:font-bold cursor-text pointer-events-none ${
          showError
            ? 'text-error peer-placeholder-shown:text-error/70 peer-focus:text-error'
            : 'text-primary peer-placeholder-shown:text-on-surface-variant peer-focus:text-primary'
        }`}
      >
        {label}
        {showError && <span className="ml-1 text-error">*</span>}
      </label>
    </div>
  )
}

export function ProjectFormFE({ values, onChange }: Props) {
  function handle(field: keyof FeForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      const updates: Partial<FeForm> = { [field]: val }
      if (field === 'projectName') {
        // Auto-derive appTitle from projectName (title-case) when user hasn't typed a custom title.
        const derived = val
          .split(/[-_\s]+/)
          .filter(Boolean)
          .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
          .join(' ')
        // Only override appTitle if it currently matches the previous auto-derivation
        // (i.e. the user hasn't typed something custom).
        const prevDerived = values.projectName
          .split(/[-_\s]+/)
          .filter(Boolean)
          .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
          .join(' ')
        if (values.appTitle === prevDerived || values.appTitle === '') {
          updates.appTitle = derived
        }
      }
      onChange(updates)
    }
  }

  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>
          web
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
          Project Metadata
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="col-span-1">
          <FloatingInput
            id="scope"
            label="Scope (optional, no @)"
            value={values.scope}
            onChange={handle('scope')}
          />
        </div>
        <div className="col-span-1">
          <FloatingInput
            id="projectName"
            label="Project Name"
            value={values.projectName}
            required
            onChange={handle('projectName')}
          />
        </div>
        <div className="col-span-2">
          <FloatingInput
            id="appTitle"
            label="App Title (browser tab)"
            value={values.appTitle}
            onChange={handle('appTitle')}
          />
        </div>
        <div className="col-span-2">
          <FloatingInput
            id="description"
            label="Description"
            value={values.description}
            onChange={handle('description')}
          />
        </div>
      </div>
      <p className="text-[11px] text-secondary px-1">
        npm name will be{' '}
        <code className="text-on-surface">
          {values.scope ? `@${values.scope}/${values.projectName || 'demo'}` : values.projectName || 'demo'}
        </code>
      </p>
    </div>
  )
}
