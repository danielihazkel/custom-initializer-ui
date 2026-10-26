import type { ReactNode } from 'react'

export type PreviewDevice = 'desktop' | 'mobile'

/** How much larger the canvas draws the preview than the editor's side panel does. */
export const CANVAS_ZOOM = 1.35

/** The Desktop / Mobile switch over a designer canvas. */
export function DeviceSwitch({ device, onChange }: { device: PreviewDevice; onChange: (device: PreviewDevice) => void }) {
  return (
    <span role="radiogroup" aria-label="Preview width" className="inline-flex overflow-hidden rounded-md border border-outline-variant">
      {([['desktop', 'Desktop', 'computer'], ['mobile', 'Mobile', 'smartphone']] as const).map(([value, label, icon]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={device === value}
          aria-label={label}
          title={`${label} width`}
          onClick={() => onChange(value)}
          className={`px-1.5 py-0.5 ${device === value ? 'bg-primary/15 text-on-surface' : 'text-secondary hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">{icon}</span>
        </button>
      ))}
    </span>
  )
}

/** The dotted canvas a preview sits on, at the designer's zoom, desktop or phone wide. */
export function CanvasFrame({ device, children }: { device: PreviewDevice; children: ReactNode }) {
  return (
    <div
      className="min-h-0 flex-1 overflow-auto bg-background p-6 [background-image:radial-gradient(var(--color-outline-variant)_1px,transparent_1px)] [background-size:16px_16px]"
      data-designer-canvas
    >
      <div className={`mx-auto ${device === 'mobile' ? 'max-w-[18rem]' : 'max-w-[56rem]'}`} style={{ zoom: CANVAS_ZOOM }}>
        {children}
      </div>
    </div>
  )
}
