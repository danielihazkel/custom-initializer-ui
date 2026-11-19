import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { isRtl, t } from '../../i18n'

/** A stop of a tour: the part it points at, and what to say about it. */
export interface TourStep {
  /** Selector inside the tour's root; a step whose part is not on screen is skipped. */
  anchor: string
  title: string
  body: string
}

/** Whether this browser has seen (or skipped) the tour kept under `storageKey`. */
export function tourSeen(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === 'done'
  } catch {
    return true
  }
}

function markTourSeen(storageKey: string) {
  try { localStorage.setItem(storageKey, 'done') } catch { /* the tour may show again; harmless */ }
}

interface Box { top: number; left: number; width: number; height: number }

const CARD_WIDTH = 288
const GAP = 10

interface Props {
  /** Where the anchors are looked up — the designer's dialog, or the document for a page tour. */
  root: HTMLElement | Document | null
  steps: TourStep[]
  /** `localStorage` key under which "done" is kept. */
  storageKey: string
  /** Names the dialog: "Designer tour", "Backend tour". */
  label: string
  /** A page scrolls, a full-screen dialog does not: bring each part into view before pointing at it. */
  scrollIntoView?: boolean
  onClose: () => void
}

/**
 * A short coach-mark tour: a spotlight on one part at a time with a card saying what it is for,
 * Back / Next / Skip and step dots. Escape skips; the arrows step (in reading order: in Hebrew,
 * ← is the next step). Finishing or skipping marks
 * it seen, so it opens by itself only once per browser; a Help menu can run it again.
 *
 * It began as the layout designer's tour (`designer/DesignerTour.tsx`, now a wrapper) and is
 * shared by the generator tabs.
 */
export function CoachTour({ root, steps, storageKey, label, scrollIntoView = false, onClose }: Props) {
  // The steps whose part is on screen — the tour skips a folded pane rather than point at nothing.
  // Looked up once mounted, not while rendering: a part rendered in the same pass as the tour is
  // not in the document yet at that point, and the tour would find nothing and close.
  const [found, setFound] = useState<TourStep[] | null>(null)
  const shown = found ?? []
  const [at, setAt] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const opener = useRef(document.activeElement as HTMLElement | null)
  const step = shown[Math.min(at, shown.length - 1)]

  useLayoutEffect(() => {
    if (!step) return
    const el = root?.querySelector<HTMLElement>(step.anchor)
    if (scrollIntoView && el) {
      // The window only: scrollIntoView would also move any clipped ancestor (see scroll.ts).
      const r = el.getBoundingClientRect()
      if (r.top < 80 || r.bottom > window.innerHeight - 40) {
        window.scrollTo({ top: Math.max(0, r.top + window.scrollY - window.innerHeight / 3) })
      }
    }
    const measure = () => {
      const r = root?.querySelector<HTMLElement>(step.anchor)?.getBoundingClientRect()
      setBox(r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [root, step, scrollIntoView])

  // On opening (once the card exists) and on every step: the primary button has the keyboard.
  useEffect(() => {
    cardRef.current?.querySelector<HTMLElement>('[data-tour-primary]')?.focus({ preventScroll: true })
  }, [at, found])

  useLayoutEffect(() => {
    const present = steps.filter(s => root?.querySelector(s.anchor))
    setFound(present)
    // Nothing to show (every anchor folded away): it counts as seen, and closes.
    if (present.length === 0) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, [])

  function finish() {
    markTourSeen(storageKey)
    onClose()
    opener.current?.focus?.({ preventScroll: true })
  }

  // The arrow that points along the reading direction goes forward.
  const rtl = isRtl()
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
  const backward = rtl ? 'ArrowRight' : 'ArrowLeft'

  function onKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    // The tour owns the keyboard while it is open: nothing reaches the page's own keys.
    e.stopPropagation()
    if (e.key === 'Tab') {
      // Tab stays on the card's buttons.
      const buttons = Array.from(cardRef.current?.querySelectorAll<HTMLElement>('button') ?? [])
      const i = buttons.indexOf(document.activeElement as HTMLElement)
      const to = e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i + 1) % buttons.length
      e.preventDefault()
      buttons[to]?.focus()
    } else if (e.key === 'Escape') { e.preventDefault(); finish() }
    else if (e.key === forward && at < shown.length - 1) { e.preventDefault(); setAt(at + 1) }
    else if (e.key === backward && at > 0) { e.preventDefault(); setAt(at - 1) }
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
  // Lined up with the part's start edge: its left in English, its right in Hebrew.
  const startLeft = !box ? vw / 2 - CARD_WIDTH / 2 : rtl ? box.left + box.width - CARD_WIDTH : box.left
  const cardLeft = Math.max(GAP, Math.min(startLeft, vw - CARD_WIDTH - GAP))
  const bodyId = `${storageKey.replace(/[^a-z0-9]/gi, '-')}-tour-body`

  return (
    <div className="fixed inset-0" style={{ zIndex: 70 }} data-coach-tour>
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
        aria-modal="true"
        aria-label={`${label} — ${step.title}`}
        aria-describedby={bodyId}
        onKeyDown={onKey}
        className="fixed space-y-2 rounded-xl border border-outline-variant bg-surface-container p-4 text-xs shadow-xl dialog-enter"
        style={{ top: cardTop, left: cardLeft, width: CARD_WIDTH }}
        data-tour-step={at}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">{t('Tour · {n} of {total}', { n: at + 1, total: shown.length })}</p>
        <h2 className="text-sm font-semibold text-on-surface">{step.title}</h2>
        <p id={bodyId} className="text-secondary leading-relaxed">{step.body}</p>
        <div className="flex items-center gap-2 pt-1">
          <span className="flex gap-1" aria-hidden="true">
            {shown.map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === at ? 'bg-primary' : 'bg-outline-variant'}`} />)}
          </span>
          <button type="button" onClick={finish} className="ms-auto rounded-md px-2 py-1 font-semibold text-secondary hover:text-on-surface">{t('Skip')}</button>
          {at > 0 && (
            <button type="button" onClick={() => setAt(at - 1)} className="rounded-md border border-outline-variant px-2 py-1 font-semibold text-on-surface">{t('Back')}</button>
          )}
          <button
            type="button"
            onClick={() => (last ? finish() : setAt(at + 1))}
            className="rounded-md bg-primary px-3 py-1 font-semibold text-on-primary"
            data-tour-primary
          >
            {last ? t('Done') : t('Next')}
          </button>
        </div>
      </div>
    </div>
  )
}
