import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { FullstackStarterRequest } from '../../../types'
import type { PreviewDataState } from '../layoutPreviewModel'
import { PreviewFrame, type Compiled, type DesignIntent } from '../../../designRuntime/PreviewFrame'
import type { DesignState, Rect } from '../../../designRuntime/protocol'
import { useAppPreview } from '../../../designRuntime/useAppPreview'
import { CANVAS_ZOOM, type PreviewDevice } from './CanvasFrame'

/** The window the app is laid out in, per device, before it is scaled to the canvas: the
 *  generated shells switch to their desktop layout at Tailwind's lg (1024px). */
export const APP_VIEWPORT: Record<PreviewDevice, number> = { desktop: 1280, tablet: 820, mobile: 390 }

/**
 * The generated app itself on the designer's canvas: the model is generated (the same
 * `/starter-fullstack.preview` the zip comes from) and its frontend runs in the sandboxed
 * preview runtime against sample data, at a device's window width scaled to fit. Every click,
 * save and transition does what the app does. `fallback` (the sketch) is drawn until the app
 * has compiled once — so the canvas is never empty while it starts — and instead of it when the
 * app cannot run here: no request and no app yet (the layout has problems), a generator error
 * before any app, or no runtime (with the reason). Once an app has run, a request that cannot be
 * made (problems to fix) or fails keeps it on screen, marked as the last one that generated.
 *
 * With `design`, the runtime's editing layer is on: the app's clicks pick parts, and the
 * gestures come back as intents. `anchor` turns a rect of the runtime's (a widget toolbar) into
 * an element on this page, for a menu to open under.
 */
export interface CanvasDesign {
  state: DesignState
  onIntent: (intent: DesignIntent, anchor: (rect: Rect) => HTMLElement) => void
}

export function AppCanvas({ request, device, zoom = CANVAS_ZOOM, hash, dataState = 'data', onRoute, fallback, emptyReason, design }: {
  request: FullstackStarterRequest | null
  device: PreviewDevice
  zoom?: number
  hash?: string
  dataState?: PreviewDataState
  onRoute?: (hash: string) => void
  fallback: ReactNode
  /** Why there is no request, shown over the fallback. */
  emptyReason?: string
  design?: CanvasDesign
}) {
  const preview = useAppPreview(request)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [compiled, setCompiled] = useState<Compiled | null>(null)
  const [crash, setCrash] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  const reason = unavailable ?? (preview.app ? null : request == null ? emptyReason ?? null : preview.error)
  // The sketch stays on the canvas until the app has compiled once; the runtime starts under it.
  const live = reason == null && compiled != null
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => setSize({ w: el.clientWidth - 48, h: el.clientHeight - 48 })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [reason != null])
  // A new app clears the last one's crash.
  useEffect(() => setCrash(null), [preview.app?.ref])

  const viewport = APP_VIEWPORT[device]
  const fit = size.w > 0 ? Math.min(1, size.w / viewport) : 1
  const scale = fit * (zoom / CANVAS_ZOOM)
  const height = Math.max(480, Math.round((size.h > 0 ? size.h : 720) / scale))

  const status = reason && request != null
    ? `Showing the sketch: ${reason}`
    : !live
      ? null
      : crash
        ? `The app stopped: ${crash}`
        : !compiled.ok
          ? `${compiled.errors.length} file${compiled.errors.length === 1 ? '' : 's'} did not compile — ${compiled.errors[0].path}: ${compiled.errors[0].message}`
          : preview.error
            ? `Showing the last app that generated — ${preview.error}`
            : request == null && emptyReason
              ? `Showing the last app that generated — ${emptyReason}`
              : null

  /** A fixed element over the runtime's `rect` (its viewport px, scaled onto this page). */
  function anchor(rect: Rect): HTMLElement {
    const el = anchorRef.current!
    const frame = box.current?.querySelector('iframe')?.getBoundingClientRect()
    Object.assign(el.style, {
      left: `${(frame?.left ?? 0) + rect.x * scale}px`,
      top: `${(frame?.top ?? 0) + rect.y * scale}px`,
      width: `${rect.w * scale}px`,
      height: `${rect.h * scale}px`,
    })
    return el
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" data-app-canvas={live ? 'app' : 'sketch'}>
      {status && (
        <p aria-live="polite" className="border-b border-outline-variant bg-surface-container-low px-4 py-1 text-[11px] text-secondary" data-app-canvas-status>
          {status}
        </p>
      )}
      {!live && <div className="flex min-h-0 flex-1 flex-col">{fallback}</div>}
      <span ref={anchorRef} aria-hidden="true" className="pointer-events-none fixed" data-app-canvas-anchor />
      {reason == null && (
        <div
          ref={box}
          className={live
            ? 'min-h-0 flex-1 overflow-auto bg-background p-6 [background-image:radial-gradient(var(--color-outline-variant)_1px,transparent_1px)] [background-size:16px_16px]'
            : 'pointer-events-none invisible absolute inset-0 overflow-hidden p-6'}
          aria-hidden={!live}
          data-designer-canvas={live ? '' : undefined}
        >
          <div className="relative mx-auto overflow-hidden rounded-xl shadow-lg ring-1 ring-outline-variant" style={{ width: viewport * scale, height: height * scale }} data-canvas-device={device}>
            <PreviewFrame
              app={preview.app}
              hash={hash}
              dataState={dataState}
              onRoute={onRoute}
              onCompiled={setCompiled}
              onRuntimeError={message => setCrash(message)}
              onUnavailable={setUnavailable}
              design={design?.state ?? null}
              onDesign={design ? intent => design.onIntent(intent, anchor) : undefined}
              title="The generated app"
              style={{ width: viewport, height, transform: `scale(${scale})`, transformOrigin: '0 0', background: 'white' }}
            />
            {live && preview.loading && (
              <div className="pointer-events-none absolute end-3 top-3 rounded-full bg-surface-container-lowest p-1.5 shadow" title="Generating the app again…" data-app-canvas-busy>
                <span className="material-symbols-outlined block animate-spin text-primary" style={{ fontSize: '18px' }} aria-hidden="true">progress_activity</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
