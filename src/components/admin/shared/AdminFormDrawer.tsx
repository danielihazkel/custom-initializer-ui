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

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Simple focus trap: focus the drawer when opened to capture keyboard events
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      setTimeout(() => drawerRef.current?.focus(), 50)
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
            onClick={onClose}
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
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
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
                className="px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed animated-gradient-btn shadow-md"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
