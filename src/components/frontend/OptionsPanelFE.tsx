import type { FrontendMetadata } from '../../hooks/useFrontendMetadata'

interface Props {
  metadata: FrontendMetadata
  reactVersion: string
  nodeVersion: string
  packageManager: string
  basePath: string
  onReactVersionChange: (v: string) => void
  onNodeVersionChange: (v: string) => void
  onPackageManagerChange: (v: string) => void
  onBasePathChange: (v: string) => void
}

function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { id: string; name: string }[]
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase font-bold tracking-widest text-primary mb-1.5">
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-surface-container-high border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
      >
        {options.map(o => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function PillToggle({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { id: string; name: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div>
      <span className="block text-[10px] uppercase font-bold tracking-widest text-primary mb-1.5">
        {label}
      </span>
      <div className="inline-flex p-0.5 rounded-xl border border-outline-variant bg-surface-container-high">
        {options.map(o => {
          const active = o.id === value
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                active
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              {o.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function OptionsPanelFE({
  metadata,
  reactVersion,
  nodeVersion,
  packageManager,
  basePath,
  onReactVersionChange,
  onNodeVersionChange,
  onPackageManagerChange,
  onBasePathChange,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>
          tune
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
          Stack
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Dropdown
          label="React"
          value={reactVersion}
          options={metadata.reactVersions}
          onChange={onReactVersionChange}
        />
        <Dropdown
          label="Node"
          value={nodeVersion}
          options={metadata.nodeVersions}
          onChange={onNodeVersionChange}
        />
      </div>
      <PillToggle
        label="Package Manager"
        value={packageManager}
        options={metadata.packageManagers}
        onChange={onPackageManagerChange}
      />
      <label className="block">
        <span className="block text-[10px] uppercase font-bold tracking-widest text-primary mb-1.5">
          Base Path
        </span>
        <input
          type="text"
          value={basePath}
          onChange={e => onBasePathChange(e.target.value)}
          placeholder="/"
          className="w-full bg-surface-container-high border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </label>
      <p className="text-[11px] text-secondary px-1">
        TypeScript {metadata.pinned.typescript} · Vite {metadata.pinned.vite} (pinned)
      </p>
    </div>
  )
}
