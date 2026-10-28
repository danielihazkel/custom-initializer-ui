import type { PreviewDataState } from '../layoutPreviewModel'

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile'

/** How much larger the canvas draws the preview than the editor's side panel does, by default. */
export const CANVAS_ZOOM = 1.35

/** The zoom steps the canvas's − / + walk through. */
export const ZOOM_LEVELS = [0.8, 1, 1.15, 1.35, 1.6, 1.9]

/** The next zoom step from `zoom` in `direction` (−1 smaller, +1 larger), clamped to the ends. */
export function nextZoom(zoom: number, direction: -1 | 1): number {
  const at = ZOOM_LEVELS.findIndex(z => Math.abs(z - zoom) < 0.001)
  const from = at >= 0 ? at : ZOOM_LEVELS.findIndex(z => z > zoom) - (direction > 0 ? 1 : 0)
  return ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, from + direction))]
}


/** The Desktop / Tablet / Mobile switch over a designer canvas. */
export function DeviceSwitch({ device, onChange }: { device: PreviewDevice; onChange: (device: PreviewDevice) => void }) {
  return (
    <span role="radiogroup" aria-label="Preview width" className="inline-flex overflow-hidden rounded-md border border-outline-variant">
      {([['desktop', 'Desktop', 'computer'], ['tablet', 'Tablet', 'tablet'], ['mobile', 'Mobile', 'smartphone']] as const).map(([value, label, icon]) => (
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

export const DATA_STATES: readonly PreviewDataState[] = ['data', 'empty', 'loading', 'error']

/** The Data / Empty / Loading / Error switch over a designer canvas: sample rows, or how the
 *  generated app draws its lists, charts and tiles with no rows, while they load, or on a failure. */
export function DataStateSwitch({ state, onChange }: { state: PreviewDataState; onChange: (state: PreviewDataState) => void }) {
  const options = [
    ['data', 'Data', 'table_rows', 'Sample rows'],
    ['empty', 'Empty', 'inbox', 'No rows yet'],
    ['loading', 'Loading', 'hourglass_empty', 'While the rows load'],
    ['error', 'Error', 'error', 'When the rows fail to load'],
  ] as const
  return (
    <span role="radiogroup" aria-label="Data state" className="inline-flex overflow-hidden rounded-md border border-outline-variant" data-canvas-data-state>
      {options.map(([value, label, icon, hint]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={state === value}
          aria-label={label}
          title={`${label} — ${hint}`}
          onClick={() => onChange(value)}
          className={`px-1.5 py-0.5 ${state === value ? 'bg-primary/15 text-on-surface' : 'text-secondary hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">{icon}</span>
        </button>
      ))}
    </span>
  )
}

/** − / percentage / + over a canvas; the percentage resets to the default zoom. */
export function ZoomControl({ zoom, onChange }: { zoom: number; onChange: (zoom: number) => void }) {
  const button = 'px-1.5 py-0.5 text-secondary hover:text-on-surface disabled:opacity-30'
  return (
    <span role="group" aria-label="Zoom" className="inline-flex items-center overflow-hidden rounded-md border border-outline-variant" data-canvas-zoom>
      <button type="button" className={button} onClick={() => onChange(nextZoom(zoom, -1))} disabled={zoom <= ZOOM_LEVELS[0]} aria-label="Zoom out" title="Zoom out">
        <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">remove</span>
      </button>
      <button
        type="button"
        className="min-w-[3rem] px-1 text-center font-mono text-[11px] text-on-surface hover:text-primary"
        onClick={() => onChange(CANVAS_ZOOM)}
        title="Reset the zoom"
        aria-label={`Zoom ${Math.round(zoom * 100)}% — reset`}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className={button} onClick={() => onChange(nextZoom(zoom, 1))} disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]} aria-label="Zoom in" title="Zoom in">
        <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">add</span>
      </button>
    </span>
  )
}

