import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface AdminFormDrawerProps {
  title: string
  isOpen: boolean
  onClose: () => void
  onSave: () => Promise<void>
  saving: boolean
  children: ReactNode
}

export function AdminFormDrawer({ title, isOpen, onClose, onSave, saving, children }: AdminFormDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)

  // Escape to close and Cmd/Ctrl + Enter to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (!saving && e.key === 'Escape') onClose()

      const isCmdOrCtrl = e.metaKey || e.ctrlKey
      if (!saving && isCmdOrCtrl && e.key === 'Enter') {
        e.preventDefault()
        onSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, onSave, saving])

  // Focus trap and auto-focus first input
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      const firstInput = drawerRef.current.querySelector('input, textarea, select') as HTMLElement
      setTimeout(() => {
        if (firstInput) firstInput.focus()
        else drawerRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  // Lock background page scrolling
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[520px] z-40 glass-drawer flex flex-col outline-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant flex-shrink-0">
              <h3 id="drawer-title" className="text-sm font-bold uppercase tracking-widest text-secondary">{title}</h3>
              <button
                onClick={onClose}
                className="p-1 rounded text-secondary hover:text-on-surface transition-colors"
                aria-label="Close drawer"
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
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95 disabled:cursor-not-allowed animated-gradient-btn shadow-md flex items-center justify-center min-w-[90px]"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving…
                  </span>
                ) : (
                  <span className="flex items-center justify-center w-full">Save</span>
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
