import { useState } from 'react'
import { getDesignSystemEntries, type FrontendMetadata, type FeColorPalette } from '../../hooks/useFrontendMetadata'
import { DESIGN_NONE } from '../../hooks/useFrontendState'

interface Props {
  metadata: FrontendMetadata
  reactVersion: string
  nodeVersion: string
  packageManager: string
  basePath: string
  designSystem: string
  colorPaletteId: string
  apiBaseUrl: string
  backendArtifactId: string
  onReactVersionChange: (v: string) => void
  onNodeVersionChange: (v: string) => void
  onPackageManagerChange: (v: string) => void
  onBasePathChange: (v: string) => void
  onDesignSystemChange: (v: string) => void
  onColorPaletteChange: (v: string) => void
  onApiBaseUrlChange: (v: string) => void
  onBackendArtifactIdChange: (v: string) => void
  hidePairedBackendSection?: boolean
}

// Palette injection only colorizes themed design systems (MUI / Chakra / Mantine).
// design-none has no theme file; design-shadcn ships its own Tailwind-based tokens.
const PALETTE_AWARE_DESIGN_SYSTEMS = new Set(['design-mui', 'design-chakra', 'design-mantine'])

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

function PalettePicker({
  palettes,
  selectedId,
  onChange,
}: {
  palettes: FeColorPalette[]
  selectedId: string
  onChange: (id: string) => void
}) {
  if (palettes.length === 0) return null
  const selected = palettes.find(p => p.id === selectedId) ?? palettes[0]
  return (
    <div>
      <span className="block text-[10px] uppercase font-bold tracking-widest text-primary mb-1.5">
        Color Palette
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        {palettes.map(p => {
          const active = p.id === selected.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              title={p.name}
              aria-label={p.name}
              aria-pressed={active}
              className={`relative w-9 h-9 rounded-full border border-outline-variant overflow-hidden transition-all ${
                active ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : 'hover:scale-105'
              }`}
              style={{
                background: `linear-gradient(135deg, ${p.primary} 0%, ${p.primary} 50%, ${p.secondary} 50%, ${p.secondary} 100%)`,
              }}
            />
          )
        })}
      </div>
      <p className="text-[11px] text-secondary mt-1.5 px-0.5">{selected.name}</p>
    </div>
  )
}

export function OptionsPanelFE({
  metadata,
  reactVersion,
  nodeVersion,
  packageManager,
  basePath,
  designSystem,
  colorPaletteId,
  apiBaseUrl,
  backendArtifactId,
  onReactVersionChange,
  onNodeVersionChange,
  onPackageManagerChange,
  onBasePathChange,
  onDesignSystemChange,
  onColorPaletteChange,
  onApiBaseUrlChange,
  onBackendArtifactIdChange,
  hidePairedBackendSection = false,
}: Props) {
  const designEntries = getDesignSystemEntries(metadata)
  const designOptions = designEntries.length
    ? designEntries.map(e => ({ id: e.id, name: e.name }))
    : [{ id: DESIGN_NONE, name: 'None / Plain CSS' }]
  const showPalettePicker = PALETTE_AWARE_DESIGN_SYSTEMS.has(designSystem)
  // Open the pair section by default when something is already set so user state is visible.
  const [pairOpen, setPairOpen] = useState(Boolean(apiBaseUrl || backendArtifactId))
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
      <Dropdown
        label="Design System"
        value={designSystem}
        options={designOptions}
        onChange={onDesignSystemChange}
      />
      {showPalettePicker && (metadata.colorPalettes?.length ?? 0) > 0 && (
        <PalettePicker
          palettes={metadata.colorPalettes}
          selectedId={colorPaletteId}
          onChange={onColorPaletteChange}
        />
      )}
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

      {!hidePairedBackendSection && (
      <div className="border-t border-outline-variant pt-4">
        <button
          type="button"
          onClick={() => setPairOpen(o => !o)}
          aria-expanded={pairOpen}
          className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-primary hover:text-on-surface transition-colors"
        >
          <span
            className="material-symbols-outlined transition-transform"
            style={{ fontSize: '16px', transform: pairOpen ? 'rotate(90deg)' : 'none' }}
          >
            chevron_right
          </span>
          Paired Backend (optional)
        </button>
        {pairOpen && (
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="block text-[10px] uppercase font-bold tracking-widest text-primary mb-1.5">
                API Base URL
              </span>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={e => onApiBaseUrlChange(e.target.value)}
                placeholder="http://localhost:8080"
                className="w-full bg-surface-container-high border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
              <span className="block text-[11px] text-secondary mt-1 px-0.5">
                Writes <code>.env.development</code> and a <code>/api</code> proxy in <code>vite.config.ts</code>.
              </span>
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase font-bold tracking-widest text-primary mb-1.5">
                Backend ArtifactId
              </span>
              <input
                type="text"
                value={backendArtifactId}
                onChange={e => onBackendArtifactIdChange(e.target.value)}
                placeholder="demo-api"
                className="w-full bg-surface-container-high border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
              <span className="block text-[11px] text-secondary mt-1 px-0.5">
                Mentioned in the generated README only.
              </span>
            </label>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
