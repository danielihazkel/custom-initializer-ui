import type { FeColorPalette } from '../../hooks/useFrontendMetadata'

/**
 * Swatch row for choosing a seeded colour palette — shared by the Frontend tab's options panel
 * and the Fullstack tab. Each swatch is a primary/secondary split circle; the selected one gets a
 * ring and its name is printed below.
 */
export function PalettePicker({
  palettes,
  selectedId,
  onChange,
  label = 'Color Palette',
  caption,
}: {
  palettes: FeColorPalette[]
  selectedId: string
  onChange: (id: string) => void
  label?: string
  /** Optional line under the selected name (e.g. "set default"). */
  caption?: React.ReactNode
}) {
  if (palettes.length === 0) return null
  const selected = palettes.find(p => p.id === selectedId) ?? palettes[0]
  return (
    <div>
      <span className="block text-[10px] uppercase font-bold tracking-widest text-primary mb-1.5">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label={label}>
        {palettes.map(p => {
          const active = p.id === selected.id
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              onClick={() => onChange(p.id)}
              title={p.name}
              aria-label={p.name}
              aria-checked={active}
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
      <p className="text-[11px] text-secondary mt-1.5 px-0.5">
        {selected.name}
        {caption && <span className="ml-1.5 text-secondary/70">{caption}</span>}
      </p>
    </div>
  )
}
