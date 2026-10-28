import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'

/** A stop of the designer tour: the part it points at, and what to say about it. */
export interface TourStep {
  /** Selector inside the designer; a step whose part is not on screen (a folded pane, no pages) is skipped. */
  anchor: string
  title: string
  body: string
}

export const DESIGNER_TOUR: TourStep[] = [
  {
    anchor: '[data-designer-library]',
    title: 'The library',
    body: 'Page types, widgets and whole-layout templates. Click a card to add it, or drag it onto the canvas or the page strip. Press / to search it.',
  },
  {
    anchor: '[data-page-strip]',
    title: 'Your pages',
    body: 'Every page of the app in menu order. Click one to open it, drag to reorder, right-click for more; Ctrl- or Shift-click picks several at once.',
  },
  {
    anchor: '[data-designer-canvas]',
    title: 'The canvas',
    body: 'The page as the generated app draws it, with sample rows. Click a part to edit it, double-click a title to rename it, drag a widget’s edge to resize it.',
  },
  {
    anchor: 'aside[aria-label="Inspector"]',
    title: 'Settings',
    body: 'Everything about the selected page or widget: its basics, its layout, who may open it, and the code it generates.',
  },
  {
    anchor: '[data-canvas-mode]',
    title: 'Play',
    body: 'Click through the layout as its users will — rows, tiles and charts go where the app goes. P switches between Design and Play.',
  },
  {
    anchor: '[data-designer-issues-toggle]',
    title: 'Problems and tips',
    body: 'What would stop Generate, and advice on the layout — each with a jump to the part, and often a one-click fix.',
  },
]

const STORAGE_KEY = 'fullstack:designerTour'

/** Whether this browser has seen (or skipped) the tour. */
export function tourSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'done'
  } catch {
    return true
  }
}

function markTourSeen() {
  try { localStorage.setItem(STORAGE_KEY, 'done') } catch { /* the tour may show again; harmless */ }
}

interface Box { top: number; left: number; width: number; height: number }

const CARD_WIDTH = 288
const GAP = 10

/**
 * A short coach-mark tour of the designer: a spotlight on one part at a time with a card saying
 * what it is for, Back / Next / Skip and step dots. Escape skips; the arrows step. Finishing or
 * skipping marks it seen, so it opens by itself only once per browser; the help menu runs it again.
 */
export function DesignerTour({ root, steps = DESIGNER_TOUR, onClose }: { root: HTMLElement | null; steps?: TourStep[]; onClose: () => void }) {
  // The steps whose part is on screen now — the tour skips a folded pane rather than point at nothing.
  const [shown] = useState(() => steps.filter(s => root?.querySelector(s.anchor)))
  const [at, setAt] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const opener = useRef(document.activeElement as HTMLElement | null)
  const step = shown[Math.min(at, shown.length - 1)]

  useLayoutEffect(() => {
    if (!step) return
    const measure = () => {
      const el = root?.querySelector<HTMLElement>(step.anchor)
      const r = el?.getBoundingClientRect()
      setBox(r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [root, step])

  useEffect(() => {
    cardRef.current?.querySelector<HTMLElement>('[data-tour-primary]')?.focus()
  }, [at])

  useEffect(() => {
    // Nothing to show (every anchor folded away): it counts as seen, and closes.
    if (shown.length === 0) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, [])

  function finish() {
    markTourSeen()
    onClose()
    opener.current?.focus?.()
  }

  function onKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    // The tour owns the keyboard while it is open: nothing reaches the designer's own keys.
    e.stopPropagation()
    if (e.key === 'Tab') {
      // Tab stays on the card's buttons.
      const buttons = Array.from(cardRef.current?.querySelectorAll<HTMLElement>('button') ?? [])
      const i = buttons.indexOf(document.activeElement as HTMLElement)
      const to = e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i + 1) % buttons.length
      e.preventDefault()
      buttons[to]?.focus()
    } else if (e.key === 'Escape') { e.preventDefault(); finish() }
    else if (e.key === 'ArrowRight' && at < shown.length - 1) { e.preventDefault(); setAt(at + 1) }
    else if (e.key === 'ArrowLeft' && at > 0) { e.preventDefault(); setAt(at - 1) }
  }

  if (!step) return null
  const last = at === shown.length - 1
  // The card sits under the part when there is room, else above it, else over its middle; always on screen.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const cardTop = !box ? vh / 3
    : box.top + box.height + GAP + 180 <= vh ? box.top + box.height + GAP
      : box.top - GAP - 180 >= 0 ? box.top - GAP - 180
        : Math.max(GAP, box.top + box.height / 2 - 90)
  const cardLeft = Math.max(GAP, Math.min((box ? box.left : vw / 2 - CARD_WIDTH / 2), vw - CARD_WIDTH - GAP))

  return (
    <div className="fixed inset-0" style={{ zIndex: 70 }} data-designer-tour>
      {/* The spotlight: everything but the part is dimmed. */}
      <div
        className="pointer-events-none fixed rounded-lg ring-2 ring-primary transition-all duration-200"
        style={box
          ? { top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8, boxShadow: '0 0 0 9999px rgba(10, 10, 20, 0.5)' }
          : { inset: 0, boxShadow: 'inset 0 0 0 9999px rgba(10, 10, 20, 0.5)' }}
        aria-hidden="true"
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-label={`Designer tour — ${step.title}`}
        aria-describedby="designer-tour-body"
        onKeyDown={onKey}
        className="fixed space-y-2 rounded-xl border border-outline-variant bg-surface-container p-4 text-xs shadow-xl"
        style={{ top: cardTop, left: cardLeft, width: CARD_WIDTH }}
        data-tour-step={at}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Tour · {at + 1} of {shown.length}</p>
        <h2 className="text-sm font-semibold text-on-surface">{step.title}</h2>
        <p id="designer-tour-body" className="text-secondary">{step.body}</p>
        <div className="flex items-center gap-2 pt-1">
          <span className="flex gap-1" aria-hidden="true">
            {shown.map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === at ? 'bg-primary' : 'bg-outline-variant'}`} />)}
          </span>
          <button type="button" onClick={finish} className="ms-auto rounded-md px-2 py-1 font-semibold text-secondary hover:text-on-surface">Skip</button>
          {at > 0 && (
            <button type="button" onClick={() => setAt(at - 1)} className="rounded-md border border-outline-variant px-2 py-1 font-semibold text-on-surface">Back</button>
          )}
          <button
            type="button"
            onClick={() => (last ? finish() : setAt(at + 1))}
            className="rounded-md bg-primary px-3 py-1 font-semibold text-on-primary"
            data-tour-primary
          >
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
