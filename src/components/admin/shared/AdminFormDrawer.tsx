import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface AdminFormDrawerProps {
  title: string
  isOpen: boolean
  onClose: () => void
  onSave: () => Promise<void>
  saving: boolean
  children: ReactNode
}

export function AdminFormDrawer({ title, isOpen, onClose, onSave, saving, children }: AdminFormDrawerProps) {
  return createPortal(
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[520px] z-40 bg-surface/95 backdrop-blur-md border-l border-outline-variant shadow-[0_0_40px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant flex-shrink-0">
          <h3 className="text-sm font-bold uppercase tracking-widest text-secondary">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-secondary hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
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
      </div>
    </>,
    document.body
  )
}
