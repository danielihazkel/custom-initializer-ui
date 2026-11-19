import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useModal } from '../../../hooks/useModal'

interface AdminFormDrawerProps {
  title: string
  isOpen: boolean
  onClose: () => void
  /** May reject to keep the drawer open — the form is expected to have shown the error itself.
   *  The rejection is swallowed here so it never surfaces as an unhandled promise. */
  onSave: () => Promise<void>
  saving: boolean
  /** Primary button copy; defaults to "Save" (and "Saving…" while `saving`). */
  saveLabel?: string
  savingLabel?: string
  /** The footer's Cancel and the header's close button; English by default (Config is not
   *  translated — the generator's wizard drawers pass their own). */
  cancelLabel?: string
  closeLabel?: string
  /** 'rtl' (a wizard drawer on the site in Hebrew): the drawer is at the left edge and reads right
   *  to left. Config's drawers stay 'ltr', whatever the page is. */
  dir?: 'ltr' | 'rtl'
  children: ReactNode
}

export function AdminFormDrawer({
  title, isOpen, onClose, onSave, saving, saveLabel = 'Save', savingLabel = 'Saving…',
  cancelLabel = 'Cancel', closeLabel = 'Close drawer', dir = 'ltr', children,
}: AdminFormDrawerProps) {
  const offscreen = dir === 'rtl' ? '-100%' : '100%'
  const drawerRef = useRef<HTMLDivElement>(null)

  // A form that throws from onSave (validation, failed parse) has already rendered its error;
  // without this guard the throw becomes a console "Uncaught (in promise)".
  const runSave = () => { onSave().catch(() => { /* surfaced inline by the form */ }) }

  // Escape closes (not while saving), Tab stays in the drawer, the page behind does not scroll
  // and focus returns to the opener. The first field is focused below, once the panel is in.
  useModal(drawerRef, { active: isOpen, onClose: saving ? undefined : onClose, initialFocus: false })

  // Cmd/Ctrl + Enter to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      const isCmdOrCtrl = e.metaKey || e.ctrlKey
      if (!saving && isCmdOrCtrl && e.key === 'Enter') {
        e.preventDefault()
        onSave().catch(() => { /* surfaced inline by the form */ })
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onSave, saving])

  // Auto-focus the first field
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      const firstInput = drawerRef.current.querySelector('input, textarea, select') as HTMLElement
      setTimeout(() => {
        if (firstInput) firstInput.focus()
        else drawerRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
            onClick={() => !saving && onClose()}
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            tabIndex={-1}
            dir={dir}
            lang={dir === 'ltr' ? 'en' : undefined}
            initial={{ x: offscreen }}
            animate={{ x: 0 }}
            exit={{ x: offscreen }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`fixed inset-y-0 ${dir === 'rtl' ? 'left-0' : 'right-0'} w-full sm:w-[520px] z-40 glass-drawer flex flex-col outline-none`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant flex-shrink-0">
              <h3 id="drawer-title" className="text-sm font-bold uppercase tracking-widest text-secondary">{title}</h3>
              <button
                onClick={onClose}
                className="p-1 rounded text-secondary hover:text-on-surface transition-colors"
                aria-label={closeLabel}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
              {children}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-outline-variant flex-shrink-0 bg-surface/50 backdrop-blur-sm">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-outline-variant text-secondary hover:text-on-surface hover:bg-surface-container-highest transition-all disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                onClick={runSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95 disabled:cursor-not-allowed animated-gradient-btn shadow-md flex items-center justify-center min-w-[90px]"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {savingLabel}
                  </span>
                ) : (
                  <span className="flex items-center justify-center w-full">{saveLabel}</span>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
