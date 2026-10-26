import { useEffect, useRef, type ReactNode } from 'react'
import { ICON_BUTTON } from './constants'

/** The layout preview as a slide-over, for widths where it cannot sit beside the page list. */
export function PreviewDrawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Modal for real: Tab stays inside, and focus goes back where it was when it closes.
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), select, input, [tabindex="0"]'))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex justify-end" data-preview-drawer>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Layout preview" className="relative flex h-full w-full max-w-md flex-col gap-2 overflow-y-auto bg-surface-container-lowest p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-secondary">
            <span className="font-semibold uppercase tracking-wider">Preview</span> · sample data · click a part to edit it
          </p>
          <button type="button" onClick={onClose} className={ICON_BUTTON} aria-label="Close the preview" autoFocus>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
